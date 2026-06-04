import { describe, expect, test } from 'vitest';
import { characters } from '@conan-online/shared';
import { MATCH_ROUNDS, REVEAL_SECONDS, ROUND_SECONDS } from '@conan-online/shared/gameRules.js';
import { createRoomStore } from './roomStore.js';

function createClock(start = 1_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
      return current;
    }
  };
}

function createStartedRoom() {
  const clock = createClock();
  const deck = characters.slice(0, MATCH_ROUNDS).map((character) => character.id);
  const store = createRoomStore({ now: clock.now, random: () => 0, deckFactory: () => deck });
  const created = store.createRoom({ nickname: 'Ran', socketId: 'socket-host', sessionId: 'session-host' });
  const joined = store.joinRoom({
    code: created.room.code,
    nickname: 'Conan',
    socketId: 'socket-player',
    sessionId: 'session-player'
  });
  const started = store.startMatch({ code: created.room.code, playerId: created.player.id });

  return { clock, deck, store, host: created.player, player: joined.player, room: started };
}

describe('room store lifecycle', () => {
  test('creates a room with host player and join code', () => {
    const store = createRoomStore({ random: () => 0 });

    const { room, player } = store.createRoom({
      nickname: 'Ran',
      socketId: 'socket-host',
      sessionId: 'session-host'
    });

    expect(room.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(room.hostPlayerId).toBe(player.id);
    expect(room.players).toEqual([
      expect.objectContaining({
        id: player.id,
        nickname: 'Ran',
        isHost: true,
        connected: true,
        score: 0
      })
    ]);
    expect(JSON.stringify(room)).not.toMatch(/socket-host|session-host|socketId|sessionId/);
  });

  test('joins room and suffixes duplicate nicknames', () => {
    const store = createRoomStore({ random: () => 0 });
    const created = store.createRoom({ nickname: 'Conan', socketId: 'socket-1', sessionId: 'session-1' });

    const joined = store.joinRoom({
      code: created.room.code,
      nickname: 'Conan',
      socketId: 'socket-2',
      sessionId: 'session-2'
    });

    expect(joined.player.nickname).toBe('Conan 2');
    expect(joined.room.players.map((player) => player.nickname)).toEqual(['Conan', 'Conan 2']);
  });

  test('rejects match start by a non-host player', () => {
    const store = createRoomStore({ random: () => 0 });
    const created = store.createRoom({ nickname: 'Ran', socketId: 'socket-host', sessionId: 'session-host' });
    const joined = store.joinRoom({
      code: created.room.code,
      nickname: 'Conan',
      socketId: 'socket-player',
      sessionId: 'session-player'
    });

    expect(() => store.startMatch({ code: created.room.code, playerId: joined.player.id })).toThrow('Only host can start match');
  });

  test('starts a 10-round match with a 20 second answer window', () => {
    const clock = createClock();
    const deck = characters.slice(0, MATCH_ROUNDS).map((character) => character.id);
    const store = createRoomStore({ now: clock.now, random: () => 0, deckFactory: () => deck });
    const created = store.createRoom({ nickname: 'Ran', socketId: 'socket-host', sessionId: 'session-host' });

    const room = store.startMatch({ code: created.room.code, playerId: created.player.id });

    expect(room.status).toBe('answering');
    expect(room.totalRounds).toBe(10);
    expect(room.currentRound).toEqual(
      expect.objectContaining({
        number: 1,
        clue: characters.find((character) => character.id === deck[0]).clues[0],
        acceptsAnswersUntil: clock.now() + ROUND_SECONDS * 1_000
      })
    );
    expect(room.currentRound.characterId).toBeUndefined();
    expect(room.deck).toBeUndefined();
  });

  test('allows wrong answers, then first correct answer wins one point and reveals immediately', () => {
    const { deck, store, host, player, room } = createStartedRoom();
    const correctId = deck[0];
    const wrongId = characters.find((character) => character.id !== correctId).id;

    const wrong = store.submitAnswer({
      code: room.code,
      playerId: host.id,
      answerId: wrongId
    });

    expect(wrong.correct).toBe(false);
    expect(wrong.room.status).toBe('answering');
    expect(wrong.room.players.find((candidate) => candidate.id === host.id).score).toBe(0);

    const correct = store.submitAnswer({
      code: room.code,
      playerId: player.id,
      answerId: correctId
    });

    expect(correct.correct).toBe(true);
    expect(correct.winsRound).toBe(true);
    expect(correct.room.status).toBe('revealing');
    expect(correct.room.currentRound.winnerPlayerId).toBe(player.id);
    expect(correct.room.players.find((candidate) => candidate.id === player.id).score).toBe(1);
  });

  test('rejects answers after the round already has a winner', () => {
    const { deck, store, host, player, room } = createStartedRoom();
    store.submitAnswer({ code: room.code, playerId: player.id, answerId: deck[0] });

    expect(() =>
      store.submitAnswer({ code: room.code, playerId: host.id, answerId: deck[0] })
    ).toThrow('Round is not accepting answers');
  });

  test('expires unanswered rounds and rejects late answers', () => {
    const { clock, deck, store, host, room } = createStartedRoom();
    clock.advance(ROUND_SECONDS * 1_000 + 1);

    const expired = store.expireRound({ code: room.code });

    expect(expired.status).toBe('revealing');
    expect(expired.currentRound.winnerPlayerId).toBeNull();
    expect(() =>
      store.submitAnswer({ code: room.code, playerId: host.id, answerId: deck[0] })
    ).toThrow('Round is not accepting answers');
  });

  test('expires an unanswered round exactly at the answer deadline', () => {
    const { clock, store, room } = createStartedRoom();
    clock.advance(ROUND_SECONDS * 1_000);

    const expired = store.expireRound({ code: room.code });

    expect(expired.status).toBe('revealing');
    expect(expired.currentRound.winnerPlayerId).toBeNull();
  });

  test('rejects a correct answer exactly at the answer deadline without awarding points', () => {
    const { clock, deck, store, player, room } = createStartedRoom();
    clock.advance(ROUND_SECONDS * 1_000);

    expect(() => store.submitAnswer({ code: room.code, playerId: player.id, answerId: deck[0] })).toThrow(
      'Round is not accepting answers'
    );

    const afterDeadline = store.getRoom(room.code);
    expect(afterDeadline.status).toBe('revealing');
    expect(afterDeadline.currentRound.winnerPlayerId).toBeNull();
    expect(afterDeadline.players.find((candidate) => candidate.id === player.id).score).toBe(0);
  });

  test('does not expose the correct character while accepting answers', () => {
    const { room } = createStartedRoom();

    expect(room.status).toBe('answering');
    expect(room.currentRound).toEqual(
      expect.objectContaining({
        number: 1,
        clue: expect.any(String),
        clues: expect.any(Array),
        acceptsAnswersUntil: expect.any(Number)
      })
    );
    expect(room.currentRound.characterId).toBeUndefined();
    expect(JSON.stringify(room.currentRound)).not.toMatch(/"characterId"/);
  });

  test('exposes the correct character during reveal', () => {
    const { deck, store, player, room } = createStartedRoom();

    const reveal = store.submitAnswer({ code: room.code, playerId: player.id, answerId: deck[0] }).room;

    expect(reveal.status).toBe('revealing');
    expect(reveal.currentRound.characterId).toBe(deck[0]);
  });

  test('advances to the next round exactly at the reveal deadline', () => {
    const { clock, deck, store, player, room } = createStartedRoom();
    const reveal = store.submitAnswer({ code: room.code, playerId: player.id, answerId: deck[0] }).room;
    clock.advance(REVEAL_SECONDS * 1_000);

    const next = store.advanceAfterReveal({ code: reveal.code });

    expect(next.status).toBe('answering');
    expect(next.currentRound.number).toBe(2);
    expect(next.currentRound.characterId).toBeUndefined();
  });

  test('advances after reveal through round 10 and then finalizes the match', () => {
    const { clock, deck, store, player, room } = createStartedRoom();
    let currentRoom = room;

    for (let round = 1; round <= MATCH_ROUNDS; round += 1) {
      currentRoom = store.submitAnswer({
        code: currentRoom.code,
        playerId: player.id,
        answerId: deck[round - 1]
      }).room;
      clock.advance(REVEAL_SECONDS * 1_000 + 1);
      currentRoom = store.advanceAfterReveal({ code: currentRoom.code });

      if (round < MATCH_ROUNDS) {
        expect(currentRoom.status).toBe('answering');
        expect(currentRoom.currentRound.number).toBe(round + 1);
        expect(currentRoom.currentRound.characterId).toBeUndefined();
      }
    }

    expect(currentRoom.status).toBe('finished');
    expect(currentRoom.currentRound).toBeNull();
    expect(currentRoom.players.find((candidate) => candidate.id === player.id).score).toBe(10);
  });

  test('starts a replay with a different character order even when the random deck repeats', () => {
    const clock = createClock();
    const deck = characters.slice(0, MATCH_ROUNDS).map((character) => character.id);
    const store = createRoomStore({ now: clock.now, random: () => 0, deckFactory: () => deck });
    const created = store.createRoom({ nickname: 'Ran', socketId: 'socket-host', sessionId: 'session-host' });
    let currentRoom = store.startMatch({ code: created.room.code, playerId: created.player.id });
    const firstMatchFirstClue = currentRoom.currentRound.clue;

    for (let round = 1; round <= MATCH_ROUNDS; round += 1) {
      currentRoom = store.submitAnswer({
        code: currentRoom.code,
        playerId: created.player.id,
        answerId: deck[round - 1]
      }).room;
      clock.advance(REVEAL_SECONDS * 1_000 + 1);
      currentRoom = store.advanceAfterReveal({ code: currentRoom.code });
    }

    expect(currentRoom.status).toBe('finished');

    const replay = store.startMatch({ code: created.room.code, playerId: created.player.id });

    expect(replay.status).toBe('answering');
    expect(replay.currentRound.number).toBe(1);
    expect(replay.currentRound.clue).not.toBe(firstMatchFirstClue);
  });
});
