/**
 * Deck audio storage (EP42-DS01, ST02). Local MinIO stands in for production
 * Cloudflare R2 (S3-compatible, public-read bucket, browser→bucket per the
 * hosting ADR). `makeResolveAudioUrl` is pure string composition — no SDK,
 * no network, no credentials — so the read path (every GET /api/decks) is
 * crash-proof against missing/unset storage env. The S3 client is
 * constructed lazily inside `putObject`, the dev/curator-only write path,
 * which is the single place `@aws-sdk/client-s3` and credentials are used.
 */

export interface AudioStorageConfig {
  endpoint?: string; // GLL_AUDIO_ENDPOINT (S3 API; used only by putObject)
  bucket?: string; // GLL_AUDIO_BUCKET
  accessKeyId?: string; // GLL_AUDIO_ACCESS_KEY_ID (putObject only)
  secretAccessKey?: string; // GLL_AUDIO_SECRET_ACCESS_KEY (putObject only)
  publicUrl?: string; // GLL_AUDIO_PUBLIC_URL (browser-reachable base)
}

/**
 * True when the curator-only mutating surface (audio upload) is enabled.
 * Default off — a mutating audio endpoint must not be reachable in a default
 * production deploy without also flipping this flag (EP42-DS02, ST08).
 */
export function isCuratorMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GLL_CURATOR_MODE === 'true' || env.GLL_CURATOR_MODE === '1';
}

/** Read env once. All fields optional — absence is tolerated, not fatal. */
export function loadAudioStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): AudioStorageConfig {
  return {
    endpoint: env.GLL_AUDIO_ENDPOINT,
    bucket: env.GLL_AUDIO_BUCKET,
    accessKeyId: env.GLL_AUDIO_ACCESS_KEY_ID,
    secretAccessKey: env.GLL_AUDIO_SECRET_ACCESS_KEY,
    publicUrl: env.GLL_AUDIO_PUBLIC_URL,
  };
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Pure compose. `undefined` when key is null/empty OR publicUrl is unset.
 * No network, no SDK, no credentials — safe on every read.
 */
export function makeResolveAudioUrl(
  cfg: AudioStorageConfig,
): (key: string | null | undefined) => string | undefined {
  return (key) => {
    if (!key || !cfg.publicUrl) return undefined;
    return `${trimTrailingSlash(cfg.publicUrl)}/${key}`;
  };
}

/**
 * Dev/curator-only upload. Constructs the S3 client lazily here — the only
 * place `@aws-sdk/client-s3` and credentials are touched. Throws if config
 * is incomplete (called only by the ST03 curator script, never on the
 * request path). Always writes Cache-Control: public, max-age=31536000,
 * immutable — keys are never overwritten in place (playback ADR §7), so
 * objects are safe to cache forever once written.
 */
export async function putObject(
  cfg: AudioStorageConfig,
  key: string,
  body: Uint8Array | Buffer,
  contentType = 'audio/mpeg',
): Promise<void> {
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error(
      'audio-store.putObject: incomplete storage config (endpoint/bucket/accessKeyId/secretAccessKey required)',
    );
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint: cfg.endpoint,
    forcePathStyle: true, // required for MinIO path-style buckets
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    region: 'us-east-1', // MinIO ignores region; SDK requires one to be set
  });

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}
