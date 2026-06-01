import { characters } from './characters.js';

export const MATCH_ROUNDS = 10;
export const ROUND_SECONDS = 20;
export const REVEAL_SECONDS = 5;
export const MAX_PLAYERS = 8;

export function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function searchCharacters(query, roster = characters) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return roster;

  return roster.filter((character) => {
    const terms = [character.name, ...character.aliases].map(normalizeText);
    return terms.some((term) => term.includes(normalizedQuery));
  });
}

export function isCorrectAnswer(answerId, correctCharacterId) {
  return answerId === correctCharacterId;
}

export function scoreAttempt({ answerId, correctCharacterId, alreadyWon = false }) {
  const correct = isCorrectAnswer(answerId, correctCharacterId);

  if (!correct || alreadyWon) {
    return { correct, points: 0, winsRound: false };
  }

  return { correct: true, points: 1, winsRound: true };
}

export function createRoundDeck(count = MATCH_ROUNDS, roster = characters, random = Math.random) {
  const pool = [...roster];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, count).map((character) => character.id);
}
