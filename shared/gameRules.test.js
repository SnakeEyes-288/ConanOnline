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
  test('exports exactly 50 characters with trimmed ids, names, aliases, and five Thai clues each', () => {
    expect(characters).toHaveLength(50);
    expect(new Set(characters.map((character) => character.id)).size).toBe(characters.length);

    for (const character of characters) {
      expect(character.id).toMatch(/^[a-z0-9-]+$/);
      expect(character.id).toBe(character.id.trim());
      expect(character.name).toEqual(expect.any(String));
      expect(character.name).toBe(character.name.trim());
      expect(character.name).not.toMatch(/[A-Za-z]/);
      expect(Array.isArray(character.aliases)).toBe(true);
      expect(character.aliases.length).toBeGreaterThan(0);
      for (const alias of character.aliases) {
        expect(alias).toEqual(expect.any(String));
        expect(alias).toBe(alias.trim());
        expect(alias.trim()).not.toBe('');
      }
      expect(character.clues).toHaveLength(5);
      for (const clue of character.clues) {
        expect(clue).toEqual(expect.any(String));
        expect(clue).toBe(clue.trim());
        expect(clue.trim()).not.toBe('');
      }
    }
  });

  test('finds characters by stable id and returns null for unknown ids', () => {
    expect(getCharacterById('edogawa-conan')?.name).toBe('เอโดงาวะ โคนัน');
    expect(getCharacterById('amuro-toru')?.aliases).toContain('เบอร์เบิน');
    expect(getCharacterById('unknown')).toBeNull();
  });

  test('does not reuse exact normalized display names or aliases across characters', () => {
    const termsByCharacter = new Map();

    for (const character of characters) {
      for (const term of [character.name, ...character.aliases].map(normalizeText)) {
        if (!termsByCharacter.has(term)) {
          termsByCharacter.set(term, []);
        }
        termsByCharacter.get(term).push(character.id);
      }
    }

    const duplicateTerms = [...termsByCharacter.entries()].filter(([, ids]) => ids.length > 1);
    expect(duplicateTerms).toEqual([]);
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

  test('keeps alternate-identity search terms clear for race answers', () => {
    expect(searchCharacters('ชิโฮะ').map((character) => character.id)).toEqual(['haibara-shiho']);
    expect(searchCharacters('ฟุรุยะ เรย์').map((character) => character.id)).toEqual(['furuya-rei']);
    expect(searchCharacters('ฟุรุยะ').map((character) => character.id)).toEqual(['furuya-rei']);
    expect(searchCharacters('เรย์').map((character) => character.id)).toEqual(['furuya-rei']);
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

  test('creates deterministic decks when random returns boundary values', () => {
    expect(createRoundDeck(3, characters, () => 0)).toEqual(createRoundDeck(3, characters, () => 0));

    const oneBoundaryDeck = createRoundDeck(3, characters, () => 1);
    expect(oneBoundaryDeck).toHaveLength(3);
    expect(new Set(oneBoundaryDeck).size).toBe(3);
    expect(oneBoundaryDeck.every((id) => getCharacterById(id))).toBe(true);

    for (const randomValue of [-1, 1.5, Number.NaN]) {
      const deck = createRoundDeck(3, characters, () => randomValue);
      expect(deck).toHaveLength(3);
      expect(new Set(deck).size).toBe(3);
      expect(deck.every((id) => getCharacterById(id))).toBe(true);
    }
  });
});
