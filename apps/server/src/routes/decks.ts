import { Hono } from 'hono';
import { getDb, SqliteContentStore } from '@gll/db';
import { ErrorCode, type ApiResponse, type GetDecksResponse, type ConversationJSON } from '@gll/api-contract';
import { transformConversation } from '../transform-conversation.js';

const router = new Hono();

function getStore() {
  return new SqliteContentStore(getDb());
}

router.get('/decks', async (c) => {
  const data = await getStore().getDecks();
  const body: ApiResponse<GetDecksResponse> = { success: true, data };
  return c.json(body);
});

router.post('/curriculum/import', async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Invalid JSON body' },
    };
    return c.json(body, 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Body must be a single ConversationJSON object' },
    };
    return c.json(body, 400);
  }

  const conv = payload as ConversationJSON;
  const appDeck = transformConversation(conv);
  await getStore().importCurriculum([appDeck]);

  return c.body(null, 201);
});

export default router;
