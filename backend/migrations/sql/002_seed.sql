-- Phase 2 – Seed data (PostgreSQL dialect)

-- Create company root
INSERT INTO companies(name, slug) VALUES ('Acme Re', 'acme-re') ON CONFLICT DO NOTHING;

-- Create root folder for company
WITH c AS (
  SELECT id FROM companies WHERE slug = 'acme-re'
), f AS (
  INSERT INTO folders(company_id, parent_id, name, slug, type, path, depth, order_index)
  SELECT c.id, NULL, 'Acme Re', 'acme-re', 'company', '', 0, 0 FROM c
  RETURNING id, company_id
)
UPDATE folders SET path = CONCAT('/', id), depth = 0 WHERE id IN (SELECT id FROM f);

-- Create Countries folder under company root
WITH root AS (
  SELECT id, company_id FROM folders WHERE type = 'company' AND slug = 'acme-re'
), ins AS (
  INSERT INTO folders(company_id, parent_id, name, slug, type, path, depth, order_index)
  SELECT root.company_id, root.id, 'Countries', 'countries', 'generic', CONCAT(root.path, '/', 0), 1, 0 FROM root
  RETURNING id, company_id, parent_id
)
UPDATE folders SET path = CONCAT((SELECT path FROM folders WHERE id = parent_id), '/', id), depth = 1 WHERE id IN (SELECT id FROM ins);

-- Default countries
WITH countries_parent AS (
  SELECT id, company_id, path FROM folders WHERE slug = 'countries' AND type = 'generic'
), added AS (
  INSERT INTO folders(company_id, parent_id, name, slug, type, path, depth, order_index)
  SELECT cp.company_id, cp.id, v.name, v.slug, 'country', CONCAT(cp.path, '/', 0), 2, ROW_NUMBER() OVER ()
  FROM countries_parent cp,
  (VALUES 
    ('Zimbabwe','zimbabwe'),('Botswana','botswana'),('Mozambique','mozambique'),
    ('Malawi','malawi'),('Angola','angola'),('Zambia','zambia'),('South Africa','south-africa')
  ) AS v(name, slug)
  RETURNING id, company_id, parent_id
)
UPDATE folders SET path = CONCAT((SELECT path FROM folders WHERE id = parent_id), '/', id), depth = 2 WHERE id IN (SELECT id FROM added);

-- Optional cedants container per country (can be added via templates later)