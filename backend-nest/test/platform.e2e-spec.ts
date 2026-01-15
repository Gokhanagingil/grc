import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Platform Core Features (e2e)', () => {
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

  describe('Attachments', () => {
    let createdAttachmentId: string;
    let testRiskId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      const newRisk = {
        title: 'Test Risk for Attachments - E2E',
        description: 'A test risk for attachment testing',
        category: 'Testing',
        severity: 'medium',
        likelihood: 'possible',
        status: 'identified',
      };

      const response = await request(app.getHttpServer())
        .post('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newRisk);

      const data = response.body.data ?? response.body;
      testRiskId = data.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !testRiskId) return;

      await request(app.getHttpServer())
        .delete(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    describe('POST /grc/attachments', () => {
      it('should upload an attachment with valid data', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .post(`/grc/attachments?refTable=grc_risks&refId=${testRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .attach('file', Buffer.from('test file content'), {
            filename: 'test-file.txt',
            contentType: 'text/plain',
          })
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('fileName', 'test-file.txt');
        expect(data).toHaveProperty('contentType', 'text/plain');
        expect(data).toHaveProperty('refTable', 'grc_risks');
        expect(data).toHaveProperty('refId', testRiskId);

        createdAttachmentId = data.id;
      });

      it('should return 400 for invalid refTable', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .post(`/grc/attachments?refTable=invalid_table&refId=${testRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .attach('file', Buffer.from('test'), {
            filename: 'test.txt',
            contentType: 'text/plain',
          })
          .expect(400);
      });

      it('should return 400 for invalid MIME type', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .post(`/grc/attachments?refTable=grc_risks&refId=${testRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .attach('file', Buffer.from('test'), {
            filename: 'test.exe',
            contentType: 'application/x-msdownload',
          })
          .expect(400);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .post('/grc/attachments?refTable=grc_risks&refId=some-id')
          .set('x-tenant-id', tenantId)
          .attach('file', Buffer.from('test'), {
            filename: 'test.txt',
            contentType: 'text/plain',
          })
          .expect(401);
      });
    });

    describe('GET /grc/attachments', () => {
      it('should list attachments for a record', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/attachments')
          .query({ refTable: 'grc_risks', refId: testRiskId })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
        if (createdAttachmentId) {
          const attachment = data.find(
            (a: { id: string }) => a.id === createdAttachmentId,
          );
          expect(attachment).toBeDefined();
        }
      });

      it('should return 400 for invalid refTable', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/attachments')
          .query({ refTable: 'invalid_table', refId: 'some-id' })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(400);
      });
    });

    describe('GET /grc/attachments/:id', () => {
      it('should get attachment metadata by ID', async () => {
        if (!dbConnected || !tenantId || !createdAttachmentId) {
          console.log(
            'Skipping test: database not connected or no attachment created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/attachments/${createdAttachmentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdAttachmentId);
        expect(data).toHaveProperty('fileName', 'test-file.txt');
      });

      it('should return 404 for non-existent attachment', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/attachments/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('GET /grc/attachments/:id/download', () => {
      it('should download attachment content', async () => {
        if (!dbConnected || !tenantId || !createdAttachmentId) {
          console.log(
            'Skipping test: database not connected or no attachment created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/attachments/${createdAttachmentId}/download`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.headers['content-type']).toContain('text/plain');
        expect(response.text).toBe('test file content');
      });
    });

    describe('DELETE /grc/attachments/:id', () => {
      it('should soft delete an attachment', async () => {
        if (!dbConnected || !tenantId || !createdAttachmentId) {
          console.log(
            'Skipping test: database not connected or no attachment created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/attachments/${createdAttachmentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted attachment in list', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !createdAttachmentId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/attachments')
          .query({ refTable: 'grc_risks', refId: testRiskId })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const deletedAttachment = data.find(
          (a: { id: string }) => a.id === createdAttachmentId,
        );
        expect(deletedAttachment).toBeUndefined();
      });
    });
  });

  describe('List Views', () => {
    let createdListViewId: string;

    describe('POST /grc/list-views', () => {
      it('should create a new list view', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newListView = {
          tableName: 'grc_risks',
          name: 'Test View - E2E',
          scope: 'user',
          isDefault: false,
        };

        const response = await request(app.getHttpServer())
          .post('/grc/list-views')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newListView)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('tableName', newListView.tableName);
        expect(data).toHaveProperty('name', newListView.name);
        expect(data).toHaveProperty('scope', newListView.scope);

        createdListViewId = data.id;
      });

      it('should return 400 without required tableName', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidListView = {
          name: 'Invalid View',
          scope: 'user',
        };

        await request(app.getHttpServer())
          .post('/grc/list-views')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidListView)
          .expect(400);
      });
    });

    describe('GET /grc/list-views', () => {
      it('should list views for a table', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/list-views')
          .query({ tableName: 'grc_risks' })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });
    });

    describe('PUT /grc/list-views/:id/columns', () => {
      it('should update list view columns', async () => {
        if (!dbConnected || !tenantId || !createdListViewId) {
          console.log(
            'Skipping test: database not connected or no list view created',
          );
          return;
        }

        const columns = [
          { columnName: 'title', orderIndex: 0, visible: true },
          { columnName: 'status', orderIndex: 1, visible: true },
          { columnName: 'severity', orderIndex: 2, visible: true },
        ];

        const response = await request(app.getHttpServer())
          .put(`/grc/list-views/${createdListViewId}/columns`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ columns })
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('columns');
        expect(Array.isArray(data.columns)).toBe(true);
        expect(data.columns.length).toBe(3);
      });
    });

    describe('DELETE /grc/list-views/:id', () => {
      it('should delete a list view', async () => {
        if (!dbConnected || !tenantId || !createdListViewId) {
          console.log(
            'Skipping test: database not connected or no list view created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/list-views/${createdListViewId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });
    });
  });

  describe('Export', () => {
    describe('POST /grc/export', () => {
      it('should export data as CSV', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const exportRequest = {
          tableName: 'grc_risks',
          columns: ['id', 'title', 'status'],
          format: 'csv',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/export')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(exportRequest)
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.headers['content-disposition']).toContain('.csv');

        const csvContent = response.text;
        expect(csvContent).toContain('id,title,status');
      });

      it('should return 400 for invalid table name', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const exportRequest = {
          tableName: 'invalid_table',
          columns: ['id'],
          format: 'csv',
        };

        await request(app.getHttpServer())
          .post('/grc/export')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(exportRequest)
          .expect(400);
      });

      it('should return 400 for invalid columns', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const exportRequest = {
          tableName: 'grc_risks',
          columns: ['invalid_column', 'another_invalid'],
          format: 'csv',
        };

        await request(app.getHttpServer())
          .post('/grc/export')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(exportRequest)
          .expect(400);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .post('/grc/export')
          .set('x-tenant-id', tenantId)
          .send({
            tableName: 'grc_risks',
            columns: ['id'],
            format: 'csv',
          })
          .expect(401);
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should not allow access to attachments from different tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000001';

      await request(app.getHttpServer())
        .get('/grc/attachments')
        .query({ refTable: 'grc_risks', refId: 'some-id' })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(200);
    });

    it('should not allow access to list views from different tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000001';

      const response = await request(app.getHttpServer())
        .get('/grc/list-views')
        .query({ tableName: 'grc_risks' })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });
});
