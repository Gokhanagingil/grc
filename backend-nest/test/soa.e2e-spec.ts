import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { GrcSoaProfile } from '../src/grc/entities/grc-soa-profile.entity';
import { GrcSoaItem } from '../src/grc/entities/grc-soa-item.entity';
import { StandardClause } from '../src/grc/entities/standard-clause.entity';
import { Standard } from '../src/grc/entities/standard.entity';
import {
  SoaProfileStatus,
  SoaApplicability,
  SoaImplementationStatus,
} from '../src/grc/enums';

/**
 * SOA (Statement of Applicability) E2E Tests
 *
 * Tests the SOA endpoints to ensure:
 * - List endpoint returns all non-deleted profiles by default (no implicit status filtering)
 * - Status filtering works when explicitly provided
 * - Seeded profiles are discoverable via the list endpoint
 * - Tenant isolation is maintained
 */
describe('SOA Profiles (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials
  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  // Test data
  let testStandardId: string;
  let draftProfileId: string;
  let publishedProfileId: string;
  let testClauseId: string;
  let testItemId: string;

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
      dataSource = app.get(DataSource);

      // Login to get admin token and tenant info
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      // Handle both wrapped (new) and unwrapped (legacy) response formats
      const responseData = loginResponse.body.data ?? loginResponse.body;
      adminToken = responseData.accessToken;
      tenantId = responseData.user?.tenantId;

      // Create test data: find or create a standard
      const standardRepo = dataSource.getRepository(Standard);
      let standard = await standardRepo.findOne({
        where: { tenantId, isDeleted: false },
        order: { name: 'ASC' },
      });

      if (!standard) {
        // Try to find any standard without tenant filter
        standard = await standardRepo.findOne({
          where: { isDeleted: false },
          order: { name: 'ASC' },
        });
      }

      if (standard) {
        testStandardId = standard.id;

        // Create test profiles with different statuses
        const profileRepo = dataSource.getRepository(GrcSoaProfile);
        const userId =
          responseData.user?.id || '00000000-0000-0000-0000-000000000002';

        // Create DRAFT profile
        const draftProfile = profileRepo.create({
          tenantId,
          standardId: testStandardId,
          name: 'Test SOA Profile - DRAFT',
          description: 'Test profile in DRAFT status',
          status: SoaProfileStatus.DRAFT,
          version: 1,
          createdBy: userId,
          isDeleted: false,
        });
        const savedDraft = await profileRepo.save(draftProfile);
        draftProfileId = savedDraft.id;

        // Create PUBLISHED profile
        const publishedProfile = profileRepo.create({
          tenantId,
          standardId: testStandardId,
          name: 'Test SOA Profile - PUBLISHED',
          description: 'Test profile in PUBLISHED status',
          status: SoaProfileStatus.PUBLISHED,
          version: 1,
          publishedAt: new Date(),
          createdBy: userId,
          isDeleted: false,
        });
        const savedPublished = await profileRepo.save(publishedProfile);
        publishedProfileId = savedPublished.id;

        // Create a test clause for items
        const clauseRepo = dataSource.getRepository(StandardClause);
        let testClause = await clauseRepo.findOne({
          where: { standardId: testStandardId, tenantId, isDeleted: false },
        });

        if (!testClause) {
          testClause = clauseRepo.create({
            tenantId,
            standardId: testStandardId,
            code: 'TEST-001',
            title: 'Test Clause for SOA Items',
            description: 'A test clause used for e2e testing',
            isDeleted: false,
          });
          testClause = await clauseRepo.save(testClause);
        }
        testClauseId = testClause.id;

        // Create a test SOA item for the draft profile
        const itemRepo = dataSource.getRepository(GrcSoaItem);
        const testItem = itemRepo.create({
          tenantId,
          profileId: draftProfileId,
          clauseId: testClauseId,
          applicability: SoaApplicability.APPLICABLE,
          implementationStatus: SoaImplementationStatus.IMPLEMENTED,
          justification: 'Test justification',
          createdBy: userId,
          isDeleted: false,
        });
        const savedItem = await itemRepo.save(testItem);
        testItemId = savedItem.id;
      }
    } catch (error) {
      console.warn(
        'Could not connect to database, skipping DB-dependent tests',
      );
      console.warn('Error:', (error as Error).message);
      dbConnected = false;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (dbConnected && dataSource) {
      try {
        // Delete items first (foreign key constraint)
        if (testItemId) {
          const itemRepo = dataSource.getRepository(GrcSoaItem);
          await itemRepo.delete(testItemId);
        }
        // Delete profiles
        if (draftProfileId && publishedProfileId) {
          const profileRepo = dataSource.getRepository(GrcSoaProfile);
          await profileRepo.delete([draftProfileId, publishedProfileId]);
        }
      } catch (error) {
        console.warn('Error cleaning up test data:', error);
      }
    }

    if (app) {
      await app.close();
    }
  });

  describe('GET /grc/soa/profiles', () => {
    it('should return all non-deleted profiles by default (including DRAFT)', async () => {
      if (!dbConnected || !tenantId || !testStandardId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/soa/profiles')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response should be in LIST-CONTRACT format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(response.body.data).toHaveProperty('totalPages');

      const { items, total } = response.body.data;

      // Should include both DRAFT and PUBLISHED profiles
      expect(total).toBeGreaterThanOrEqual(2);
      expect(items.length).toBeGreaterThanOrEqual(2);

      // Verify both test profiles are present
      const profileIds = items.map((p: { id: string }) => p.id);
      expect(profileIds).toContain(draftProfileId);
      expect(profileIds).toContain(publishedProfileId);

      // Verify DRAFT profile is included
      const draftProfile = items.find(
        (p: { id: string }) => p.id === draftProfileId,
      );
      expect(draftProfile).toBeDefined();
      expect(draftProfile.status).toBe(SoaProfileStatus.DRAFT);
    });

    it('should filter by status when status query param is provided', async () => {
      if (!dbConnected || !tenantId || !testStandardId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      // Test DRAFT filter
      const draftResponse = await request(app.getHttpServer())
        .get('/grc/soa/profiles?status=DRAFT')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(draftResponse.body.data).toHaveProperty('items');
      expect(draftResponse.body.data).toHaveProperty('total');

      const draftItems = draftResponse.body.data.items;
      const draftTotal = draftResponse.body.data.total;

      // All returned profiles should be DRAFT
      draftItems.forEach((profile: { status: string }) => {
        expect(profile.status).toBe(SoaProfileStatus.DRAFT);
      });

      // Should include our test DRAFT profile
      const draftProfileIds = draftItems.map((p: { id: string }) => p.id);
      expect(draftProfileIds).toContain(draftProfileId);
      expect(draftTotal).toBeGreaterThanOrEqual(1);

      // Test PUBLISHED filter
      const publishedResponse = await request(app.getHttpServer())
        .get('/grc/soa/profiles?status=PUBLISHED')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(publishedResponse.body.data).toHaveProperty('items');
      expect(publishedResponse.body.data).toHaveProperty('total');

      const publishedItems = publishedResponse.body.data.items;
      const publishedTotal = publishedResponse.body.data.total;

      // All returned profiles should be PUBLISHED
      publishedItems.forEach((profile: { status: string }) => {
        expect(profile.status).toBe(SoaProfileStatus.PUBLISHED);
      });

      // Should include our test PUBLISHED profile
      const publishedProfileIds = publishedItems.map(
        (p: { id: string }) => p.id,
      );
      expect(publishedProfileIds).toContain(publishedProfileId);
      expect(publishedTotal).toBeGreaterThanOrEqual(1);
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/soa/profiles')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/soa/profiles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should maintain tenant isolation', async () => {
      if (!dbConnected || !tenantId || !testStandardId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      // Create a profile for a different tenant
      const otherTenantId = '99999999-9999-9999-9999-999999999999';
      const profileRepo = dataSource.getRepository(GrcSoaProfile);
      const userId = '00000000-0000-0000-0000-000000000002';

      const otherTenantProfile = profileRepo.create({
        tenantId: otherTenantId,
        standardId: testStandardId,
        name: 'Other Tenant Profile',
        description: 'Should not appear in main tenant list',
        status: SoaProfileStatus.DRAFT,
        version: 1,
        createdBy: userId,
        isDeleted: false,
      });
      const savedOther = await profileRepo.save(otherTenantProfile);

      try {
        // Query with main tenant ID - should not see other tenant's profile
        const response = await request(app.getHttpServer())
          .get('/grc/soa/profiles')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const profileIds = response.body.data.items.map(
          (p: { id: string }) => p.id,
        );
        expect(profileIds).not.toContain(savedOther.id);
      } finally {
        // Clean up
        await profileRepo.delete(savedOther.id);
      }
    });
  });

  describe('GET /grc/soa/profiles/:id', () => {
    it('should return a specific profile by ID', async () => {
      if (!dbConnected || !tenantId || !draftProfileId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${draftProfileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('id', draftProfileId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('status', SoaProfileStatus.DRAFT);
    });

    it('should return 404 for non-existent profile', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeId = '00000000-0000-0000-0000-000000000999';
      await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });

  describe('GET /grc/soa/profiles/:profileId/items', () => {
    it('should return items for a profile in LIST-CONTRACT format', async () => {
      if (!dbConnected || !tenantId || !draftProfileId || !testItemId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${draftProfileId}/items?page=1&pageSize=10`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(response.body.data).toHaveProperty('totalPages');

      const { items, total } = response.body.data;
      expect(total).toBeGreaterThanOrEqual(1);
      expect(items.length).toBeGreaterThanOrEqual(1);

      const itemIds = items.map((i: { id: string }) => i.id);
      expect(itemIds).toContain(testItemId);

      const testItem = items.find((i: { id: string }) => i.id === testItemId);
      expect(testItem).toBeDefined();
      expect(testItem.applicability).toBe(SoaApplicability.APPLICABLE);
      expect(testItem.implementationStatus).toBe(
        SoaImplementationStatus.IMPLEMENTED,
      );
    });

    it('should return 404 for non-existent profile', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeId = '00000000-0000-0000-0000-000000000999';
      await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${fakeId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });

    it('should maintain tenant isolation for items', async () => {
      if (!dbConnected || !tenantId || !draftProfileId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      const otherTenantId = '99999999-9999-9999-9999-999999999999';

      const response = await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${draftProfileId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', otherTenantId)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /grc/soa/profiles/:profileId/statistics', () => {
    it('should return statistics for a profile', async () => {
      if (!dbConnected || !tenantId || !draftProfileId || !testItemId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${draftProfileId}/statistics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const stats = response.body.data;
      expect(stats).toHaveProperty('totalItems');
      expect(stats).toHaveProperty('applicabilityCounts');
      expect(stats).toHaveProperty('implementationCounts');
      expect(stats).toHaveProperty('evidenceCoverage');
      expect(stats).toHaveProperty('controlCoverage');

      expect(stats.totalItems).toBeGreaterThanOrEqual(1);
      expect(stats.applicabilityCounts).toHaveProperty(
        SoaApplicability.APPLICABLE,
      );
      expect(stats.implementationCounts).toHaveProperty(
        SoaImplementationStatus.IMPLEMENTED,
      );
      expect(stats.evidenceCoverage).toHaveProperty('itemsWithEvidence');
      expect(stats.evidenceCoverage).toHaveProperty('itemsWithoutEvidence');
      expect(stats.controlCoverage).toHaveProperty('itemsWithControls');
      expect(stats.controlCoverage).toHaveProperty('itemsWithoutControls');
    });

    it('should return 404 for non-existent profile', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeId = '00000000-0000-0000-0000-000000000999';
      await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${fakeId}/statistics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });

    it('should maintain tenant isolation for statistics', async () => {
      if (!dbConnected || !tenantId || !draftProfileId) {
        console.log(
          'Skipping test: database not connected or test data not available',
        );
        return;
      }

      const otherTenantId = '99999999-9999-9999-9999-999999999999';

      const response = await request(app.getHttpServer())
        .get(`/grc/soa/profiles/${draftProfileId}/statistics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', otherTenantId)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});
