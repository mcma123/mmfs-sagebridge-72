# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MMFS Brokerage South Africa - A document management system (DMS) and accounting platform for a reinsurance brokerage. The application is a full-stack TypeScript monorepo with React frontend (Vite + React Router) and Node.js/Express backend with PostgreSQL (Supabase).

## Development Commands

### Running the Application
```bash
# Run frontend and backend concurrently (recommended for development)
npm run dev

# Run backend only
npm run dev:backend
# or
npm run backend:dev

# Run frontend only
npm run dev:frontend

# Start production server (backend serves static frontend)
npm start
```

### Building
```bash
# Build for production
npm run build

# Build in development mode (enables component tagger)
npm run build:dev

# Preview production build
npm preview
```

### Testing & Quality
```bash
# Run all tests with Vitest
npm test

# Lint the codebase
npm run lint
```

### Database Management
```bash
# Run application database migrations
npm run db:migrate:app

# Create Supabase admin user
npm run admin:create:supabase
```

## Architecture & Structure

### Frontend-Backend Communication

The app uses a hybrid data architecture:
- **HTTP REST API**: Traditional request-response for CRUD operations (`/api/v1/*`)
- **WebSocket (Socket.IO)**: Real-time updates for accounting data (`/api/socket.io`)
- **LocalStorage**: Client-side persistence for DMS documents and settings

### Dual Data Sources

**Documents Module**: Operates in two modes via `src/lib/store/documents.ts`:
- **localStorage mode** (`'local'`): Default, persists to browser storage under namespace `dms-documents-store`
- **API mode** (`'api'`): Future state, will sync with backend endpoints
- Both DMS and Accounting modules share the same document store by setting namespace to `'dms-documents-store'`

**Accounting Module**: Hybrid approach:
- Uses Supabase tables (`accounting_entities`, `accounting_accounts`, etc.) for core data
- Real-time updates via Socket.IO (`backend/src/realtime/accounting.ts`)
- HTTP fallback if WebSocket fails (`src/lib/realtime/accounting.ts` → `fetchRefsRealtimeWithFallback`)

### Database Access Patterns

**Backend Middleware Stack** (`backend/src/server.ts`):
1. `pgMiddleware`: Attaches `req.pg` (PostgreSQL Pool) to every request
2. `supabaseMiddleware`: Attaches `req.supabase` (Supabase client) to every request

**Two Database Access Methods**:
- **Direct PostgreSQL**: Use `req.pg.query()` for complex queries, transactions
- **Supabase Client**: Use `req.supabase.from('table')` for ORM-like operations

**Migration System**: SQL files in `backend/migrations/sql/` run sequentially by `migrate_app.ts`:
- `005_app_init.sql`: Core app tables (users, roles)
- `006_app_seed_admin.sql`: Default admin user
- `007_accounting_init.sql`: Accounting schema
- `008_accounting_seed.sql`: Chart of accounts seed data
- `009_accounting_api_views.sql`: Database views for API
- `010_accounting_actions.sql`: Stored procedures/functions

### Authentication & Authorization

**JWT-based Auth**:
- Login: `POST /api/v1/auth/login` returns JWT token
- Token stored in localStorage (`access_token`)
- Client includes in `Authorization: Bearer <token>` headers
- Backend validates via `jsonwebtoken` (secret from `JWT_SECRET` env var)

**Role-Based Access Control (RBAC)**:
- Roles: `admin`, `accountant`, `editor`, `viewer`
- Frontend: `RoleGuard` component wraps protected routes
- Backend: `rbac.ts` middleware with role hierarchy (admin > accountant/editor > viewer)
- WebSocket: Role extracted from JWT or `X-Role` header fallback

### Frontend State Management

**Global State**:
- `@tanstack/react-query`: Server state management and caching
- `ThemeProvider`: Dark/light mode via `next-themes`
- `ProjectsProvider`: DMS project context (`src/lib/store/projects.tsx`)

**LocalStorage Keys**:
- `dms-documents-store`: Shared document tree (folders, files, audit logs)
- `user-role`: Selected RBAC role (Admin/Editor/Viewer)
- `telemetry_events`: Client-side analytics events
- `accounting-settings`: Accounting module preferences

