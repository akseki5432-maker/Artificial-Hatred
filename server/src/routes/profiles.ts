import { Router } from 'express';
import { z } from 'zod';
import { CADENCES, HABIT_CATALOG } from '@pocketpilot/core';
import { HttpError, idParam } from '../app.js';
import { buildPlan } from '../plan.js';
import type { Repo } from '../repo.js';

const cadence = z.enum(CADENCES as [string, ...string[]]);
const split = z.object({
  save: z.number().min(0).max(100),
  spend: z.number().min(0).max(100),
  share: z.number().min(0).max(100),
  invest: z.number().min(0).max(100),
});

const profileInput = z.object({
  name: z.string().trim().min(1).max(60),
  age: z.number().int().min(3).max(25).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  allowanceAmount: z.number().min(0).max(1_000_000).optional(),
  allowanceCadence: cadence.optional(),
  savingsRate: z.number().min(0).max(1).optional(),
  growthRatePct: z.number().min(0).max(30).optional(),
  startingBalance: z.number().min(0).max(10_000_000).optional(),
  split: split.optional(),
});

const incomeInput = z.object({
  label: z.string().trim().min(1).max(60),
  amount: z.number().min(0).max(1_000_000),
  cadence,
});

export function profilesRouter(repo: Repo) {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json(repo.listProfiles());
  });

  r.post('/', (req, res) => {
    const input = profileInput.parse(req.body);
    res.status(201).json(repo.createProfile(input as Parameters<Repo['createProfile']>[0]));
  });

  r.get('/:id', (req, res) => {
    const p = repo.getProfile(idParam(req));
    if (!p) throw new HttpError(404, 'Profile not found');
    res.json({ ...p, income: repo.listIncome(p.id) });
  });

  r.put('/:id', (req, res) => {
    const input = profileInput.partial().parse(req.body);
    const p = repo.updateProfile(idParam(req), input as Parameters<Repo['updateProfile']>[1]);
    if (!p) throw new HttpError(404, 'Profile not found');
    res.json(p);
  });

  r.delete('/:id', (req, res) => {
    if (!repo.deleteProfile(idParam(req))) throw new HttpError(404, 'Profile not found');
    res.status(204).end();
  });

  r.get('/:id/plan', (req, res) => {
    const p = repo.getProfile(idParam(req));
    if (!p) throw new HttpError(404, 'Profile not found');
    const catalog = repo.catalogWithPrices();
    const habits = catalog.habits.length > 0 ? catalog.habits : HABIT_CATALOG;
    res.json(buildPlan(p, repo.listIncome(p.id), repo.listGoals(p.id), repo.listLedger(p.id), habits));
  });

  r.get('/:id/income', (req, res) => {
    res.json(repo.listIncome(idParam(req)));
  });

  r.post('/:id/income', (req, res) => {
    const id = idParam(req);
    if (!repo.getProfile(id)) throw new HttpError(404, 'Profile not found');
    const input = incomeInput.parse(req.body);
    res.status(201).json(repo.addIncome(id, input.label, input.amount, input.cadence as Parameters<Repo['addIncome']>[3]));
  });

  r.delete('/:id/income/:incomeId', (req, res) => {
    if (!repo.deleteIncome(idParam(req, 'incomeId'))) throw new HttpError(404, 'Income source not found');
    res.status(204).end();
  });

  return r;
}
