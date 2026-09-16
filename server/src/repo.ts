import { GOAL_CATALOG, HABIT_CATALOG, canConvert, convertPrice, type Cadence, type CatalogItem, type HabitItem, type RateTable, type SplitPercentages } from '@pocketpilot/core';
import type { Db } from './db.js';

export interface Profile {
  id: number;
  name: string;
  age: number | null;
  currency: string;
  allowanceAmount: number;
  allowanceCadence: Cadence;
  savingsRate: number;
  growthRatePct: number;
  startingBalance: number;
  split: SplitPercentages;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileInput {
  name: string;
  age?: number | null;
  currency?: string;
  allowanceAmount?: number;
  allowanceCadence?: Cadence;
  savingsRate?: number;
  growthRatePct?: number;
  startingBalance?: number;
  split?: SplitPercentages;
}

export interface IncomeSource {
  id: number;
  profileId: number;
  label: string;
  amount: number;
  cadence: Cadence;
}

export interface Goal {
  id: number;
  profileId: number;
  catalogId: string | null;
  name: string;
  emoji: string;
  price: number;
  currency: string;
  searchQuery: string | null;
  savedSoFar: number;
  isFavorite: boolean;
  /** ISO date (YYYY-MM-DD) the kid wants it by, if any. */
  targetDate: string | null;
  /** Set when the kid actually got the thing. */
  completedAt: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: number;
  profileId: number;
  kind: 'in' | 'out';
  amount: number;
  category: string;
  note: string | null;
  /** The goal this entry was put toward, if any. */
  goalId: number | null;
  at: string;
}

export interface Skip {
  id: number;
  profileId: number;
  habitId: string;
  name: string;
  amount: number;
  /** When the money was actually moved into savings, if it has been. */
  movedAt: string | null;
  at: string;
}

export interface PriceRecord {
  key: string;
  name: string;
  price: number;
  currency: string;
  source: string;
  query: string | null;
  note: string | null;
  fetchedAt: string;
}

type Row = Record<string, unknown>;

export type PricedItem<T> = T & {
  source: string;
  fetchedAt: string | null;
  /** Price and currency before conversion to the requested currency. */
  originalPrice: number;
  originalCurrency: string;
};

function rowToProfile(r: Row): Profile {
  let split: SplitPercentages = { save: 40, spend: 40, share: 10, invest: 10 };
  try {
    split = { ...split, ...(JSON.parse(String(r.split_json)) as Partial<SplitPercentages>) };
  } catch {
    /* keep default */
  }
  return {
    id: Number(r.id),
    name: String(r.name),
    age: r.age === null || r.age === undefined ? null : Number(r.age),
    currency: String(r.currency),
    allowanceAmount: Number(r.allowance_amount),
    allowanceCadence: String(r.allowance_cadence) as Cadence,
    savingsRate: Number(r.savings_rate),
    growthRatePct: Number(r.growth_rate_pct),
    startingBalance: Number(r.starting_balance),
    split,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function rowToGoal(r: Row): Goal {
  return {
    id: Number(r.id),
    profileId: Number(r.profile_id),
    catalogId: r.catalog_id === null ? null : String(r.catalog_id),
    name: String(r.name),
    emoji: String(r.emoji),
    price: Number(r.price),
    currency: String(r.currency),
    searchQuery: r.search_query === null ? null : String(r.search_query),
    savedSoFar: Number(r.saved_so_far),
    isFavorite: Number(r.is_favorite) === 1,
    targetDate: r.target_date === null || r.target_date === undefined ? null : String(r.target_date),
    completedAt: r.completed_at === null || r.completed_at === undefined ? null : String(r.completed_at),
    createdAt: String(r.created_at),
  };
}

function rowToLedger(r: Row): LedgerEntry {
  return {
    id: Number(r.id),
    profileId: Number(r.profile_id),
    kind: String(r.kind) as 'in' | 'out',
    amount: Number(r.amount),
    category: String(r.category),
    note: r.note === null ? null : String(r.note),
    goalId: r.goal_id === null || r.goal_id === undefined ? null : Number(r.goal_id),
    at: String(r.at),
  };
}

function rowToPrice(r: Row): PriceRecord {
  return {
    key: String(r.key),
    name: String(r.name),
    price: Number(r.price),
    currency: String(r.currency),
    source: String(r.source),
    query: r.query === null ? null : String(r.query),
    note: r.note === null ? null : String(r.note),
    fetchedAt: String(r.fetched_at),
  };
}

/** Best-guess spending category for a finished goal, for the "where it goes" chart. */
function categoryForGoal(goal: Goal): string {
  const item = GOAL_CATALOG.find((g) => g.id === goal.catalogId);
  switch (item?.category) {
    case 'games':
      return 'games';
    case 'toys':
      return 'toys';
    case 'sports':
      return 'clothes';
    case 'experiences':
      return 'fun';
    default:
      return 'other';
  }
}

export class Repo {
  constructor(private readonly db: Db) {}

  // ----- profiles -----
  listProfiles(): Profile[] {
    return (this.db.prepare('SELECT * FROM profiles ORDER BY id').all() as Row[]).map(rowToProfile);
  }

  getProfile(id: number): Profile | null {
    const row = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToProfile(row) : null;
  }

  createProfile(input: ProfileInput): Profile {
    const res = this.db
      .prepare(
        `INSERT INTO profiles (name, age, currency, allowance_amount, allowance_cadence, savings_rate, growth_rate_pct, starting_balance, split_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.age ?? null,
        input.currency ?? 'USD',
        input.allowanceAmount ?? 0,
        input.allowanceCadence ?? 'weekly',
        input.savingsRate ?? 0.5,
        input.growthRatePct ?? 7,
        input.startingBalance ?? 0,
        JSON.stringify(input.split ?? { save: 40, spend: 40, share: 10, invest: 10 }),
      );
    return this.getProfile(Number(res.lastInsertRowid)) as Profile;
  }

  updateProfile(id: number, input: Partial<ProfileInput>): Profile | null {
    const current = this.getProfile(id);
    if (!current) return null;
    const next = {
      name: input.name ?? current.name,
      age: input.age === undefined ? current.age : input.age,
      currency: input.currency ?? current.currency,
      allowanceAmount: input.allowanceAmount ?? current.allowanceAmount,
      allowanceCadence: input.allowanceCadence ?? current.allowanceCadence,
      savingsRate: input.savingsRate ?? current.savingsRate,
      growthRatePct: input.growthRatePct ?? current.growthRatePct,
      startingBalance: input.startingBalance ?? current.startingBalance,
      split: input.split ?? current.split,
    };
    this.db
      .prepare(
        `UPDATE profiles SET name=?, age=?, currency=?, allowance_amount=?, allowance_cadence=?, savings_rate=?, growth_rate_pct=?, starting_balance=?, split_json=?, updated_at=datetime('now')
         WHERE id=?`,
      )
      .run(
        next.name,
        next.age,
        next.currency,
        next.allowanceAmount,
        next.allowanceCadence,
        next.savingsRate,
        next.growthRatePct,
        next.startingBalance,
        JSON.stringify(next.split),
        id,
      );
    return this.getProfile(id);
  }

  deleteProfile(id: number): boolean {
    return this.db.prepare('DELETE FROM profiles WHERE id = ?').run(id).changes > 0;
  }

  // ----- income sources -----
  listIncome(profileId: number): IncomeSource[] {
    return (this.db.prepare('SELECT * FROM income_sources WHERE profile_id = ? ORDER BY id').all(profileId) as Row[]).map((r) => ({
      id: Number(r.id),
      profileId: Number(r.profile_id),
      label: String(r.label),
      amount: Number(r.amount),
      cadence: String(r.cadence) as Cadence,
    }));
  }

  addIncome(profileId: number, label: string, amount: number, cadence: Cadence): IncomeSource {
    const res = this.db.prepare('INSERT INTO income_sources (profile_id, label, amount, cadence) VALUES (?, ?, ?, ?)').run(profileId, label, amount, cadence);
    return { id: Number(res.lastInsertRowid), profileId, label, amount, cadence };
  }

  deleteIncome(id: number): boolean {
    return this.db.prepare('DELETE FROM income_sources WHERE id = ?').run(id).changes > 0;
  }

  // ----- goals -----
  listGoals(profileId: number): Goal[] {
    return (this.db.prepare('SELECT * FROM goals WHERE profile_id = ? ORDER BY completed_at IS NOT NULL, is_favorite DESC, id').all(profileId) as Row[]).map(rowToGoal);
  }

  getGoal(id: number): Goal | null {
    const row = this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Row | undefined;
    return row ? rowToGoal(row) : null;
  }

  createGoal(profileId: number, g: Omit<Goal, 'id' | 'profileId' | 'createdAt' | 'completedAt'>): Goal {
    const res = this.db
      .prepare(
        `INSERT INTO goals (profile_id, catalog_id, name, emoji, price, currency, search_query, saved_so_far, is_favorite, target_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(profileId, g.catalogId, g.name, g.emoji, g.price, g.currency, g.searchQuery, g.savedSoFar, g.isFavorite ? 1 : 0, g.targetDate);
    return this.getGoal(Number(res.lastInsertRowid)) as Goal;
  }

  updateGoal(id: number, patch: Partial<Omit<Goal, 'id' | 'profileId' | 'createdAt'>>): Goal | null {
    const cur = this.getGoal(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    this.db
      .prepare('UPDATE goals SET catalog_id=?, name=?, emoji=?, price=?, currency=?, search_query=?, saved_so_far=?, is_favorite=?, target_date=?, completed_at=? WHERE id=?')
      .run(next.catalogId, next.name, next.emoji, next.price, next.currency, next.searchQuery, next.savedSoFar, next.isFavorite ? 1 : 0, next.targetDate, next.completedAt, id);
    return this.getGoal(id);
  }

  deleteGoal(id: number): boolean {
    return this.db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0;
  }

  // ----- ledger -----
  listLedger(profileId: number, limit = 200): LedgerEntry[] {
    return (this.db.prepare('SELECT * FROM ledger WHERE profile_id = ? ORDER BY at DESC, id DESC LIMIT ?').all(profileId, limit) as Row[]).map(rowToLedger);
  }

  addLedger(profileId: number, e: { kind: 'in' | 'out'; amount: number; category: string; note?: string | null; at?: string; goalId?: number | null }): LedgerEntry {
    const res = this.db
      .prepare("INSERT INTO ledger (profile_id, kind, amount, category, note, goal_id, at) VALUES (?, ?, ?, ?, ?, ?, COALESCE(datetime(?), datetime('now')))")
      .run(profileId, e.kind, e.amount, e.category, e.note ?? null, e.goalId ?? null, e.at ?? null);
    const row = this.db.prepare('SELECT * FROM ledger WHERE id = ?').get(Number(res.lastInsertRowid)) as Row;
    return rowToLedger(row);
  }

  deleteLedger(id: number): boolean {
    return this.db.prepare('DELETE FROM ledger WHERE id = ?').run(id).changes > 0;
  }

  /**
   * Move money into a goal: one ledger entry plus the goal's progress, in a
   * single transaction so the log and the goal can never disagree.
   */
  saveTowardGoal(profileId: number, goalId: number, amount: number, note?: string | null): { goal: Goal; entry: LedgerEntry } {
    this.db.exec('BEGIN');
    try {
      const goal = this.getGoal(goalId);
      if (!goal || goal.profileId !== profileId) throw new Error('Goal not found');
      const entry = this.addLedger(profileId, { kind: 'out', amount, category: 'saving', note: note ?? `Toward ${goal.name}`, goalId });
      this.db.prepare('UPDATE goals SET saved_so_far = saved_so_far + ? WHERE id = ?').run(amount, goalId);
      this.db.exec('COMMIT');
      return { goal: this.getGoal(goalId) as Goal, entry };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Mark a goal as bought. Money that was already in the Save jar is taken back
   * out of it and the full price is recorded as a purchase, so the jar, the
   * balance and the spending totals all stay consistent.
   */
  completeGoal(goalId: number, logPurchase: boolean): { goal: Goal; entries: LedgerEntry[] } {
    this.db.exec('BEGIN');
    try {
      const goal = this.getGoal(goalId);
      if (!goal) throw new Error('Goal not found');
      const entries: LedgerEntry[] = [];
      if (logPurchase) {
        const saved = this.jarBalanceForGoal(goalId);
        if (saved > 0) {
          entries.push(this.addLedger(goal.profileId, { kind: 'in', amount: saved, category: 'saving', note: `From the Save jar for ${goal.name}`, goalId }));
        }
        if (goal.price > 0) {
          entries.push(this.addLedger(goal.profileId, { kind: 'out', amount: goal.price, category: categoryForGoal(goal), note: `Bought ${goal.name}`, goalId }));
        }
      }
      this.db.prepare("UPDATE goals SET completed_at = datetime('now'), is_favorite = 0 WHERE id = ?").run(goalId);
      this.db.exec('COMMIT');
      return { goal: this.getGoal(goalId) as Goal, entries };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** How much of this goal's money is sitting in the Save jar right now. */
  private jarBalanceForGoal(goalId: number): number {
    const row = this.db
      .prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'out' THEN amount ELSE -amount END), 0) AS total FROM ledger WHERE goal_id = ? AND category = 'saving'")
      .get(goalId) as { total: number };
    return Math.max(0, row.total);
  }

  // ----- skips -----
  listSkips(profileId: number, limit = 200): Skip[] {
    return (this.db.prepare('SELECT * FROM skips WHERE profile_id = ? ORDER BY at DESC, id DESC LIMIT ?').all(profileId, limit) as Row[]).map((r) => ({
      id: Number(r.id),
      profileId: Number(r.profile_id),
      habitId: String(r.habit_id),
      name: String(r.name),
      amount: Number(r.amount),
      movedAt: r.moved_at === null || r.moved_at === undefined ? null : String(r.moved_at),
      at: String(r.at),
    }));
  }

  addSkip(profileId: number, habitId: string, name: string, amount: number): Skip {
    const res = this.db.prepare('INSERT INTO skips (profile_id, habit_id, name, amount) VALUES (?, ?, ?, ?)').run(profileId, habitId, name, amount);
    return this.listSkips(profileId).find((s) => s.id === Number(res.lastInsertRowid)) as Skip;
  }

  deleteSkip(id: number): boolean {
    return this.db.prepare('DELETE FROM skips WHERE id = ?').run(id).changes > 0;
  }

  /**
   * Turn skipped purchases into real saved money: one ledger entry for the
   * total, and the skips are marked so the same money cannot be moved twice.
   */
  moveSkipsToSavings(profileId: number, goalId: number | null): { moved: number; count: number; entry: LedgerEntry | null } {
    this.db.exec('BEGIN');
    try {
      const pending = this.listSkips(profileId, 10_000).filter((s) => s.movedAt === null);
      const total = Math.round(pending.reduce((sum, s) => sum + s.amount, 0) * 100) / 100;
      if (total <= 0) {
        this.db.exec('COMMIT');
        return { moved: 0, count: 0, entry: null };
      }
      const goal = goalId === null ? null : this.getGoal(goalId);
      if (goalId !== null && (!goal || goal.profileId !== profileId)) throw new Error('Goal not found');
      const entry = this.addLedger(profileId, {
        kind: 'out',
        amount: total,
        category: 'saving',
        note: goal ? `Skipped ${pending.length} treats, toward ${goal.name}` : `Skipped ${pending.length} treats`,
        goalId: goal ? goal.id : null,
      });
      if (goal) this.db.prepare('UPDATE goals SET saved_so_far = saved_so_far + ? WHERE id = ?').run(total, goal.id);
      const stamp = this.db.prepare("SELECT datetime('now') AS now").get() as { now: string };
      const update = this.db.prepare('UPDATE skips SET moved_at = ? WHERE id = ?');
      for (const s of pending) update.run(stamp.now, s.id);
      this.db.exec('COMMIT');
      return { moved: total, count: pending.length, entry };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // ----- prices -----
  listPrices(): PriceRecord[] {
    return (this.db.prepare('SELECT * FROM prices').all() as Row[]).map(rowToPrice);
  }

  getPrice(key: string): PriceRecord | null {
    const row = this.db.prepare('SELECT * FROM prices WHERE key = ?').get(key) as Row | undefined;
    return row ? rowToPrice(row) : null;
  }

  setPrice(p: { key: string; name: string; price: number; currency: string; source: string; query?: string | null; note?: string | null }): PriceRecord {
    this.db
      .prepare(
        `INSERT INTO prices (key, name, price, currency, source, query, note, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET name=excluded.name, price=excluded.price, currency=excluded.currency, source=excluded.source, query=excluded.query, note=excluded.note, fetched_at=excluded.fetched_at`,
      )
      .run(p.key, p.name, p.price, p.currency, p.source, p.query ?? null, p.note ?? null);
    this.db.prepare('INSERT INTO price_history (key, price, currency, source) VALUES (?, ?, ?, ?)').run(p.key, p.price, p.currency, p.source);
    return this.getPrice(p.key) as PriceRecord;
  }

  resetPrice(key: string): boolean {
    return this.db.prepare('DELETE FROM prices WHERE key = ?').run(key).changes > 0;
  }

  priceHistory(key: string, limit = 50): { price: number; currency: string; source: string; at: string }[] {
    return (this.db.prepare('SELECT price, currency, source, at FROM price_history WHERE key = ? ORDER BY at DESC, id DESC LIMIT ?').all(key, limit) as Row[]).map((r) => ({
      price: Number(r.price),
      currency: String(r.currency),
      source: String(r.source),
      at: String(r.at),
    }));
  }

  /**
   * Catalog with stored price overrides applied, converted into `currency`
   * when a rate table is given. Items keep their original price for reference.
   */
  catalogWithPrices(currency?: string, rates?: RateTable): { goals: PricedItem<CatalogItem>[]; habits: PricedItem<HabitItem>[]; currency: string } {
    const overrides = new Map(this.listPrices().map((p) => [p.key, p]));
    const target = (currency ?? 'USD').toUpperCase();
    const apply = <T extends { id: string; price: number; currency: string }>(prefix: string, item: T): PricedItem<T> => {
      const o = overrides.get(`${prefix}:${item.id}`);
      const base = o ? { ...item, price: o.price, currency: o.currency, source: o.source, fetchedAt: o.fetchedAt } : { ...item, source: 'catalog', fetchedAt: null };
      if (base.currency.toUpperCase() === target || !rates || !canConvert(base.currency, target, rates)) {
        return { ...base, originalPrice: base.price, originalCurrency: base.currency };
      }
      return { ...base, price: convertPrice(base.price, base.currency, target, rates), currency: target, originalPrice: base.price, originalCurrency: base.currency };
    };
    return {
      goals: GOAL_CATALOG.map((g) => apply('goal', g)),
      habits: HABIT_CATALOG.map((h) => apply('habit', h)),
      currency: target,
    };
  }
}
