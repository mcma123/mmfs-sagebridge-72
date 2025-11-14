#!/usr/bin/env tsx
/**
 * Integration test for journal workflow actions
 * Tests: create draft → review → delete and create draft → post → void
 * 
 * Usage: tsx backend/scripts/test_journal_actions.ts
 */

import 'dotenv/config';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api/v1/accounting';
const ROLE = 'accountant';
const USER_ID = '1';

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
    'x-user-id': USER_ID,
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

async function test1_CreateReviewDelete() {
  console.log('\n=== Test 1: Create Draft → Review → Delete ===\n');

  // Step 1: Create draft journal
  console.log('1. Creating draft journal...');
  const createResp = await apiCall('POST', '/journals/draft', {
    date: new Date().toISOString().split('T')[0],
    reference: 'TEST-DRAFT-001',
    description: 'Test draft for review/delete flow',
    lines: [
      { account_id: 1, date: new Date().toISOString().split('T')[0], debit: 100, credit: 0 },
      { account_id: 2, date: new Date().toISOString().split('T')[0], debit: 0, credit: 100 },
    ],
  });

  if (!createResp.ok) {
    console.error(`❌ Failed to create draft: ${createResp.error}`);
    return false;
  }

  const journalId = createResp.data?.journal_id;
  console.log(`✅ Created draft journal ID: ${journalId}`);

  // Step 2: Review the draft
  console.log(`\n2. Reviewing journal ${journalId}...`);
  const reviewResp = await apiCall('PATCH', `/journals/${journalId}/review`);

  if (!reviewResp.ok) {
    console.error(`❌ Failed to review: ${reviewResp.error}`);
    return false;
  }

  console.log(`✅ Reviewed journal ${journalId}`);

  // Step 3: Verify status is 'reviewed'
  console.log(`\n3. Verifying status...`);
  const getResp = await apiCall('GET', `/journals/${journalId}`);

  if (!getResp.ok) {
    console.error(`❌ Failed to get journal: ${getResp.error}`);
    return false;
  }

  if (getResp.data?.journal?.status !== 'reviewed') {
    console.error(`❌ Expected status='reviewed', got '${getResp.data?.journal?.status}'`);
    return false;
  }

  console.log(`✅ Status is 'reviewed'`);

  // Step 4: Delete the reviewed journal
  console.log(`\n4. Deleting reviewed journal ${journalId}...`);
  const deleteResp = await apiCall('DELETE', `/journals/${journalId}`);

  if (!deleteResp.ok) {
    console.error(`❌ Failed to delete: ${deleteResp.error}`);
    return false;
  }

  console.log(`✅ Deleted journal ${journalId}`);

  // Step 5: Verify it's gone
  console.log(`\n5. Verifying deletion...`);
  const getAfterDeleteResp = await apiCall('GET', `/journals/${journalId}`);

  if (getAfterDeleteResp.ok) {
    console.error(`❌ Journal still exists after deletion`);
    return false;
  }

  if (getAfterDeleteResp.status !== 404) {
    console.error(`❌ Expected 404, got ${getAfterDeleteResp.status}`);
    return false;
  }

  console.log(`✅ Journal ${journalId} is deleted (404)`);

  return true;
}

async function test2_CreatePostVoid() {
  console.log('\n=== Test 2: Create Draft → Post → Void ===\n');

  // Step 1: Create balanced draft journal
  console.log('1. Creating balanced draft journal...');
  const createResp = await apiCall('POST', '/journals/draft', {
    date: new Date().toISOString().split('T')[0],
    reference: 'TEST-POST-001',
    description: 'Test draft for post/void flow',
    lines: [
      { account_id: 1, date: new Date().toISOString().split('T')[0], debit: 200, credit: 0 },
      { account_id: 2, date: new Date().toISOString().split('T')[0], debit: 0, credit: 200 },
    ],
  });

  if (!createResp.ok) {
    console.error(`❌ Failed to create draft: ${createResp.error}`);
    return false;
  }

  const journalId = createResp.data?.journal_id;
  console.log(`✅ Created draft journal ID: ${journalId}`);

  // Step 2: Post the draft
  console.log(`\n2. Posting journal ${journalId}...`);
  const postResp = await apiCall('POST', `/journals/${journalId}/post`);

  if (!postResp.ok) {
    console.error(`❌ Failed to post: ${postResp.error}`);
    return false;
  }

  console.log(`✅ Posted journal ${journalId}`);

  // Step 3: Verify status is 'posted'
  console.log(`\n3. Verifying status...`);
  const getResp = await apiCall('GET', `/journals/${journalId}`);

  if (!getResp.ok) {
    console.error(`❌ Failed to get journal: ${getResp.error}`);
    return false;
  }

  if (getResp.data?.journal?.status !== 'posted') {
    console.error(`❌ Expected status='posted', got '${getResp.data?.journal?.status}'`);
    return false;
  }

  console.log(`✅ Status is 'posted'`);

  // Step 4: Try to delete (should fail with 409)
  console.log(`\n4. Attempting to delete posted journal (should fail)...`);
  const deleteResp = await apiCall('DELETE', `/journals/${journalId}`);

  if (deleteResp.ok) {
    console.error(`❌ Delete should have failed for posted journal`);
    return false;
  }

  if (deleteResp.status !== 409) {
    console.error(`❌ Expected 409, got ${deleteResp.status}`);
    return false;
  }

  console.log(`✅ Delete correctly rejected with 409`);

  // Step 5: Void the posted journal
  console.log(`\n5. Voiding posted journal ${journalId}...`);
  const voidResp = await apiCall('POST', `/journals/${journalId}/void`, {
    reason: 'Test void',
  });

  if (!voidResp.ok) {
    console.error(`❌ Failed to void: ${voidResp.error}`);
    return false;
  }

  const reversalId = voidResp.data?.reversal_journal_id;
  console.log(`✅ Voided journal ${journalId}, reversal ID: ${reversalId}`);

  // Step 6: Verify voided_at is set
  console.log(`\n6. Verifying voided_at...`);
  const getAfterVoidResp = await apiCall('GET', `/journals/${journalId}`);

  if (!getAfterVoidResp.ok) {
    console.error(`❌ Failed to get journal: ${getAfterVoidResp.error}`);
    return false;
  }

  if (!getAfterVoidResp.data?.journal?.voided_at) {
    console.error(`❌ voided_at should be set`);
    return false;
  }

  console.log(`✅ voided_at is set: ${getAfterVoidResp.data.journal.voided_at}`);

  return true;
}

async function main() {
  console.log('🧪 Journal Actions Integration Tests');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Role: ${ROLE}, User ID: ${USER_ID}`);

  const test1Result = await test1_CreateReviewDelete();
  const test2Result = await test2_CreatePostVoid();

  console.log('\n=== Test Summary ===');
  console.log(`Test 1 (Create→Review→Delete): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Create→Post→Void): ${test2Result ? '✅ PASS' : '❌ FAIL'}`);

  if (test1Result && test2Result) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});












