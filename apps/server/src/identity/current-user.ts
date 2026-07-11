/** The seeded single-user id (see `seedDemoUser`). Use this literal only where a
 *  fixed seed value is written (seeds); resolve request identity through
 *  `getCurrentUserId()` instead. */
export const DEMO_USER_ID = 'demo-user';

/**
 * The single current-user resolver. Returns the seeded demo user today — identity
 * is single-user by ADR scope and auth is out of scope. This is the one seam real
 * auth (request/session lookup) replaces later; every route reads identity here so
 * there is no duplicated `demo-user` constant to drift.
 */
export function getCurrentUserId(/* future: ctx */): string {
  return DEMO_USER_ID;
}
