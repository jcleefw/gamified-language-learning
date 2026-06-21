import type { Config } from 'drizzle-kit';

export default {
  schema: './packages/srs-engine-v2/src/persistence/schema.ts',
  out: './packages/srs-engine-v2/drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/learning-state.db',
  },
} satisfies Config;
