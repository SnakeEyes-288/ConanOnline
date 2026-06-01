import { characters, getCharacterById } from '@conan-online/shared';
import {
  MATCH_ROUNDS,
  MAX_PLAYERS,
  REVEAL_SECONDS,
  ROUND_SECONDS,
  createRoundDeck,
  normalizeText,
  scoreAttempt
} from '@conan-online/shared/gameRules.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_NICKNAME = 'Detective';

export function createRoomStore(options = {}) {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const deckFactory = options.deckFactory ?? ((count) => createRoundDeck(count, characters, random));
  const rooms = new Map();
  let nextPlayerNumber = 1;

  function createRoom({ nickname, socketId, sessionId }) {
    const code = createUniqueCode();
    const player = createPlayer({ nickname, socketId, sessionId, isHost: true });
    const room = {
      code,
      status: 'lobby',
      hostPlayerId: player.id,
      players: [player],
      totalRounds: MATCH_ROUNDS,
      currentRound: null,
      match: null,
      createdAt: now(),
      updatedAt: now()
    };

    rooms.set(code, room);

    return { room: publicRoom(room), player: publicPlayer(player, room.hostPlayerId) };
  }

  function joinRoom({ code, nickname, socketId, sessionId }) {
    const room = requireRoom(code);

    if (room.status !== 'lobby') {
      throw new Error('Room is not joinable');
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }

    const player = createPlayer({
      nickname: uniqueNickname(room, cleanNickname(nickname)),
      socketId,
      sessionId,
      isHost: false
    });
    room.players.push(player);
    touch(room);

    return { room: publicRoom(room), player: publicPlayer(player, room.hostPlayerId) };
  }

  function reconnect({ code, playerId, sessionId, socketId }) {
    const room = requireRoom(code);
    const player = room.players.find((candidate) => {
      if (playerId && candidate.id === playerId) return true;
      return Boolean(sessionId && candidate.sessionId === sessionId);
    });

    if (!player) {
      throw new Error('Player not found');
    }

    player.socketId = socketId;
    player.sessionId = sessionId ?? player.sessionId;
    player.connected = true;
    touch(room);

    return { room: publicRoom(room), player: publicPlayer(player, room.hostPlayerId) };
  }

  function startMatch({ code, playerId }) {
    const room = requireRoom(code);

    if (room.hostPlayerId !== playerId) {
      throw new Error('Only host can start match');
    }
    if (room.status !== 'lobby' && room.status !== 'finished') {
      throw new Error('Match already started');
    }

    const deck = deckFactory(MATCH_ROUNDS);
    if (!Array.isArray(deck) || deck.length < MATCH_ROUNDS) {
      throw new Error('Round deck is incomplete');
    }

    for (const player of room.players) {
      player.score = 0;
    }

    room.status = 'answering';
    room.match = {
      deck: deck.slice(0, MATCH_ROUNDS),
      roundIndex: 0
    };
    room.currentRound = createRound(room, 0);
    touch(room);

    return publicRoom(room);
  }

  function submitAnswer({ code, playerId, answerId }) {
    const room = requireRoom(code);
    const player = requirePlayer(room, playerId);

    ensureAcceptingAnswers(room);

    const scoring = scoreAttempt({
      answerId,
      correctCharacterId: room.currentRound.characterId,
      alreadyWon: Boolean(room.currentRound.winnerPlayerId)
    });

    const attempt = {
      playerId: player.id,
      answerId,
      correct: scoring.correct,
      createdAt: now()
    };
    room.currentRound.attempts.push(attempt);

    if (scoring.winsRound) {
      player.score += scoring.points;
      room.currentRound.winnerPlayerId = player.id;
      room.currentRound.winningAnswerId = answerId;
      beginReveal(room);
    } else {
      touch(room);
    }

    return {
      correct: scoring.correct,
      winsRound: scoring.winsRound,
      points: scoring.points,
      room: publicRoom(room)
    };
  }

  function expireRound({ code }) {
    const room = requireRoom(code);

    if (room.status !== 'answering' || !room.currentRound) {
      return publicRoom(room);
    }
    if (now() <= room.currentRound.acceptsAnswersUntil) {
      return publicRoom(room);
    }

    beginReveal(room);
    return publicRoom(room);
  }

  function advanceAfterReveal({ code }) {
    const room = requireRoom(code);

    if (room.status !== 'revealing' || !room.currentRound) {
      return publicRoom(room);
    }
    if (now() <= room.currentRound.revealEndsAt) {
      return publicRoom(room);
    }

    const nextRoundIndex = room.match.roundIndex + 1;
    if (nextRoundIndex >= MATCH_ROUNDS) {
      room.status = 'finished';
      room.currentRound = null;
      room.match = null;
      touch(room);
      return publicRoom(room);
    }

    room.match.roundIndex = nextRoundIndex;
    room.status = 'answering';
    room.currentRound = createRound(room, nextRoundIndex);
    touch(room);

    return publicRoom(room);
  }

  function disconnect({ code, socketId, playerId }) {
    const room = requireRoom(code);
    const player = room.players.find((candidate) => {
      if (playerId && candidate.id === playerId) return true;
      return Boolean(socketId && candidate.socketId === socketId);
    });

    if (!player) {
      throw new Error('Player not found');
    }

    player.connected = false;
    player.socketId = null;
    transferHostIfNeeded(room);
    touch(room);

    return publicRoom(room);
  }

  function getRoom(code) {
    const room = rooms.get(normalizeCode(code));
    return room ? publicRoom(room) : null;
  }

  function createUniqueCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');
      if (!rooms.has(code)) {
        return code;
      }
    }

    throw new Error('Unable to create room code');
  }

  function createPlayer({ nickname, socketId, sessionId, isHost }) {
    return {
      id: `player-${nextPlayerNumber++}`,
      nickname: cleanNickname(nickname),
      score: 0,
      connected: true,
      joinedAt: now(),
      socketId: socketId ?? null,
      sessionId: sessionId ?? null,
      isHost
    };
  }

  function createRound(room, roundIndex) {
    const characterId = room.match.deck[roundIndex];
    const character = getCharacterById(characterId);

    if (!character) {
      throw new Error('Round character not found');
    }

    return {
      number: roundIndex + 1,
      characterId,
      clue: character.clues[0],
      clues: [...character.clues],
      startedAt: now(),
      acceptsAnswersUntil: now() + ROUND_SECONDS * 1_000,
      revealEndsAt: null,
      winnerPlayerId: null,
      winningAnswerId: null,
      attempts: []
    };
  }

  function ensureAcceptingAnswers(room) {
    if (room.status !== 'answering' || !room.currentRound || room.currentRound.winnerPlayerId) {
      throw new Error('Round is not accepting answers');
    }
    if (now() > room.currentRound.acceptsAnswersUntil) {
      beginReveal(room);
      throw new Error('Round is not accepting answers');
    }
  }

  function beginReveal(room) {
    room.status = 'revealing';
    room.currentRound.revealEndsAt = now() + REVEAL_SECONDS * 1_000;
    touch(room);
  }

  function transferHostIfNeeded(room) {
    const currentHost = room.players.find((player) => player.id === room.hostPlayerId);
    if (currentHost?.connected) {
      return;
    }

    const nextHost = room.players.find((player) => player.connected);
    if (nextHost) {
      room.hostPlayerId = nextHost.id;
    }
  }

  function requireRoom(code) {
    const room = rooms.get(normalizeCode(code));
    if (!room) {
      throw new Error('Room not found');
    }
    return room;
  }

  function requirePlayer(room, playerId) {
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    return player;
  }

  function touch(room) {
    room.updatedAt = now();
  }

  return {
    createRoom,
    joinRoom,
    reconnect,
    startMatch,
    submitAnswer,
    expireRound,
    advanceAfterReveal,
    disconnect,
    getRoom
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map((player) => publicPlayer(player, room.hostPlayerId)),
    totalRounds: room.totalRounds,
    currentRound: publicRound(room.currentRound),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  };
}

