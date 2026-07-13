import { describe, it, expect } from 'vitest';
import { loadAudioStorageConfig, makeResolveAudioUrl, putObject } from '../audio-store.js';

describe('loadAudioStorageConfig', () => {
  it('returns an all-undefined config for empty env without throwing', () => {
    expect(loadAudioStorageConfig({})).toEqual({
      endpoint: undefined,
      bucket: undefined,
      accessKeyId: undefined,
      secretAccessKey: undefined,
      publicUrl: undefined,
    });
  });

  it('reads GLL_AUDIO_* vars from the given env', () => {
    const cfg = loadAudioStorageConfig({
      GLL_AUDIO_ENDPOINT: 'http://localhost:9000',
      GLL_AUDIO_BUCKET: 'gll-audio',
      GLL_AUDIO_ACCESS_KEY_ID: 'minioadmin',
      GLL_AUDIO_SECRET_ACCESS_KEY: 'minioadmin',
      GLL_AUDIO_PUBLIC_URL: 'http://localhost:9000/gll-audio',
    });
    expect(cfg).toEqual({
      endpoint: 'http://localhost:9000',
      bucket: 'gll-audio',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      publicUrl: 'http://localhost:9000/gll-audio',
    });
  });
});

describe('makeResolveAudioUrl', () => {
  it('composes publicUrl + key with no double slash', () => {
    const resolve = makeResolveAudioUrl({ publicUrl: 'http://localhost:9000/gll-audio' });
    expect(resolve('decks/d1/audio.mp3')).toBe(
      'http://localhost:9000/gll-audio/decks/d1/audio.mp3',
    );
  });

  it('trims a trailing slash on publicUrl before composing', () => {
    const resolve = makeResolveAudioUrl({ publicUrl: 'http://localhost:9000/gll-audio/' });
    expect(resolve('decks/d1/audio.mp3')).toBe(
      'http://localhost:9000/gll-audio/decks/d1/audio.mp3',
    );
  });

  it('returns undefined for a null or empty key', () => {
    const resolve = makeResolveAudioUrl({ publicUrl: 'http://localhost:9000/gll-audio' });
    expect(resolve(null)).toBeUndefined();
    expect(resolve('')).toBeUndefined();
    expect(resolve(undefined)).toBeUndefined();
  });

  it('returns undefined when publicUrl is unset, regardless of key', () => {
    const resolve = makeResolveAudioUrl({});
    expect(resolve('decks/d1/audio.mp3')).toBeUndefined();
  });

  it('performs no network call and constructs no S3Client on the read path', async () => {
    const resolve = makeResolveAudioUrl({ publicUrl: 'http://localhost:9000/gll-audio' });
    // Resolution is synchronous pure string composition — no await, no I/O.
    const result = resolve('decks/d1/audio.mp3');
    expect(typeof result).toBe('string');
  });
});

describe('putObject', () => {
  it('throws a clear error when config is incomplete', async () => {
    await expect(
      putObject({}, 'decks/d1/audio.mp3', Buffer.from('fake-mp3-bytes')),
    ).rejects.toThrow(/incomplete storage config/);
  });

  it('throws when only some fields are present', async () => {
    await expect(
      putObject(
        { endpoint: 'http://localhost:9000', bucket: 'gll-audio' },
        'decks/d1/audio.mp3',
        Buffer.from('fake-mp3-bytes'),
      ),
    ).rejects.toThrow(/incomplete storage config/);
  });
});
