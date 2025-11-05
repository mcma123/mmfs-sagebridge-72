#!/usr/bin/env tsx
/**
 * Integration test for ledger endpoint with filters and pagination
 * Tests: GET /api/v1/accounting/ledger with various query parameters
 * 
 * Usage: tsx backend/scripts/test_ledger.ts
 */

import 'dotenv/config';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api/v1/accounting';
const ROLE = 'accountant';

interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function apiCall<T = any>(
  method: string,
  path: string,
  body?: any
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Role': ROLE,
  };

  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any = null;
    const text = await resp.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = text;
      }
    }

    return {
      ok: resp.ok,
      status: resp.status,
      data: resp.ok ? data : undefined,
      error: resp.ok ? undefined : (data?.message || data?.error || resp.statusText),
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err.message,
    };
  }
}

async function test1_GetAllLedgerEntries() {
  console.log('\n=== Test 1: Get All Ledger Entries (no filters) ===\n');

  const resp = await apiCall('GET', '/ledger');

  if (!resp.ok) {
    console.error(`❌ Failed to fetch ledger: ${resp.error}`);
    return false;
  }

  const { items, total } = resp.data;
  console.log(`✅ Fetched ${items?.length || 0} entries (total: ${total || 'unknown'})`);
  
  if (items && items.length > 0) {
    console.log(`   First entry: Account ${items[0].account_id}, Date ${items[0].date}, Balance ${items[0].balance_after}`);
  }

  return true;
}

async function test2_FilterByAccount() {
  console.log('\n=== Test 2: Filter by Account ID ===\n');

  // First, get accounts to find a valid account_id
  const accountsResp = await apiCall('GET', '/accounts');
  if (!accountsResp.ok || !accountsResp.data?.items?.length) {
    console.error('❌ No accounts available for testing');
    return false;
  }

  const accountId = accountsResp.data.items[0].id;
  const accountCode = accountsResp.data.items[0].code;
  console.log(`Testing with account: ${accountCode} (ID: ${accountId})`);

  const resp = await apiCall('GET', `/ledger?account_id=${accountId}`);

  if (!resp.ok) {
    console.error(`❌ Failed to fetch ledger for account ${accountId}: ${resp.error}`);
    return false;
  }

  const { items, total } = resp.data;
  console.log(`✅ Fetched ${items?.length || 0} entries for account ${accountCode} (total: ${total || 'unknown'})`);

  // Verify all entries are for the specified account
  if (items && items.length > 0) {
    const allMatch = items.every((entry: any) => entry.account_id === accountId);
    if (allMatch) {
      console.log(`✅ All entries match account_id ${accountId}`);
    } else {
      console.error(`❌ Some entries don't match account_id ${accountId}`);
      return false;
    }
  }

  return true;
}

async function test3_FilterByDateRange() {
  console.log('\n=== Test 3: Filter by Date Range ===\n');

  const startDate = '2024-01-01';
  const endDate = '2024-12-31';

  const resp = await apiCall('GET', `/ledger?start=${startDate}&end=${endDate}`);

  if (!resp.ok) {
    console.error(`❌ Failed to fetch ledger for date range: ${resp.error}`);
    return false;
  }

  const { items, total } = resp.data;
  console.log(`✅ Fetched ${items?.length || 0} entries for ${startDate} to ${endDate} (total: ${total || 'unknown'})`);

  // Verify all entries are within the date range
  if (items && items.length > 0) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const allInRange = items.every((entry: any) => {
      const entryDate = new Date(entry.date);
      return entryDate >= start && entryDate <= end;
    });
    
    if (allInRange) {
      console.log(`✅ All entries are within date range`);
    } else {
      console.error(`❌ Some entries are outside date range`);
      return false;
    }
  }

  return true;
}

