import { config } from './config.js';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { PriceSearchService } from './services/priceSearch/index.js';
import { BraveProvider } from './services/priceSearch/providers/brave.js';
import { DuckDuckGoProvider } from './services/priceSearch/providers/duckduckgo.js';
import { SerpApiProvider } from './services/priceSearch/providers/serpapi.js';

const db = openDb(config.dbPath);
const priceSearch = new PriceSearchService(
  [new SerpApiProvider(config.serpApiKey), new BraveProvider(config.braveApiKey), new DuckDuckGoProvider(config.enableDuckDuckGo)],
  db,
  config.priceCacheHours,
  (msg) => console.warn(`[price-search] ${msg}`),
);

const app = createApp({ db, priceSearch, webDist: config.webDist });

app.listen(config.port, () => {
  const providers = priceSearch
    .providerStatus()
    .map((p) => `${p.name}${p.configured ? '' : ' (off)'}`)
    .join(', ');
  console.log(`PocketPilot API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`Price providers: ${providers}`);
});
