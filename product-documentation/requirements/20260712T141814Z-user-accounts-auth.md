# Requirements Specification: User Accounts & Authentication (srs-demo)

Source idea brief: `product-documentation/ideas/20260712T141111Z-user-accounts-auth.md`

## 1. Overview

**Purpose**
Give srs-demo individual user accounts so each learner's SRS progress is tracked and retrievable separately, instead of sharing one undifferentiated pool of state. This is a beta-gating capability: without per-user identity the demo cannot meaningfully serve more than one real learner.

**Scope**

Included:
- Email + password registration and login.
- Email verification and password reset.
- Session persistence so a returning learner resumes their exact SRS state.
- Replacing the single-user identity seam so each request resolves to the authenticated user.

Excluded:
- Google OAuth (planned later phase, not this spec).
- Multiple devices per user.
- Teams / classrooms / roles beyond the existing `learner` default.
- Hardened security posture — the boundary is *learner separation on a shared/demo instance*, not adversarial-grade authentication.

**Stakeholders**
- Requested by / signs off: PO (jcleefw). 
- Affected: individual learners on the shared srs-demo instance.

## 2. Functional Requirements

| ID | Requirement | Priority (MoSCoW) | Source |
| --- | --- | --- | --- |
| FR-001 | The system shall allow a visitor to register an account by submitting an email address and a password. | Must | Idea brief |
| FR-002 | The system shall reject registration when the submitted email already belongs to an existing account. | Must | schema.ts `users.email` unique |
| FR-003 | The system shall store the password only as a one-way hash, never in plaintext or reversible form. | Must | Idea brief (implied) [Assumed] |
| FR-004 | The system shall send a verification email containing a single-use verification link when an account is registered. | Must | Idea brief |
| FR-005 | The system shall mark an account as unverified until its verification link is used, and as verified thereafter. | Must | Idea brief |
| FR-006 | The system shall prevent sign-in to an account that has not completed email verification. | Should | [Assumed] — confirm whether unverified users may log in but not persist |
| FR-007 | The system shall authenticate a returning user who submits a matching email and password, and reject when either does not match. | Must | Idea brief |
| FR-008 | The system shall allow a user to request a password reset by submitting their email, sending a single-use, time-limited reset link to that address. | Must | Idea brief |
| FR-009 | The system shall allow a user to set a new password via a valid reset link and invalidate that link after use. | Must | Idea brief |
| FR-010 | The system shall establish a session on successful sign-in that persists across browser visits until logout or expiry. | Must | Idea brief ("logs back in and resumes state") |
| FR-011 | The system shall allow a signed-in user to sign out, ending their session. | Should | [Assumed] |
| FR-012 | The system shall resolve the identity of every learning request to the authenticated user rather than the fixed demo user. | Must | current-user.ts seam |
| FR-013 | The system shall scope all SRS/learner state reads and writes so a user accesses only state keyed to their own user id. | Must | schema.ts (state tables keyed by `user_id`) |
| FR-014 | The system shall restore the authenticated user's existing SRS state on sign-in, reflecting their prior progress. | Must | Idea brief (success criterion) |
| FR-015 | The system shall not expose or comingle another user's learner state under any authenticated session. | Must | Idea brief (core problem) |

## 3. Non-Functional Requirements

| ID | Category | Requirement | Measure |
| --- | --- | --- | --- |
| NFR-001 | Security | Passwords stored using a purpose-built password hash. | Argon2 or bcrypt; no plaintext at rest [Assumed algorithm] |
| NFR-002 | Security | Verification and reset tokens are single-use and expire. | Reset/verify link invalid after use or after expiry window [Needs test criteria — expiry duration TBD] |
| NFR-003 | Security | Authenticated identity is required for all learner-state endpoints. | Every state route resolves a real user; no anonymous state writes |
| NFR-004 | Privacy | A user's learner state is isolated from other users. | No query returns rows for a `user_id` other than the session user |
| NFR-005 | Usability | Session persists across visits without re-entering credentials each time. | Returning within the session window lands signed-in |

## 4. Constraints

- Stack is fixed: TypeScript, Drizzle ORM over SQLite (`packages/db`). New auth data must fit this.
- The `users` table currently has **no credential or verification columns** — schema additions (password hash, verification/reset state) are required.
- `getCurrentUserId()` in `apps/server/src/identity/current-user.ts` is the single documented integration seam; auth must replace it there rather than scattering identity lookups.
- All per-user learner-state tables are **already keyed by `user_id`** — no state-table restructuring is needed to separate learners.
- No email-sending capability exists in the codebase today; verification and reset depend on introducing one.
- The boundary is demo-grade learner separation, not adversarial-grade security — this bounds how much hardening is warranted.

## 5. Assumptions

- **[Assumed]** Existing per-user state tables are sufficient as-is; the only identity-provisioning gap is issuing real `user_id`s at registration instead of the seeded `demo-user`.
- **[Assumed]** Unverified users should be blocked from full use (FR-006); the alternative (log in but no persistence) is unconfirmed.
- **[Assumed]** Password hashing uses Argon2/bcrypt; exact algorithm not yet chosen.
- **[Assumed]** Token expiry windows (verification, reset, session) are acceptable to define at build time; no stakeholder-fixed durations given.
- **[Assumed]** Google OAuth deferral means the first release is email/password only; the `users` schema should still leave room for a future federated-identity column.

## 6. Dependencies

- `users` table (`packages/db/src/schema.ts`) — must be extended with credential + verification fields.
- `getCurrentUserId()` seam (`apps/server/src/identity/current-user.ts`) — the replacement point for session-based identity.
- An email delivery mechanism (net-new) — required before FR-004, FR-008 can be tested end-to-end.
- Session mechanism (net-new) — cookie/token store to satisfy FR-010.
- Existing seeded `demo-user` and its state — must be reconciled with real accounts on first real release (see Open Items).

## 7. Open Items

| # | Question | Owner | Notes |
| --- | --- | --- | --- |
| OI-1 | **Schema-stability gate before release.** How stable must the learner-state data shape be before real users accumulate state? Premature release risks a later schema change that cannot be fully migrated, forcing some users to restart. | PO | Central risk from idea brief; gates release timing. Consider `/ba/gap-analysis`. |
| OI-2 | What happens to the existing seeded `demo-user` state on first real release — migrate to a real account, discard, or keep as demo? | PO | Affects FR-014 for pre-existing data. |
| OI-3 | Email provider / delivery approach for verification + reset. | PO/Eng | Blocks FR-004, FR-008. |
| OI-4 | Session model (cookie session vs. token) and expiry/persistence window. | Eng | Shapes FR-010, NFR-005. |
| OI-5 | Unverified-user behavior — hard block vs. limited access (resolves FR-006). | PO | |
| OI-6 | Verification/reset/session token expiry durations. | PO/Eng | Resolves NFR-002 test criteria. |
