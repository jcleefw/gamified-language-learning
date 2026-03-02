# PRD: User Management & Authentication

> **Status**: Complete PRD
> **Created**: 20260226T150000Z
> **Scope**: User CRUD, role assignment, authentication (Google OAuth + credentials), session management
> **Out of scope for this document**: Content curation workflow (see `20260226T140000Z-content-curation.md`), SRS learning engine (see `PRD-srs-learning-path.md`), platform/UI framework, authorization rules per feature

---

## 1. Problem Statement

The application has three distinct user types (admin, curator, learner) with different capabilities. Without user management and authentication, there is no way to control who accesses curation tools, who learns, or who administers the system. This is a foundational dependency — no other feature can be delivered to real users without it.

---

## 2. Goals

1. **Secure access**: Only authenticated users can access the application. Each user has exactly one role that determines their capabilities.
2. **Frictionless onboarding**: Google OAuth users can sign in with one click and immediately begin using the app as a learner.
3. **Admin control**: Admins can create, deactivate, and manage all users and their roles without developer intervention.

---

## 3. Non-Goals

- Self-service registration via credentials (admin creates credential-based accounts)
- Multi-factor authentication
- Social login providers other than Google (MVP)
- Fine-grained per-resource permissions (e.g., per-conversation access control — handled by content curation's collaboration toggle)
- Password self-service reset by end users (not in MVP)
- Password policy / complexity rules (not in MVP, will refine later)
- Adding a password to a Google-only account (later scope)
- User profile editing by learners (display name, avatar, preferences)

---

## 4. Users & Context

**Admin**: Manages all users. Creates credential-based accounts, assigns roles, deactivates users, views user activity. Web-only interface.

**Curator**: Authenticated via Google OAuth or credentials. Uses admin-path tools to curate content. Does not manage other users.

**Learner**: Authenticated via Google OAuth or credentials. Uses the learning path. Most learners are expected to arrive via Google OAuth.

---

## 5. Requirements

### 5.1 Authentication — Google OAuth Sign-In

1. Users can sign in using Google OAuth.
2. On successful OAuth callback, the system looks up the user by email.
3. If the user exists: embed their role in the JWT, verify `isActive` is true, update `lastLoginAt`. If `isActive` is false, reject the sign-in.
4. If the user does not exist: auto-create a new user record with `role: learner`, `passwordHash: null`, `authProvider: google`, `isActive: true`.
5. The JWT contains: user ID, email, role.

### 5.2 Authentication — Credentials Sign-In

6. Users can sign in using email and password.
7. If no user is found for the email, reject the sign-in (no account existence disclosure).
8. If the user is found but `isActive` is false, reject the sign-in.
9. If the user is found but `passwordHash` is null, reject the sign-in (this is a Google-only account — the user must sign in via Google).
10. If the user is found and active, compare the provided password against the stored `passwordHash` using bcrypt.
11. On successful comparison, issue a JWT with the same claims as Google OAuth sign-in.

### 5.3 Session Management

12. Authentication uses JWT-based sessions.
13. Sessions expire after 7 days (configurable).
14. Signing out invalidates the current session.

### 5.4 User Management — Admin Capabilities

15. Admins can create a new user by providing: email, display name, role (admin/curator/learner), and a temporary password.
16. Admins can update a user's role.
17. Admins can deactivate a user (`isActive: false`). Deactivated users cannot sign in. Active sessions are not forcibly terminated — rejected on next token refresh.
18. When deactivating a curator who has published content, the admin is prompted to decide what to do with that curator's published content (keep published or unpublish).
19. Admins can reactivate a previously deactivated user.
20. Admins can view a list of all users with: email, display name, role, auth provider, `isActive` status, `lastLoginAt`, `createdAt`.
21. Admins can view a user's activity summary: account events (last login, creation date, role history), learning progress, and curation activity.
22. Admins cannot delete user records permanently — only deactivate.

### 5.5 Role Model

23. Three roles exist: `admin`, `curator`, `learner`.
24. Each user has exactly one role at any time.
25. Role hierarchy for capabilities: admin > curator > learner. Admins have all curator capabilities. Curators have all learner capabilities.
26. Only admins can change a user's role.

### 5.6 Admin Bootstrap

27. The first admin account is created via a seed script (not through the application UI).

### 5.7 User Data Model

28. A user record contains:
    - ID (UUID)
    - Email (unique)
    - Display name
    - Role (`admin` | `curator` | `learner`)
    - Password hash (nullable — null for Google-only accounts)
    - Auth provider (`google` | `credentials`)
    - `isActive` (boolean, default true)
    - `lastLoginAt` (timestamp, nullable)
    - `createdAt` (timestamp)
    - `updatedAt` (timestamp)

---

## 6. Success Metrics

| Metric | Type | Target |
|---|---|---|
| Google OAuth sign-in completion rate | Leading | > 95% of OAuth attempts result in successful sign-in |
| Time to first action after sign-in | Leading | < 5 seconds from auth callback to landing page |
| Admin user creation success rate | Leading | 100% of admin-created accounts are usable on first attempt |
| Failed sign-in rate (credentials) | Lagging | < 10% of credential sign-in attempts fail (excluding blocked accounts) |

---

## 7. Open Questions

No open questions remain. All decisions have been made.
