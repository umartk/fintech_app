import request from 'supertest';
import app from '../app';

describe('App', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Unknown routes', () => {
    it('should handle unknown routes gracefully', async () => {
      const response = await request(app).get('/unknown-route');
      
      expect(response.status).toBe(404);
    });
  });
});
