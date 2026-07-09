import { PinoLogger } from '@gll/logger';

/** Process-wide application logger. Routes create request-scoped children. */
export const logger = new PinoLogger({ minLevel: 'info' });
