import { SystemField } from './models';

const ISO_CURRENCIES = new Set([
  'USD','EUR','GBP','ZAR','JPY','CHF','AUD','CAD','NZD','CNY','INR','BRL','MXN','SEK','NOK','DKK','PLN','TRY','RUB','HKD','SGD','KRW','ZWL'
]);

export function sanitizeText(input: string | null | undefined, maxLen = 256): string | null {
  if (!input && input !== '') return null;
  const trimmed = String(input).trim().slice(0, maxLen);
  const printable = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
  return printable;
}

export function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const dmyMatch = /^\d{2}\/\d{2}\/\d{4}$/.test(v);
  const mdyMatch = /^\d{2}-\d{2}-\d{4}$/.test(v);
  const isoSlashMatch = /^\d{4}\/\d{2}\/\d{2}$/.test(v);
  if (isoMatch) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : v;
  }
  if (dmyMatch) {
    const [dd, mm, yyyy] = v.split('/');
    const d = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(d)) return null;
    return new Date(d).toISOString().slice(0, 10);
  }
  if (mdyMatch) {
    const [mm, dd, yyyy] = v.split('-');
    const d = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(d)) return null;
    return new Date(d).toISOString().slice(0, 10);
  }
  if (isoSlashMatch) {
    const [yyyy, mm, dd] = v.split('/');
    const d = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(d)) return null;
    return new Date(d).toISOString().slice(0, 10);
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const iso = d.toISOString().slice(0, 10);
    return iso;
  }
  return null;
}

export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Accounting-style negatives e.g. (250.00)
  const hasParensNegative = /^\(.*\)$/.test(raw);
  // Strip parentheses and any currency symbols/letters
  let cleaned = raw.replace(/[()]/g, '').replace(/[^0-9.,-]/g, '');
  // Normalize thousand separators: drop commas, keep dot as decimal
  cleaned = cleaned.replace(/,/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!isFinite(num)) return null;
  return hasParensNegative ? -Math.abs(num) : num;
}

export function deriveSignedAmount(debit: number | null, credit: number | null, fallbackAmount: number | null): number | null {
  // If neither debit nor credit provided, use fallback
  if (debit === null && credit === null) return fallbackAmount;
  const d = debit ?? 0;
  const c = credit ?? 0;
  // Treat explicit zero/zero as "no amount" when no fallback
  if (d === 0 && c === 0 && fallbackAmount === null) return null;
  return d - c;
}

export function isIsoCurrency(code: string | null | undefined): boolean {
  if (!code) return false;
  return ISO_CURRENCIES.has(code.toUpperCase());
}

export function validateAccountCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return /^[A-Za-z0-9_.-]{2,32}$/.test(code.trim());
}

export function stableRowHash(parts: Array<string | number | null | undefined>): string {
  const str = parts.map(p => p === null || p === undefined ? '' : String(p).trim().toLowerCase()).join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return `h${Math.abs(h)}`;
}

export function fieldRequired(field: SystemField): boolean {
  return field === 'date' || field === 'description' || field === 'amount' || field === 'debit' || field === 'credit';
}