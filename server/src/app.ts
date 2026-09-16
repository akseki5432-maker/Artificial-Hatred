import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import type { Db } from './db.js';
import { Repo } from './repo.js';
import { PriceSearchError, type PriceSearchService } from './services/priceSearch/index.js';
import type { FxService } from './services/fx.js';
import { backupRouter } from './routes/backup.js';
import { catalogRouter } from './routes/catalog.js';
import { ledgerRouter } from './routes/ledger.js';
import { profilesRouter } from './routes/profiles.js';
import { skipsRouter } from './routes/skips.js';
import { goalsRouter } from './routes/goals.js';

export interface AppDeps {
  db: Db;
  priceSearch: PriceSearchService;
  fx: FxService;
  /** Allowed CORS origins. Undefined means any origin (handy for local development). */
  corsOrigins?: string[];
  /** Directory of the built web app to serve; skipped when missing. */
  webDist?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApp(deps: AppDeps) {
  const repo = new Repo(deps.db);
  const app = express();
  app.disable('x-powered-by');
  // The app is same-origin in production; cross-origin is only needed for the
  // Vite dev server, so the allowed origins are configurable rather than "*".
  app.use(deps.corsOrigins === undefined ? cors() : cors({ origin: deps.corsOrigins }));
  app.use(express.json({ limit: '2mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, providers: deps.priceSearch.providerStatus(), time: new Date().toISOString() });
  });

  app.get('/api/fx', async (_req, res) => {
    res.json(await deps.fx.status());
  });

  app.use('/api/profiles', profilesRouter(repo, deps.fx));
  app.use('/api', goalsRouter(repo, deps.fx));
  app.use('/api', ledgerRouter(repo));
  app.use('/api', catalogRouter(repo, deps.priceSearch, deps.fx));
  app.use('/api', skipsRouter(repo));
  app.use('/api', backupRouter(repo));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  if (deps.webDist && fs.existsSync(path.join(deps.webDist, 'index.html'))) {
    app.use(express.static(deps.webDist));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(deps.webDist as string, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid input', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
      return;
    }
    if (err instanceof PriceSearchError || err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof SyntaxError && 'body' in (err as object)) {
      res.status(400).json({ error: 'Malformed JSON body' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}

/** Parse a positive integer route param or throw a 400. */
export function idParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`);
  return n;
}