function publicPlayer(player, hostPlayerId) {
  return {
    id: player.id,
    nickname: player.nickname,
    score: player.score,
    connected: player.connected,
    isHost: player.id === hostPlayerId,
    joinedAt: player.joinedAt
  };
}

function publicRound(round) {
  if (!round) {
    return null;
  }

  return {
    number: round.number,
    characterId: round.characterId,
    clue: round.clue,
    clues: [...round.clues],
    startedAt: round.startedAt,
    acceptsAnswersUntil: round.acceptsAnswersUntil,
    revealEndsAt: round.revealEndsAt,
    winnerPlayerId: round.winnerPlayerId,
    winningAnswerId: round.winningAnswerId,
    attempts: round.attempts.map((attempt) => ({ ...attempt }))
  };
}

function uniqueNickname(room, nickname) {
  const taken = new Set(room.players.map((player) => normalizeText(player.nickname)));
  if (!taken.has(normalizeText(nickname))) {
    return nickname;
  }

  for (let suffix = 2; suffix <= MAX_PLAYERS + 1; suffix += 1) {
    const candidate = `${nickname} ${suffix}`;
    if (!taken.has(normalizeText(candidate))) {
      return candidate;
    }
  }

  return nickname;
}

function cleanNickname(nickname) {
  const cleaned = String(nickname ?? '').trim().replace(/\s+/g, ' ');
  return cleaned || DEFAULT_NICKNAME;
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}
