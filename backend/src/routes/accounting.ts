import express from 'express';
import { authorize } from '../middleware/rbac';

const router = express.Router();

// Entities CRUD
router.get('/entities', authorize(['admin','accountant','editor','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { data, error } = await req.db.from('accounting_entities').select('*').order('name', { ascending: true });
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
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

router.get('/journals', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { start, end } = req.query as any;
    let q = req.db.from('accounting_journals').select('*');
    if (start) q = q.gte('date', start);
    if (end) q = q.lte('date', end);
    q = q.order('date', { ascending: true }).order('id', { ascending: true });
    const { data, error } = await q;
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
  } catch (err) { next(err); }
});

// Ledger query
router.get('/ledger', authorize(['admin','accountant','viewer']), async (req: any, res: any, next: any) => {
  try {
    const { account_id, start, end } = req.query as any;
    if (!account_id) throw { status: 400, code: 'INVALID_QUERY', message: 'account_id required' };
    let q = req.db.from('accounting_ledger_entries').select('*').eq('account_id', account_id);
    if (start) q = q.gte('date', start);
    if (end) q = q.lte('date', end);
    q = q.order('date', { ascending: true }).order('id', { ascending: true });
    const { data, error } = await q;
    if (error) throw { status: 500, code: 'DB_ERROR', message: error.message };
    res.json({ items: data || [] });
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