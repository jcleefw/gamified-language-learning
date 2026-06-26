import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

// Shared state across steps within a scenario
let masteredWordIds: string[] = [];

// Helper: answer every question in the current batch correctly using the cheat hint.
// Waits for the batch results screen when done.
async function answerBatchCorrectly(page: import('@playwright/test').Page) {
  while (await page.locator('.quiz-card').isVisible()) {
    const cheatHint = await page.locator('.cheat-hint').textContent();
    // Format: "✓ a — ขาว"
    const match = cheatHint?.match(/✓\s+(\S+)\s+—/);
    if (!match) throw new Error(`Unexpected cheat-hint format: "${cheatHint}"`);
    const correctLabel = match[1]; // e.g. "a"

    await page
      .locator('.choice-btn')
      .filter({ has: page.locator('.label', { hasText: new RegExp(`^${correctLabel}$`) }) })
      .click();

    // Brief pause so Vue can update answered state before the next poll
    await page.waitForTimeout(200);
  }
  await page.waitForSelector('.batch-results');
}

Given('the app is open with a clean session', async ({ page }) => {
  masteredWordIds = [];
  // Wipe the server-side DB state (via Vite proxy → port 6060)
  const deleteRes = await page.request.delete('/api/state');
  if (!deleteRes.ok()) {
    console.warn(`DELETE /api/state returned ${deleteRes.status()} (non-critical)`);
  }
  // Verify DB is cleared by fetching state
  const stateRes = await page.request.get('/api/state');
  const stateBody = (await stateRes.json()) as { success: boolean; data: { words: unknown[] } };
  if (stateBody.data?.words?.length > 0) {
    console.warn(`DB still has ${stateBody.data.words.length} word states after clear; retrying DELETE`);
    await page.request.delete('/api/state');
  }
  // Navigate and clear localStorage
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.deck-selector');
});

When('I select the {string} deck', async ({ page }, deckTopic: string) => {
  await page.locator('.deck-btn', { hasText: deckTopic }).click();
  await page.waitForSelector('.quiz-card');
});

When('I answer all questions in the batch correctly', async ({ page }) => {
  await answerBatchCorrectly(page);
});

When('I click {string}', async ({ page }, buttonText: string) => {
  await page.locator('button', { hasText: buttonText }).click();
});

Then('I should see mastered words in the results', async ({ page }) => {
  const badges = page.locator('.mastered-badge');
  await expect(badges.first()).toBeVisible();

  // The display table strips the "th::" prefix (row.wordId.replace('th::','')).
  // Instead, read full IDs from the pool-debug panel's "Mastered — this deck" section,
  // which renders item.id verbatim (e.g. "th::หิว").
  const masteredSection = page.locator('.pool-debug .pool-section').filter({
    has: page.locator('.pool-label', { hasText: /Mastered — this deck/ }),
  });
  const rawIds = await masteredSection.locator('.pool-id').allTextContents();
  masteredWordIds = rawIds.map((id) => id.trim()).filter(Boolean);

  expect(masteredWordIds.length, 'No mastered word IDs found in pool-debug').toBeGreaterThan(0);
});

When('I reload the app', async ({ page }) => {
  await page.reload();
  await page.waitForSelector('.deck-selector');
});

Then('I should see a saved session banner', async ({ page }) => {
  await expect(page.locator('.resume-banner')).toBeVisible();
});

When('I select the {string} deck again', async ({ page }, deckTopic: string) => {
  await page.locator('.deck-btn', { hasText: deckTopic }).click();
  await page.waitForSelector('.quiz-card');
});

Then('none of the mastered words should appear in the quiz active pool', async ({ page }) => {
  // Sanity: masteredWordIds must have been collected in the prior step
  expect(masteredWordIds.length, 'masteredWordIds was not populated').toBeGreaterThan(0);

  // In VITE_CHEAT_MODE the quiz card renders a pool panel.
  // The first .pool-col is "Active" — its .pool-id spans show word IDs.
  const activePoolCol = page.locator('.pool-panel .pool-col').first();
  await expect(activePoolCol, 'Pool panel not visible — is VITE_CHEAT_MODE=true?').toBeVisible();

  const activePoolItems = activePoolCol.locator('.pool-id');
  const activeIds = await activePoolItems.allTextContents();
  expect(activeIds.length, 'Active pool is empty — no words to compare').toBeGreaterThan(0);

  for (const rawId of activeIds) {
    const activeId = rawId.trim();
    expect(
      masteredWordIds,
      `Mastered word "${activeId}" should not appear in the active quiz pool`,
    ).not.toContain(activeId);
  }
});
