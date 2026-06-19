import { describe, it, expect } from 'vitest';
import { TagSystem } from '../TagSystem';
import type { Taggable } from '../types';

const fool: Taggable = {
  tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype'],
};

const dice: Taggable = {
  tags: ['roll', 'random', 'numeric', 'threshold', 'low'],
};

const hexagram: Taggable = {
  tags: ['draw', 'random', 'binary', 'reversible'],
};

describe('TagSystem', () => {
  const system = new TagSystem();

  describe('hasAllTags', () => {
    it('returns true when entity has all specified tags', () => {
      expect(system.hasAllTags(fool, ['major-arcana', 'fool-archetype'])).toBe(true);
    });

    it('returns false when entity is missing any tag', () => {
      expect(system.hasAllTags(fool, ['major-arcana', 'numeric'])).toBe(false);
    });

    it('returns true for empty tag list', () => {
      expect(system.hasAllTags(fool, [])).toBe(true);
    });
  });

  describe('hasAnyTag', () => {
    it('returns true when entity has at least one specified tag', () => {
      expect(system.hasAnyTag(dice, ['binary', 'numeric'])).toBe(true);
    });

    it('returns false when entity has none of the specified tags', () => {
      expect(system.hasAnyTag(dice, ['binary', 'major-arcana'])).toBe(false);
    });

    it('returns false for empty tag list', () => {
      expect(system.hasAnyTag(dice, [])).toBe(false);
    });
  });

  describe('findMatching', () => {
    const entities = [fool, dice, hexagram];

    it('finds all entities matching all tags', () => {
      const result = system.findMatching(entities, ['draw', 'random'], 'all');
      expect(result).toHaveLength(2); // fool + hexagram
    });

    it('finds all entities matching any tags', () => {
      const result = system.findMatching(entities, ['numeric', 'binary'], 'any');
      expect(result).toHaveLength(2); // dice + hexagram
    });

    it('returns empty array when no match', () => {
      const result = system.findMatching(entities, ['nonexistent'], 'all');
      expect(result).toHaveLength(0);
    });
  });

  describe('hasOpposingTags', () => {
    const opposingPairs: [string, string][] = [
      ['high', 'low'],
      ['order', 'chaos'],
    ];

    it('returns true when entities have opposing tags', () => {
      const highRoll: Taggable = { tags: ['roll', 'high'] };
      const lowRoll: Taggable = { tags: ['roll', 'low'] };
      expect(system.hasOpposingTags(highRoll, lowRoll, opposingPairs)).toBe(true);
    });

    it('returns false when entities have no opposing tags', () => {
      const a: Taggable = { tags: ['draw', 'random'] };
      const b: Taggable = { tags: ['draw', 'random'] };
      expect(system.hasOpposingTags(a, b, opposingPairs)).toBe(false);
    });
  });
});
