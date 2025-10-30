import express from 'express';
import cors from 'cors';
import { foldersRouter } from './routes/folders';
import { documentsRouter } from './routes/documents';
import { errorHandler } from './middleware/errorHandler';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/v1/documents', foldersRouter);
app.use('/api/v1/documents', documentsRouter);
// Mirror routes for Accounting module under a separate base path
app.use('/api/v1/accounting/documents', foldersRouter);
app.use('/api/v1/accounting/documents', documentsRouter);

app.use(errorHandler);

// Only start if run directly (placeholder)
if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  app.listen(port, () => console.log(`Documents API listening on http://localhost:${port}`));
}

export default app;