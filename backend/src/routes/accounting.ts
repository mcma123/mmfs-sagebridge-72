import express from 'express';
import { authorize } from '../middleware/rbac';

const router = express.Router();

// Entities CRUD
router.get('/entities', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    // Exclude soft-deleted by default
    const { data, error } = await req.db
      .from('accounting_entities')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    // Filter out soft-deleted if column exists; backward-compatible if migrations not applied
    const items = (data || []).filter((e: any) => !('deleted_at' in e) || e.deleted_at === null);
    res.json({ items });
  } catch (err) { next(err); }
});

router.post('/entities', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { name, type, status, currency, country, email, phone, notes } = req.body || {};
    if (!name || !type) throw { status: 400, code: 'INVALID_BODY', message: 'name and type required' };
    const { data, error } = await req.db.rpc('fn_create_entity', {
      p_type: type,
      p_name: name,
      p_status: status ?? null,
      p_currency: currency ?? null,
      p_country: country ?? null,
      p_email: email ?? null,
      p_phone: phone ?? null,
      p_notes: notes ?? null,
    });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// Get single entity
router.get('/entities/:id', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.db
      .from('accounting_entities')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();
    if (error) throw { status: 404, code: 'NOT_FOUND', message: 'entity not found' };
    if (data.deleted_at) throw { status: 404, code: 'NOT_FOUND', message: 'entity not found' };
    res.json(data);
  } catch (err) { next(err); }
});

// Soft delete entity (blocked if referenced by journal lines)
router.delete('/entities/:id', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const refCheck = await req.pg.query('SELECT COUNT(*)::INT AS cnt FROM accounting.journal_lines WHERE entity_id = $1', [Number(id)]);
    const referenced = refCheck.rows?.[0]?.cnt > 0;
    if (referenced) {
      throw { status: 409, code: 'ENTITY_REFERENCED', message: 'Cannot delete entity referenced by journal lines. Set status to Inactive instead.' };
    }
    await req.pg.query(
      `UPDATE accounting.entities
       SET deleted_at = NOW(), status = COALESCE(status, 'Inactive'), updated_at = NOW()
       WHERE id = $1`,
      [Number(id)]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

router.patch('/entities/:id', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { name, type, status, currency, country, email, phone, notes } = req.body || {};
    const { data, error } = await req.db.rpc('fn_update_entity', {
      p_id: Number(id),
      p_type: type ?? null,
      p_name: name ?? null,
      p_status: status ?? null,
      p_currency: currency ?? null,
      p_country: country ?? null,
      p_email: email ?? null,
      p_phone: phone ?? null,
      p_notes: notes ?? null,
    });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json(data);
  } catch (err) { next(err); }
});

// Accounts CRUD
router.get('/accounts', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.from('accounting_accounts').select('*').order('code', { ascending: true });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

router.post('/accounts', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { code, name, type, currency, parent_id, is_active } = req.body || {};
    if (!code || !name || !type) throw { status: 400, code: 'INVALID_BODY', message: 'code, name, type required' };
    const { data, error } = await req.db.rpc('fn_create_account', {
      p_code: code,
      p_name: name,
      p_type: type,
      p_currency: currency ?? null,
      p_parent_id: parent_id ?? null,
      p_is_active: is_active ?? true,
    });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// Get single account
router.get('/accounts/:id', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { data, error } = await req.db
      .from('accounting_accounts')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();
    if (error) throw { status: 404, code: 'NOT_FOUND', message: 'account not found' };
    res.json(data);
  } catch (err) { next(err); }
});

router.patch('/accounts/:id', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { code, name, type, currency, parent_id, is_active } = req.body || {};
    const { data, error } = await req.db.rpc('fn_update_account', {
      p_id: Number(id),
      p_code: code ?? null,
      p_name: name ?? null,
      p_type: type ?? null,
      p_currency: currency ?? null,
      p_parent_id: parent_id ?? null,
      p_is_active: is_active ?? null,
    });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/accounts/:id', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    // Check if account is referenced by journal lines
    const refCheck = await req.pg.query(
      'SELECT COUNT(*)::INT AS cnt FROM accounting.journal_lines WHERE account_id = $1',
      [Number(id)]
    );
    const referenced = refCheck.rows?.[0]?.cnt > 0;

    if (referenced) {
      throw {
        status: 409,
        code: 'ACCOUNT_REFERENCED',
        message: 'Cannot delete account with transaction history. Set to inactive instead.'
      };
    }

    // Delete the account
    await req.pg.query('DELETE FROM accounting.accounts WHERE id = $1', [Number(id)]);

    res.status(204).send();
  } catch (err) { next(err); }
});

