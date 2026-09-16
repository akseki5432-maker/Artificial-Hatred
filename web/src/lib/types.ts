import type {
  BalancePoint,
  Cadence,
  CatalogItem,
  CompoundGrowthResult,
  EarnEstimate,
  GoalPlan,
  HabitItem,
  IncomeSource as CoreIncome,
  Insight,
  Normalized,
  PriceSummary,
  SkipHabitResult,
  SplitAmounts,
  SplitPercentages,
} from '@pocketpilot/core';

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
  targetDate: string | null;
  createdAt: string;
}

export interface DeadlinePlan {
  targetDate: string;
  weeksLeft: number;
  neededPerWeek: number;
  shareOfIncome: number;
  onTrack: boolean;
}

export interface LedgerEntry {
  id: number;
  profileId: number;
  kind: 'in' | 'out';
  amount: number;
  category: string;
  note: string | null;
  at: string;
}

export interface PricedCatalogItem extends CatalogItem {
  source: string;
  fetchedAt: string | null;
  originalPrice: number;
  originalCurrency: string;
}

export interface PricedHabit extends HabitItem {
  source: string;
  fetchedAt: string | null;
  originalPrice: number;
  originalCurrency: string;
}

export interface Catalog {
  goals: PricedCatalogItem[];
  habits: PricedHabit[];
  categories: Record<string, string>;
  currency: string;
  catalogReviewed: string;
}

export interface FxStatus {
  source: 'static' | 'live';
  date: string;
  currencies: string[];
}

export interface Plan {
  profile: Profile;
  sources: (CoreIncome & { id: number | null })[];
  normalized: Normalized;
  weeksPerYear: number;
  split: SplitAmounts;
  balanceOneYear: BalancePoint[];
  untilAdult: { years: number; withGrowth: CompoundGrowthResult; noGrowth: CompoundGrowthResult };
  goals: (Goal & { plans: GoalPlan[]; progress: number; deadline: DeadlinePlan | null; convertedFrom: { price: number; currency: string } | null })[];
  habits: (PricedHabit & { oneYear: SkipHabitResult; fiveYears: SkipHabitResult })[];
  ledgerSummary: { spentThisMonth: number; receivedThisMonth: number; byCategory: Record<string, number>; entries: number };
  insights: Insight[];
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

export interface PriceSearchResult {
  query: string;
  provider: string;
  summary: PriceSummary;
  sources: { title: string; url?: string; snippet?: string; price?: number; currency?: string }[];
  fetchedAt: string;
  fromCache: boolean;
  converted: { price: number; currency: string; low: number; high: number } | null;
  saved: PriceRecord | null;
}

export interface ProviderStatus {
  name: string;
  configured: boolean;
}

export type EarnIdea = EarnEstimate;
