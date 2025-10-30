# Banking Module – Import ERD

This ERD captures import-related entities to support CSV ingestion, mapping, staging, validation, duplicate detection, commit, and audit.

## Tables

- import_sessions (`id`, `user_id`, `created_at`, `file_name`, `file_hash`, `status`, `totals_json`, `mapping_template_id`)
- import_mapping_templates (`id`, `name`, `bank`, `header_map_json`, `transforms_json`, `created_by`, `created_at`)
- import_transactions (
  `id`, `session_id`, `row_index`, `date`, `description`, `amount`, `debit`, `credit`, `account_code`, `reference`, `currency`,
  `validation_status`, `duplicate_flag`, `excluded`, `edit_history_json`, `row_hash`
)
- import_errors (`id`, `session_id`, `row_index`, `field`, `code`, `message`)
- import_audit_events (`id`, `session_id`, `actor_id`, `timestamp`, `action`, `details_json`)

## Relationships

- `import_sessions` 1—N `import_transactions`
- `import_sessions` 1—N `import_errors`
- `import_sessions` 1—N `import_audit_events`
- `import_sessions.mapping_template_id` → `import_mapping_templates.id`

## Indexes & Constraints

- Unique: (`session_id`, `row_hash`) on `import_transactions` for idempotency and dedup.
- Foreign keys: `session_id` references `import_sessions.id` with cascade on delete (staged rows/errors removed when session cleared).
- Filtered indexes for fast queries: `validation_status`, `duplicate_flag`, `excluded`.

## Status Enum

- `import_sessions.status`: `new` | `mapped` | `staged` | `committed` | `cancelled`.
- `import_transactions.validation_status`: `valid` | `invalid` | `duplicate` | `unmapped`.

## Destination Commit

- Commit uses `row_hash` as an idempotency key per destination (e.g., Journal Entries).
- Store commit metadata in `import_audit_events.details_json` including destination names and counts.

## Notes

- `*_json` fields store structured data as JSON for flexibility (totals, header maps, transforms, edit history).
- For large imports, consider sharding `import_transactions` by `session_id` or batching commits.