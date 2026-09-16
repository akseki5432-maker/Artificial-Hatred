import { describe, expect, it } from 'vitest';
import { parseBrave } from '../src/services/priceSearch/providers/brave.js';
import { parseDuckDuckGoHtml } from '../src/services/priceSearch/providers/duckduckgo.js';
import { parseSerpApi } from '../src/services/priceSearch/providers/serpapi.js';

describe('serpapi parser', () => {
  it('reads structured shopping prices', () => {
    const r = parseSerpApi({
      shopping_results: [
        { title: 'Nintendo Switch 2', price: '$449.99', extracted_price: 449.99, product_link: 'https://example.com/a', source: 'Best Buy' },
        { title: 'Switch 2 bundle', price: '$499.00', extracted_price: 499, link: 'https://example.com/b' },
        { title: 'No price here' },
        { title: 'Text only', price: '€459,99' },
      ],
    });
    expect(r.prices.map((p) => p.value)).toEqual([449.99, 499, 459.99]);
    expect(r.prices[2]?.currency).toBe('EUR');
    expect(r.sources[0]?.url).toBe('https://example.com/a');
  });
});

describe('brave parser', () => {
  it('pulls prices from snippets', () => {
    const r = parseBrave({
      web: {
        results: [
          { title: 'Switch 2 review', url: 'https://x/1', description: 'The console launched at $449.99 and bundles cost $499.99.' },
          { title: 'Forum thread', url: 'https://x/2', description: 'Talking about model numbers 2026', extra_snippets: ['Bought mine for 460 dollars'] },
          { title: 'Nothing', url: 'https://x/3', description: 'No numbers at all' },
        ],
      },
    });
    expect(r.prices.map((p) => p.value)).toEqual([449.99, 499.99, 460]);
    expect(r.sources).toHaveLength(2);
  });
});

describe('duckduckgo parser', () => {
  it('reads result titles and snippets from the html page', () => {
    const html = `
<div id="links" class="results">
  <div class="result results_links results_links_deep web-result ">
    <div class="links_main links_deep result__body">
      <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fshop.example.com%2Fswitch2&amp;rut=abc">Nintendo Switch 2 &#x27;s price is $449.99</a></h2>
      <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fshop.example.com%2Fswitch2">Buy the <b>Nintendo Switch 2</b> for $449.99 or the bundle for $499.99.</a>
    </div>
  </div>
  <div class="result results_links results_links_deep web-result ">
    <div class="links_main links_deep result__body">
      <h2 class="result__title"><a class="result__a" href="https://news.example.com/x">Switch 2 news</a></h2>
      <a class="result__snippet" href="https://news.example.com/x">Nothing about money.</a>
    </div>
  </div>
  <div class="nav-link"></div>
</div>`;
    const r = parseDuckDuckGoHtml(html);
    expect(r.prices.map((p) => p.value)).toEqual([449.99, 449.99, 499.99]);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0]?.url).toBe('https://shop.example.com/switch2');
    expect(r.sources[0]?.title).toBe("Nintendo Switch 2 's price is $449.99");
  });

  it('returns nothing for an empty page', () => {
    expect(parseDuckDuckGoHtml('<html></html>').prices).toEqual([]);
  });
});
