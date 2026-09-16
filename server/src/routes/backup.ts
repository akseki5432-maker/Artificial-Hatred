import { Router } from 'express';
import { z } from 'zod';
import { CADENCES } from '@pocketpilot/core';
import { HttpError, idParam } from '../app.js';
import type { Repo } from '../repo.js';

const cadence = z.enum(CADENCES as [string, ...string[]]);

/** Shape of a backup file. `version` lets future readers migrate old files. */
const backupSchema = z.object({
  app: z.literal('pocketpilot'),
  version: z.literal(1),
  exportedAt: z.string().optional(),
  profiles: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        age: z.number().int().min(3).max(25).nullable().optional(),
        currency: z.string().trim().length(3).optional(),
        allowanceAmount: z.number().min(0).optional(),
        allowanceCadence: cadence.optional(),
        savingsRate: z.number().min(0).max(1).optional(),
        growthRatePct: z.number().min(0).max(30).optional(),
        startingBalance: z.number().min(0).optional(),
        split: z.object({ save: z.number(), spend: z.number(), share: z.number(), invest: z.number() }).optional(),
        income: z.array(z.object({ label: z.string().trim().min(1).max(60), amount: z.number().min(0), cadence })).default([]),
        goals: z
          .array(
            z.object({
              catalogId: z.string().nullable().optional(),
              name: z.string().trim().min(1).max(80),
              emoji: z.string().trim().max(8).optional(),
              price: z.number().min(0),
              currency: z.string().trim().length(3).optional(),
              searchQuery: z.string().nullable().optional(),
              savedSoFar: z.number().min(0).optional(),
              isFavorite: z.boolean().optional(),
              targetDate: z.string().nullable().optional(),
            }),
          )
          .default([]),
        ledger: z
          .array(
            z.object({
              kind: z.enum(['in', 'out']),
              amount: z.number().positive(),
              category: z.string().trim().max(30).optional(),
              note: z.string().nullable().optional(),
              at: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  prices: z
    .array(
      z.object({
        key: z.string().trim().min(3).max(80),
        name: z.string().trim().min(1).max(80),
        price: z.number().min(0),
        currency: z.string().trim().length(3),
        source: z.string().trim().max(40).optional(),
        query: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

export type Backup = z.infer<typeof backupSchema>;

export function backupRouter(repo: Repo) {
  const r = Router();

  /** Everything, as one JSON file the family can keep. */
  r.get('/backup', (_req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="pocketpilot-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(buildBackup(repo));
  });

  /** One kid's data, for moving between devices. */
  r.get('/profiles/:id/backup', (req, res) => {
    const id = idParam(req);
    if (!repo.getProfile(id)) throw new HttpError(404, 'Profile not found');
    res.json(buildBackup(repo, id));
  });

  /**
   * Restore a backup. Profiles are always added, never overwritten, so a
   * restore can never silently destroy what is already there.
   */
  r.post('/backup/restore', (req, res) => {
    const backup = backupSchema.parse(req.body);
    const added = { profiles: 0, goals: 0, income: 0, ledger: 0, prices: 0 };
    for (const p of backup.profiles) {
      const profile = repo.createProfile({
        name: p.name,
        age: p.age ?? null,
        currency: (p.currency ?? 'USD').toUpperCase(),
        allowanceAmount: p.allowanceAmount ?? 0,
        allowanceCadence: (p.allowanceCadence ?? 'weekly') as Parameters<Repo['createProfile']>[0]['allowanceCadence'],
        savingsRate: p.savingsRate ?? 0.5,
        growthRatePct: p.growthRatePct ?? 7,
        startingBalance: p.startingBalance ?? 0,
        ...(p.split ? { split: p.split } : {}),
      });
      added.profiles++;
      for (const i of p.income) {
        repo.addIncome(profile.id, i.label, i.amount, i.cadence as Parameters<Repo['addIncome']>[3]);
        added.income++;
      }
      for (const g of p.goals) {
        repo.createGoal(profile.id, {
          catalogId: g.catalogId ?? null,
          name: g.name,
          emoji: g.emoji ?? '🎯',
          price: g.price,
          currency: (g.currency ?? profile.currency).toUpperCase(),
          searchQuery: g.searchQuery ?? null,
          savedSoFar: g.savedSoFar ?? 0,
          isFavorite: g.isFavorite ?? false,
          targetDate: g.targetDate ?? null,
        });
        added.goals++;
      }
      for (const e of p.ledger) {
        repo.addLedger(profile.id, { kind: e.kind, amount: e.amount, category: e.category ?? 'other', note: e.note ?? null, ...(e.at ? { at: e.at } : {}) });
        added.ledger++;
      }
    }
    for (const price of backup.prices) {
      repo.setPrice({ ...price, source: price.source ?? 'manual', query: price.query ?? null, note: price.note ?? null });
      added.prices++;
    }
    res.status(201).json({ restored: added });
  });

  return r;
}

function buildBackup(repo: Repo, onlyProfileId?: number): Backup {
  const profiles = repo.listProfiles().filter((p) => onlyProfileId === undefined || p.id === onlyProfileId);
  return {
    app: 'pocketpilot',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: profiles.map((p) => ({
      name: p.name,
      age: p.age,
      currency: p.currency,
      allowanceAmount: p.allowanceAmount,
      allowanceCadence: p.allowanceCadence,
      savingsRate: p.savingsRate,
      growthRatePct: p.growthRatePct,
      startingBalance: p.startingBalance,
      split: p.split,
      income: repo.listIncome(p.id).map((i) => ({ label: i.label, amount: i.amount, cadence: i.cadence })),
      goals: repo.listGoals(p.id).map((g) => ({
        catalogId: g.catalogId,
        name: g.name,
        emoji: g.emoji,
        price: g.price,
        currency: g.currency,
        searchQuery: g.searchQuery,
        savedSoFar: g.savedSoFar,
        isFavorite: g.isFavorite,
        targetDate: g.targetDate,
      })),
      ledger: repo.listLedger(p.id, 100_000).map((e) => ({ kind: e.kind, amount: e.amount, category: e.category, note: e.note, at: e.at })),
    })),
    prices: onlyProfileId === undefined ? repo.listPrices().map((p) => ({ key: p.key, name: p.name, price: p.price, currency: p.currency, source: p.source, query: p.query, note: p.note })) : [],
  };
}
