import type { Catalog, EarnIdea, FxStatus, Goal, IncomeSource, LedgerEntry, Plan, PriceRecord, PriceSearchResult, Profile, ProviderStatus } from './types.ts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; issues?: { path: string; message: string }[] };
    const detail = err.issues?.length ? ` (${err.issues.map((i) => `${i.path}: ${i.message}`).join(', ')})` : '';
    throw new ApiError(res.status, (err.error ?? `Request failed with ${res.status}`) + detail, err.issues);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; providers: ProviderStatus[] }>('GET', '/health'),

  profiles: {
    list: () => request<Profile[]>('GET', '/profiles'),
    get: (id: number) => request<Profile & { income: IncomeSource[] }>('GET', `/profiles/${id}`),
    create: (input: Partial<Profile> & { name: string }) => request<Profile>('POST', '/profiles', input),
    update: (id: number, input: Partial<Profile>) => request<Profile>('PUT', `/profiles/${id}`, input),
    remove: (id: number) => request<void>('DELETE', `/profiles/${id}`),
    plan: (id: number) => request<Plan>('GET', `/profiles/${id}/plan`),
    addIncome: (id: number, input: { label: string; amount: number; cadence: string }) => request<IncomeSource>('POST', `/profiles/${id}/income`, input),
    removeIncome: (id: number, incomeId: number) => request<void>('DELETE', `/profiles/${id}/income/${incomeId}`),
  },

  goals: {
    list: (profileId: number) => request<Goal[]>('GET', `/profiles/${profileId}/goals`),
    create: (profileId: number, input: Partial<Goal>) => request<Goal>('POST', `/profiles/${profileId}/goals`, input),
    update: (id: number, input: Partial<Goal>) => request<Goal>('PUT', `/goals/${id}`, input),
    remove: (id: number) => request<void>('DELETE', `/goals/${id}`),
  },

  ledger: {
    list: (profileId: number) => request<LedgerEntry[]>('GET', `/profiles/${profileId}/ledger`),
    categories: () => request<string[]>('GET', '/ledger/categories'),
    add: (profileId: number, input: { kind: 'in' | 'out'; amount: number; category?: string; note?: string | null }) =>
      request<LedgerEntry>('POST', `/profiles/${profileId}/ledger`, input),
    remove: (id: number) => request<void>('DELETE', `/ledger/${id}`),
    addAllowance: (profileId: number) => request<LedgerEntry>('POST', `/profiles/${profileId}/ledger/allowance`),
    csvUrl: (profileId: number) => `/api/profiles/${profileId}/ledger.csv`,
  },

  backup: {
    url: '/api/backup',
    profileUrl: (id: number) => `/api/profiles/${id}/backup`,
    restore: (data: unknown) => request<{ restored: { profiles: number; goals: number; income: number; ledger: number; prices: number } }>('POST', '/backup/restore', data),
  },

  catalog: (currency?: string) => request<Catalog>('GET', currency ? `/catalog?currency=${encodeURIComponent(currency)}` : '/catalog'),
  fx: () => request<FxStatus>('GET', '/fx'),
  earn: (age?: number | null) => request<EarnIdea[]>('GET', age === null || age === undefined ? '/earn' : `/earn?age=${age}`),

  prices: {
    status: () => request<{ providers: ProviderStatus[]; overrides: PriceRecord[] }>('GET', '/prices'),
    search: (input: { query: string; currency?: string; country?: string; applyToKey?: string; fresh?: boolean }) =>
      request<PriceSearchResult>('POST', '/prices/search', input),
    set: (key: string, input: { price: number; currency?: string; name?: string; note?: string | null }) => request<PriceRecord>('PUT', `/prices/${key}`, input),
    reset: (key: string) => request<void>('DELETE', `/prices/${key}`),
    history: (key: string) => request<{ price: number; currency: string; source: string; at: string }[]>('GET', `/prices/${key}/history`),
    refreshAll: (input: { currency?: string; country?: string }) =>
      request<{ updated: { key: string; price: number; currency: string; provider: string }[]; failed: { key: string; error: string }[] }>('POST', '/prices/refresh', input),
  },
};
