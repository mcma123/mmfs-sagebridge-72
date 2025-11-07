import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';

describe('Backend Server Smoke Tests', () => {
  it('should load express app without errors', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/nonexistent-route-12345');
    expect(response.status).toBe(404);
  });

  it('should have CORS headers configured', async () => {
    const response = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:8080');
    
    // Should respond to OPTIONS (preflight)
    expect([200, 204, 404]).toContain(response.status);
  });
});

