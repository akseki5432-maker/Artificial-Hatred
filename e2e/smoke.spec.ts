import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// These tests share one server, so this file starts from a known empty state.
test.beforeAll(async ({ request }) => {
  const profiles = (await (await request.get('/api/profiles')).json()) as { id: number }[];
  for (const p of profiles) await request.delete(`/api/profiles/${p.id}`);
});

test('a kid can set up an allowance and see the money map', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/start$/);
  await page.getByPlaceholder('Sam').fill('Sam');
  await page.getByRole('radio', { name: 'Every day' }).click();
  await page.locator('input[type="number"]').nth(1).fill('3');
  await page.getByRole('button', { name: /Show me my money map/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.hero .value')).toHaveText('$1,095');
  await expect(page.getByText("That's $1,095 a year")).toBeVisible();
});

test('goals show time to reach them and a cart totals a year', async ({ page }) => {
  await page.goto('/goals');
  await page.locator('.tile', { hasText: 'Bike' }).getByRole('button', { name: 'Goal' }).click();
  await expect(page.locator('.card', { hasText: 'Bike' }).first().getByText('50% of your money')).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Bike' }).first().getByText('about 7 months')).toBeVisible();
  await page.locator('.tile', { hasText: 'Laptop' }).getByRole('button', { name: /Add Laptop to cart/ }).click();
  await expect(page.getByText(/73% of a year's allowance/)).toBeVisible();
});

test('saving into a goal finishes it', async ({ page }) => {
  await page.goto('/goals');
  // A cheap goal so a couple of deposits finish it.
  await page.getByPlaceholder('Telescope, guitar, hoverboard…').fill('Comic book');
  await page.getByLabel('Price').fill('10');
  await page.getByRole('button', { name: 'Add goal' }).click();
  const card = page.locator('.card', { hasText: 'Comic book' }).first();
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: /Put money in/ }).click();
  await card.getByLabel('How much to put in').fill('4');
  await card.getByRole('button', { name: 'Add it' }).click();
  await expect(card.getByText('Saved $4 of $10')).toBeVisible();

  await card.getByRole('button', { name: /Put money in/ }).click();
  await card.getByLabel('How much to put in').fill('6');
  await card.getByRole('button', { name: 'Add it' }).click();
  await expect(card.getByText('You did it!')).toBeVisible();

  // Putting money in also wrote it to the log, tagged as a goal.
  await page.goto('/ledger');
  await expect(page.getByText('Toward Comic book').first()).toBeVisible();

  await page.goto('/goals');
  await page.locator('.card', { hasText: 'Comic book' }).first().getByRole('button', { name: /I bought it/ }).click();
  await expect(page.getByRole('heading', { name: /Things you saved up for/ })).toBeVisible();
  await expect(page.locator('.item', { hasText: 'Comic book' })).toBeVisible();
});

test('the grow page reacts to the rate slider', async ({ page }) => {
  await page.goto('/grow');
  const rate = page.getByLabel(/Growth per year/);
  const earned = page.getByText('Your money earned').locator('..').locator('.value');
  await expect(rate).toHaveValue('7');
  // Drag the slider to its minimum: with no growth, nothing is earned.
  await rate.click({ position: { x: 2, y: 8 } });
  await expect(rate).toHaveValue('0');
  await expect(earned).toHaveText('$0');
  // Nudge it back up and money starts working.
  await rate.press('ArrowRight');
  await expect(rate).toHaveValue('0.5');
  await expect(earned).not.toHaveText('$0');
});

test('the log records allowance day and exports csv', async ({ page }) => {
  await page.goto('/ledger');
  await page.getByRole('button', { name: /I got my allowance/ }).click();
  await expect(page.locator('table')).toContainText('allowance');
  const [profile] = (await (await page.request.get('/api/profiles')).json()) as { id: number }[];
  const res = await page.request.get(`/api/profiles/${profile.id}/ledger.csv`);
  expect(res.ok()).toBeTruthy();
  expect(await res.text()).toContain('date,kind,amount,currency,category,note');
});

test('the prices page explains that no provider is configured', async ({ page }) => {
  await page.goto('/prices');
  await expect(page.getByText(/No online price provider is set up/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
});

test('the learn page runs a quiz', async ({ page }) => {
  await page.goto('/learn');
  await page.locator('.tile', { hasText: 'Small money adds up' }).click();
  await page.getByRole('button', { name: '$260' }).click();
  await page.getByRole('button', { name: '$520' }).click();
  await page.getByRole('button', { name: '$1 every day' }).click();
  await page.getByRole('button', { name: 'Check my answers' }).click();
  await expect(page.getByText('3 out of 3')).toBeVisible();
});

test('nothing overflows on a phone', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  for (const path of ['/', '/goals', '/grow', '/habits', '/earn', '/ledger', '/learn', '/prices']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `${path} scrolls sideways`).toBeLessThanOrEqual(390);
  }
  await ctx.close();
});
