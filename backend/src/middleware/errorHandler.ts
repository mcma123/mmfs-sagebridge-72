import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Unexpected error';
  
  // Log error details for debugging
  console.error(`[${new Date().toISOString()}] Error ${status} on ${req.method} ${req.path}:`);
  console.error('Code:', code);
  console.error('Message:', message);
  if (status === 500) {
    console.error('Stack:', err.stack);
    console.error('Full error:', err);
  }
  
  res.status(status).json({ error: { code, message } });
}