import { describe, expect, it } from 'vitest';
import { LESSONS, findLesson, lessonsForAge } from '../src/lessons.js';

describe('lessons', () => {
  it('every quiz answer points at a real choice and has an explanation', () => {
    for (const l of LESSONS) {
      expect(l.quiz.length).toBeGreaterThanOrEqual(3);
      for (const q of l.quiz) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.choices.length);
        expect(q.why.length).toBeGreaterThan(10);
      }
      expect(new Set(LESSONS.map((x) => x.id)).size).toBe(LESSONS.length);
    }
  });
  it('filters by age', () => {
    expect(lessonsForAge(6).every((l) => l.minAge <= 6)).toBe(true);
    expect(lessonsForAge(6).length).toBeLessThan(LESSONS.length);
    expect(lessonsForAge(null)).toHaveLength(LESSONS.length);
    expect(findLesson('compounding')?.title).toContain('money');
  });
});
