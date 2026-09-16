import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/goals', '/grow', '/habits', '/earn', '/ledger', '/learn', '/prices'];

// Every page needs a kid to exist, so this file makes its own.
test.beforeAll(async ({ request }) => {
  const existing = (await (await request.get('/api/profiles')).json()) as unknown[];
  if (existing.length === 0) {
    await request.post('/api/profiles', { data: { name: 'Ada', age: 11, allowanceAmount: 10, allowanceCadence: 'weekly' } });
  }
});

for (const path of PAGES) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.html ?? ''}`)).toEqual([]);
  });
}

test('dark mode keeps its contrast', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  for (const path of ['/', '/goals', '/ledger']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${path} ${v.id}: ${v.nodes[0]?.html ?? ''}`)).toEqual([]);
  }
  await ctx.close();
});

test('the chart offers the same numbers as a table', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Show the numbers' }).first().click();
  await expect(page.getByRole('columnheader', { name: 'Total with growth' })).toBeVisible();
});

test('keyboard users can reach the content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});
