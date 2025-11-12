import express from 'express';
import crypto from 'crypto';
import { authorize } from '../middleware/rbac';

const router = express.Router();

function stableHash(parts: any): string {
  const norm = JSON.stringify(parts, Object.keys(parts).sort());
  return crypto.createHash('sha256').update(norm).digest('hex');
}

async function resolveAccountIdByCode(pg: any, accountCode: string): Promise<number | null> {
  try {
    const result = await pg.query('SELECT id FROM accounting.accounts WHERE code = $1 LIMIT 1', [accountCode]);
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Sessions list/create
router.get('/sessions', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const result = await req.pg.query('SELECT * FROM banking.import_sessions ORDER BY created_at DESC');
    res.json({ items: result.rows });
  } catch (err) { next(err); }
});

router.post('/sessions', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { fileName, fileHash, mappingTemplateId } = req.body || {};
    const userId = Number(req.headers['x-user-id']) || null;
    const result = await req.pg.query(
      `INSERT INTO banking.import_sessions (user_id, file_name, file_hash, status, mapping_template_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, fileName, fileHash, 'new', mappingTemplateId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Session details
router.get('/sessions/:id', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const sessionResult = await req.pg.query('SELECT * FROM banking.import_sessions WHERE id = $1', [id]);
    if (sessionResult.rows.length === 0) throw { status: 404, code: 'NOT_FOUND', message: 'session not found' };

    const countResult = await req.pg.query('SELECT COUNT(*) FROM banking.import_transactions WHERE session_id = $1', [id]);
    const session = sessionResult.rows[0];
    session.transactionsCount = parseInt(countResult.rows[0].count);

    res.json(session);
  } catch (err) { next(err); }
});

// Analyze raw rows and compute totals, set status to 'mapped'
router.post('/sessions/:id/analyze', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { rows } = req.body || {};
    if (!Array.isArray(rows)) throw { status: 400, code: 'INVALID_BODY', message: 'rows[] required' };

    let count = 0, valid = 0, invalid = 0, duplicate = 0, excluded = 0, debitTotal = 0, creditTotal = 0;
    const seen = new Set<string>();
    const duplicateIndices: number[] = [];

    for (const r of rows) {
      const base = {
        date: r.date || null,
        description: (r.description || '').trim().toLowerCase(),
        amount: r.amount ?? null,
        debit: r.debit ?? null,
        credit: r.credit ?? null,
        currency: (r.currency || '').trim().toUpperCase(),
        reference: (r.reference || '').trim().toLowerCase()
      };
      const h = stableHash(base);
      if (seen.has(h)) {
        duplicate++;
        duplicateIndices.push(count);
      } else {
        seen.add(h);
      }
      const isValid = !!(base.date && (base.debit || base.credit || base.amount));
      if (isValid) valid++; else invalid++;
      debitTotal += Number(base.debit || 0);
      creditTotal += Number(base.credit || 0);
      count++;
    }

    const totals = { count, valid, invalid, duplicate, excluded, debitTotal, creditTotal };
    await req.pg.query(
      'UPDATE banking.import_sessions SET status = $1, totals_json = $2 WHERE id = $3',
      ['mapped', JSON.stringify(totals), id]
    );

    // Return complete response matching AnalyzeResponse interface
    res.json({
      totals,
      errors: [],
      duplicates: duplicateIndices
    });
  } catch (err) { next(err); }
});

// Stage normalized transactions into import_transactions, set status to 'staged'
router.post('/sessions/:id/stage', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { transactions } = req.body || {};
    if (!Array.isArray(transactions)) throw { status: 400, code: 'INVALID_BODY', message: 'transactions[] required' };

    const rows = transactions.map((t: any) => {
      const base = {
        date: t.date || null,
        description: (t.description || '').trim().toLowerCase(),
        amount: t.amount ?? null,
        debit: t.debit ?? null,
        credit: t.credit ?? null,
        currency: (t.currency || '').trim().toUpperCase(),
        reference: (t.reference || '').trim().toLowerCase(),
        accountCode: (t.accountCode || '').trim()
      };
      const rowHash = stableHash(base);
      return {
        session_id: Number(id),
        row_index: t.rowIndex ?? 0,
        date: t.date || null,
        description: t.description || null,
        amount: t.amount ?? null,
        debit: t.debit ?? null,
        credit: t.credit ?? null,
        account_code: t.accountCode || null,
        reference: t.reference || null,
        currency: t.currency || null,
        validation_status: t.validationStatus || 'unmapped',
        duplicate_flag: !!t.duplicateFlag,
        excluded: !!t.excluded,
        edit_history_json: Array.isArray(t.editHistory) ? t.editHistory : [],
        row_hash: rowHash
      };
    });

    // Insert ignoring duplicates (unique on session_id,row_hash)
    for (const row of rows) {
      await req.pg.query(
        `INSERT INTO banking.import_transactions
         (session_id, row_index, date, description, amount, debit, credit, account_code, reference, currency,
          validation_status, duplicate_flag, excluded, edit_history_json, row_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (session_id, row_hash) DO NOTHING`,
        [row.session_id, row.row_index, row.date, row.description, row.amount, row.debit, row.credit,
         row.account_code, row.reference, row.currency, row.validation_status, row.duplicate_flag,
         row.excluded, JSON.stringify(row.edit_history_json), row.row_hash]
      );
    }

    await req.pg.query('UPDATE banking.import_sessions SET status = $1 WHERE id = $2', ['staged', id]);
    res.status(201).json({ sessionId: id, staged: rows.length });
  } catch (err) { next(err); }
});

// Edit a staged row
router.patch('/sessions/:id/rows/:rowId', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id, rowId } = req.params;
    const updates: any = {};
    const allowed = ['date','description','amount','debit','credit','account_code','reference','currency','validation_status','duplicate_flag','excluded','edit_history_json'];
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    // Build dynamic UPDATE query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(rowId);
    values.push(Number(id));

    const result = await req.pg.query(
      `UPDATE banking.import_transactions
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND session_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Transaction not found' };
    }

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// Commit staged rows -> Accounting destinations (Journal Entries, Trial Balance, Chart of Accounts)
router.post('/sessions/:id/commit', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { bankAccountCode, aggregation, destinations } = req.body || {};

    // Make bankAccountCode optional - only validate if Journal Entries destination is selected
    let bankAccountId = null;
    if (destinations?.journalEntries && bankAccountCode && bankAccountCode !== 'DEFAULT') {
      bankAccountId = await resolveAccountIdByCode(req.pg, bankAccountCode);
      if (!bankAccountId) throw { status: 400, code: 'ACCOUNT_NOT_FOUND', message: `Bank account code ${bankAccountCode} not found` };
    }

    const txResult = await req.pg.query(
      `SELECT * FROM banking.import_transactions
       WHERE session_id = $1 AND excluded = false AND validation_status IN ('valid', 'unmapped')
       ORDER BY row_index ASC`,
      [id]
    );
    const txs = txResult.rows;

    if (!txs || txs.length === 0) {
      return res.json({ sessionId: id, success: true, committedRows: 0, errors: [] });
    }

    const createdBy = Number(req.headers['x-user-id']) || null;
    const commitResults = { journalId: null, trialBalanceUpdated: false, missingAccounts: [] };

    // Destination 1: Journal Entries
    if (destinations?.journalEntries) {
      // Build lines: pair each transaction with bankAccountId to ensure balancing
      const lines: any[] = [];
      for (const t of txs) {
        const accountCode = t.account_code;
        if (!accountCode) continue; // skip unmapped
        const accId = await resolveAccountIdByCode(req.pg, accountCode);
        if (!accId) continue;

        const amountNum = Number(t.amount ?? 0);
        const debitAmt = Number(t.debit ?? (amountNum > 0 ? amountNum : 0));
        const creditAmt = Number(t.credit ?? (amountNum < 0 ? Math.abs(amountNum) : 0));
        const memo = t.description || t.reference || '';

        if (bankAccountId) {
          // If bank account specified, create balanced entries
          if (debitAmt > 0) {
            lines.push({ account_id: accId, debit: debitAmt, memo });
            lines.push({ account_id: bankAccountId, credit: debitAmt, memo });
          } else if (creditAmt > 0) {
            lines.push({ account_id: accId, credit: creditAmt, memo });
            lines.push({ account_id: bankAccountId, debit: creditAmt, memo });
          }
        } else {
          // No bank account - create simple entries
          if (debitAmt > 0) {
            lines.push({ account_id: accId, debit: debitAmt, memo });
          }
          if (creditAmt > 0) {
            lines.push({ account_id: accId, credit: creditAmt, memo });
          }
        }
      }

      if (aggregation === 'by_account' && lines.length > 0) {
        // Aggregate per account_id
        const aggMap = new Map<number, { debit: number; credit: number; memo: string }>();
        for (const l of lines) {
          const prev = aggMap.get(l.account_id) || { debit: 0, credit: 0, memo: '' };
          aggMap.set(l.account_id, { debit: prev.debit + Number(l.debit || 0), credit: prev.credit + Number(l.credit || 0), memo: prev.memo });
        }
        const aggregated: any[] = [];
        let totalDebit = 0, totalCredit = 0;
        for (const [accId, vals] of aggMap.entries()) {
          if (vals.debit > 0) { aggregated.push({ account_id: accId, debit: vals.debit }); totalDebit += vals.debit; }
          if (vals.credit > 0) { aggregated.push({ account_id: accId, credit: vals.credit }); totalCredit += vals.credit; }
        }
        // Add bank balancing line(s) if bank account specified
        if (bankAccountId) {
          if (totalDebit > totalCredit) {
            aggregated.push({ account_id: bankAccountId, credit: totalDebit - totalCredit });
          } else if (totalCredit > totalDebit) {
            aggregated.push({ account_id: bankAccountId, debit: totalCredit - totalDebit });
          }
        }
        lines.splice(0, lines.length, ...aggregated);
      }

      if (lines.length > 0) {
        // Call accounting function via PostgreSQL
        const journalResult = await req.pg.query(
          'SELECT accounting.fn_post_journal($1, $2, $3, $4, $5) as journal_id',
          [
            new Date().toISOString().slice(0,10),
            `BANK_IMPORT_${id}`,
            `Bank import commit for session ${id}`,
            createdBy,
            JSON.stringify(lines)
          ]
        );
        commitResults.journalId = journalResult.rows[0]?.journal_id;
      }
    }

    // Destination 2: Trial Balance
    if (destinations?.trialBalance) {
      // Aggregate transactions by account and insert/update trial balance
      // Note: This assumes a trial_balance table exists - implementation may vary
      try {
        const trialBalanceQuery = `
          INSERT INTO accounting.trial_balance_entries (account_id, period_date, debit, credit, balance, created_at)
          SELECT
            a.id as account_id,
            DATE_TRUNC('month', t.date) as period_date,
            SUM(COALESCE(t.debit, 0)) as debit,
            SUM(COALESCE(t.credit, 0)) as credit,
            SUM(COALESCE(t.debit, 0) - COALESCE(t.credit, 0)) as balance,
            NOW() as created_at
          FROM banking.import_transactions t
          JOIN accounting.accounts a ON a.code = t.account_code
          WHERE t.session_id = $1 AND t.excluded = FALSE AND t.account_code IS NOT NULL
          GROUP BY a.id, DATE_TRUNC('month', t.date)
          ON CONFLICT (account_id, period_date)
          DO UPDATE SET
            debit = trial_balance_entries.debit + EXCLUDED.debit,
            credit = trial_balance_entries.credit + EXCLUDED.credit,
            balance = trial_balance_entries.balance + EXCLUDED.balance
        `;
        const result = await req.pg.query(trialBalanceQuery, [id]);
        commitResults.trialBalanceUpdated = true;
      } catch (tbErr: any) {
        // Log error but don't fail the commit if trial balance update fails
        console.error('[banking_import] Trial balance update failed:', tbErr.message);
      }
    }

    // Destination 3: Chart of Accounts
    if (destinations?.chartOfAccounts) {
      // Extract unique account codes and check which ones don't exist
      const missingAccountsQuery = `
        SELECT DISTINCT t.account_code
        FROM banking.import_transactions t
        LEFT JOIN accounting.accounts a ON a.code = t.account_code
        WHERE t.session_id = $1
          AND t.excluded = FALSE
          AND t.account_code IS NOT NULL
          AND a.id IS NULL
      `;
      const { rows: missingAccounts } = await req.pg.query(missingAccountsQuery, [id]);

      if (missingAccounts.length > 0) {
        commitResults.missingAccounts = missingAccounts.map((row: any) => row.account_code);

        // Store missing accounts in audit log for admin review
        await req.pg.query(
          `INSERT INTO banking.import_audit_events (session_id, actor_id, action, details_json)
           VALUES ($1, $2, $3, $4)`,
          [
            Number(id),
            createdBy,
            'missing_accounts_detected',
            JSON.stringify({ accounts: commitResults.missingAccounts, count: commitResults.missingAccounts.length })
          ]
        );
      }
    }

    // Audit event for commit
    await req.pg.query(
      `INSERT INTO banking.import_audit_events (session_id, actor_id, action, details_json)
       VALUES ($1, $2, $3, $4)`,
      [
        Number(id),
        createdBy,
        'commit',
        JSON.stringify({
          journal_id: commitResults.journalId,
          trial_balance_updated: commitResults.trialBalanceUpdated,
          missing_accounts: commitResults.missingAccounts,
          committed_rows: txs.length,
          aggregation: aggregation || 'none',
          destinations: destinations || {}
        })
      ]
    );

    // Update session status
    await req.pg.query(
      'UPDATE banking.import_sessions SET status = $1 WHERE id = $2',
      ['committed', id]
    );
    res.json({
      sessionId: id,
      success: true,
      committedRows: txs.length,
      errors: [],
      ...commitResults
    });
  } catch (err) { next(err); }
});

// Templates list/create
router.get('/templates', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const result = await req.pg.query(
      'SELECT * FROM banking.import_mapping_templates ORDER BY created_at DESC'
    );
    res.json({ items: result.rows });
  } catch (err) { next(err); }
});

router.post('/templates', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { name, bank, headerMap, transforms } = req.body || {};
    if (!name) throw { status: 400, code: 'INVALID_BODY', message: 'name required' };
    const userId = Number(req.headers['x-user-id']) || null;
    const result = await req.pg.query(
      `INSERT INTO banking.import_mapping_templates (name, bank, header_map_json, transforms_json, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, bank, JSON.stringify(headerMap || {}), JSON.stringify(transforms || {}), userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;