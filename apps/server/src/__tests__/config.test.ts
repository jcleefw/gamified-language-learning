import { describe, it, expect } from 'vitest';
import app from '../app.js';
import { LEARNING_CONFIG, type LearningConfigResponse } from '../config/learning.js';

describe('GET /api/config', () => {
  it('serves the server learning policy', async () => {
    const res = await app.request('/api/config');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: true; data: LearningConfigResponse };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      masteryThreshold: LEARNING_CONFIG.masteryThreshold,
      streakThresholds: LEARNING_CONFIG.streakThresholds,
    });
  });

  it('is derived from LEARNING_CONFIG (single source of truth)', async () => {
    const res = await app.request('/api/config');
    const body = (await res.json()) as { success: true; data: LearningConfigResponse };
    // The response mirrors the constant field-for-field — no independent copy.
    expect(body.data.masteryThreshold).toBe(LEARNING_CONFIG.masteryThreshold);
    expect(body.data.streakThresholds).toEqual(LEARNING_CONFIG.streakThresholds);
  });
});
