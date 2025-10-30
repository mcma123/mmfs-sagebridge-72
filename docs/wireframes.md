# Phase 1 – Wireframes (ASCII)

## Explorer Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Company > Countries > Zimbabwe > Cedants > ABC Insurance │
├───────────────┬─────────────────────────────────────────────────────┤
│ Tree          │ Toolbar: [New Folder] [Upload] [Rename] [Move] [Del]│
│               ├─────────────────────────────────────────────────────┤
│ Company       │ List/Grid                                           │
│ ├─ Countries  │ ┌─────────────────────────────────────────────────┐ │
│ │  ├─ Zimbabwe│ │ Name          Type       Size      Updated     │ │
│ │  │  └─ Ced…│ │ Facultative   folder     —         2 days ago  │ │
│ │  ├─ Botswana│ │ Treaty        folder     —         2 days ago  │ │
│ │  └─ Mozam…  │ │ Placements    folder     —         1 day ago   │ │
│               │ │ Masters       folder     —         1 day ago   │ │
│               │ │ Proposal.pdf  document   2.4MB     3 hours ago │ │
│               │ └─────────────────────────────────────────────────┘ │
│               │ Pagination / Virtualization controls                │
├───────────────┴─────────────────────────────────────────────────────┤
│ Details Panel: Metadata | Tags | Versions | Activity Feed           │
└──────────────────────────────────────────────────────────────────────┘
```

## Context Menu (Node)

```
Right-click node →
  - New Folder
  - Upload
  - Rename
  - Move
  - Delete
  - Share (link with expiry)
  - Apply Template (where applicable)
```

## Upload Dialog

```
┌──────────────────────────────────────────┐
│ Upload to: /Acme Re/Zimbabwe/ABC Ins/... │
├──────────────────────────────────────────┤
│ [Drop files here] or [Choose files]      │
│ Chunked + checksum verification          │
│ Progress: [■■■■□□□□] 45%                 │
│ [Cancel] [Pause]                         │
└──────────────────────────────────────────┘
```