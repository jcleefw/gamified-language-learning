# PRD: Gemini TTS Audio Generation System

**Document ID:** `20260302T000000Z-gemini-tts-generation`
**Status:** Complete
**Owner:** Product
**Created:** 2026-03-02
**Last Updated:** 2026-03-02

---

## 1. Overview

### 1.1 Purpose

Define the architecture and behavior of Text-to-Speech (TTS) audio generation using Google's Gemini API, with built-in rate limiting, quota management, and graceful degradation to support both free and paid API tiers.

### 1.2 Problem Statement

Gemini TTS provides high-quality multilingual audio generation but has strict rate limits, especially on the free tier. The system must:

- Generate audio for conversation content and individual vocabulary words
- Respect daily quota limits across multiple features (content curation + SRS quiz)
- Provide graceful degradation when quota is exhausted
- Support future migration from free tier to paid tier without code changes

### 1.3 Success Criteria

- TTS generation never exceeds configured daily quota
- Active learning window words (8 words per user) receive audio generation priority
- System remains functional when audio quota is exhausted (fallback to text-only)
- Configuration allows seamless tier upgrades (free → paid) without deployment

---

## 2. Scope

### 2.1 In Scope

- Rate-limited TTS generation for:
  - Full conversation audio (content curation)
  - Per-word audio for active learning window vocabulary (SRS quiz)
- Centralized quota management across all TTS consumers
- Configurable rate limits (RPM, TPM, RPD)
- Graceful degradation when quota exhausted
- Audio status tracking (`available`, `pending`, `failed`)
- Priority-based generation (active words > passive words)

### 2.2 Out of Scope (Future Phases)

- Per-sentence audio generation
- Batch TTS generation (generating many words/conversations in a single bulk operation)
- Cross-user audio sharing/caching
- Fallback to alternative TTS providers
- Multi-tenant quota distribution
- Predictive quota budgeting based on SRS schedules

### 2.3 Related PRDs

- [20260226T140000Z-content-curation.md](20260226T140000Z-content-curation.md) — Full conversation audio
- [20260226T100000Z-srs-learning-path.md](20260226T100000Z-srs-learning-path.md) — Audio recognition questions
- [Infra ADR](../architecture/20260301T161844Z-infra-cloudflare-platform.md) — D1, R2, Queues platform decisions

---

## 3. Strategy: Option 4 — Free Tier + Hard Limit + Lazy Per-Word for Active Window

### 3.1 Approach

- **Free Tier by Default:** Use Gemini free tier limits (10 RPD)
- **Hard Limit Enforcement:** Pre-flight quota check before every TTS call
- **Lazy Generation:** Generate per-word audio only when a word enters the active learning window (8 words)
- **Graceful Degradation:** Return `null` when quota exhausted; app continues without audio

### 3.2 Quota Allocation Strategy

Total daily quota is **shared across all TTS consumers**:

| Consumer             | Quota Allocation     | Notes                                              |
| -------------------- | -------------------- | -------------------------------------------------- |
| **Content Curation** | Up to 5 requests/day | Full conversation audio generation                 |
| **SRS Active Words** | Up to 5 requests/day | Per-word audio for words in active learning window |
| **Total**            | 10 requests/day      | Free tier limit                                    |

**Quota exhaustion behavior:**

- When quota consumed by content curation, SRS audio generation fails gracefully
- When quota consumed by SRS, content curation fails gracefully
- No feature gets guaranteed allocation — first-come-first-served within daily cap

---

## 4. Requirements

### 4.1 Functional Requirements

#### FR-1: Centralized Rate Limiter Service

- **Description:** A service that wraps all Gemini TTS API calls and enforces rate limits
- **Acceptance Criteria:**
  - Pre-flight check: `canGenerateAudio()` returns `true` if quota available, `false` otherwise
  - Post-generation: Increment counters for RPM, TPM, RPD
  - Counters reset at UTC midnight for RPD, every minute for RPM/TPM
  - All TTS calls in the system MUST go through this service

