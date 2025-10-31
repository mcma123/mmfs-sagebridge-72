import express from 'express';
import cors from 'cors';
import { foldersRouter } from './routes/folders';
import { documentsRouter } from './routes/documents';
import { errorHandler } from './middleware/errorHandler';
import { supabaseMiddleware } from './middleware/supabase';
import { pgMiddleware } from './middleware/pg.ts';
import accountingRouter from './routes/accounting';
import bankingImportRouter from './routes/banking_import';
import authRouter from './routes/auth';
import adminUsersRouter from './routes/admin_users';

const app = express();
app.use(cors());
app.use(express.json());
app.use(pgMiddleware);
app.use(supabaseMiddleware);

// Auth endpoints
app.use('/api/v1/auth', authRouter);

// Administration: Users management
app.use('/api/v1/administration/users', adminUsersRouter);

app.use('/api/v1/documents', foldersRouter);
app.use('/api/v1/documents', documentsRouter);
// Mirror routes for Accounting module under a separate base path
app.use('/api/v1/accounting/documents', foldersRouter);
app.use('/api/v1/accounting/documents', documentsRouter);

// Accounting core endpoints
app.use('/api/v1/accounting', accountingRouter);

// Banking Import endpoints
app.use('/api/v1/banking/import', bankingImportRouter);

app.use(errorHandler);

export default app;