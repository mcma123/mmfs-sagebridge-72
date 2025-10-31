import express from 'express';
import crypto from 'crypto';
import { authorize } from '../middleware/rbac';

const router = express.Router();

function stableHash(parts: any): string {
  const norm = JSON.stringify(parts, Object.keys(parts).sort());
  return crypto.createHash('sha256').update(norm).digest('hex');
}

async function resolveAccountIdByCode(db: any, accountCode: string): Promise<number | null> {
  const { data, error } = await db.from('accounting.accounts').select('id').eq('code', accountCode).limit(1).single();
  if (error) return null;
  return data?.id ?? null;
}

// Sessions list/create
router.get('/sessions', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.from('banking.import_sessions').select('*').order('created_at', { ascending: false });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

router.post('/sessions', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { fileName, fileHash, mappingTemplateId } = req.body || {};
    const userId = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.from('banking.import_sessions')
      .insert({ user_id: userId, file_name: fileName, file_hash: fileHash, status: 'new', mapping_template_id: mappingTemplateId })
      .select().single();
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// Session details
router.get('/sessions/:id', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.db.from('banking.import_sessions').select('*').eq('id', id).single();
    if (error) throw { status: 404, code: 'NOT_FOUND', message: 'session not found' };
    const { data: txCount, error: txErr } = await req.db.from('banking.import_transactions').select('id', { count: 'exact', head: true }).eq('session_id', id);
    if (txErr) throw { status: 500, code: 'DB_ERROR', message: txErr.message };
    res.json({ ...data, transactionsCount: txCount?.length ?? 0 });
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
    for (const r of rows) {
      count++;
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
      if (seen.has(h)) duplicate++; else seen.add(h);
      const isValid = !!(base.date && (base.debit || base.credit || base.amount));
      if (isValid) valid++; else invalid++;
      debitTotal += Number(base.debit || 0);
      creditTotal += Number(base.credit || 0);
    }
    const totals = { count, valid, invalid, duplicate, excluded, debitTotal, creditTotal };
    const { error } = await req.db.from('banking.import_sessions').update({ status: 'mapped', totals_json: totals }).eq('id', id);
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ sessionId: id, totals });
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
    const { error } = await req.db.from('banking.import_transactions').upsert(rows, { onConflict: 'session_id,row_hash' });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };

    const { error: updErr } = await req.db.from('banking.import_sessions').update({ status: 'staged' }).eq('id', id);
    if (updErr) throw { status: 500, code: 'DB_ERROR', message: updErr.message };
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
    updates.session_id = Number(id);
    const { data, error } = await req.db.from('banking.import_transactions').update(updates).eq('id', rowId).select().single();
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json(data);
  } catch (err) { next(err); }
});

// Commit staged rows -> Accounting Journal Entries using a specified bank account code
router.post('/sessions/:id/commit', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { bankAccountCode, aggregation } = req.body || {};
    if (!bankAccountCode) throw { status: 400, code: 'INVALID_BODY', message: 'bankAccountCode required to balance journal' };
    const bankAccountId = await resolveAccountIdByCode(req.db, bankAccountCode);
    if (!bankAccountId) throw { status: 400, code: 'ACCOUNT_NOT_FOUND', message: `Bank account code ${bankAccountCode} not found` };

    const { data: txs, error: txErr } = await req.db
      .from('banking.import_transactions')
      .select('*')
      .eq('session_id', id)
      .eq('excluded', false)
      .in('validation_status', ['valid','unmapped'])
      .order('row_index', { ascending: true });
    if (txErr) throw { status: 500, code: 'DB_ERROR', message: txErr.message };

    if (!txs || txs.length === 0) {
      return res.json({ sessionId: id, success: true, committedRows: 0, errors: [] });
    }

    // Build lines: pair each transaction with bankAccountId to ensure balancing
    const lines: any[] = [];
    for (const t of txs) {
      const accountCode = t.account_code;
      if (!accountCode) continue; // skip unmapped
      const accId = await resolveAccountIdByCode(req.db, accountCode);
      if (!accId) continue;

      const amountNum = Number(t.amount ?? 0);
      const debitAmt = Number(t.debit ?? (amountNum > 0 ? amountNum : 0));
      const creditAmt = Number(t.credit ?? (amountNum < 0 ? Math.abs(amountNum) : 0));
      const memo = t.description || t.reference || '';

      if (debitAmt > 0) {
        lines.push({ account_id: accId, debit: debitAmt, memo });
        lines.push({ account_id: bankAccountId, credit: debitAmt, memo });
      } else if (creditAmt > 0) {
        lines.push({ account_id: accId, credit: creditAmt, memo });
        lines.push({ account_id: bankAccountId, debit: creditAmt, memo });
      }
    }

    if (aggregation === 'by_account') {
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
      // Add bank balancing line(s)
      if (totalDebit > totalCredit) {
        aggregated.push({ account_id: bankAccountId, credit: totalDebit - totalCredit });
      } else if (totalCredit > totalDebit) {
        aggregated.push({ account_id: bankAccountId, debit: totalCredit - totalDebit });
      }
      lines.splice(0, lines.length, ...aggregated);
    }

    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data: journalId, error: postErr } = await req.db.rpc('fn_post_journal', {
      p_date: new Date().toISOString().slice(0,10),
      p_reference: `BANK_IMPORT_${id}`,
      p_description: `Bank import commit for session ${id}`,
      p_created_by: createdBy,
      p_lines: lines
    });
    if (postErr) throw { status: 500, code: 'DB_ERROR', message: postErr.message };

    // Audit event
    await req.db.from('banking.import_audit_events').insert({
      session_id: Number(id),
      actor_id: createdBy,
      action: 'commit',
      details_json: { journal_id: journalId, committed_rows: txs.length, aggregation: aggregation || 'none' }
    });

    // Update session status
    await req.db.from('banking.import_sessions').update({ status: 'committed' }).eq('id', id);
    res.json({ sessionId: id, success: true, committedRows: txs.length, errors: [] });
  } catch (err) { next(err); }
});

// Templates list/create
router.get('/templates', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.from('banking.import_mapping_templates').select('*').order('created_at', { ascending: false });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

router.post('/templates', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { name, bank, headerMap, transforms } = req.body || {};
    if (!name) throw { status: 400, code: 'INVALID_BODY', message: 'name required' };
    const userId = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.from('banking.import_mapping_templates')
      .insert({ name, bank, header_map_json: headerMap || {}, transforms_json: transforms || {}, created_by: userId })
      .select().single();
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json(data);
  } catch (err) { next(err); }
});

export default router;