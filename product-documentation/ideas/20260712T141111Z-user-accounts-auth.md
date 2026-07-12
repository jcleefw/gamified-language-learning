# Idea Brief: User Accounts & Authentication for srs-demo

**Core Idea**
Give srs-demo individual user accounts so each learner's SRS progress is tracked and retrievable separately.

**Who It's For**
Primary: individual learners using the shared srs-demo instance, who currently share one undifferentiated pool of learning state. No secondary stakeholders in scope (no teachers, admins, or classroom roles).

**Problem It Solves**
Today the demo has no per-person boundary, so one learner's SRS progress is indistinguishable from another's on a shared instance. The immediate need is *identification* — separating one learner's progress from another's — rather than hard security. Without it, the demo cannot support more than one real user meaningfully, which is a beta-gating limitation.

**How It Works**
- Learners sign in with **email + password** to start; **Google OAuth** is a planned later migration, not part of the first phase.
- **Email verification** and **password reset** are included (email verification was reconsidered into scope specifically so password reset works properly).
- Once authenticated, a user's SRS state is stored against their account, and their exact learning state is restored on return.

**What Success Looks Like**
- Each user's SRS state is independently retrievable per-account from the database.
- A returning learner logs back in and resumes their exact SRS state.

**Constraints and Non-Goals**
- Out of scope: multiple devices per user, teams/classrooms.
- Google OAuth deferred to a later phase (email + password first).
- Boundary is learner separation on a shared/demo instance, not hardened authentication.

**Known Unknowns**
- **Central risk — premature release vs. schema stability:** If the app is released to real users before the data shape is settled, a later schema change may not be fully migratable. Some users could lose progress and have to start from scratch. This is the primary concern driving the timing of any release.
- **Migration of existing real learning state:** How to move already-accumulated SRS/learning state into the new per-user account model without loss.
- [Open question] How much schema hardening is "enough" before it's safe to let real users accumulate state — i.e., what makes the data shape stable enough to release against?
- [Open question] Interaction with the existing multi-user persistent storage layer (EP30) — how much of this is already supported vs. net-new.
