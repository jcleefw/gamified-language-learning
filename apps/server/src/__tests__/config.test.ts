import { describe, it, expect } from 'vitest';
import app from '../app.js';
import { LEARNING_CONFIG, type AppConfigResponse } from '../config/learning.js';

describe('GET /api/config', () => {
  it('serves the FE config surface, categorized user vs pedagogy', async () => {
    const res = await app.request('/api/config');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: true; data: AppConfigResponse };
    expect(body.success).toBe(true);

    // User-tunable config (T1): learning policy + presentation/orchestration.
    expect(body.data.user).toMatchObject({
      masteryThreshold: LEARNING_CONFIG.masteryThreshold,
      streakThresholds: LEARNING_CONFIG.streakThresholds,
      wordsPerBatch: expect.any(Number),
      maxRetryPerSession: expect.any(Number),
      maxRetryPerWord: expect.any(Number),
      sentenceDirections: expect.any(Array),
    });

    // Pedagogy config (T2): authored course design, not user-writable.
    expect(body.data.pedagogy).toMatchObject({
      sentenceScheduling: expect.any(Object),
      sentenceGraduation: expect.any(Object),
    });

    // T3 system internals are never served (D4).
    expect(body.data).not.toHaveProperty('system');
  });

  it('learning policy is derived from LEARNING_CONFIG (single source of truth)', async () => {
    const res = await app.request('/api/config');
    const body = (await res.json()) as { success: true; data: AppConfigResponse };
    expect(body.data.user.masteryThreshold).toBe(LEARNING_CONFIG.masteryThreshold);
    expect(body.data.user.streakThresholds).toEqual(LEARNING_CONFIG.streakThresholds);
  });
});
