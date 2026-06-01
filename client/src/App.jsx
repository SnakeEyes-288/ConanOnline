import React, { useEffect, useMemo, useState } from 'react';
import { characters } from '@conan-online/shared';
import { searchCharacters } from '@conan-online/shared/gameRules.js';
import { createSocket } from './socket.js';

const SESSION_STORAGE_KEY = 'conan-online-session-id';
const INITIAL_FORM = {
  nickname: '',
  roomCode: ''
};

function getStoredSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const created =
    window.crypto?.randomUUID?.() ??
    `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

function screenForRoom(room) {
  if (!room) return 'home';
  if (room.status === 'lobby') return 'lobby';
  if (room.status === 'answering') return 'game';
  if (room.status === 'revealing') return 'reveal';
  if (room.status === 'finished') return 'final';
  return 'home';
}

function sortPlayers(players = []) {
  return [...players].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.joinedAt - right.joinedAt;
  });
}

function findCharacter(id) {
  return characters.find((character) => character.id === id) ?? null;
}

export default function App() {
  const socket = useMemo(() => createSocket(), []);
  const [sessionId] = useState(getStoredSessionId);
  const [screen, setScreen] = useState('home');
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [answerQuery, setAnswerQuery] = useState('');
  const [selectedAnswerId, setSelectedAnswerId] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const currentRound = room?.currentRound ?? null;
  const players = room?.players ?? [];
  const currentPlayer = players.find((candidate) => candidate.id === player?.id) ?? player;
  const isHost = Boolean(currentPlayer?.isHost);
  const answerOptions = useMemo(() => searchCharacters(answerQuery).slice(0, 8), [answerQuery]);
  const revealedCharacter = findCharacter(currentRound?.characterId);
  const winner = players.find((candidate) => candidate.id === currentRound?.winnerPlayerId) ?? null;
  const finalPlayers = useMemo(() => sortPlayers(players), [players]);

  useEffect(() => {
    function acceptSession(payload) {
      setRoom(payload.room);
      setPlayer(payload.player);
      setScreen(screenForRoom(payload.room));
      setError('');
    }

    function acceptRoom(payload) {
      setRoom(payload.room);
      setScreen(screenForRoom(payload.room));
    }

    function acceptRound(payload) {
      setRoom(payload.room);
      setScreen('game');
      setAnswerQuery('');
      setSelectedAnswerId('');
      setAnswerResult(null);
    }

    function acceptReveal(payload) {
      setRoom(payload.room);
      setScreen('reveal');
      setSelectedAnswerId('');
    }

    function acceptFinal(payload) {
      setRoom(payload.room);
      setScreen('final');
    }

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit('session:resume', { sessionId });
    });
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('disconnected'));
    socket.on('session:resumed', acceptSession);
    socket.on('room:created', acceptSession);
    socket.on('room:joined', acceptSession);
    socket.on('room:update', acceptRoom);
    socket.on('match:round', acceptRound);
    socket.on('answer:result', (payload) => setAnswerResult(payload));
    socket.on('match:reveal', acceptReveal);
    socket.on('match:final', acceptFinal);
    socket.on('app:error', (payload) => setError(payload?.message ?? 'Something went wrong.'));

    socket.connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('session:resumed', acceptSession);
      socket.off('room:created', acceptSession);
      socket.off('room:joined', acceptSession);
      socket.off('room:update', acceptRoom);
      socket.off('match:round', acceptRound);
      socket.off('answer:result');
      socket.off('match:reveal', acceptReveal);
      socket.off('match:final', acceptFinal);
      socket.off('app:error');
      socket.disconnect();
    };
  }, [sessionId, socket]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function createRoom(event) {
    event.preventDefault();
    setError('');
    socket.emit('room:create', {
      nickname: form.nickname,
      sessionId
    });
  }

  function joinRoom(event) {
    event.preventDefault();
    setError('');
    socket.emit('room:join', {
      roomCode: form.roomCode,
      nickname: form.nickname,
      sessionId
    });
  }

  function startMatch() {
    setError('');
    socket.emit('room:start');
  }

  function submitAnswer(answerId = selectedAnswerId) {
    if (!answerId) return;

    setError('');
    setSelectedAnswerId(answerId);
    socket.emit('answer:submit', { answerId });
  }

  function restartMatch() {
    startMatch();
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Conan Online</p>
          <h1>Detective quiz room</h1>
        </div>
        <p className={`connection connection-${connectionStatus}`}>{connectionStatus}</p>
      </header>

      {error ? <p role="alert" className="error-banner">{error}</p> : null}

      {screen === 'home' ? (
        <section className="screen home-screen">
          <form onSubmit={createRoom} className="panel">
            <h2>Create a room</h2>
            <label>
              Nickname
              <input name="nickname" value={form.nickname} onChange={updateForm} placeholder="Detective" />
            </label>
            <button type="submit">Create room</button>
          </form>

          <form onSubmit={joinRoom} className="panel">
            <h2>Join a room</h2>
            <label>
              Room code
              <input
                name="roomCode"
                value={form.roomCode}
                onChange={updateForm}
                placeholder="ABCD"
                maxLength={4}
              />
            </label>
            <label>
              Nickname
              <input name="nickname" value={form.nickname} onChange={updateForm} placeholder="Detective" />
            </label>
            <button type="submit">Join room</button>
          </form>
        </section>
      ) : null}

      {screen === 'lobby' ? (
        <section className="screen lobby-screen">
          <RoomSummary room={room} currentPlayer={currentPlayer} />
          <PlayerList players={players} />
          <button type="button" onClick={startMatch} disabled={!isHost}>
            {isHost ? 'Start match' : 'Waiting for host'}
          </button>
        </section>
      ) : null}

      {screen === 'game' ? (
        <section className="screen game-screen">
          <RoundHeader room={room} round={currentRound} />
          <p className="clue">{currentRound?.clue}</p>
          <label>
            Search answer
            <input
              value={answerQuery}
              onChange={(event) => setAnswerQuery(event.target.value)}
              placeholder="Type a character name"
            />
          </label>
          <div className="answer-grid">
            {answerOptions.map((character) => (
              <button
                key={character.id}
                type="button"
                onClick={() => submitAnswer(character.id)}
                className={selectedAnswerId === character.id ? 'selected' : ''}
              >
                {character.name}
              </button>
            ))}
          </div>
          {answerResult ? (
            <p className="answer-result">
              {answerResult.correct ? 'Correct answer' : 'Not this character'}
              {answerResult.points ? ` (+${answerResult.points})` : ''}
            </p>
          ) : null}
          <PlayerList players={players} />
        </section>
      ) : null}

      {screen === 'reveal' ? (
        <section className="screen reveal-screen">
          <RoundHeader room={room} round={currentRound} />
          <p className="clue">{currentRound?.clue}</p>
          <h2>{revealedCharacter?.name ?? 'No answer revealed'}</h2>
          {winner ? <p>Round winner: {winner.nickname}</p> : <p>No winner this round.</p>}
          {currentRound?.winningAnswerId ? <p>Winning answer: {findCharacter(currentRound.winningAnswerId)?.name}</p> : null}
          <PlayerList players={players} />
        </section>
      ) : null}

      {screen === 'final' ? (
        <section className="screen final-screen">
          <RoomSummary room={room} currentPlayer={currentPlayer} />
          <h2>Final scores</h2>
          <ol>
            {finalPlayers.map((candidate) => (
              <li key={candidate.id}>
                {candidate.nickname} - {candidate.score}
              </li>
            ))}
          </ol>
          <button type="button" onClick={restartMatch} disabled={!isHost}>
            {isHost ? 'Play again' : 'Waiting for host'}
          </button>
        </section>
      ) : null}
    </main>
  );
}

function RoomSummary({ room, currentPlayer }) {
  return (
    <section className="room-summary">
      <p>Room code</p>
      <h2>{room?.code}</h2>
      <p>
        Playing as {currentPlayer?.nickname ?? 'Detective'}
        {currentPlayer?.isHost ? ' (host)' : ''}
      </p>
    </section>
  );
}

function RoundHeader({ room, round }) {
  return (
    <header className="round-header">
      <p>
        Round {round?.number ?? 0} of {room?.totalRounds ?? 0}
      </p>
      <p>Status: {room?.status}</p>
    </header>
  );
}

function PlayerList({ players }) {
  return (
    <section className="player-list">
      <h2>Players</h2>
      <ul>
        {players.map((candidate) => (
          <li key={candidate.id}>
            <span>{candidate.nickname}</span>
            <span>{candidate.score}</span>
            {!candidate.connected ? <span>offline</span> : null}
            {candidate.isHost ? <span>host</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
