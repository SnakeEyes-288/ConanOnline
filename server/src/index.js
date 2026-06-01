import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { Server } from 'socket.io';
import { createRoomStore } from './roomStore.js';

const DEFAULT_PORT = Number(process.env.PORT ?? 4000);
const DEFAULT_CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const SAFE_ERROR_MESSAGE = 'Something went wrong.';
const NOT_IN_ROOM_MESSAGE = 'Not in a room.';
const KNOWN_ERROR_MESSAGES = new Set([
  NOT_IN_ROOM_MESSAGE,
  'Room is not joinable',
  'Room is full',
  'Player not found',
  'Only host can start match',
  'Match already started',
  'Round deck is incomplete',
  'Round is not accepting answers',
  'Room not found',
  'Unable to create room code',
  'Round character not found'
]);

export function createConanServer({ port = DEFAULT_PORT, clientOrigin = DEFAULT_CLIENT_ORIGIN, store } = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST']
    }
  });
  const roomStore = store ?? createRoomStore();
  const roundTimers = new Map();
  const revealTimers = new Map();
  const sessions = new Map();
  const sockets = new Map();

  app.use(cors({ origin: clientOrigin }));

  app.get('/health', (_request, response) => {
    response.json({ ok: true, service: 'conan-online-server' });
  });

  function rememberSocket(socket, { room, player }, sessionId) {
    const participant = { roomCode: room.code, playerId: player.id, sessionId: sessionId ?? null };
    sockets.set(socket.id, participant);

    if (sessionId) {
      sessions.set(sessionId, { roomCode: room.code, playerId: player.id });
    }
  }

  function detachSocket(socket) {
    const previous = sockets.get(socket.id);
    sockets.delete(socket.id);

    if (!previous) {
      return;
    }

    socket.leave(previous.roomCode);

    try {
      const room = roomStore.disconnect({
        code: previous.roomCode,
        socketId: socket.id,
        playerId: previous.playerId
      });
      emitRoom(room.code, 'room:update', { room });
    } catch (error) {
      logUnexpectedError(error);
    }
  }

  function getParticipant(socket) {
    const participant = sockets.get(socket.id);
    if (!participant) {
      throw new Error(NOT_IN_ROOM_MESSAGE);
    }

    return participant;
  }

  function emitRoom(roomCode, event, payload) {
    io.to(roomCode).emit(event, payload);
  }

  function matchPayload(room) {
    return { room, round: room.currentRound };
  }

  function toSafeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (KNOWN_ERROR_MESSAGES.has(message)) {
      return { message };
    }

    logUnexpectedError(error);
    return { message: SAFE_ERROR_MESSAGE };
  }

  function logUnexpectedError(error) {
    console.error('Unexpected Conan server error:', error);
  }

  function emitError(socket, error) {
    socket.emit('app:error', toSafeError(error));
  }

  function emitRoomError(roomCode, error) {
    emitRoom(roomCode, 'app:error', toSafeError(error));
  }

  function clearRoundTimer(roomCode) {
    clearTimeout(roundTimers.get(roomCode));
    roundTimers.delete(roomCode);
  }

  function clearRevealTimer(roomCode) {
    clearTimeout(revealTimers.get(roomCode));
    revealTimers.delete(roomCode);
  }

  function clearRoomTimers(roomCode) {
    clearRoundTimer(roomCode);
    clearRevealTimer(roomCode);
  }

  function clearAllTimers() {
    for (const roomCode of roundTimers.keys()) {
      clearRoundTimer(roomCode);
    }
    for (const roomCode of revealTimers.keys()) {
      clearRevealTimer(roomCode);
    }
  }

  function scheduleRound(room) {
    const roomCode = room.code;
    clearRoundTimer(roomCode);

    const deadline = room.currentRound?.acceptsAnswersUntil;
    if (!deadline) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        roundTimers.delete(roomCode);
        const revealedRoom = roomStore.expireRound({ code: roomCode });
        emitRoom(roomCode, 'match:reveal', { room: revealedRoom });

        if (revealedRoom.status === 'revealing') {
          scheduleReveal(revealedRoom);
        }
      } catch (error) {
        emitRoomError(roomCode, error);
      }
    }, Math.max(0, deadline - Date.now()));
    timer.unref?.();

    roundTimers.set(roomCode, timer);
  }

  function scheduleReveal(room) {
    const roomCode = room.code;
    clearRevealTimer(roomCode);

    const deadline = room.currentRound?.revealEndsAt;
    if (!deadline) {
      return;
    }

    const timer = setTimeout(() => {
      try {
        revealTimers.delete(roomCode);
        const nextRoom = roomStore.advanceAfterReveal({ code: roomCode });

        if (nextRoom.status === 'finished') {
          clearRoomTimers(roomCode);
          emitRoom(roomCode, 'match:final', { room: nextRoom });
          return;
        }

        emitRoom(roomCode, 'match:round', matchPayload(nextRoom));
        scheduleRound(nextRoom);
      } catch (error) {
        emitRoomError(roomCode, error);
      }
    }, Math.max(0, deadline - Date.now()));
    timer.unref?.();

    revealTimers.set(roomCode, timer);
  }

  io.on('connection', (socket) => {
    socket.on('session:resume', ({ sessionId } = {}) => {
      try {
        const session = sessionId ? sessions.get(sessionId) : null;
        if (!session) {
          return;
        }

        detachSocket(socket);
        const result = roomStore.reconnect({
          code: session.roomCode,
          playerId: session.playerId,
          sessionId,
          socketId: socket.id
        });
        socket.join(result.room.code);
        rememberSocket(socket, result, sessionId);
        socket.emit('session:resumed', { ...result, round: result.room.currentRound });
        emitRoom(result.room.code, 'room:update', { room: result.room });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('room:create', ({ nickname, sessionId } = {}) => {
      try {
        const result = roomStore.createRoom({ nickname, sessionId, socketId: socket.id });
        detachSocket(socket);
        socket.join(result.room.code);
        rememberSocket(socket, result, sessionId);
        socket.emit('room:created', result);
        emitRoom(result.room.code, 'room:update', { room: result.room });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('room:join', ({ roomCode, nickname, sessionId } = {}) => {
      try {
        const result = roomStore.joinRoom({ code: roomCode, nickname, sessionId, socketId: socket.id });
        detachSocket(socket);
        socket.join(result.room.code);
        rememberSocket(socket, result, sessionId);
        socket.emit('room:joined', result);
        emitRoom(result.room.code, 'room:update', { room: result.room });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('room:start', () => {
      try {
        const participant = getParticipant(socket);
        const room = roomStore.startMatch({ code: participant.roomCode, playerId: participant.playerId });
        clearRoomTimers(room.code);
        emitRoom(room.code, 'match:round', matchPayload(room));
        scheduleRound(room);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('answer:submit', ({ answerId } = {}) => {
      try {
        const participant = getParticipant(socket);
        const result = roomStore.submitAnswer({
          code: participant.roomCode,
          playerId: participant.playerId,
          answerId
        });
        const answerResult = {
          correct: result.correct,
          winsRound: result.winsRound,
          points: result.points
        };

        socket.emit('answer:result', answerResult);
        emitRoom(result.room.code, 'room:update', { room: result.room });

        if (result.winsRound) {
          clearRoundTimer(result.room.code);
          emitRoom(result.room.code, 'match:reveal', { room: result.room });
          scheduleReveal(result.room);
        }
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('disconnect', () => {
      const participant = sockets.get(socket.id);
      sockets.delete(socket.id);

      if (!participant) {
        return;
      }

      try {
        const room = roomStore.disconnect({
          code: participant.roomCode,
          socketId: socket.id,
          playerId: participant.playerId
        });
        emitRoom(room.code, 'room:update', { room });
      } catch (error) {
        logUnexpectedError(error);
      }
    });
  });

  return {
    app,
    server,
    io,
    start: () =>
      new Promise((resolve, reject) => {
        if (server.listening) {
          resolve(server);
          return;
        }

        server.once('error', reject);
        server.listen(port, () => {
          server.off('error', reject);
          resolve(server);
        });
      }),
    close: () =>
      new Promise((resolve) => {
        clearAllTimers();
        io.close(() => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close(() => resolve());
        });
      })
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const conanServer = createConanServer();
  conanServer.start().then(() => {
    console.log(`Conan Online server listening on port ${DEFAULT_PORT}`);
  });
}
