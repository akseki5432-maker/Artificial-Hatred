import path from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3001),
  dbPath: env.POCKETPILOT_DB ?? path.resolve(process.cwd(), '..', 'data', 'pocketpilot.db'),
  serpApiKey: env.SERPAPI_KEY?.trim() || undefined,
  braveApiKey: env.BRAVE_SEARCH_API_KEY?.trim() || undefined,
  enableDuckDuckGo: (env.ENABLE_DDG_SEARCH ?? '1') !== '0',
  priceCacheHours: Number(env.PRICE_CACHE_HOURS ?? 24),
  corsOrigins: env.POCKETPILOT_CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean),
  fxCacheHours: Number(env.FX_CACHE_HOURS ?? 24),
  enableLiveFx: (env.ENABLE_LIVE_FX ?? '1') !== '0',
  searchCountry: (env.PRICE_SEARCH_COUNTRY ?? 'us').toLowerCase(),
  /** Absolute path to the built web app, served in production if present. */
  webDist: env.POCKETPILOT_WEB_DIST ?? path.resolve(process.cwd(), '..', 'web', 'dist'),
};
