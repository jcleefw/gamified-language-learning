import { createBdd } from 'playwright-bdd';
import { expect, type Page } from '@playwright/test';

const { Given, When, Then } = createBdd();

// Shared state across steps within a scenario
let storedSentencePrompt = '';

Given('the sentence scheduling is configured for tests', async ({ page }) => {
  // Set sentenceBatchGap to 0 so sentences appear immediately after words are seen
  const res = await page.request.post('/api/test/config/sentence', {
    data: {
      sentenceScheduling: {
        minSeenForSentence: 1,
        sentenceBatchGap: 0,
      },
    },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) {
    throw new Error(`Failed to set sentence config: ${res.status()}`);
  }
  // Hard refresh the page to ensure new config is loaded
  await page.goto(page.url(), { waitUntil: 'networkidle', referer: 'about:client' });
  await page.waitForSelector('.deck-selector');
});

// Parse the sentence cheat hint into an ordered array of wordIds.
// Cheat hint text: "✓ th::หิว → th::แล้ว → th::ไป"
function parseSentenceCheatHint(text: string): string[] {
  return text
    .replace(/^✓\s*/, '')
    .split('→')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Click tiles in the given wordId order from the tile bank.
async function placeTiles(page: Page, wordIds: string[]) {
  for (const wordId of wordIds) {
    await page
      .locator('.tile-bank .tile-chip')
      .filter({ has: page.locator(`[data-word-id="${wordId}"]`) })
      .first()
      .click();
  }
}

// Answer a single word-block question correctly and click Next.
async function answerSentenceCorrectly(page: Page) {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found for sentence question');

  const correctOrder = parseSentenceCheatHint(cheatHint);
  await placeTiles(page, correctOrder);

  await page.locator('button', { hasText: 'Submit' }).click();
  await page.locator('button', { hasText: 'Next' }).click();
  await page.waitForTimeout(200);
}

// Answer every question in the current batch (MCQ or word-block) correctly.
async function answerBatchMixed(page: Page) {
  while (await page.locator('.quiz-card').isVisible()) {
    const isSentence = await page.locator('.tile-bank').isVisible();

    if (isSentence) {
      await answerSentenceCorrectly(page);
    } else {
      // MCQ — reuse existing cheat-hint strategy
      const cheatHint = await page.locator('.cheat-hint').textContent();
      const match = cheatHint?.match(/✓\s+(\S+)\s+—/);
      if (!match) throw new Error(`Unexpected cheat-hint format: "${cheatHint}"`);
      const correctLabel = match[1];

      await page
        .locator('.choice-btn')
        .filter({ has: page.locator('.label', { hasText: new RegExp(`^${correctLabel}$`) }) })
        .click();

      await page.waitForTimeout(200);
    }
  }

  await page.waitForSelector('.batch-results');
}

When('I answer all word and sentence questions in the batch correctly', async ({ page }) => {
  await answerBatchMixed(page);
});

Then('I should see a sentence question in the batch', async ({ page }) => {
  // Poll through questions until we see a word-block (tile-bank), or exhaust the batch.
  // If we find one, pass. If we reach results without seeing one, fail.
  let foundSentence = false;

  while (await page.locator('.quiz-card').isVisible()) {
    const isSentence = await page.locator('.tile-bank').isVisible();

    if (isSentence) {
      foundSentence = true;
      break;
    }

    // It's an MCQ — skip it by answering (any choice)
    const firstChoice = page.locator('.choice-btn').first();
    await firstChoice.click();
    await page.waitForTimeout(200);
  }

  expect(foundSentence, 'No sentence (word-block) question appeared in this batch').toBe(true);
});

Then('I should see the batch results screen', async ({ page }) => {
  await expect(page.locator('.batch-results')).toBeVisible();
});

// Skip MCQ questions until a word-block question is visible.
When('I skip MCQ questions to reach the sentence question', async ({ page }) => {
  while (await page.locator('.quiz-card').isVisible()) {
    if (await page.locator('.tile-bank').isVisible()) break;
    await page.locator('.choice-btn').first().click();
    await page.waitForTimeout(200);
  }
  await expect(page.locator('.tile-bank'), 'No sentence question found in this batch').toBeVisible();
});

// Place tiles in correct order and click Submit (does not click Next).
When('I submit the sentence correctly', async ({ page }) => {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found');
  const correctOrder = parseSentenceCheatHint(cheatHint);
  await placeTiles(page, correctOrder);
  await page.locator('button', { hasText: 'Submit' }).click();
});

// Place tiles in reversed order and click Submit (does not click Next).
When('I submit the sentence with wrong tile order', async ({ page }) => {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found');
  const correctOrder = parseSentenceCheatHint(cheatHint);
  const wrongOrder = [...correctOrder].reverse();
  await placeTiles(page, wrongOrder);
  await page.locator('button', { hasText: 'Submit' }).click();
});

When('I note the sentence question prompt', async ({ page }) => {
  storedSentencePrompt = (await page.locator('.quiz-card .prompt').textContent())?.trim() ?? '';
  expect(storedSentencePrompt, 'Could not read sentence prompt').not.toBe('');
});

When('I click "Next" on the sentence feedback', async ({ page }) => {
  await page.locator('button', { hasText: 'Next' }).click();
  await page.waitForTimeout(200);
});

Then('I should see correct sentence feedback', async ({ page }) => {
  await expect(page.locator('.sentence-feedback.correct')).toBeVisible();
});

Then('I should see incorrect sentence feedback', async ({ page }) => {
  await expect(page.locator('.sentence-feedback.wrong')).toBeVisible();
});

Then('I should see the correct answer displayed', async ({ page }) => {
  await expect(page.locator('.correct-answer')).toBeVisible();
});

Then('I should see a {string} button', async ({ page }, label: string) => {
  await expect(page.locator('button', { hasText: label })).toBeVisible();
});

Then('the same sentence should appear again before the batch ends', async ({ page }) => {
  expect(storedSentencePrompt, 'No prompt was stored — run "I note the sentence question prompt" first').not.toBe('');

  let found = false;

  while (await page.locator('.quiz-card').isVisible()) {
    const prompt = (await page.locator('.quiz-card .prompt').textContent())?.trim();

    if (prompt === storedSentencePrompt) {
      found = true;
      break;
    }

    // Advance past this question
    if (await page.locator('.tile-bank').isVisible()) {
      await answerSentenceCorrectly(page);
    } else {
      await page.locator('.choice-btn').first().click();
      await page.waitForTimeout(200);
    }
  }

  expect(found, `Sentence "${storedSentencePrompt}" was not re-presented before the batch ended`).toBe(true);
});
