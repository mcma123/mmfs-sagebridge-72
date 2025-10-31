-- Seed minimal accounting data

-- Basic entities
INSERT INTO accounting.entities(type, name, country, status)
VALUES
  ('Client', 'Default Client', 'ZM', 'Active')
ON CONFLICT DO NOTHING;

-- Basic chart of accounts
INSERT INTO accounting.accounts(code, name, type)
VALUES
  ('1000', 'Accounts Receivable', 'Asset'),
  ('2000', 'Accounts Payable', 'Liability'),
  ('4000', 'Premium Income', 'Revenue'),
  ('5001', 'Commission Expense', 'Expense')
ON CONFLICT (code) DO NOTHING;