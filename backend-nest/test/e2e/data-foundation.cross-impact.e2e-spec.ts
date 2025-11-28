import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Data Foundation Cross-Impact (e2e)', () => {
  let app: INestApplication;
  const TENANT_ID = '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v2/compliance/cross-impact', () => {
    it('should return 200 with matches for valid clause (ISO20000:8.4)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/compliance/cross-impact')
        .query({ clause: 'ISO20000:8.4', includeSynthetic: 'false' })
        .set('x-tenant-id', TENANT_ID)
        .expect(200);

      expect(response.body).toHaveProperty('clause');
      expect(response.body).toHaveProperty('matches');
      expect(Array.isArray(response.body.matches)).toBe(true);
      expect(response.body.matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 200 with empty matches for invalid format (foo)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/compliance/cross-impact')
        .query({ clause: 'foo' })
        .set('x-tenant-id', TENANT_ID)
        .expect(200);

      expect(response.body).toHaveProperty('clause', 'foo');
      expect(response.body).toHaveProperty('matches');
      expect(Array.isArray(response.body.matches)).toBe(true);
      expect(response.body.matches.length).toBe(0);
      expect(response.body).toHaveProperty('note', 'invalid_clause_format');
    });

    it('should return 200 with empty matches for non-existent clause (ISO20000:99.99)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/compliance/cross-impact')
        .query({ clause: 'ISO20000:99.99', includeSynthetic: 'false' })
        .set('x-tenant-id', TENANT_ID)
        .expect(200);

      expect(response.body).toHaveProperty('clause', 'ISO20000:99.99');
      expect(response.body).toHaveProperty('matches');
      expect(Array.isArray(response.body.matches)).toBe(true);
      expect(response.body.matches.length).toBe(0);
      expect(response.body).toHaveProperty('note', 'clause_not_found');
    });
  });
});
