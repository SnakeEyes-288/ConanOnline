import { describe, expect, test } from 'vitest';
import { characters, getCharacterById } from './characters.js';
import {
  MATCH_ROUNDS,
  MAX_PLAYERS,
  REVEAL_SECONDS,
  ROUND_SECONDS,
  createRoundDeck,
  isCorrectAnswer,
  normalizeText,
  scoreAttempt,
  searchCharacters
} from './gameRules.js';

describe('shared Conan quiz data', () => {
  test('exports exactly 50 characters with five Thai clues each', () => {
    expect(characters).toHaveLength(50);
    expect(new Set(characters.map((character) => character.id)).size).toBe(50);

    for (const character of characters) {
      expect(character.id).toMatch(/^[a-z0-9-]+$/);
      expect(character.name).toEqual(expect.any(String));
      expect(character.name).not.toMatch(/[A-Za-z]/);
      expect(Array.isArray(character.aliases)).toBe(true);
      expect(character.aliases.length).toBeGreaterThan(0);
      expect(character.clues).toHaveLength(5);
      expect(character.clues.every((clue) => typeof clue === 'string' && clue.length > 0)).toBe(true);
    }
  });

  test('finds characters by stable id and returns null for unknown ids', () => {
    expect(getCharacterById('edogawa-conan')?.name).toBe('เอโดงาวะ โคนัน');
    expect(getCharacterById('amuro-toru')?.aliases).toContain('เบอร์เบิน');
    expect(getCharacterById('unknown')).toBeNull();
  });
});

describe('shared game rules', () => {
  test('exports the configured match constants', () => {
    expect(MATCH_ROUNDS).toBe(10);
    expect(ROUND_SECONDS).toBe(20);
    expect(REVEAL_SECONDS).toBe(5);
    expect(MAX_PLAYERS).toBe(8);
  });

  test('normalizes whitespace, case, and surrounding text', () => {
    expect(normalizeText('  Conan  ')).toBe('conan');
    expect(normalizeText(' ฟุรุยะ   เรย์ ')).toBe('ฟุรุยะ เรย์');
    expect(normalizeText(null)).toBe('');
  });

  test('searches by Thai display name and aliases', () => {
    expect(searchCharacters('โคนัน').map((character) => character.id)).toContain('edogawa-conan');
    expect(searchCharacters('bourbon').map((character) => character.id)).toEqual([]);
    expect(searchCharacters('เบอร์เบิน').map((character) => character.id)).toContain('amuro-toru');
    expect(searchCharacters('Shuichi').map((character) => character.id)).toContain('akai-shuichi');
    expect(searchCharacters('')).toHaveLength(50);
  });

  test('checks exact answer ids', () => {
    expect(isCorrectAnswer('edogawa-conan', 'edogawa-conan')).toBe(true);
    expect(isCorrectAnswer('kudo-shinichi', 'edogawa-conan')).toBe(false);
  });

  test('scores only first correct answers while wrong answers keep the race open', () => {
    expect(scoreAttempt({ answerId: 'kudo-shinichi', correctCharacterId: 'edogawa-conan', alreadyWon: false })).toEqual({
      correct: false,
      points: 0,
      winsRound: false
    });
    expect(scoreAttempt({ answerId: 'edogawa-conan', correctCharacterId: 'edogawa-conan', alreadyWon: false })).toEqual({
      correct: true,
      points: 1,
      winsRound: true
    });
    expect(scoreAttempt({ answerId: 'edogawa-conan', correctCharacterId: 'edogawa-conan', alreadyWon: true })).toEqual({
      correct: true,
      points: 0,
      winsRound: false
    });
  });

  test('creates a unique round deck of requested character ids', () => {
    const deck = createRoundDeck(10, characters, () => 0.5);

    expect(deck).toHaveLength(10);
    expect(new Set(deck).size).toBe(10);
    expect(deck.every((id) => getCharacterById(id))).toBe(true);
  });
});