### Routing Structure

**Main Modules**:
- `/dashboard`: Main dashboard with financial overview
- `/dms/*`: Document Management System (projects, tasks, documents, progress tracking)
- `/accounting/*`: Full accounting suite (chart of accounts, journals, general ledger, trial balance, reconciliation)
- `/banking`: Bank import and reconciliation
- `/entities`: Entity management (cedants, brokers)
- `/administration/*`: User management (admin only)
- `/settings`: User preferences

**API Routes** (`backend/src/server.ts`):
- `/api/v1/auth`: Authentication endpoints
- `/api/v1/documents`: DMS folder/document operations (mirrored at `/api/v1/accounting/documents`)
- `/api/v1/accounting`: Accounting operations (entities, accounts, journals, GL)
- `/api/v1/banking/import`: Bank statement CSV import
- `/api/v1/administration/users`: User CRUD (admin only)

### Component Architecture

**UI Framework**:
- Radix UI primitives + Tailwind CSS
- shadcn/ui component system in `src/components/ui/`
- Path alias: `@/*` maps to `src/*`

**Form Handling**:
- `react-hook-form` + `zod` validation
- Standard pattern: `useForm({ resolver: zodResolver(schema) })`

**Charts & Visualization**:
- `recharts` for financial charts and dashboards

### Socket.IO Real-time Architecture

**Connection Setup**:
- Client: `src/lib/realtime/accounting.ts` connects via `/api/socket.io` path
- Server: `backend/src/index.ts` creates HTTP server, attaches Socket.IO
- Auth: JWT token passed via `auth.token` in handshake

**Event Pattern**:
- Client emits: `accounting:fetchRefs`
- Server responds: callback acknowledgment or `accounting:refs`/`accounting:error` events
- Graceful fallback to HTTP if WebSocket fails

### Environment Variables

**Required for Development** (`.env`):
- `SUPABASE_URL` / `VITE_SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`: Public anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Backend admin operations
- `DATABASE_URL` or discrete `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`: PostgreSQL connection
- `JWT_SECRET`: Token signing secret (defaults to `'dev-secret-change-me'`)

**Note**: Password must be URL-encoded in connection strings (`@` → `%40`)

## Key Implementation Patterns

### Adding a New Accounting Feature
1. Add SQL migration in `backend/migrations/sql/` (increment number)
2. Update `backend/scripts/migrate_app.ts` to include new file
3. Create/update route in `backend/src/routes/accounting.ts`
4. Add Socket.IO event handler in `backend/src/realtime/accounting.ts` if real-time needed
5. Create frontend page in `src/pages/accounting/`
6. Add route in `src/App.tsx`
7. Update sidebar navigation in `src/components/layout/Sidebar.tsx`

### Testing Pattern
- Unit tests: `*.test.ts` files colocated with implementation
- Test setup: `src/test/setup.ts` configures jsdom environment
- Run specific test: `npm test -- <filename>`
- Banking validators have test coverage: `src/lib/banking/__tests__/validators.test.ts`

### Database Query Pattern
```typescript
// PostgreSQL direct
const result = await req.pg.query('SELECT * FROM table WHERE id = $1', [id]);

// Supabase ORM
const { data, error } = await req.supabase
  .from('table')
  .select('*')
  .eq('id', id);
```

### Document Store Usage
```typescript
import { setDocumentsNamespace, createFolder, listChildren } from '@/lib/store/documents';

// Set namespace to share between modules
setDocumentsNamespace('dms-documents-store');

// CRUD operations
const folder = createFolder(parentId, 'New Folder', 'generic');
const { folders, documents } = listChildren(folderId);
```

## Important Notes

- **TLS Verification Disabled**: `NODE_TLS_REJECT_UNAUTHORIZED='0'` for Supabase SSL (dev only)
- **Vite Proxy**: Frontend dev server proxies `/api` to `http://localhost:3000`
- **Production**: Backend serves static frontend from `dist/` directory
- **Strict Typing Disabled**: `noImplicitAny: false` in tsconfig - gradually migrate to strict mode
- **CORS**: Wide-open for development (`origin: '*'`), tighten for production
- **Catch-all Route**: Must be last in routing - all custom routes added above `path="*"`
