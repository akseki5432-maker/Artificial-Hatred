import { Router } from 'express';
import { z } from 'zod';
import { HttpError, idParam } from '../app.js';
import type { Repo } from '../repo.js';

export const LEDGER_CATEGORIES = ['allowance', 'chores', 'gift', 'snacks', 'games', 'toys', 'clothes', 'fun', 'saving', 'sharing', 'other'] as const;

const entryInput = z.object({
  kind: z.enum(['in', 'out']),
  amount: z.number().positive().max(1_000_000),
  category: z.enum(LEDGER_CATEGORIES).optional(),
  note: z.string().trim().max(140).nullable().optional(),
  at: z.string().datetime().optional(),
});

export function ledgerRouter(repo: Repo) {
  const r = Router();

  r.get('/ledger/categories', (_req, res) => {
    res.json(LEDGER_CATEGORIES);
  });

  r.get('/profiles/:id/ledger', (req, res) => {
    res.json(repo.listLedger(idParam(req)));
  });

  r.post('/profiles/:id/ledger', (req, res) => {
    const profileId = idParam(req);
    if (!repo.getProfile(profileId)) throw new HttpError(404, 'Profile not found');
    const input = entryInput.parse(req.body);
    res.status(201).json(
      repo.addLedger(profileId, {
        kind: input.kind,
        amount: input.amount,
        category: input.category ?? (input.kind === 'in' ? 'allowance' : 'other'),
        note: input.note ?? null,
        ...(input.at ? { at: input.at } : {}),
      }),
    );
  });

  r.delete('/ledger/:id', (req, res) => {
    if (!repo.deleteLedger(idParam(req))) throw new HttpError(404, 'Entry not found');
    res.status(204).end();
  });

  return r;
}
