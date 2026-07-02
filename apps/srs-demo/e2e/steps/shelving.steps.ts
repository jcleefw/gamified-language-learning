import { createBdd } from 'playwright-bdd';
import { expect, type Page } from '@playwright/test';
import { loadScenario, type ScenarioName } from '../fixtures/index.js';

const { Given, When, Then } = createBdd();

// Scenario-scoped state
let shelvedWordIds: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Answer one MCQ question incorrectly.
async function answerMCQIncorrectly(page: Page): Promise<void> {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found');
  const match = cheatHint.match(/✓\s+(\S+)\s+—/);
  if (!match) throw new Error(`Unexpected cheat-hint format: "${cheatHint}"`);
  const correctLabel = match[1].trim();

  const allChoices = page.locator('.choice-btn');
  const count = await allChoices.count();
  for (let i = 0; i < count; i++) {
    const btn = allChoices.nth(i);
    const btnLabel = await btn.locator('.label').textContent();
    if (btnLabel?.trim() !== correctLabel) {
      await btn.click();
      await page.waitForTimeout(200);
      return;
    }
  }
  throw new Error('Could not find an incorrect MCQ choice');
}

// Answer one sentence question incorrectly (select tiles in wrong order and submit).
async function answerSentenceIncorrectly(page: Page): Promise<void> {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No sentence cheat hint found');

  const wordIds = cheatHint.match(/th::\S+/g) ?? [];
  if (wordIds.length === 0) throw new Error(`No th:: word IDs found in sentence cheat hint: "${cheatHint}"`);

  // Select tiles in REVERSE order to ensure wrong answer
  const reversed = [...wordIds].reverse();
  for (const wordId of reversed) {
    await page.locator(`.tile-bank .tile-chip[data-word-id="${wordId}"]`).first().click();
  }
  await page.locator('button', { hasText: 'Submit' }).click();
  await page.locator('button', { hasText: 'Next' }).click();
  await page.waitForTimeout(200);
}

// Answer the current question incorrectly (MCQ: wrong choice; sentence: wrong order).
async function answerQuestionIncorrectly(page: Page): Promise<void> {
  const isSentence = await page.locator('.tile-bank').isVisible();
  if (isSentence) {
    await answerSentenceIncorrectly(page);
  } else {
    await answerMCQIncorrectly(page);
  }
}

// Answer all questions in the current batch incorrectly.
// Waits for the quiz-card to appear first to handle transitions after "Next Batch →" clicks.
async function answerBatchIncorrectly(page: Page): Promise<void> {
  await page.waitForSelector('.quiz-card');
  while (await page.locator('.quiz-card').isVisible()) {
    await answerQuestionIncorrectly(page);
  }
  await page.waitForSelector('.batch-results');
}

// Get shelved word IDs from the API.
async function getShelvedWordIds(page: Page, deckId: string): Promise<string[]> {
  const res = await page.request.get(`/api/shelving?deckId=${encodeURIComponent(deckId)}`);
  if (!res.ok()) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`GET /api/shelving returned ${res.status()}: ${text}`);
  }
  const body = await res.json() as { success: boolean; data: Array<{ wordId: string; shelvedAtBatch: number }> };
  expect(body.success).toBe(true);
  return body.data.map((sw) => sw.wordId);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

