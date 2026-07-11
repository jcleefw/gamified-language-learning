import { describe, it, expect } from 'vitest';
import { mintCorrelationId, createCorrelationLedger } from '../useCorrelation';

describe('mintCorrelationId', () => {
  it('mints a distinct id each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => mintCorrelationId()));
    expect(ids.size).toBe(100);
  });
});

describe('createCorrelationLedger', () => {
  it('mints an id on first serve of a word', () => {
    const ledger = createCorrelationLedger();
    expect(ledger.peek('w1')).toBeUndefined();
    const id = ledger.forWord('w1');
    expect(id).toBeTruthy();
    expect(ledger.peek('w1')).toBe(id);
  });

  it('reuses a word id on re-serve — a recheck re-ask keeps the original id', () => {
    const ledger = createCorrelationLedger();
    const first = ledger.forWord('w1');
    const reask = ledger.forWord('w1');
    expect(reask).toBe(first);
  });

  it('gives different words different ids', () => {
    const ledger = createCorrelationLedger();
    expect(ledger.forWord('a')).not.toBe(ledger.forWord('b'));
  });

  it('reset clears the ledger so ids never bleed across sessions', () => {
    const ledger = createCorrelationLedger();
    const before = ledger.forWord('w1');
    ledger.reset();
    expect(ledger.peek('w1')).toBeUndefined();
    expect(ledger.forWord('w1')).not.toBe(before);
  });
});
