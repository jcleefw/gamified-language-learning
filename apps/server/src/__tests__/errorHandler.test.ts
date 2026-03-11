import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import { errorHandler } from '../app.js';

describe('global error handler', () => {
  it('returns ApiResponse envelope with INTERNAL_ERROR on unhandled error', async () => {
    const testApp = new Hono();
    testApp.onError(errorHandler);
    testApp.get('/boom', () => {
      throw new Error('something went wrong');
    });

    const res = await testApp.request('/boom');
    expect(res.status).toBe(500);

    const body = (await res.json()) as ApiResponse<never>;
    expect(body).toEqual({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'something went wrong',
      },
    });
  });
});
