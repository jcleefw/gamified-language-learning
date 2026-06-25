import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

Given('the API server is unreachable', async ({ page }) => {
  await page.route('/api/state', (route) => route.abort('connectionrefused'));
});

Given('I have a saved session', async ({ page }) => {
  // POST a word state so onMounted sees runState.size > 0 and sets hasSavedSession = true
  await page.request.post('/api/state/word', {
    data: { wordId: 'th::seed', seen: 1, correct: 1, mastery: 0, correctStreak: 1, wrongStreak: 0, lapses: 0 },
  });
  // Set the last deck key so the resume banner has a deck to show
  await page.evaluate(() => localStorage.setItem('srs-demo-last-deck', 'lets-eat-something'));
  // Reload so onMounted picks up the DB state and renders the resume banner
  await page.reload();
  await page.waitForSelector('.resume-banner');
});

When('I open the app', async ({ page }) => {
  await page.goto('/');
});

Then('I should see an API error banner', async ({ page }) => {
  await expect(page.locator('.api-error')).toBeVisible();
});
