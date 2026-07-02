import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import type { Context } from 'hono';
import stateRouter from './routes/state.js';
import shelvingRouter from './routes/shelving.js';
import testSeedRouter from './routes/test-seed.js';
import decksRouter from './routes/decks.js';
import debugLogsRouter from './routes/debug-logs.js';

export function errorHandler(err: Error, c: Context): Response {
  const body: ApiResponse<never> = {
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: err.message },
  };
  return c.json(body, 500);
}

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/api', stateRouter);
app.route('/api', shelvingRouter);
app.route('/api', testSeedRouter);
app.route('/api', decksRouter);
app.route('/api', debugLogsRouter);

export default app;