// Journals: post and list
router.post('/journals', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { date, reference, description, lines } = req.body || {};
    if (!date || !Array.isArray(lines) || lines.length === 0) throw { status: 400, code: 'INVALID_BODY', message: 'date and lines[] required' };
    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_post_journal', {
      p_date: date,
      p_reference: reference ?? null,
      p_description: description ?? null,
      p_created_by: createdBy,
      p_lines: lines
    });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json({ journal_id: data });
  } catch (err) { next(err); }
});

// Create journal draft (allows unbalanced)
router.post('/journals/draft', authorize(['admin','accountant','editor']), async (req: any, res: any, next: any) => {
  try {
    const { date, reference, description, lines } = req.body || {};
    if (!date || !Array.isArray(lines) || lines.length === 0) throw { status: 400, code: 'INVALID_BODY', message: 'date and lines[] required' };
    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_create_journal_draft', {
      p_date: date,
      p_reference: reference ?? null,
      p_description: description ?? null,
      p_created_by: createdBy,
      p_lines: lines
    });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json({ journal_id: data });
  } catch (err) { next(err); }
});

// Review journal (draft -> reviewed)
router.patch('/journals/:id/review', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const reviewedBy = Number(req.headers['x-user-id']) || null;
    const { error } = await req.db.rpc('fn_review_journal', {
      p_journal_id: Number(id),
      p_reviewed_by: reviewedBy
    });
    if (error) {
      // Map known DB errors to 400
      if (error.message && (error.message.includes('not found') || error.message.includes('not in draft'))) {
        throw { status: 400, code: 'INVALID_STATUS', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

// Post journal from draft/reviewed
router.post('/journals/:id/post', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const postedBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_post_journal_from_draft', {
      p_journal_id: Number(id),
      p_posted_by: postedBy
    });
    if (error) {
      // Check for balance error
      if (error.message && error.message.includes('not balanced')) {
        throw { status: 400, code: 'UNBALANCED', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }
    res.status(200).json({ journal_id: data });
  } catch (err) { next(err); }
});

router.get('/journals', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { start, end, status } = req.query as any;
    let q = req.db.from('accounting_journals').select('*');
    if (start) q = q.gte('date', start);
    if (end) q = q.lte('date', end);
    if (status) q = q.eq('status', status);
    q = q.order('date', { ascending: true }).order('id', { ascending: true });
    const { data, error } = await q;
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

// Get a single journal with lines
router.get('/journals/:id', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const j = await req.db
      .from('accounting_journals')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();
    if (j.error || !j.data) throw { status: 404, code: 'NOT_FOUND', message: 'journal not found' };
    const lines = await req.db
      .from('accounting_journal_lines')
      .select('*')
      .eq('journal_id', Number(id))
      .order('id', { ascending: true });
    if (lines.error) throw { status: 500, code: 'DB_ERROR', message: lines.error.message };
    res.json({ journal: j.data, lines: lines.data || [] });
  } catch (err) { next(err); }
});

// Void a journal by posting reversal
router.post('/journals/:id/void', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_void_journal', {
      p_journal_id: Number(id),
      p_created_by: createdBy,
      p_reason: reason ?? null,
    });
    if (error) {
      // Map known DB errors to 400
      if (error.message && (error.message.includes('not found') || error.message.includes('already voided'))) {
        throw { status: 400, code: 'INVALID_VOID', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }
    res.json({ reversal_journal_id: data });
  } catch (err) { next(err); }
});

// Delete journal (only draft/reviewed)
router.delete('/journals/:id', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const journalId = Number(req.params.id);
    if (!journalId) throw { status: 400, code: 'INVALID_ID', message: 'valid journal id required' };

    const lookup = await req.pg.query('SELECT status FROM accounting.journals WHERE id = $1', [journalId]);
    const journal = lookup.rows?.[0];
    if (!journal) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Journal not found' };
    }

    if (journal.status === 'posted') {
      throw {
        status: 409,
        code: 'POSTED_CANNOT_DELETE',
        message: 'Posted journals must be voided instead of deleted.',
      };
    }

    await req.pg.query('DELETE FROM accounting.journal_lines WHERE journal_id = $1', [journalId]);
    await req.pg.query('DELETE FROM accounting.journals WHERE id = $1', [journalId]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Ledger query (with optional filters and pagination)
router.get('/ledger', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { account_id, start, end, limit = 50, offset = 0 } = req.query as any;
    let q = req.db.from('accounting_ledger_entries').select('*', { count: 'exact' }).order('date', { ascending: true }).order('id', { ascending: true });
    if (account_id) q = q.eq('account_id', Number(account_id));
    if (start) q = q.gte('date', start);
    if (end) q = q.lte('date', end);
    q = q.range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, count, error } = await q;
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [], total: count ?? undefined });
  } catch (err) { next(err); }
});

// Trial balance (current)
router.get('/trial-balance', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.from('accounting_trial_balance_current').select('*');
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

export default router;