import { Router } from 'express';
import { z } from 'zod';
import { findCatalogItem } from '@pocketpilot/core';
import { HttpError, idParam } from '../app.js';
import type { Repo } from '../repo.js';
import type { FxService } from '../services/fx.js';

const goalInput = z.object({
  catalogId: z.string().trim().max(60).nullable().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  price: z.number().min(0).max(10_000_000).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  searchQuery: z.string().trim().max(200).nullable().optional(),
  savedSoFar: z.number().min(0).max(10_000_000).optional(),
  isFavorite: z.boolean().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable().optional(),
});

export function goalsRouter(repo: Repo, fx: FxService) {
  const r = Router();

  r.get('/profiles/:id/goals', (req, res) => {
    res.json(repo.listGoals(idParam(req)));
  });

  r.post('/profiles/:id/goals', async (req, res) => {
    const profileId = idParam(req);
    const profile = repo.getProfile(profileId);
    if (!profile) throw new HttpError(404, 'Profile not found');
    const input = goalInput.parse(req.body);
    const fromCatalog = input.catalogId ? findCatalogItem(input.catalogId) : undefined;
    const stored = input.catalogId ? repo.getPrice(`goal:${input.catalogId}`) : null;
    const name = input.name ?? fromCatalog?.name;
    let price = input.price ?? stored?.price ?? fromCatalog?.price;
    let currency = input.currency ?? (input.price !== undefined ? profile.currency : (stored?.currency ?? fromCatalog?.currency ?? profile.currency));
    if (!name || price === undefined) throw new HttpError(400, 'A goal needs a name and a price (or a valid catalogId)');
    // Store goals in the kid's currency so progress and prices line up.
    if (currency.toUpperCase() !== profile.currency.toUpperCase()) {
      try {
        price = await fx.convert(price, currency, profile.currency);
        currency = profile.currency;
      } catch {
        /* keep the original currency; the plan converts for display when it can */
      }
    }
    const goal = repo.createGoal(profileId, {
      catalogId: input.catalogId ?? null,
      name,
      emoji: input.emoji ?? fromCatalog?.emoji ?? '🎯',
      price,
      currency,
      searchQuery: input.searchQuery ?? fromCatalog?.searchQuery ?? `${name} price`,
      savedSoFar: input.savedSoFar ?? 0,
      isFavorite: input.isFavorite ?? false,
      targetDate: input.targetDate ?? null,
    });
    res.status(201).json(goal);
  });

  r.put('/goals/:id', (req, res) => {
    const input = goalInput.parse(req.body);
    const goal = repo.updateGoal(idParam(req), input);
    if (!goal) throw new HttpError(404, 'Goal not found');
    res.json(goal);
  });

  r.delete('/goals/:id', (req, res) => {
    if (!repo.deleteGoal(idParam(req))) throw new HttpError(404, 'Goal not found');
    res.status(204).end();
  });

  return r;
}
