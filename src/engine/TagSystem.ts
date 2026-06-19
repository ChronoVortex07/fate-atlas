import type { Taggable, Tag } from './types';

export class TagSystem {
  hasAllTags(entity: Taggable, tags: Tag[]): boolean {
    return tags.every((t) => entity.tags.includes(t));
  }

  hasAnyTag(entity: Taggable, tags: Tag[]): boolean {
    return tags.some((t) => entity.tags.includes(t));
  }

  findMatching(
    entities: Taggable[],
    tags: Tag[],
    mode: 'all' | 'any',
  ): Taggable[] {
    const check = mode === 'all' ? this.hasAllTags.bind(this) : this.hasAnyTag.bind(this);
    return entities.filter((e) => check(e, tags));
  }

  hasOpposingTags(
    a: Taggable,
    b: Taggable,
    opposingPairs: [string, string][],
  ): boolean {
    return opposingPairs.some(([t1, t2]) => {
      return (
        (a.tags.includes(t1) && b.tags.includes(t2)) ||
        (a.tags.includes(t2) && b.tags.includes(t1))
      );
    });
  }
}
