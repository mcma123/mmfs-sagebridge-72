import express from 'express';
import { authorize } from '../middleware/rbac';
import ExcelJS from 'exceljs';
import { broadcastJournalPosted, broadcastGeneralRefresh } from '../realtime/dashboardBroadcast';

const router = express.Router();

// Ensure Supabase-backed routes fail gracefully when Supabase is unavailable
const requireSupabase = (req: any, res: any, next: any) => {
  if (!(req as any).db) {
    console.error('[accounting] ✗ Supabase client not available on request', {
      path: req.path,
      method: req.method,
      supabaseAvailable: req.supabaseAvailable,
      hasDb: !!req.db,
      hasSupabase: !!req.supabase,
      hasPg: !!req.pg,
    });

    return res.status(503).json({
      error: {
        code: 'SUPABASE_UNAVAILABLE',
        message:
          'Supabase client is not available. This may be due to missing environment variables or connection issues. ' +
          'Please check backend logs for details. Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) in .env.',
        details: {
          supabaseAvailable: req.supabaseAvailable ?? false,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
  return next();
};

// Entities CRUD
router.get('/entities', authorize(['admin','accountant','editor','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
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

router.post('/entities', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.get('/entities/:id', authorize(['admin','accountant','editor','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
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

router.patch('/entities/:id', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.get('/accounts', authorize(['admin','accountant','editor','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.from('accounting_accounts').select('*').order('code', { ascending: true });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

router.post('/accounts', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.get('/accounts/:id', authorize(['admin','accountant','editor','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
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

router.patch('/accounts/:id', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.post('/journals', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.post('/journals/draft', authorize(['admin','accountant','editor']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.patch('/journals/:id/review', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.post('/journals/:id/post', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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

router.get('/journals', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.get('/journals/:id', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
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
router.post('/journals/:id/void', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
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

// Delete journal (only draft/reviewed OR unpaid notes)
router.delete('/journals/:id', authorize(['admin']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const journalId = Number(req.params.id);
    if (!journalId) throw { status: 400, code: 'INVALID_ID', message: 'valid journal id required' };

    const lookup = await req.pg.query('SELECT status, reference, payment_status FROM accounting.journals WHERE id = $1', [journalId]);
    const journal = lookup.rows?.[0];
    if (!journal) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Journal not found' };
    }

    // Allow deletion of draft/reviewed journals OR unpaid notes (DN-/CN-)
    const isNote = journal.reference && (journal.reference.startsWith('DN-') || journal.reference.startsWith('CN-'));
    const canDelete = (journal.status !== 'posted') || (isNote && journal.payment_status === 'unpaid');

    if (!canDelete) {
      throw {
        status: 409,
        code: 'CANNOT_DELETE',
        message: 'Posted journals must be voided instead of deleted. Notes can only be deleted if unpaid.',
      };
    }

    const deletedBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_delete_journal', {
      p_journal_id: journalId,
      p_deleted_by: deletedBy
    });

    if (error) {
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DEBIT/CREDIT NOTE ACTIONS
// ============================================================================

// Mark debit note as paid (creates payment journal)
router.post('/journals/:id/mark-paid', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { bank_account_id, payment_date, notes } = req.body || {};

    if (!bank_account_id || !payment_date) {
      throw { status: 400, code: 'INVALID_BODY', message: 'bank_account_id and payment_date required' };
    }

    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_mark_note_paid', {
      p_journal_id: Number(id),
      p_bank_account_id: bank_account_id,
      p_payment_date: payment_date,
      p_created_by: createdBy,
      p_notes: notes || null
    });

    if (error) {
      // Map known DB errors to 400
      if (error.message && (error.message.includes('not found') || error.message.includes('already paid') || error.message.includes('voided'))) {
        throw { status: 400, code: 'INVALID_OPERATION', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.json(data);
  } catch (err) { next(err); }
});

// Record partial payment for debit note
router.post('/journals/:id/partial-payment', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { amount, bank_account_id, payment_date, notes } = req.body || {};

    if (!amount || !bank_account_id || !payment_date) {
      throw { status: 400, code: 'INVALID_BODY', message: 'amount, bank_account_id, and payment_date required' };
    }

    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_record_partial_payment', {
      p_journal_id: Number(id),
      p_amount: amount,
      p_bank_account_id: bank_account_id,
      p_payment_date: payment_date,
      p_created_by: createdBy,
      p_notes: notes || null
    });

    if (error) {
      if (error.message && (error.message.includes('not found') || error.message.includes('voided') || error.message.includes('exceeds'))) {
        throw { status: 400, code: 'INVALID_OPERATION', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.json(data);
  } catch (err) { next(err); }
});

// Reconcile payment for debit note
router.post('/journals/:id/reconcile', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const createdBy = Number(req.headers['x-user-id']) || null;

    const { data, error } = await req.db.rpc('fn_reconcile_payment', {
      p_journal_id: Number(id),
      p_created_by: createdBy
    });

    if (error) {
      if (error.message && (error.message.includes('not found') || error.message.includes('must be paid') || error.message.includes('already reconciled'))) {
        throw { status: 400, code: 'INVALID_OPERATION', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.json(data);
  } catch (err) { next(err); }
});

// Apply credit note to debit note
router.post('/journals/:id/apply-credit', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params; // credit note id
    const { debit_note_id, amount, applied_date, notes } = req.body || {};

    if (!debit_note_id) {
      throw { status: 400, code: 'INVALID_BODY', message: 'debit_note_id required' };
    }

    const createdBy = Number(req.headers['x-user-id']) || null;

    // If amount not provided, use full credit note amount
    let applyAmount = amount;
    if (!applyAmount) {
      const creditNoteResult = await req.pg.query(
        'SELECT COALESCE(SUM(credit), 0) as total FROM accounting.journal_lines WHERE journal_id = $1 AND credit > 0',
        [Number(id)]
      );
      applyAmount = creditNoteResult.rows[0]?.total || 0;
    }

    const { data, error } = await req.db.rpc('fn_apply_credit_to_debit', {
      p_credit_note_id: Number(id),
      p_debit_note_id: debit_note_id,
      p_amount: applyAmount,
      p_applied_date: applied_date || new Date().toISOString().split('T')[0],
      p_created_by: createdBy,
      p_notes: notes || null
    });

    if (error) {
      if (error.message && (error.message.includes('not found') || error.message.includes('not a') || error.message.includes('voided') || error.message.includes('exceeds'))) {
        throw { status: 400, code: 'INVALID_OPERATION', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.json(data);
  } catch (err) { next(err); }
});

// Mark refund paid for credit note
router.post('/journals/:id/refund-paid', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { bank_account_id, payment_date, notes } = req.body || {};

    if (!bank_account_id || !payment_date) {
      throw { status: 400, code: 'INVALID_BODY', message: 'bank_account_id and payment_date required' };
    }

    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_mark_refund_paid', {
      p_journal_id: Number(id),
      p_bank_account_id: bank_account_id,
      p_payment_date: payment_date,
      p_created_by: createdBy,
      p_notes: notes || null
    });

    if (error) {
      if (error.message && (error.message.includes('not found') || error.message.includes('credit note') || error.message.includes('already paid') || error.message.includes('voided'))) {
        throw { status: 400, code: 'INVALID_OPERATION', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.json(data);
  } catch (err) { next(err); }
});

// Export note as PDF
router.get('/journals/:id/pdf', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    // Get journal with lines
    const journal = await req.db
      .from('accounting_journals')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();

    if (journal.error || !journal.data) {
      throw { status: 404, code: 'NOT_FOUND', message: 'journal not found' };
    }

    const lines = await req.db
      .from('accounting_journal_lines')
      .select('*')
      .eq('journal_id', Number(id))
      .order('id', { ascending: true });

    if (lines.error) {
      throw { status: 500, code: 'DB_ERROR', message: lines.error.message };
    }

    // Check if it's a note
    const isDebitNote = journal.data.reference?.startsWith('DN-');
    const isCreditNote = journal.data.reference?.startsWith('CN-');

    if (!isDebitNote && !isCreditNote) {
      throw { status: 400, code: 'INVALID_OPERATION', message: 'Only debit and credit notes can be exported as PDF' };
    }

    // For now, return JSON (PDF generation will be implemented in Phase 3)
    // TODO: Implement PDF generation with pdfkit
    res.json({
      message: 'PDF generation not yet implemented',
      journal: journal.data,
      lines: lines.data || []
    });
  } catch (err) { next(err); }
});

// Ledger query (with optional filters and pagination)
router.get('/ledger', authorize(['admin','accountant','editor','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
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

// Trial balance (with optional date filter)
router.get('/trial-balance', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { asOfDate } = req.query;

    // Validate date if provided
    let dateParam = null;
    if (asOfDate) {
      const parsedDate = new Date(asOfDate as string);
      if (isNaN(parsedDate.getTime())) {
        throw { status: 400, code: 'INVALID_DATE', message: 'Invalid date format. Use YYYY-MM-DD.' };
      }
      // Check if date is not in the future
      if (parsedDate > new Date()) {
        throw { status: 400, code: 'FUTURE_DATE', message: 'Date cannot be in the future.' };
      }
      dateParam = asOfDate;
    }

    // Check if function exists first
    try {
      const fnCheck = await req.pg.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'accounting'
          AND p.proname = 'fn_trial_balance_asof'
        ) as exists
      `);
      
      if (!fnCheck.rows[0].exists) {
        console.error('Trial balance function does not exist. Run migration 012_trial_balance_filters.sql');
        throw { 
          status: 500, 
          code: 'MIGRATION_MISSING', 
          message: 'Trial balance function not found. Please run database migration 012.' 
        };
      }
    } catch (checkErr: any) {
      if (checkErr.status === 500) throw checkErr;
      console.error('Error checking for trial balance function:', checkErr);
    }

    // Call the SQL function with date parameter (uses current date if null)
    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_trial_balance_asof($1::DATE)',
      [dateParam]
    );

    res.json({ items: result.rows || [] });
  } catch (err) { next(err); }
});

// Export trial balance to Excel
router.get('/trial-balance/export', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { asOfDate } = req.query;

    // Validate date if provided
    let dateParam = null;
    let formattedDate = new Date().toISOString().split('T')[0];
    if (asOfDate) {
      const parsedDate = new Date(asOfDate as string);
      if (isNaN(parsedDate.getTime())) {
        throw { status: 400, code: 'INVALID_DATE', message: 'Invalid date format. Use YYYY-MM-DD.' };
      }
      if (parsedDate > new Date()) {
        throw { status: 400, code: 'FUTURE_DATE', message: 'Date cannot be in the future.' };
      }
      dateParam = asOfDate;
      formattedDate = asOfDate as string;
    }

    // Fetch trial balance data
    const result = await req.pg.query(
      'SELECT * FROM accounting.fn_trial_balance_asof($1::DATE)',
      [dateParam]
    );

    const items = result.rows || [];

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Trial Balance');

    // Set column widths
    worksheet.columns = [
      { header: 'Account Code', key: 'code', width: 15 },
      { header: 'Account Name', key: 'name', width: 40 },
      { header: 'Debit', key: 'debit', width: 18 },
      { header: 'Credit', key: 'credit', width: 18 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Helper function to determine if account type has debit normal balance
    const isDebitNormalBalance = (type: string) => {
      return ['Asset', 'Expense'].includes(type);
    };

    // Group accounts by category
    const categories = items.reduce((acc: any, item: any) => {
      const category = item.type || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    // Category order for accounting
    const categoryOrder = ['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'Other'];

    let currentRow = 2;
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    // Add data by category
    categoryOrder.forEach(category => {
      if (!categories[category]) return;

      const accounts = categories[category];
      let categoryDebit = 0;
      let categoryCredit = 0;

      // Add category header
      const categoryRow = worksheet.getRow(currentRow);
      categoryRow.getCell(1).value = category;
      categoryRow.font = { bold: true };
      categoryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' }
      };
      currentRow++;

      // Add accounts in category
      accounts.forEach((account: any) => {
        const balance = Number(account.balance) || 0;
        const isDebit = isDebitNormalBalance(account.type);

        let debitAmount = 0;
        let creditAmount = 0;

        if (balance !== 0) {
          if ((isDebit && balance > 0) || (!isDebit && balance < 0)) {
            debitAmount = Math.abs(balance);
          } else {
            creditAmount = Math.abs(balance);
          }
        }

        categoryDebit += debitAmount;
        categoryCredit += creditAmount;

        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = account.code;
        row.getCell(2).value = account.name;
        row.getCell(3).value = debitAmount > 0 ? debitAmount : '';
        row.getCell(4).value = creditAmount > 0 ? creditAmount : '';

        // Format currency cells
        if (debitAmount > 0) {
          row.getCell(3).numFmt = 'R#,##0.00';
        }
        if (creditAmount > 0) {
          row.getCell(4).numFmt = 'R#,##0.00';
        }

        currentRow++;
      });

      // Add category subtotal
      const subtotalRow = worksheet.getRow(currentRow);
      subtotalRow.getCell(2).value = `${category} Subtotal`;
      subtotalRow.getCell(3).value = categoryDebit > 0 ? categoryDebit : '';
      subtotalRow.getCell(4).value = categoryCredit > 0 ? categoryCredit : '';
      subtotalRow.font = { bold: true };
      if (categoryDebit > 0) {
        subtotalRow.getCell(3).numFmt = 'R#,##0.00';
      }
      if (categoryCredit > 0) {
        subtotalRow.getCell(4).numFmt = 'R#,##0.00';
      }

      grandTotalDebit += categoryDebit;
      grandTotalCredit += categoryCredit;

      currentRow += 2; // Add blank row after category
    });

    // Add grand totals
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(2).value = 'Grand Total';
    totalRow.getCell(3).value = grandTotalDebit;
    totalRow.getCell(4).value = grandTotalCredit;
    totalRow.font = { bold: true, size: 12 };
    totalRow.getCell(3).numFmt = 'R#,##0.00';
    totalRow.getCell(4).numFmt = 'R#,##0.00';
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD0D0D0' }
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="trial-balance-${formattedDate}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// ============================================================================
// TAX REPORTS
// ============================================================================

// Get all tax returns with optional filters
router.get('/tax-reports', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { type, year, status } = req.query as any;
    let q = req.db.from('accounting_tax_returns').select('*');

    if (type) q = q.eq('type', type);
    if (status) q = q.eq('status', status);
    if (year) {
      // Filter by year in period_start
      q = q.gte('period_start', `${year}-01-01`).lte('period_start', `${year}-12-31`);
    }

    q = q.order('due_date', { ascending: false }).order('id', { ascending: false });
    const { data, error } = await q;
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

// Get upcoming tax deadlines (suggestions for next 90 days)
router.get('/tax-reports/upcoming', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.rpc('fn_get_upcoming_tax_deadlines');
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

// Get single tax return with line items
router.get('/tax-reports/:id', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const taxReturn = await req.db
      .from('accounting_tax_returns')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();
    if (taxReturn.error || !taxReturn.data) {
      throw { status: 404, code: 'NOT_FOUND', message: 'tax return not found' };
    }

    const lines = await req.db
      .from('accounting_tax_return_lines')
      .select('*')
      .eq('tax_return_id', Number(id))
      .order('id', { ascending: true });
    if (lines.error) throw { status: 500, code: 'DB_ERROR', message: lines.error.message };

    res.json({ taxReturn: taxReturn.data, lines: lines.data || [] });
  } catch (err) { next(err); }
});

// Create new tax return (calls RPC to auto-calculate)
router.post('/tax-reports', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { type, period_start, period_end, due_date } = req.body || {};
    if (!type || !period_start || !period_end || !due_date) {
      throw { status: 400, code: 'INVALID_BODY', message: 'type, period_start, period_end, and due_date required' };
    }

    const createdBy = Number(req.headers['x-user-id']) || null;
    const { data, error } = await req.db.rpc('fn_create_tax_return', {
      p_type: type,
      p_period_start: period_start,
      p_period_end: period_end,
      p_due_date: due_date,
      p_created_by: createdBy
    });

    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// Update tax return (manual override amounts)
router.patch('/tax-reports/:id', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { amount, reference, notes, lines } = req.body || {};

    // Check if tax return is in draft status
    const existing = await req.db
      .from('accounting_tax_returns')
      .select('status')
      .eq('id', Number(id))
      .limit(1)
      .single();

    if (existing.error || !existing.data) {
      throw { status: 404, code: 'NOT_FOUND', message: 'tax return not found' };
    }

    if (existing.data.status !== 'draft') {
      throw { status: 400, code: 'INVALID_STATUS', message: 'Can only update draft tax returns' };
    }

    // Update main tax return
    const updates: any = { updated_at: new Date().toISOString() };
    if (amount !== undefined) updates.amount = amount;
    if (reference !== undefined) updates.reference = reference;
    if (notes !== undefined) updates.notes = notes;

    const { error: updateError } = await req.db
      .from('accounting_tax_returns')
      .update(updates)
      .eq('id', Number(id));

    if (updateError) throw { status: 500, code: 'DB_ERROR', message: updateError.message };

    // Update lines if provided
    if (Array.isArray(lines) && lines.length > 0) {
      // Delete existing lines
      await req.db
        .from('accounting_tax_return_lines')
        .delete()
        .eq('tax_return_id', Number(id));

      // Insert new lines
      for (const line of lines) {
        await req.db
          .from('accounting_tax_return_lines')
          .insert({
            tax_return_id: Number(id),
            description: line.description,
            account_id: line.account_id || null,
            amount: line.amount,
            is_manual_override: true
          });
      }
    }

    // Return updated tax return
    const updated = await req.db
      .from('accounting_tax_returns')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();

    res.json(updated.data);
  } catch (err) { next(err); }
});

// Review tax return (draft -> reviewed)
router.patch('/tax-reports/:id/review', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const reviewedBy = Number(req.headers['x-user-id']) || null;

    const { error } = await req.db.rpc('fn_review_tax_return', {
      p_tax_return_id: Number(id),
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

// Submit tax return (draft/reviewed -> submitted)
router.patch('/tax-reports/:id/submit', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;
    const { submitted_date } = req.body || {};
    const submittedBy = Number(req.headers['x-user-id']) || null;

    const { error } = await req.db.rpc('fn_submit_tax_return', {
      p_tax_return_id: Number(id),
      p_submitted_by: submittedBy,
      p_submitted_date: submitted_date || null
    });

    if (error) {
      // Map known DB errors to 400
      if (error.message && (error.message.includes('not found') || error.message.includes('already submitted'))) {
        throw { status: 400, code: 'INVALID_STATUS', message: error.message };
      }
      throw { status: 500, code: 'DB_ERROR', message: error.message };
    }

    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

// Delete tax return (draft only)
router.delete('/tax-reports/:id', authorize(['admin','accountant']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    // Check status
    const existing = await req.db
      .from('accounting_tax_returns')
      .select('status')
      .eq('id', Number(id))
      .limit(1)
      .single();

    if (existing.error || !existing.data) {
      throw { status: 404, code: 'NOT_FOUND', message: 'tax return not found' };
    }

    if (existing.data.status !== 'draft') {
      throw { status: 409, code: 'CANNOT_DELETE', message: 'Can only delete draft tax returns. Reviewed or submitted returns cannot be deleted.' };
    }

    // Delete lines first (cascade should handle this, but being explicit)
    await req.db
      .from('accounting_tax_return_lines')
      .delete()
      .eq('tax_return_id', Number(id));

    // Delete tax return
    const { error } = await req.db
      .from('accounting_tax_returns')
      .delete()
      .eq('id', Number(id));

    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };

    res.status(204).send();
  } catch (err) { next(err); }
});

// Get current tax liabilities from ledger
router.get('/tax-liabilities', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db
      .from('accounting_tax_liabilities')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

// Export tax return as Excel (similar to trial balance export)
router.get('/tax-reports/:id/export', authorize(['admin','accountant','viewer']), requireSupabase, async (req: any, res: any, next: any) => {
  try {
    const { id } = req.params;

    // Fetch tax return
    const taxReturn = await req.db
      .from('accounting_tax_returns')
      .select('*')
      .eq('id', Number(id))
      .limit(1)
      .single();

    if (taxReturn.error || !taxReturn.data) {
      throw { status: 404, code: 'NOT_FOUND', message: 'tax return not found' };
    }

    // Fetch lines
    const lines = await req.db
      .from('accounting_tax_return_lines')
      .select('*')
      .eq('tax_return_id', Number(id))
      .order('id', { ascending: true });

    if (lines.error) throw { status: 500, code: 'DB_ERROR', message: lines.error.message };

    const tr = taxReturn.data;
    const lineItems = lines.data || [];

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tax Return');

    // Add header info
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = `Tax Return - ${tr.type}`;
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:D2');
    worksheet.getCell('A2').value = `Period: ${tr.period_start} to ${tr.period_end}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:D3');
    worksheet.getCell('A3').value = `Due Date: ${tr.due_date}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A4:D4');
    worksheet.getCell('A4').value = `Status: ${tr.status.toUpperCase()}`;
    worksheet.getCell('A4').alignment = { horizontal: 'center' };

    // Empty row
    worksheet.addRow([]);

    // Column headers
    const headerRow = worksheet.addRow(['Description', 'Account Code', 'Amount', 'Override']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Set column widths
    worksheet.columns = [
      { key: 'description', width: 40 },
      { key: 'account_code', width: 15 },
      { key: 'amount', width: 18 },
      { key: 'override', width: 12 }
    ];

    // Add line items
    for (const line of lineItems) {
      const row = worksheet.addRow([
        line.description,
        line.account_id || '-',
        line.amount,
        line.is_manual_override ? 'Yes' : 'No'
      ]);

      // Format amount column
      row.getCell(3).numFmt = 'R#,##0.00';
    }

    // Total row
    const totalRow = worksheet.addRow(['', '', tr.amount, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(2).value = 'TOTAL:';
    totalRow.getCell(2).alignment = { horizontal: 'right' };
    totalRow.getCell(3).numFmt = 'R#,##0.00';
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    const filename = `tax-return-${tr.type}-${tr.period_start}-${tr.period_end}.xlsx`.toLowerCase().replace(/_/g, '-');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// Health check endpoint (comprehensive diagnostics)
router.get('/health', authorize(['admin','accountant','viewer']), async (req: any, res: any) => {
  try {
    const health: any = {
      timestamp: new Date().toISOString(),
      overall: 'unknown',
      checks: {},
    };

    // Check 1: Environment Variables
    health.checks.environment = {
      status: 'checking',
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      PGHOST: !!process.env.PGHOST,
    };

    const envOk = (health.checks.environment.SUPABASE_URL &&
                   (health.checks.environment.SUPABASE_SERVICE_ROLE_KEY || health.checks.environment.SUPABASE_ANON_KEY));
    health.checks.environment.status = envOk ? 'healthy' : 'unhealthy';

    // Check 2: PostgreSQL Connection
    health.checks.postgresql = { status: 'checking' };
    try {
      if (!req.pg) {
        health.checks.postgresql.status = 'unavailable';
        health.checks.postgresql.error = 'req.pg is undefined';
      } else {
        const pgResult = await req.pg.query('SELECT NOW() as now, current_database() as db');
        health.checks.postgresql.status = 'healthy';
        health.checks.postgresql.database = pgResult.rows[0]?.db;
        health.checks.postgresql.serverTime = pgResult.rows[0]?.now;
      }
    } catch (err: any) {
      health.checks.postgresql.status = 'unhealthy';
      health.checks.postgresql.error = err?.message || String(err);
    }

    // Check 3: Supabase Client
    health.checks.supabase = {
      status: 'checking',
      available: !!(req as any).db,
      supabaseAvailable: req.supabaseAvailable,
    };

    if ((req as any).db) {
      health.checks.supabase.status = 'healthy';
    } else {
      health.checks.supabase.status = 'unavailable';
      health.checks.supabase.message = 'Supabase client not initialized on request object';
    }

    // Check 4: Database Schema - Trial Balance Function
    health.checks.trialBalanceFunction = { status: 'checking' };
    try {
      const check = await req.pg.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'accounting' AND p.proname = 'fn_trial_balance_asof'
        ) as exists
      `);
      const exists = !!check.rows?.[0]?.exists;
      health.checks.trialBalanceFunction.exists = exists;
      health.checks.trialBalanceFunction.status = exists ? 'healthy' : 'missing';
      if (!exists) {
        health.checks.trialBalanceFunction.recommendation = 'Run migration: 012_trial_balance_filters.sql';
      }
    } catch (err: any) {
      health.checks.trialBalanceFunction.status = 'error';
      health.checks.trialBalanceFunction.error = err?.message || String(err);
    }

    // Check 5: Public Views Accessibility
    health.checks.publicViews = { status: 'checking', views: {} };

    if ((req as any).db) {
      const viewsToCheck = [
        'accounting_accounts',
        'accounting_entities',
        'accounting_ledger_entries',
        'accounting_trial_balance',
        'accounting_tax_returns',
        'accounting_tax_liabilities',
      ];

      for (const viewName of viewsToCheck) {
        try {
          const { error } = await (req as any).db
            .from(viewName)
            .select('*')
            .limit(1);

          if (error) {
            health.checks.publicViews.views[viewName] = {
              accessible: false,
              error: error.message || String(error),
            };
          } else {
            health.checks.publicViews.views[viewName] = { accessible: true };
          }
        } catch (err: any) {
          health.checks.publicViews.views[viewName] = {
            accessible: false,
            error: err?.message || String(err),
          };
        }
      }

      const allViewsAccessible = Object.values(health.checks.publicViews.views)
        .every((v: any) => v.accessible);

      health.checks.publicViews.status = allViewsAccessible ? 'healthy' : 'partial';

      if (!allViewsAccessible) {
        health.checks.publicViews.recommendation =
          'Run migration: 009_accounting_api_views.sql and ensure "public" schema is exposed in Supabase project settings';
      }
    } else {
      health.checks.publicViews.status = 'skipped';
      health.checks.publicViews.reason = 'Supabase client not available';
    }

    // Overall status determination
    const criticalChecks = [
      health.checks.postgresql.status === 'healthy',
      health.checks.environment.status === 'healthy',
    ];

    const importantChecks = [
      health.checks.supabase.status === 'healthy',
      health.checks.publicViews.status === 'healthy' || health.checks.publicViews.status === 'skipped',
      health.checks.trialBalanceFunction.status === 'healthy',
    ];

    if (criticalChecks.every(Boolean) && importantChecks.every(Boolean)) {
      health.overall = 'healthy';
    } else if (criticalChecks.every(Boolean)) {
      health.overall = 'degraded';
    } else {
      health.overall = 'unhealthy';
    }

    // Add recommendations
    health.recommendations = [];

    if (health.checks.environment.status !== 'healthy') {
      health.recommendations.push('Configure Supabase environment variables in .env file');
    }

    if (health.checks.supabase.status !== 'healthy') {
      health.recommendations.push('Check backend startup logs for Supabase client initialization errors');
    }

    if (health.checks.trialBalanceFunction.status !== 'healthy') {
      health.recommendations.push('Run database migrations: npm run db:migrate:app');
    }

    if (health.checks.publicViews.status === 'partial') {
      health.recommendations.push('Verify Supabase project exposes "public" schema in API settings');
    }

    res.json(health);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'HEALTH_ERROR',
        message: err?.message || 'health check failed',
        stack: err?.stack,
      },
    });
  }
});

// ============================================================================
// PAYMENT RECONCILIATION ENDPOINTS
// ============================================================================

// Get outstanding receivables (unpaid/partial debit notes)
router.get('/outstanding-items', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const result = await req.pg.query(`
      SELECT * FROM accounting.vw_outstanding_receivables
      ORDER BY journal_date ASC
    `);
    res.json({ items: result.rows });
  } catch (err) { next(err); }
});

// Get available credit notes
router.get('/available-credits', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const result = await req.pg.query(`
      SELECT * FROM accounting.vw_available_credits
      ORDER BY journal_date ASC
    `);
    res.json({ items: result.rows });
  } catch (err) { next(err); }
});

// Get unallocated bank transactions
router.get('/bank-transactions', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const result = await req.pg.query(`
      SELECT * FROM accounting.vw_unallocated_payments
      ORDER BY transaction_date DESC
    `);
    res.json({ items: result.rows });
  } catch (err) { next(err); }
});

// Manual entry of bank transaction
router.post('/bank-transactions', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { transaction_date, reference, description, amount, entity_name, bank_account_id, notes } = req.body || {};

    if (!transaction_date || !amount) {
      throw { status: 400, code: 'INVALID_BODY', message: 'transaction_date and amount are required' };
    }

    const userId = (req as any).userId || null;

    const result = await req.pg.query(`
      INSERT INTO accounting.bank_transactions
        (transaction_date, reference, description, amount, entity_name, bank_account_id, notes, created_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unallocated')
      RETURNING *
    `, [transaction_date, reference, description, amount, entity_name, bank_account_id, notes, userId]);

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// Import CSV bank statement
router.post('/bank-transactions/import', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { transactions, description } = req.body || {};

    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw { status: 400, code: 'INVALID_BODY', message: 'transactions array is required' };
    }

    const userId = (req as any).userId || null;
    const client = await req.pg.pool.connect();

    try {
      await client.query('BEGIN');

      // Create reconciliation batch
      const batchResult = await client.query(`
        INSERT INTO accounting.reconciliation_batches
          (batch_date, description, total_transactions, total_amount, created_by, status)
        VALUES (CURRENT_DATE, $1, $2, $3, $4, 'in_progress')
        RETURNING id
      `, [description || 'Bank statement import', transactions.length, transactions.reduce((sum, t) => sum + Number(t.amount), 0), userId]);

      const batchId = batchResult.rows[0].id;

      // Insert all transactions
      const insertPromises = transactions.map((t: any) =>
        client.query(`
          INSERT INTO accounting.bank_transactions
            (transaction_date, reference, description, amount, entity_name, bank_account_id, import_batch_id, created_by, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unallocated')
        `, [t.transaction_date || t.date, t.reference, t.description, t.amount, t.entity_name, t.bank_account_id, batchId, userId])
      );

      await Promise.all(insertPromises);

      await client.query('COMMIT');

      res.status(201).json({
        batch_id: batchId,
        imported_count: transactions.length,
        message: `Successfully imported ${transactions.length} transactions`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// Suggest matches for a bank transaction
router.post('/reconciliation/suggest-matches', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { bank_transaction_id } = req.body || {};

    if (!bank_transaction_id) {
      throw { status: 400, code: 'INVALID_BODY', message: 'bank_transaction_id is required' };
    }

    // Get the bank transaction
    const btResult = await req.pg.query(`
      SELECT * FROM accounting.bank_transactions WHERE id = $1
    `, [bank_transaction_id]);

    if (btResult.rows.length === 0) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Bank transaction not found' };
    }

    const bankTx = btResult.rows[0];
    const amount = Math.abs(Number(bankTx.amount));
    const entityName = bankTx.entity_name || '';
    const reference = bankTx.reference || '';
    const txDate = new Date(bankTx.transaction_date);

    // Query outstanding items
    const outstandingResult = await req.pg.query(`
      SELECT
        journal_id,
        reference,
        journal_date,
        description,
        entity_name,
        outstanding_amount,
        payment_status,
        days_outstanding
      FROM accounting.vw_outstanding_receivables
    `);

    // Calculate match scores for each outstanding item
    const matches = outstandingResult.rows.map((item: any) => {
      let score = 0;
      const factors: string[] = [];

      // 1. Exact Amount Match (40 points)
      const itemAmount = Math.abs(Number(item.outstanding_amount));
      if (Math.abs(amount - itemAmount) < 0.01) {
        score += 40;
        factors.push('exact_amount');
      } else if (Math.abs(amount - itemAmount) < itemAmount * 0.05) {
        // Within 5% tolerance
        score += 20;
        factors.push('close_amount');
      }

      // 2. Entity Name Similarity (30 points)
      if (entityName && item.entity_name) {
        const similarity = calculateStringSimilarity(entityName.toLowerCase(), item.entity_name.toLowerCase());
        const entityScore = Math.round((similarity / 100) * 30);
        score += entityScore;
        if (entityScore > 20) factors.push('entity_match');
      }

      // 3. Reference Number Match (20 points)
      if (reference && item.reference) {
        if (reference.includes(item.reference) || item.reference.includes(reference)) {
          score += 20;
          factors.push('reference_match');
        } else if (extractNumbers(reference) === extractNumbers(item.reference)) {
          score += 10;
          factors.push('reference_partial');
        }
      }

      // 4. Date Proximity (10 points) - ±7 days window
      const daysDiff = Math.abs((txDate.getTime() - new Date(item.journal_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        const dateScore = Math.round((1 - daysDiff / 7) * 10);
        score += dateScore;
        if (dateScore > 5) factors.push('date_proximity');
      }

      return {
        journal_id: item.journal_id,
        reference: item.reference,
        journal_date: item.journal_date,
        description: item.description,
        entity_name: item.entity_name,
        outstanding_amount: item.outstanding_amount,
        payment_status: item.payment_status,
        days_outstanding: item.days_outstanding,
        match_score: score,
        match_factors: factors,
        confidence: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'
      };
    });

        // Sort by score descending and return top 10
        const sortedMatches = matches
          .filter((m: any) => m.match_score > 0)
          .sort((a: any, b: any) => b.match_score - a.match_score)
          .slice(0, 10);

    res.json({ matches: sortedMatches });
  } catch (err) { next(err); }
});

// Apply match(es) - allocate payment to journal(s)
router.post('/reconciliation/apply-match', authorize(['admin','accountant']), async (req: any, res: any, next: any) => {
  try {
    const { bank_transaction_id, allocations } = req.body || {};

    if (!bank_transaction_id || !Array.isArray(allocations) || allocations.length === 0) {
      throw { status: 400, code: 'INVALID_BODY', message: 'bank_transaction_id and allocations array are required' };
    }

    const userId = (req as any).userId || null;
    const client = await req.pg.pool.connect();

    try {
      await client.query('BEGIN');

      // Get bank transaction
      const btResult = await client.query('SELECT * FROM accounting.bank_transactions WHERE id = $1', [bank_transaction_id]);
      if (btResult.rows.length === 0) {
        throw { status: 404, code: 'NOT_FOUND', message: 'Bank transaction not found' };
      }
      const bankTx = btResult.rows[0];

      // Validate total allocation equals bank transaction amount
      const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
      if (Math.abs(totalAllocated - Math.abs(Number(bankTx.amount))) > 0.01) {
        throw { status: 400, code: 'INVALID_ALLOCATION', message: 'Total allocated amount must equal bank transaction amount' };
      }

      // Process each allocation
      for (const alloc of allocations) {
        const { journal_id, amount, match_score, match_type } = alloc;

        // Insert payment allocation
        await client.query(`
          INSERT INTO accounting.payment_allocations
            (bank_transaction_id, journal_id, allocated_amount, match_score, match_type, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [bank_transaction_id, journal_id, amount, match_score || null, match_type || 'manual', userId]);

        // Get journal info
        const journalResult = await client.query(`
          SELECT reference, payment_status, paid_amount,
                 (SELECT COALESCE(SUM(debit), 0) FROM accounting.journal_lines WHERE journal_id = $1) as total_amount
          FROM accounting.journals WHERE id = $1
        `, [journal_id]);

        if (journalResult.rows.length === 0) continue;

        const journal = journalResult.rows[0];
        const newPaidAmount = Number(journal.paid_amount || 0) + Number(amount);
        const totalAmount = Number(journal.total_amount);
        const isFullyPaid = Math.abs(newPaidAmount - totalAmount) < 0.01;

        // Call appropriate payment function
        if (isFullyPaid) {
          await client.query(`
            SELECT accounting.fn_mark_note_paid($1, NULL, $2, $3)
          `, [journal_id, bankTx.transaction_date, userId]);
        } else {
          await client.query(`
            SELECT accounting.fn_record_partial_payment($1, $2, NULL, $3, $4)
          `, [journal_id, amount, bankTx.transaction_date, userId]);
        }

        // Update received_at timestamp
        await client.query(`
          UPDATE accounting.journals
          SET received_at = $2
          WHERE id = $1 AND received_at IS NULL
        `, [journal_id, bankTx.transaction_date]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Successfully allocated payment to ${allocations.length} journal(s)`
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

 // Helper function: Calculate string similarity (simple Levenshtein-based)
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  // Simple implementation - check for substring matches
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.includes(shorter)) return 80;

  // Check word overlap
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const maxWords = Math.max(words1.length, words2.length);

  return Math.round((commonWords / maxWords) * 100);
}

// Helper function: Extract numbers from string
function extractNumbers(str: string): string {
  return (str.match(/\d+/g) || []).join('');
}

// ============================================================================
// PERIOD-END AND YEAR-END CHECKLIST ENDPOINTS
// ============================================================================

// Get accounting periods (optionally filtered by year)
router.get(
  '/periods',
  authorize(['admin', 'accountant', 'editor', 'viewer']),
  requireSupabase,
  async (req: any, res: any, next: any) => {
    try {
      const { year } = req.query as any;
      let q = req.db.from('accounting_periods').select('*');

      if (year) {
        q = q
          .gte('period_start', `${year}-01-01`)
          .lte('period_start', `${year}-12-31`);
      }

      q = q.order('period_start', { ascending: true });
      const { data, error } = await q;

      if (error) {
        throw { status: 500, code: 'DB_ERROR', message: error.message };
      }

      res.json({ items: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// Update period status/checklist (soft close only)
router.patch(
  '/periods/:id',
  authorize(['admin', 'accountant']),
  requireSupabase,
  async (req: any, res: any, next: any) => {
    try {
      const { id } = req.params;
      const {
        status,
        reconciliations_done,
        journals_done,
        accounts_done,
        taxes_done,
        reports_done,
      } = req.body || {};

      if (
        status &&
        status !== 'Closed' &&
        status !== 'In Progress' &&
        status !== 'Future'
      ) {
        throw {
          status: 400,
          code: 'INVALID_STATUS',
          message: 'status must be one of Closed, In Progress, Future',
        };
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (status !== undefined) {
        updates.status = status;
        if (status === 'Closed') {
          updates.closed_date = new Date().toISOString();
          updates.closed_by = Number(req.headers['x-user-id']) || null;
        }
      }

      if (reconciliations_done !== undefined) {
        updates.reconciliations_done = !!reconciliations_done;
      }
      if (journals_done !== undefined) {
        updates.journals_done = !!journals_done;
      }
      if (accounts_done !== undefined) {
        updates.accounts_done = !!accounts_done;
      }
      if (taxes_done !== undefined) {
        updates.taxes_done = !!taxes_done;
      }
      if (reports_done !== undefined) {
        updates.reports_done = !!reports_done;
      }

      const { error: updateError } = await req.db
        .from('accounting_periods')
        .update(updates)
        .eq('id', Number(id));

      if (updateError) {
        throw { status: 500, code: 'DB_ERROR', message: updateError.message };
      }

      const { data, error: fetchError } = await req.db
        .from('accounting_periods')
        .select('*')
        .eq('id', Number(id))
        .limit(1)
        .single();

      if (fetchError || !data) {
        throw { status: 404, code: 'NOT_FOUND', message: 'period not found' };
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Get year-end checklist tasks for a fiscal year
router.get(
  '/year-end-checklist',
  authorize(['admin', 'accountant', 'editor', 'viewer']),
  requireSupabase,
  async (req: any, res: any, next: any) => {
    try {
      const { year } = req.query as any;
      const fiscalYear =
        year !== undefined ? Number(year) : new Date().getFullYear();

      const { data, error } = await req.db
        .from('accounting_year_end_tasks')
        .select('*')
        .eq('fiscal_year', fiscalYear)
        .order('order_index', { ascending: true });

      if (error) {
        throw { status: 500, code: 'DB_ERROR', message: error.message };
      }

      res.json({ items: data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// Update year-end checklist task completion
router.patch(
  '/year-end-checklist/:id',
  authorize(['admin', 'accountant']),
  requireSupabase,
  async (req: any, res: any, next: any) => {
    try {
      const { id } = req.params;
      const { completed } = req.body || {};

      if (typeof completed !== 'boolean') {
        throw {
          status: 400,
          code: 'INVALID_BODY',
          message: 'completed (boolean) is required',
        };
      }

      const updates: any = {
        completed,
        updated_at: new Date().toISOString(),
      };

      if (completed) {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = Number(req.headers['x-user-id']) || null;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }

      const { error: updateError } = await req.db
        .from('accounting_year_end_tasks')
        .update(updates)
        .eq('id', Number(id));

      if (updateError) {
        throw { status: 500, code: 'DB_ERROR', message: updateError.message };
      }

      const { data, error: fetchError } = await req.db
        .from('accounting_year_end_tasks')
        .select('*')
        .eq('id', Number(id))
        .limit(1)
        .single();

      if (fetchError || !data) {
        throw {
          status: 404,
          code: 'NOT_FOUND',
          message: 'year-end task not found',
        };
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

export default router;