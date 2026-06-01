import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { createRoomStore } from './roomStore.js';

const port = Number(process.env.PORT ?? 4000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST']
  }
});
const store = createRoomStore();
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

function emitRoom(roomCode, event, payload) {
  io.to(roomCode).emit(event, payload);
}

function matchPayload(room) {
  return { room, round: room.currentRound };
}

function emitError(socket, error) {
  socket.emit('app:error', { message: error instanceof Error ? error.message : String(error) });
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
      const revealedRoom = store.expireRound({ code: roomCode });
      emitRoom(roomCode, 'match:reveal', { room: revealedRoom });

      if (revealedRoom.status === 'revealing') {
        scheduleReveal(revealedRoom);
      }
    } catch (error) {
      emitRoom(roomCode, 'app:error', { message: error.message });
    }
  }, Math.max(0, deadline - Date.now()));

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
      const nextRoom = store.advanceAfterReveal({ code: roomCode });

      if (nextRoom.status === 'finished') {
        clearRoomTimers(roomCode);
        emitRoom(roomCode, 'match:final', { room: nextRoom });
        return;
      }

      emitRoom(roomCode, 'match:round', matchPayload(nextRoom));
      scheduleRound(nextRoom);
    } catch (error) {
      emitRoom(roomCode, 'app:error', { message: error.message });
    }
  }, Math.max(0, deadline - Date.now()));

  revealTimers.set(roomCode, timer);
}

io.on('connection', (socket) => {
  socket.on('session:resume', ({ sessionId } = {}) => {
    try {
      const session = sessionId ? sessions.get(sessionId) : null;
      if (!session) {
        return;
      }

      const result = store.reconnect({
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
      const result = store.createRoom({ nickname, sessionId, socketId: socket.id });
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
      const result = store.joinRoom({ code: roomCode, nickname, sessionId, socketId: socket.id });
      socket.join(result.room.code);
      rememberSocket(socket, result, sessionId);
      socket.emit('room:joined', result);
      emitRoom(result.room.code, 'room:update', { room: result.room });
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on('room:start', ({ roomCode, playerId } = {}) => {
    try {
      const room = store.startMatch({ code: roomCode, playerId });
      clearRoomTimers(room.code);
      emitRoom(room.code, 'match:round', matchPayload(room));
      scheduleRound(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on('answer:submit', ({ roomCode, playerId, answerId } = {}) => {
    try {
      const result = store.submitAnswer({ code: roomCode, playerId, answerId });
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
      const room = store.disconnect({
        code: participant.roomCode,
        socketId: socket.id,
        playerId: participant.playerId
      });
      emitRoom(room.code, 'room:update', { room });
    } catch {
      // A stale socket mapping should not bring down the realtime server.
    }
  });
});

server.listen(port, () => {
  console.log(`Conan Online server listening on port ${port}`);
});