#### FR-2: Configurable Rate Limits

- **Description:** Rate limits stored in configuration, not hardcoded
- **Acceptance Criteria:**
  - Config file (`.env` or `config/tts.yml`) contains:
    ```yaml
    GEMINI_TTS_RPM: 3 # Requests per minute
    GEMINI_TTS_TPM: 10000 # Tokens per minute
    GEMINI_TTS_RPD: 10 # Requests per day
    ```
  - Defaults to free tier values if not specified
  - Changing config values takes effect on service restart (no code changes)

#### FR-3: Lazy Per-Word Audio Generation

- **Description:** Generate audio for vocabulary words only when they enter active learning window
- **Acceptance Criteria:**
  - When a word transitions to `active` status in SRS system, trigger audio generation
  - If quota available, generate audio and store URL
  - If quota exhausted, mark word audio status as `pending`
  - Re-attempt generation when quota resets (next day)

#### FR-4: Audio Status Tracking

- **Description:** Track audio availability for each word and conversation
- **Acceptance Criteria:**
  - Words table has `audioStatus` field with values:
    - `available` — Audio URL exists and is valid
    - `pending` — Audio not yet generated (quota exhausted or not yet attempted)
    - `failed` — Generation attempted but failed (non-quota error)
  - Conversations table has similar `audioStatus` field
  - API responses include audio status for client-side handling

#### FR-5: Graceful Degradation in Quiz

