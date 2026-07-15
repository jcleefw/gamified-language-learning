import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadDeckAudio } from '../useStore';

function file(): File {
  return new File([new Uint8Array([1, 2, 3])], 'audio.mp3', { type: 'audio/mpeg' });
}

describe('uploadDeckAudio', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs multipart to the deck-scoped curation URL and resolves the returned audioKey', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { audioKey: 'decks/d1/audio.mp3' } }),
    } as unknown as Response);

    const key = await uploadDeckAudio('d1', file());

    expect(key).toBe('decks/d1/audio.mp3');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/curation/decks/d1/audio');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('audio')).toBeInstanceOf(File);
  });

  it('rejects with the server error message on a typed error body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown deckId "d9"' } }),
    } as unknown as Response);

    await expect(uploadDeckAudio('d9', file())).rejects.toThrow('Unknown deckId "d9"');
  });

  it('rejects on a non-OK response without a typed body (no silent success)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(uploadDeckAudio('d1', file())).rejects.toThrow();
  });
});