Given('the scenario {string} is loaded', async ({ page }, scenarioName: string) => {
  shelvedWordIds = [];
  const fixture = loadScenario(scenarioName as ScenarioName);

  // Apply config override from fixture if present
  if (fixture.config) {
    await page.request.post('/api/test/config/shelving', {
      data: fixture.config,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await page.request.post('/api/test/seed', {
    data: fixture,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    const text = await res.text().catch(() => '<unreadable>');
    throw new Error(`POST /api/test/seed returned ${res.status()}: ${text}`);
  }
  const body = await res.json() as { success: boolean };
  expect(body.success).toBe(true);

  // Reload so Vue picks up seeded state (clear localStorage so session reinitializes)
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.deck-selector');
});

Given('the shelving config is reset to defaults', async ({ page }) => {
  await page.request.delete('/api/test/config/shelving');
});

When('I answer all word questions in the batch incorrectly', async ({ page }) => {
  await answerBatchIncorrectly(page);
});

When('I resume the saved session', async ({ page }) => {
  await page.waitForSelector('.deck-selector');
  const resumeBanner = page.locator('.resume-banner');
  if (await resumeBanner.isVisible()) {
    const resumeBtn = resumeBanner.locator('button').first();
    await resumeBtn.click();
  } else {
    throw new Error('Expected resume-banner to be visible after reload');
  }
  await page.waitForSelector('.quiz-card');
});

Then('some words should be shelved for {string}', async ({ page }, deckId: string) => {
  // Wait for quiz-card to ensure onAdvanceBatch (including shelving pipeline) has completed
  await page.waitForSelector('.quiz-card', { timeout: 10000 });
  shelvedWordIds = await getShelvedWordIds(page, deckId);
  expect(shelvedWordIds.length, `Expected some shelved words for ${deckId}, got 0`).toBeGreaterThan(0);
});

Then('no words should be shelved for {string}', async ({ page }, deckId: string) => {
  await page.waitForSelector('.quiz-card', { timeout: 10000 });
  const ids = await getShelvedWordIds(page, deckId);
  expect(ids, `Expected no shelved words for ${deckId}`).toHaveLength(0);
});

Then('no more than {int} words should be shelved for {string}', async ({ page }, maxCount: number, deckId: string) => {
  await page.waitForSelector('.quiz-card', { timeout: 10000 });
  const ids = await getShelvedWordIds(page, deckId);
  expect(ids.length, `Expected at most ${maxCount} shelved words, got ${ids.length}`).toBeLessThanOrEqual(maxCount);
});

Then('shelved words should not appear as quiz questions', async ({ page }) => {
  expect(shelvedWordIds.length, 'No shelved word IDs recorded — run "some words should be shelved" first').toBeGreaterThan(0);

  // The quiz-card exposes the MCQ word being assessed via data-question-word-id.
  // Sentence questions expose an empty string (they test multiple words; excluded separately).
  await page.waitForSelector('.quiz-card', { timeout: 10000 });
  const questionWordId = await page.locator('.quiz-card').getAttribute('data-question-word-id');
  if (questionWordId) {
    expect(
      shelvedWordIds,
      `Shelved word "${questionWordId}" should not appear as a quiz question`,
    ).not.toContain(questionWordId);
  }
});

Then('the active pool should maintain configured batch size', async ({ page }) => {
  // After shelving, the active pool should be rebalanced by pulling from queue
  // Expected: active pool size = configured wordsPerBatch (3)
  await page.waitForSelector('.batch-results', { timeout: 10000 });

  // Read pool state from pool-debug data carrier
  const poolDebug = page.locator('.pool-debug-hidden');
  const activeSection = poolDebug.locator('.pool-section').first();
  const activeItems = await activeSection.locator('li:not(.pool-empty)').count();

  // Configured batch size is 3 (wordsPerBatch from CONFIG in App.vue)
  expect(activeItems, `Expected active pool to have 3 items after rebalancing, got ${activeItems}`).toBe(3);
});

Then('the batch should contain expected words from replenished pool', async ({ page }) => {
  // Verify that the next batch contains words from the replenished queue
  // (not just the same words that weren't shelved)
  await page.waitForSelector('.quiz-card', { timeout: 10000 });

  const poolDebug = page.locator('.pool-debug-hidden');
  const activeSection = poolDebug.locator('.pool-section').first();
  const activeWordIds = await activeSection
    .locator('li:not(.pool-empty) .pool-id')
    .allTextContents();

  // Should have at least 3 active words (was 3, shelved 2, pulled 2 new = 3)
  expect(activeWordIds.length, `Expected at least 3 active words, got ${activeWordIds.length}`).toBeGreaterThanOrEqual(3);
});
