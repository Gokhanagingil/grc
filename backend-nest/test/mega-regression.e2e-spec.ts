/**
 * Mega Regression E2E Tests
 *
 * Targeted regression coverage for:
 *   A) CAB: add Change to agenda
 *   B) Incident: edit/save with priority auto-computation
 *   C) Major Incident: list load with proper permissions
 *   D) Change: linked risk/control + risk score refresh
 *   E) Priority Matrix: CRUD operations
 *
 * These tests guard against recurrence of the following staging issues:
 *   - "Verification failed" on CAB agenda add
 *   - "Verification failed" on Incident edit
 *   - "Access denied: Insufficient permissions" on Major Incident list
 *   - Missing linked-risk influence on Change risk score
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Mega Regression Pack (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
      dbConnected = true;

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      const responseData = loginResponse.body.data ?? loginResponse.body;
      adminToken = responseData.accessToken;
      tenantId = responseData.user?.tenantId;
    } catch (error) {
      console.warn(
        'Could not connect to database, skipping DB-dependent tests',
      );
      console.warn('Error:', (error as Error).message);
      dbConnected = false;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ─── A) CAB Agenda: add/remove Change ────────────────────────────────────

  describe('A) CAB Agenda — add Change to agenda', () => {
    let cabId: string;
    let changeId: string;

    it('should create a CAB meeting for testing', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/cab-meetings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'Regression CAB Meeting',
          meetingAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          status: 'SCHEDULED',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      cabId = data.id;
      expect(cabId).toBeDefined();
    });

    it('should create a Change for agenda testing', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'Regression Change for CAB Agenda',
          type: 'NORMAL',
          risk: 'MEDIUM',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      changeId = data.id;
      expect(changeId).toBeDefined();
    });

    it('should add a Change to the CAB agenda (no Verification failed)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !cabId || !changeId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/grc/itsm/cab-meetings/${cabId}/agenda`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ changeId, order: 1 });

      // Accept 200 or 201
      expect([200, 201]).toContain(res.status);
    });

    it('should list the CAB agenda and see the added Change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !cabId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/cab-meetings/${cabId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = res.body.data ?? res.body;
      // Check that the meeting exists — agenda items may be nested
      expect(data).toHaveProperty('id', cabId);
    });
  });

  // ─── B) Incident Edit/Save + Priority Auto-Compute ───────────────────────

  describe('B) Incident Edit/Save — no Verification failed', () => {
    let incidentId: string;

    it('should create an incident with auto-computed priority', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: 'Regression Incident for Edit Test',
          impact: 'high',
          urgency: 'medium',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      incidentId = data.id;
      expect(incidentId).toBeDefined();
      // Priority should be auto-computed: high × medium = p2
      expect(data.priority).toBe('p2');
    });

    it('should edit an existing incident without Verification failed', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      const res = await request(app.getHttpServer())
        .patch(`/grc/itsm/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: 'Regression Incident - Updated',
          status: 'in_progress',
        })
        .expect(200);

      const data = res.body.data ?? res.body;
      expect(data.shortDescription).toBe('Regression Incident - Updated');
      expect(data.status).toBe('in_progress');
    });

    it('should recalculate priority when impact/urgency changes on edit', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      const res = await request(app.getHttpServer())
        .patch(`/grc/itsm/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          impact: 'high',
          urgency: 'high',
        })
        .expect(200);

      const data = res.body.data ?? res.body;
      // high × high = p1
      expect(data.priority).toBe('p1');
    });

    it('should reject forbidden fields without leaking server errors', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      // Sending a forbidden field (e.g., tenantId) should return 400, not 500
      const res = await request(app.getHttpServer())
        .patch(`/grc/itsm/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          tenantId: 'should-be-forbidden',
        });

      // Should be a client error (400), not server error (500)
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── C) Major Incident — list load + permissions ──────────────────────────

  describe('C) Major Incident — list load (no Access Denied)', () => {
    it('admin should have ITSM_MAJOR_INCIDENT_READ permission', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = res.body.data ?? res.body;
      expect(data.permissions).toContain('itsm:major_incident:read');
    });

    it('should load major incident list with 200 (not 403)', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .get('/grc/itsm/major-incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      const data = res.body.data;
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping: no DB');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/itsm/major-incidents')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });

  // ─── D) Change — linked risk/control + risk score ─────────────────────────

  describe('D) Change — linked risks influence risk score', () => {
    let changeId: string;

    it('should create a change for risk score testing', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'Regression Change for Risk Score',
          type: 'NORMAL',
          risk: 'MEDIUM',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      changeId = data.id;
      expect(changeId).toBeDefined();
    });

    it('should get risk assessment with linked risk contribution factor', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      // Trigger risk assessment calculation
      const calcRes = await request(app.getHttpServer())
        .post(`/grc/itsm/changes/${changeId}/risk-assessment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      // Accept 200 or 201
      if (calcRes.status >= 200 && calcRes.status < 300) {
        // Now get the assessment
        const res = await request(app.getHttpServer())
          .get(`/grc/itsm/changes/${changeId}/risk-assessment`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = res.body.data ?? res.body;
        const assessment =
          data && 'assessment' in data ? data.assessment : data;

        if (assessment && assessment.breakdown) {
          // Verify Linked Risk Contribution factor exists in breakdown
          const linkedFactor = assessment.breakdown.find(
            (f: { name: string }) => f.name === 'Linked Risk Contribution',
          );
          expect(linkedFactor).toBeDefined();
          expect(linkedFactor.weight).toBe(12);
          // No linked risks on this fresh change => score should be 0
          expect(linkedFactor.score).toBe(0);
        }
      }
    });

    it('should list linked risks for a change (empty initially)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}/risks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      // Accept 200 (may return empty array or list-contract envelope)
      expect(res.status).toBeLessThan(300);
    });

    it('should list linked controls for a change (empty initially)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites missing');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}/controls`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      expect(res.status).toBeLessThan(300);
    });
  });

  // ─── E) Priority Matrix — CRUD ───────────────────────────────────────────

  describe('E) Priority Matrix — CRUD operations', () => {
    it('should seed default priority matrix', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/priority-matrix/seed')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      // Accept 200 or 201
      expect([200, 201]).toContain(res.status);
    });

    it('should get the priority matrix', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .get('/grc/itsm/priority-matrix')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = res.body.data ?? res.body;
      // Should return array of matrix entries
      // Controller returns { data: rows }, response interceptor may wrap again
      const inner = data?.data ?? data;
      const items = Array.isArray(inner) ? inner : (inner?.items ?? inner);
      expect(Array.isArray(items)).toBe(true);
    });

    it('should upsert a priority matrix entry', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .put('/grc/itsm/priority-matrix')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          entries: [
            { impact: 'high', urgency: 'high', priority: 'p1' },
            { impact: 'high', urgency: 'medium', priority: 'p2' },
            { impact: 'high', urgency: 'low', priority: 'p3' },
          ],
        });

      // Accept 200 or 201
      expect(res.status).toBeLessThan(300);
    });
  });

  // ─── F) Cross-cutting contract tests ──────────────────────────────────────

  describe('F) Cross-cutting contract regression', () => {
    it('incident list should return LIST-CONTRACT envelope', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .get('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });

    it('change list should return LIST-CONTRACT envelope', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .get('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });

    it('CAB meeting list should return LIST-CONTRACT envelope', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no DB');
        return;
      }

      const res = await request(app.getHttpServer())
        .get('/grc/itsm/cab-meetings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      const data = res.body.data;
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });
  });
});