async function test4_Pagination() {
  console.log('\n=== Test 4: Pagination ===\n');

  // First page
  console.log('Fetching first page (limit=10, offset=0)...');
  const page1Resp = await apiCall('GET', '/ledger?limit=10&offset=0');

  if (!page1Resp.ok) {
    console.error(`❌ Failed to fetch first page: ${page1Resp.error}`);
    return false;
  }

  const { items: page1Items, total } = page1Resp.data;
  console.log(`✅ Page 1: ${page1Items?.length || 0} entries (total: ${total || 'unknown'})`);

  if (!total || total <= 10) {
    console.log('⚠️  Not enough entries to test pagination (need > 10)');
    return true; // Not a failure, just insufficient data
  }

  // Second page
  console.log('\nFetching second page (limit=10, offset=10)...');
  const page2Resp = await apiCall('GET', '/ledger?limit=10&offset=10');

  if (!page2Resp.ok) {
    console.error(`❌ Failed to fetch second page: ${page2Resp.error}`);
    return false;
  }

  const { items: page2Items } = page2Resp.data;
  console.log(`✅ Page 2: ${page2Items?.length || 0} entries`);

  // Verify pages don't overlap
  if (page1Items && page2Items && page1Items.length > 0 && page2Items.length > 0) {
    const page1Ids = new Set(page1Items.map((e: any) => e.id));
    const hasOverlap = page2Items.some((e: any) => page1Ids.has(e.id));
    
    if (hasOverlap) {
      console.error('❌ Pages have overlapping entries');
      return false;
    } else {
      console.log('✅ Pages have no overlapping entries');
    }
  }

  return true;
}

async function test5_CombinedFilters() {
  console.log('\n=== Test 5: Combined Filters (account + date range + pagination) ===\n');

  // Get a valid account
  const accountsResp = await apiCall('GET', '/accounts');
  if (!accountsResp.ok || !accountsResp.data?.items?.length) {
    console.error('❌ No accounts available for testing');
    return false;
  }

  const accountId = accountsResp.data.items[0].id;
  const accountCode = accountsResp.data.items[0].code;

  const startDate = '2024-01-01';
  const endDate = '2024-12-31';
  const limit = 5;
  const offset = 0;

  console.log(`Testing with: account=${accountCode}, dates=${startDate} to ${endDate}, limit=${limit}, offset=${offset}`);

  const resp = await apiCall('GET', `/ledger?account_id=${accountId}&start=${startDate}&end=${endDate}&limit=${limit}&offset=${offset}`);

  if (!resp.ok) {
    console.error(`❌ Failed to fetch with combined filters: ${resp.error}`);
    return false;
  }

  const { items, total } = resp.data;
  console.log(`✅ Fetched ${items?.length || 0} entries (total: ${total || 'unknown'})`);

  // Verify filters are applied
  if (items && items.length > 0) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const allValid = items.every((entry: any) => {
      const entryDate = new Date(entry.date);
      return entry.account_id === accountId && entryDate >= start && entryDate <= end;
    });
    
    if (allValid) {
      console.log(`✅ All entries match combined filters`);
    } else {
      console.error(`❌ Some entries don't match filters`);
      return false;
    }

    if (items.length <= limit) {
      console.log(`✅ Result count respects limit`);
    } else {
      console.error(`❌ Result count exceeds limit`);
      return false;
    }
  }

  return true;
}

async function test6_EmptyResults() {
  console.log('\n=== Test 6: Empty Results (invalid account) ===\n');

  const invalidAccountId = 999999;
  const resp = await apiCall('GET', `/ledger?account_id=${invalidAccountId}`);

  if (!resp.ok) {
    console.error(`❌ Request failed (should return empty array): ${resp.error}`);
    return false;
  }

  const { items, total } = resp.data;
  
  if (items && items.length === 0) {
    console.log(`✅ Returns empty array for invalid account (total: ${total || 0})`);
    return true;
  } else {
    console.error(`❌ Expected empty array, got ${items?.length || 'undefined'} items`);
    return false;
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Ledger Endpoint Integration Tests                    ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Role: ${ROLE}`);

  const tests = [
    { name: 'Get All Ledger Entries', fn: test1_GetAllLedgerEntries },
    { name: 'Filter by Account', fn: test2_FilterByAccount },
    { name: 'Filter by Date Range', fn: test3_FilterByDateRange },
    { name: 'Pagination', fn: test4_Pagination },
    { name: 'Combined Filters', fn: test5_CombinedFilters },
    { name: 'Empty Results', fn: test6_EmptyResults },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ Test threw exception: ${err.message}`);
      failed++;
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Test Summary                                          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`Total: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

