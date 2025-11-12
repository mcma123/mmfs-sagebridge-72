import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes a value to a finite number, returning 0 for invalid inputs.
 * Handles numbers, strings (with currency symbols/commas), null, and undefined.
 * 
 * @param value - The value to sanitize
 * @returns A finite number, or 0 if the value cannot be converted
 */
export function sanitizeNumber(value: unknown): number {
  // Handle finite numbers directly
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  
  // Handle string values by stripping non-numeric characters (except . and -)
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  
  // Log in development to help catch unexpected data shapes
  if (process.env.NODE_ENV === 'development' && value !== null && value !== undefined && value !== '') {
    console.warn('sanitizeNumber: Could not convert value to number, returning 0:', value);
  }
  
  // Default to 0 for null, undefined, or invalid values
  return 0;
}

/**
 * Extracts initials from a user's display name.
 * Examples: "John Doe" → "JD", "Alice" → "A", "Bob Smith Jr" → "BS"
 *
 * @param name - The display name
 * @returns User initials (uppercase, max 2 characters)
 */
export function getUserInitials(name?: string | null): string {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return '?';
  }

  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  // Take first letter of first word and first letter of last word
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Formats a role string for display.
 * Examples: "admin" → "Admin", "accountant" → "Accountant"
 *
 * @param role - The role string
 * @returns Formatted role name
 */
export function formatUserRole(role?: string | null): string {
  if (!role || typeof role !== 'string') {
    return 'User';
  }

  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}