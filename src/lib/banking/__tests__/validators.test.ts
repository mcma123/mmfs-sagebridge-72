import { describe, it, expect } from 'vitest';
import { parseDate, parseAmount, deriveSignedAmount, stableRowHash } from '../validators';

describe('banking validators', () => {
  it('parses dates in common formats', () => {
    expect(parseDate('2024-01-31')).toBe('2024-01-31');
    expect(parseDate('31/01/2024')).toBe('2024-01-31');
    expect(parseDate('01-31-2024')).toBe('2024-01-31');
    expect(parseDate('2024/01/31')).toBe('2024-01-31');
  });

  it('parses amounts with symbols and commas', () => {
    expect(parseAmount('R1,234.56')).toBeCloseTo(1234.56);
    expect(parseAmount('-$987')).toBeCloseTo(-987);
    expect(parseAmount('(250.00)')).toBeCloseTo(-250.0);
  });

  it('derives signed amount from debit/credit', () => {
    expect(deriveSignedAmount(100, null, null)).toBeCloseTo(100);
    expect(deriveSignedAmount(null, 50, null)).toBeCloseTo(-50);
    expect(deriveSignedAmount(null, null, 12.34)).toBeCloseTo(12.34);
    expect(deriveSignedAmount(0, 0, null)).toBeNull();
  });

  it('produces stable row hash for same content', () => {
    const a = stableRowHash(['2024-01-31','Payment',123.45,'11001','INV-123']);
    const b = stableRowHash(['2024-01-31','Payment',123.45,'11001','INV-123']);
    const c = stableRowHash(['2024-01-31','Payment',-123.45,'11001','INV-123']);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});