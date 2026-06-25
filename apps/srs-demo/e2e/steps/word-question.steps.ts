import { createBdd } from 'playwright-bdd';
import { expect, type Page } from '@playwright/test';

const { When, Then } = createBdd();

// Shared state across steps within a scenario
let storedWordPrompt = '';
let storedWordValue = '';

// Parse the MCQ cheat hint and return { label, value }.
// Cheat hint text: "✓ a — ขาว"
function parseMCQCheatHint(text: string): { label: string; value: string } {
  const match = text.match(/✓\s+(\S+)\s+—\s+(.+)/);
  if (!match) throw new Error(`Unexpected MCQ cheat-hint format: "${text}"`);
  return { label: match[1].trim(), value: match[2].trim() };
}

// Click the correct MCQ choice identified by the cheat hint label.
async function answerMCQCorrectly(page: Page) {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found');
  const { label } = parseMCQCheatHint(cheatHint);
  await page
    .locator('.choice-btn')
    .filter({ has: page.locator('.label', { hasText: new RegExp(`^${label}$`) }) })
    .click();
  await page.waitForTimeout(200);
}

// Click any MCQ choice that is NOT the correct one.
async function answerMCQIncorrectly(page: Page) {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found');
  const { label: correctLabel } = parseMCQCheatHint(cheatHint);
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
  throw new Error('Could not find an incorrect choice to click');
}

// Answer one question — MCQ or word-block — advancing past it fully (including Next for sentences).
async function answerOneQuestion(page: Page) {
  const isSentence = await page.locator('.tile-bank').isVisible();
  if (isSentence) {
    // Sentence: place tiles correctly, Submit, then Next
    const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
    if (!cheatHint) throw new Error('No sentence cheat hint');
    const wordIds = cheatHint
      .replace(/^✓\s*/, '')
      .split('→')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const wordId of wordIds) {
      await page
        .locator('.tile-bank .tile-chip')
        .filter({ has: page.locator(`[data-word-id="${wordId}"]`) })
        .first()
        .click();
    }
    await page.locator('button', { hasText: 'Submit' }).click();
    await page.locator('button', { hasText: 'Next' }).click();
    await page.waitForTimeout(200);
  } else {
    await answerMCQCorrectly(page);
  }
}

Then('I should see a word question with 4 choices', async ({ page }) => {
  await expect(page.locator('.quiz-card')).toBeVisible();
  await expect(page.locator('.tile-bank')).not.toBeVisible();
  await expect(page.locator('.choice-btn')).toHaveCount(4);
});

When('I note the word question prompt', async ({ page }) => {
  storedWordPrompt = (await page.locator('.quiz-card .prompt').textContent())?.trim() ?? '';
  expect(storedWordPrompt, 'Could not read word question prompt').not.toBe('');
});

When('I answer the word question correctly', async ({ page }) => {
  await answerMCQCorrectly(page);
});

When('I answer the word question incorrectly', async ({ page }) => {
  await answerMCQIncorrectly(page);
});

When('I note the word value from the cheat hint', async ({ page }) => {
  const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();
  if (!cheatHint) throw new Error('No cheat hint found');
  storedWordValue = parseMCQCheatHint(cheatHint).value;
  expect(storedWordValue, 'Could not read word value from cheat hint').not.toBe('');
});

Then('I should see a different question or the batch results screen', async ({ page }) => {
  const atResults = await page.locator('.batch-results').isVisible();
  if (atResults) return;

  const newPrompt = (await page.locator('.quiz-card .prompt').textContent())?.trim();
  expect(newPrompt, 'Question prompt did not change after answering').not.toBe(storedWordPrompt);
});

Then('the same word should appear again before the batch ends', async ({ page }) => {
  expect(storedWordValue, 'No word value stored — run "I note the word value from the cheat hint" first').not.toBe('');

  let found = false;

  while (await page.locator('.quiz-card').isVisible()) {
    const cheatHint = await page.locator('.quiz-card .cheat-hint').textContent();

    // Sentence cheat hints don't have the "— value" format; skip them
    if (cheatHint && cheatHint.includes('—')) {
      const { value } = parseMCQCheatHint(cheatHint);
      if (value === storedWordValue) {
        found = true;
        break;
      }
    }

    await answerOneQuestion(page);
  }

  expect(found, `Word "${storedWordValue}" was not re-presented before the batch ended`).toBe(true);
});
