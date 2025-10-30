# Phase 2 – Data Model & ERD

Approach: single `folders` table using an adjacency list with a materialized path (`/id1/id2/id3`) and depth. Documents reference folders, and permissions reference subjects and folders.

## Tables

- companies (`id`, `name`, `slug`, `created_at`)
- folders (`id`, `company_id`, `parent_id`, `name`, `slug`, `type`, `path`, `depth`, `order_index`, `metadata_json`, `created_by`, `created_at`, `updated_at`, `deleted_at`)
- documents (`id`, `folder_id`, `name`, `ext`, `mime_type`, `size_bytes`, `storage_key`, `checksum_sha256`, `version`, `uploaded_by`, `created_at`, `updated_at`, `deleted_at`)
- permissions (`id`, `subject_type`, `subject_id`, `folder_id`, `role`)
- tags (`id`, `name`, `company_id`)
- document_tags (`document_id`, `tag_id`)
- audit_logs (`company_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata_json`, `at`)

## Folder Types

Enum `folder_type`: `company`, `country`, `cedant`, `category`, `treaty_section`, `generic`.

## Indexes & Constraints

- Unique: `(company_id, parent_id, name)`
- Path index: `path`
- Foreign keys: `folder_id`, `company_id`, and cascades on delete (soft-delete via `deleted_at`).

## Materialized Path

- Example: `/1/34/78` where `1` is company root folder, `34` country, `78` cedant.
- On move: update node path and descendants via string replacement.

## Seed

- Create Company roots; add default Countries.
- Optional Cedants under Countries; Category and Treaty Section templates applied later.

See migrations under `backend/migrations/sql`.