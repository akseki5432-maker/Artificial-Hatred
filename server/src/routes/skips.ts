import { Router } from 'express';
import { z } from 'zod';
import { HttpError, idParam } from '../app.js';
import type { Repo } from '../repo.js';

const skipInput = z.object({
  habitId: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  amount: z.number().positive().max(10_000),
});

const moveInput = z.object({
  goalId: z.number().int().positive().nullable().optional(),
});

export function skipsRouter(repo: Repo) {
  const r = Router();

  r.get('/profiles/:id/skips', (req, res) => {
    res.json(repo.listSkips(idParam(req)));
  });

  /** "I didn't buy it today." Nothing moves yet; this only records the choice. */
  r.post('/profiles/:id/skips', (req, res) => {
    const profileId = idParam(req);
    if (!repo.getProfile(profileId)) throw new HttpError(404, 'Profile not found');
    const input = skipInput.parse(req.body);
    res.status(201).json(repo.addSkip(profileId, input.habitId, input.name, input.amount));
  });

  r.delete('/skips/:id', (req, res) => {
    if (!repo.deleteSkip(idParam(req))) throw new HttpError(404, 'Skip not found');
    res.status(204).end();
  });

  /** Turn every skip that has not been banked yet into real saved money. */
  r.post('/profiles/:id/skips/bank', (req, res) => {
    const profileId = idParam(req);
    if (!repo.getProfile(profileId)) throw new HttpError(404, 'Profile not found');
    const input = moveInput.parse(req.body ?? {});
    const result = repo.moveSkipsToSavings(profileId, input.goalId ?? null);
    if (result.count === 0) throw new HttpError(400, 'Nothing to bank yet. Skip something first!');
    res.status(201).json(result);
  });

  return r;
}