- **Description:** SRS quiz adapts when word audio is unavailable
- **Acceptance Criteria:**
  - When generating quiz batch, check `word.audioStatus === 'available'` before creating audio question
  - If unavailable, redistribute question type per existing logic ([SRS PRD line 58](product-documentation/prds/20260226T100000Z-srs-learning-path.md#L58))
  - No error shown to user — quiz proceeds with available question types

#### FR-6: Graceful Degradation in Content Curation

- **Description:** Conversation playback adapts when full audio is unavailable
- **Acceptance Criteria:**
  - If `conversation.audioStatus !== 'available'`, hide audio player in UI
  - Show message: "Audio generation in progress — check back later"
  - Conversation remains fully usable (text display, word highlighting, etc.)

#### FR-7: Daily Quota Reset

- **Description:** RPD counter resets at UTC midnight
- **Acceptance Criteria:**
  - Quota check queries `tts_quota` table: `SELECT COUNT(*) WHERE status = 'success' AND created_at >= date('now')`
  - After midnight UTC, query naturally returns 0 — no explicit reset needed
  - First TTS call of the day succeeds (if within RPM/TPM limits)

#### FR-8: Multi-Consumer Quota Sharing

- **Description:** All features share the same daily quota pool
- **Acceptance Criteria:**
  - Content curation TTS calls decrement the same `daily_tts_count` as SRS TTS calls
  - No feature-specific quota buckets in Phase 1
  - Logs include consumer type for observability: `logger.info('TTS consumed by: content_curation')`

---

### 4.2 Non-Functional Requirements

#### NFR-1: Performance

- Pre-flight quota check completes in < 50ms (D1 query)
- TTS generation timeout: 30 seconds (Gemini API SLA)
- Queue processing is async — no user-facing latency from TTS generation

#### NFR-2: Reliability

- If D1 query fails, fail safe: reject TTS generation (assume quota exhausted)
- Queue consumer retries transient Gemini API failures (5xx errors) up to 3 times with exponential backoff
- Non-transient failures (4xx errors) immediately marked as `failed`, no retry
- Failed queue messages retried per Cloudflare Queues retry policy

#### NFR-3: Observability

- Log every TTS generation attempt with:
  - Consumer type (`content_curation`, `srs_active_word`)
  - Quota state (`remaining: X/10`)
  - Success/failure reason
- Emit metrics:
  - `tts.requests.total` (counter, tagged by consumer)
  - `tts.requests.rejected` (counter, tagged by reason: `quota_exhausted`, `rate_limit`, `api_error`)
  - `tts.quota.remaining` (gauge)

#### NFR-4: Security

- Gemini API key stored in environment variable, never in code
- TTS service validates input text length < 5000 characters (prevent abuse)

---

## 5. Technical Design

### 5.1 Architecture

```
┌─────────────────┐      ┌─────────────────┐
│ Content         │      │ SRS Quiz        │
│ Curation        │      │ System          │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └────────┬───────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ TTS Service     │◄──── Config (RPM/TPM/RPD)
         │ (Rate Limiter)  │
         └────────┬────────┘
                  │
                  ├──► D1 (quota counters + audio status)
                  │
                  ├──► Cloudflare Queue (async generation)
                  │         │
                  │         ▼
                  │    Gemini TTS API
                  │         │
                  │         ▼
                  └──► R2 (audio file storage)
```

### 5.2 Core Service Interface

```typescript
interface TTSService {
  // Pre-flight check
  canGenerateAudio(estimatedTokens: number): Promise<boolean>;

  // Enqueue audio generation (returns false if quota exhausted)
  enqueueAudio(params: {
    text: string;
    language: string;
    voice?: string;
    consumer: 'content_curation' | 'srs_active_word';
    targetId: string; // word ID or conversation ID
    targetType: 'word' | 'conversation';
  }): Promise<boolean>;

  // Query current quota state
  getQuotaStatus(): Promise<{
    rpm: { used: number; limit: number };
    tpm: { used: number; limit: number };
    rpd: { used: number; limit: number };
  }>;
}
```

### 5.3 D1 Quota Table

```sql
CREATE TABLE tts_quota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumer TEXT NOT NULL,           -- 'content_curation' | 'srs_active_word'
  target_id TEXT NOT NULL,          -- word ID or conversation ID
  target_type TEXT NOT NULL,        -- 'word' | 'conversation'
  tokens_used INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'failed'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily quota check: count today's successful requests
-- SELECT COUNT(*) FROM tts_quota
--   WHERE status = 'success'
--   AND created_at >= date('now');
```

No TTL-based expiry needed — daily quota is calculated by counting rows with `created_at >= date('now')` (UTC). Old rows can be pruned periodically for housekeeping.

### 5.4 Database Schema Changes

**Words Table:**

```sql
ALTER TABLE words ADD COLUMN audio_r2_key TEXT;
ALTER TABLE words ADD COLUMN audio_status TEXT DEFAULT 'pending';
ALTER TABLE words ADD COLUMN audio_generated_at TEXT;
```

**Conversations Table:**

```sql
ALTER TABLE conversations ADD COLUMN audio_r2_key TEXT;
ALTER TABLE conversations ADD COLUMN audio_status TEXT DEFAULT 'pending';
ALTER TABLE conversations ADD COLUMN audio_generated_at TEXT;
```

### 5.5 Generation Flow (Per-Word Audio)

```
1. Word enters active learning window
   ↓
2. SRS system calls: ttsService.enqueueAudio({ text: word.characters, ... })
   ↓
3. TTS Service checks: canGenerateAudio(estimatedTokens)
   ↓
4a. Quota available:
    - Insert row into tts_quota (reserves the slot)
    - Push message to Cloudflare Queue
    - word.audioStatus = 'pending'
    - Return true
   ↓
4b. Quota exhausted:
    - Return false
    - word.audioStatus remains 'pending'
    - Log: "TTS quota exhausted for word_id=123"
   ↓
5. Queue consumer (Worker) processes message:
    - Call Gemini TTS API
    - Decode base64 audio response
    - Store audio file in R2 (key: audio/<language>/<targetType>/<targetId>.mp3)
    - Update word.audio_r2_key and word.audioStatus = 'available' in D1
    - On failure: update word.audioStatus = 'failed'
   ↓
6. Client receives word with audioStatus field; constructs R2 URL from audio_r2_key
```

---

## 6. User Experience

### 6.1 Content Curation Page

**When audio available:**

- Audio player appears at top of conversation
- "Play Full Conversation" button enabled

**When audio pending:**

- Audio player hidden
- Message shown: "Audio generation in progress. Check back later or refresh."

**When audio failed:**

- Audio player hidden
- Message shown: "Audio unavailable for this conversation."

### 6.2 SRS Quiz

**When word audio available:**

- Audio recognition questions included in quiz batch (10% distribution)
- Question shows speaker icon, plays audio on tap

**When word audio pending/failed:**

- Question slot redistributed to MC (80%) or word block (20%)
- No indication to user that audio was attempted
- Quiz functions normally with available question types

---

## 7. Configuration

### 7.1 Environment Variables

```bash
# Required
GEMINI_API_KEY=your_api_key_here

# Optional (defaults to free tier)
GEMINI_TTS_RPM=3          # Requests per minute
GEMINI_TTS_TPM=10000      # Tokens per minute
GEMINI_TTS_RPD=10         # Requests per day

# Cloudflare bindings (configured in wrangler.toml, not .env)
# D1: TTS_DB binding
# R2: TTS_AUDIO_BUCKET binding
# Queue: TTS_QUEUE binding
```

### 7.2 Tier Migration Example

**Upgrading to Paid Tier 1:**

```bash
# Update environment variables via wrangler or Cloudflare dashboard
wrangler secret put GEMINI_TTS_RPM    # Set to 10
wrangler secret put GEMINI_TTS_RPD    # Set to 250
```

No code changes or restarts required — Workers pick up new env vars on next invocation.

---

## 8. Testing Strategy

### 8.1 Unit Tests

- `TTSService.canGenerateAudio()` correctly enforces RPM/TPM/RPD
- Quota counters increment/reset correctly
- Graceful degradation (returns `null` when quota exhausted)

### 8.2 Integration Tests

- End-to-end: Generate audio for word → verify DB update → verify quota decrement
- End-to-end: Exhaust quota → verify subsequent calls return `null`
- End-to-end: Quota reset at midnight UTC → verify first call succeeds

### 8.3 Manual Testing

- Generate 10 conversation audios in one day → verify 11th fails gracefully
- Add word to active window when quota exhausted → verify `audioStatus = 'pending'`
- Restart service → verify quota counters persist (D1 durability)

---

## 9. Rollout Plan

### Phase 1: Core Infrastructure (Week 1)

- Implement `TTSService` with rate limiting
- D1 quota counter storage (`tts_quota` table)
- Database schema changes (`audio_status` field on words and conversations tables)
- Configuration loading (`.env` → defaults)

### Phase 2: Content Curation Integration (Week 2)

- Generate full conversation audio via `TTSService`
- UI updates for audio pending/failed states
- Testing with free tier limits

### Phase 3: SRS Integration (Week 3)

- Lazy per-word audio generation on active window entry
- Quiz question type redistribution logic
- End-to-end testing with quota exhaustion scenarios

### Phase 4: Observability (Week 4)

- Logging and metrics
- Admin dashboard for quota monitoring (optional)
- Documentation and runbook

---

## 10. Metrics and Monitoring

### 10.1 Key Metrics

| Metric                    | Description                     | Alert Threshold         |
| ------------------------- | ------------------------------- | ----------------------- |
| `tts.requests.rejected`   | TTS calls rejected due to quota | > 10/day                |
| `tts.quota.remaining`     | Daily quota remaining           | < 2 (warn: running low) |
| `tts.api.errors`          | Gemini API failures             | > 5/hour                |
| `tts.generation.duration` | TTS API response time           | p95 > 10s               |

### 10.2 Alerts

- **Quota Exhaustion:** Notify when daily quota consumed before 6pm UTC (indicates high usage)
- **API Failures:** Page if Gemini API error rate > 10% for 5 minutes

---

## 11. Open Questions

### Q1: Multi-Tenant Quota Distribution

**Status:** Deferred — Not applicable
**Question:** If multiple users share one API key (multi-tenant SaaS), how do we fairly distribute the 10 RPD quota?
**Resolution:** Solo founder project with single-tenant deployment. TTS generation is curator/admin-initiated only — learners do not trigger TTS calls. Revisit if multi-tenant becomes a requirement.

---

### Q2: Audio URL Persistence

**Status:** Resolved
**Question:** Do Gemini-hosted audio URLs expire? If so, when?
**Resolution:** N/A — Gemini TTS returns raw base64 audio data, not hosted URLs. Audio is decoded and stored in Cloudflare R2. R2 objects do not expire unless explicitly deleted. No re-generation needed.

---

### Q3: Cross-User Audio Sharing

**Status:** Deferred
**Question:** Can two users learning the same word share the same audio file?
**Benefit:** Reduces quota consumption by ~90% (words shared across users)
**Complexity:** Requires word-level audio caching, cache invalidation strategy
**Decision:** Defer to Phase 2+ (future optimization)

---

### Q4: Retry Strategy for Transient Failures

**Status:** Resolved
**Question:** If TTS generation fails due to network timeout (not quota), should we retry immediately or queue for later?
**Resolution:** Immediate retry — 3 attempts with exponential backoff for transient errors (5xx). Non-transient errors (4xx) immediately marked as `failed`, no retry. Failed queue messages retried per Cloudflare Queues retry policy. See NFR-2.

---

### Q5: Fallback TTS Provider

**Status:** Deferred
**Question:** Should we integrate a secondary TTS provider (e.g., ElevenLabs, AWS Polly) as fallback when Gemini quota exhausted?
**Benefit:** Better user experience (always have audio)
**Cost:** Additional API costs, integration complexity
**Decision:** Defer to Phase 3+ (if free tier proves insufficient)

---

## 12. Success Metrics (Post-Launch)

### 12.1 Operational

- **Quota Utilization:** Average daily RPD usage (target: 60-80% of limit)
- **Rejection Rate:** % of TTS calls rejected due to quota (target: < 5%)
- **Audio Availability:** % of active words with audio available (target: > 90%)

### 12.2 User Impact

- **Quiz Completion Rate:** Compare quiz completion rates for batches with audio vs. without (hypothesis: audio improves engagement)
- **Conversation Replay:** % of users who play full conversation audio at least once per session

---

## 13. Risks and Mitigations

| Risk                                    | Likelihood | Impact | Mitigation                                                              |
| --------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| Gemini API quota exhausted early in day | High       | Medium | Priority-based generation (active words first); alert when 80% consumed |
| Gemini API deprecated/pricing changed   | Low        | High   | Design allows swapping TTS provider; monitor Gemini changelog           |
| D1 unavailable prevents quota tracking  | Low        | High   | Fail-safe: reject TTS generation when D1 query fails (avoid overage)    |
| Queue message processing delay          | Low        | Low    | Audio is async; UI already handles `pending` status gracefully          |

---

## 14. Dependencies

- **External:**
  - Google Gemini API (TTS endpoint availability)

- **Cloudflare:**
  - D1 (quota counter storage + audio metadata)
  - R2 (audio file storage)
  - Queues (async audio generation)

- **Internal:**
  - SRS Learning Path system (active window word tracking)
  - Content Curation system (conversation storage)

---

## 15. Appendix

### 15.1 Related Cost Model

See [20260227T163726Z-gemini-tts-cost-model.md](../cost-models/20260227T163726Z-gemini-tts-cost-model.md) for detailed cost analysis.

### 15.2 Gemini API Reference

- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/quota)
- [Gemini TTS Documentation](https://ai.google.dev/gemini-api/docs/models/tts)

---

**Changelog:**

- `2026-03-02`: Finalized — resolved Q1 (deferred, not applicable), Q4 (resolved per NFR-2), fixed remaining Redis → D1 references, fixed relative links, status → Complete
- `2026-03-02`: Aligned with Cloudflare infra ADR — Redis → D1, added R2 storage + Cloudflare Queues async flow, resolved Q2
- `2026-03-02`: Initial draft (Option 4 strategy)
