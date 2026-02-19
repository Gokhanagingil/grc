import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';

/**
 * Platform Builder E2E Tests
 *
 * Tests the Platform Builder v0 feature:
 * - Admin APIs for table and field management
 * - Runtime Data APIs for dynamic record CRUD
 * - Filtering and sorting of dynamic records
 */
describe('Platform Builder (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials
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

  // ==================== REGRESSION TEST: Platform Builder Tables Exist ====================
  // This test verifies that the Platform Builder migration has been run and the required
  // tables exist. This is a regression test for the 500 error that occurs when the
  // /grc/admin/tables endpoint is called but the sys_db_object table doesn't exist.
  // Root cause: Migration 1737300000000-CreatePlatformBuilderTables was not run on staging.
  describe('Platform Builder Schema Validation (Regression Test)', () => {
    it('should have sys_db_object table in database schema', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const dataSource = app.get<DataSource>(getDataSourceToken());
      const result = await dataSource.manager.query<Array<{ exists: boolean }>>(
        `SELECT to_regclass('public.sys_db_object') IS NOT NULL as exists`,
      );

      expect(result[0].exists).toBe(true);
    });

    it('should have sys_dictionary table in database schema', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const dataSource = app.get<DataSource>(getDataSourceToken());
      const result = await dataSource.manager.query<Array<{ exists: boolean }>>(
        `SELECT to_regclass('public.sys_dictionary') IS NOT NULL as exists`,
      );

      expect(result[0].exists).toBe(true);
    });

    it('should have dynamic_records table in database schema', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const dataSource = app.get<DataSource>(getDataSourceToken());
      const result = await dataSource.manager.query<Array<{ exists: boolean }>>(
        `SELECT to_regclass('public.dynamic_records') IS NOT NULL as exists`,
      );

      expect(result[0].exists).toBe(true);
    });

    it('should return 200 for GET /grc/admin/tables when tables exist (not 500)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // This test verifies the endpoint returns 200 (not 500) when Platform Builder
      // tables exist. A 500 error here indicates the migration hasn't been run.
      const response = await request(app.getHttpServer())
        .get('/grc/admin/tables?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      // Should NOT be 500 - that indicates missing tables
      expect(response.status).not.toBe(500);
      // Should be 200 with valid response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  // ==================== ADMIN TABLE MANAGEMENT ====================
  describe('Admin Table Management', () => {
    let createdTableId: string;
    const testTableName = 'u_test_e2e_' + Date.now();

    describe('POST /grc/admin/tables', () => {
      it('should create a new dynamic table with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newTable = {
          name: testTableName,
          label: 'Test E2E Table',
          description: 'A test table created by e2e tests',
          isActive: true,
        };

        const response = await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newTable)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        const data = response.body.data;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newTable.name);
        expect(data).toHaveProperty('label', newTable.label);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);

        createdTableId = data.id;
      });

      it('should return 400 for invalid table name pattern', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidTable = {
          name: 'invalid_table_name', // Missing u_ prefix
          label: 'Invalid Table',
        };

        await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidTable)
          .expect(400);
      });

      it('should return 409 for duplicate table name', async () => {
        if (!dbConnected || !tenantId || !createdTableId) {
          console.log(
            'Skipping test: database not connected or no table created',
          );
          return;
        }

        const duplicateTable = {
          name: testTableName,
          label: 'Duplicate Table',
        };

        await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(duplicateTable)
          .expect(409);
      });
    });

    describe('GET /grc/admin/tables', () => {
      it('should return list of tables with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/admin/tables')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });
    });

    describe('GET /grc/admin/tables/:id', () => {
      it('should return a specific table by ID', async () => {
        if (!dbConnected || !tenantId || !createdTableId) {
          console.log(
            'Skipping test: database not connected or no table created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/admin/tables/${createdTableId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        const data = response.body.data;
        expect(data).toHaveProperty('id', createdTableId);
        expect(data).toHaveProperty('name', testTableName);
        expect(data).toHaveProperty('fieldCount');
        expect(data).toHaveProperty('recordCount');
      });
    });

    describe('PATCH /grc/admin/tables/:id', () => {
      it('should update an existing table', async () => {
        if (!dbConnected || !tenantId || !createdTableId) {
          console.log(
            'Skipping test: database not connected or no table created',
          );
          return;
        }

        const updateData = {
          label: 'Test E2E Table - Updated',
          description: 'Updated description',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/admin/tables/${createdTableId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        const data = response.body.data;
        expect(data).toHaveProperty('id', createdTableId);
        expect(data).toHaveProperty('label', updateData.label);
        expect(data).toHaveProperty('description', updateData.description);
      });
    });

    // ==================== ADMIN FIELD MANAGEMENT ====================
    describe('Field Management for Table', () => {
      let createdFieldId: string;

      describe('POST /grc/admin/tables/:tableId/fields', () => {
        it('should create a new field for the table', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const newField = {
            fieldName: 'test_field',
            label: 'Test Field',
            type: 'string',
            isRequired: true,
            isUnique: false,
          };

          const response = await request(app.getHttpServer())
            .post(`/grc/admin/tables/${createdTableId}/fields`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(newField)
            .expect(201);

          expect(response.body).toHaveProperty('success', true);
          const data = response.body.data;
          expect(data).toHaveProperty('id');
          expect(data).toHaveProperty('fieldName', newField.fieldName);
          expect(data).toHaveProperty('label', newField.label);
          expect(data).toHaveProperty('type', newField.type);
          expect(data).toHaveProperty('isRequired', newField.isRequired);

          createdFieldId = data.id;
        });

        it('should return 400 for invalid field name pattern', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const invalidField = {
            fieldName: '123_invalid', // Must start with letter
            label: 'Invalid Field',
          };

          await request(app.getHttpServer())
            .post(`/grc/admin/tables/${createdTableId}/fields`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(invalidField)
            .expect(400);
        });

        it('should create a choice field with options', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const choiceField = {
            fieldName: 'status_field',
            label: 'Status',
            type: 'choice',
            isRequired: false,
            choiceOptions: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ],
          };

          const response = await request(app.getHttpServer())
            .post(`/grc/admin/tables/${createdTableId}/fields`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(choiceField)
            .expect(201);

          expect(response.body).toHaveProperty('success', true);
          const data = response.body.data;
          expect(data).toHaveProperty('type', 'choice');
          expect(data).toHaveProperty('choiceOptions');
          expect(Array.isArray(data.choiceOptions)).toBe(true);
          expect(data.choiceOptions).toHaveLength(2);
        });
      });

      describe('GET /grc/admin/tables/:tableId/fields', () => {
        it('should return list of fields for the table', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .get(`/grc/admin/tables/${createdTableId}/fields`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          expect(response.body.data).toHaveProperty('items');
          expect(Array.isArray(response.body.data.items)).toBe(true);
          expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
        });
      });

      describe('PATCH /grc/admin/fields/:fieldId', () => {
        it('should update an existing field', async () => {
          if (!dbConnected || !tenantId || !createdFieldId) {
            console.log(
              'Skipping test: database not connected or no field created',
            );
            return;
          }

          const updateData = {
            label: 'Test Field - Updated',
            isRequired: false,
          };

          const response = await request(app.getHttpServer())
            .patch(`/grc/admin/fields/${createdFieldId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(updateData)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          const data = response.body.data;
          expect(data).toHaveProperty('id', createdFieldId);
          expect(data).toHaveProperty('label', updateData.label);
          expect(data).toHaveProperty('isRequired', updateData.isRequired);
        });
      });
    });

    // ==================== RUNTIME DATA CRUD ====================
    describe('Runtime Data CRUD', () => {
      let createdRecordId: string;

      describe('POST /grc/data/:tableName', () => {
        it('should create a new record in the dynamic table', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const newRecord = {
            data: {
              test_field: 'Test Value 1',
              status_field: 'active',
            },
          };

          const response = await request(app.getHttpServer())
            .post(`/grc/data/${testTableName}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(newRecord)
            .expect(201);

          expect(response.body).toHaveProperty('success', true);
          const data = response.body.data;
          expect(data).toHaveProperty('id');
          expect(data).toHaveProperty('recordId');
          expect(data).toHaveProperty('tableName', testTableName);
          expect(data).toHaveProperty('data');
          expect(data.data).toHaveProperty('test_field', 'Test Value 1');

          createdRecordId = data.recordId;
        });

        it('should create another record for filtering tests', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const newRecord = {
            data: {
              test_field: 'Test Value 2',
              status_field: 'inactive',
            },
          };

          const response = await request(app.getHttpServer())
            .post(`/grc/data/${testTableName}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(newRecord)
            .expect(201);

          expect(response.body).toHaveProperty('success', true);
        });

        it('should return 404 for non-existent table', async () => {
          if (!dbConnected || !tenantId) {
            console.log('Skipping test: database not connected');
            return;
          }

          const newRecord = {
            data: { field: 'value' },
          };

          await request(app.getHttpServer())
            .post('/grc/data/u_nonexistent_table')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(newRecord)
            .expect(404);
        });
      });

      describe('GET /grc/data/:tableName', () => {
        it('should return list of records with pagination', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .get(`/grc/data/${testTableName}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          expect(response.body.data).toHaveProperty('records');
          expect(response.body.data.records).toHaveProperty('items');
          expect(Array.isArray(response.body.data.records.items)).toBe(true);
          expect(
            response.body.data.records.items.length,
          ).toBeGreaterThanOrEqual(2);
          expect(response.body.data).toHaveProperty('fields');
          expect(Array.isArray(response.body.data.fields)).toBe(true);
        });

        it('should filter records by field value', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const filter = JSON.stringify({ status_field: 'active' });
          const response = await request(app.getHttpServer())
            .get(
              `/grc/data/${testTableName}?filter=${encodeURIComponent(filter)}`,
            )
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          const items = response.body.data.records.items;
          expect(items.length).toBeGreaterThanOrEqual(1);
          items.forEach((item: { data: { status_field: string } }) => {
            expect(item.data.status_field).toBe('active');
          });
        });

        it('should search records by text', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .get(`/grc/data/${testTableName}?search=Test%20Value%201`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          const items = response.body.data.records.items;
          expect(items.length).toBeGreaterThanOrEqual(1);
        });

        it('should sort records by field', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .get(`/grc/data/${testTableName}?sortBy=test_field&sortOrder=ASC`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          const items = response.body.data.records.items;
          expect(items.length).toBeGreaterThanOrEqual(2);
          // Verify sorting (first item should have lower value)
          if (items.length >= 2) {
            expect(items[0].data.test_field <= items[1].data.test_field).toBe(
              true,
            );
          }
        });
      });

      describe('GET /grc/data/:tableName/:recordId', () => {
        it('should return a specific record by ID', async () => {
          if (!dbConnected || !tenantId || !createdRecordId) {
            console.log(
              'Skipping test: database not connected or no record created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .get(`/grc/data/${testTableName}/${createdRecordId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          const data = response.body.data;
          expect(data).toHaveProperty('record');
          expect(data.record).toHaveProperty('recordId', createdRecordId);
          expect(data).toHaveProperty('fields');
        });

        it('should return 404 for non-existent record', async () => {
          if (!dbConnected || !tenantId || !createdTableId) {
            console.log(
              'Skipping test: database not connected or no table created',
            );
            return;
          }

          await request(app.getHttpServer())
            .get(
              `/grc/data/${testTableName}/00000000-0000-0000-0000-000000000000`,
            )
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(404);
        });
      });

      describe('PATCH /grc/data/:tableName/:recordId', () => {
        it('should update an existing record', async () => {
          if (!dbConnected || !tenantId || !createdRecordId) {
            console.log(
              'Skipping test: database not connected or no record created',
            );
            return;
          }

          const updateData = {
            data: {
              test_field: 'Updated Value',
            },
          };

          const response = await request(app.getHttpServer())
            .patch(`/grc/data/${testTableName}/${createdRecordId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .send(updateData)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
          const data = response.body.data;
          expect(data).toHaveProperty('recordId', createdRecordId);
          expect(data.data).toHaveProperty('test_field', 'Updated Value');
        });
      });

      describe('DELETE /grc/data/:tableName/:recordId', () => {
        it('should soft delete a record', async () => {
          if (!dbConnected || !tenantId || !createdRecordId) {
            console.log(
              'Skipping test: database not connected or no record created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .delete(`/grc/data/${testTableName}/${createdRecordId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
        });

        it('should not return deleted record in list', async () => {
          if (!dbConnected || !tenantId || !createdRecordId) {
            console.log(
              'Skipping test: database not connected or no record created',
            );
            return;
          }

          const response = await request(app.getHttpServer())
            .get(`/grc/data/${testTableName}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          const items = response.body.data.records.items;
          const deletedRecord = items.find(
            (r: { recordId: string }) => r.recordId === createdRecordId,
          );
          expect(deletedRecord).toBeUndefined();
        });
      });
    });

    // ==================== GENERIC QUERY RUNTIME (PHASE 3) ====================
    describe('Generic Query Runtime (Phase 3)', () => {
      let refTableId: string;
      let sourceTableId: string;
      let refRecordId: string;
      let otherTenantId: string | null = null;

      const refTableName = 'u_ref_e2e_' + Date.now();
      const sourceTableName = 'u_source_e2e_' + Date.now();

      beforeAll(async () => {
        if (!dbConnected || !tenantId) {
          return;
        }

        const tenantsRes = await request(app.getHttpServer())
          .get('/tenants?page=1&limit=50')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const tenants = tenantsRes.body.tenants ?? [];
        const other = tenants.find(
          (t: { id: string }) => t.id && t.id !== tenantId,
        );
        otherTenantId = other?.id ?? null;
      });

      afterAll(async () => {
        if (!dbConnected || !tenantId) {
          return;
        }

        const dataSource = app.get<DataSource>(getDataSourceToken());
        if (otherTenantId) {
          await dataSource.manager.query(
            'DELETE FROM dynamic_records WHERE tenant_id = $1 AND table_name = $2',
            [otherTenantId, sourceTableName],
          );
        }

        const tablesToClean = [sourceTableName, refTableName];
        for (const tn of tablesToClean) {
          const recordsResponse = await request(app.getHttpServer())
            .get(`/grc/data/${tn}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);

          if (recordsResponse.body.data?.records?.items) {
            for (const record of recordsResponse.body.data.records.items) {
              await request(app.getHttpServer())
                .delete(`/grc/data/${tn}/${record.recordId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('x-tenant-id', tenantId);
            }
          }
        }

        if (sourceTableId) {
          await request(app.getHttpServer())
            .delete(`/grc/admin/tables/${sourceTableId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }

        if (refTableId) {
          await request(app.getHttpServer())
            .delete(`/grc/admin/tables/${refTableId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }
      });

      it('should create tables and fields for dot-walking', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const refTableRes = await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: refTableName,
            label: 'Ref Table (E2E)',
            description: 'Reference table for generic query tests',
            isActive: true,
          })
          .expect(201);

        expect(refTableRes.body).toHaveProperty('success', true);
        refTableId = refTableRes.body.data.id;

        const sourceTableRes = await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: sourceTableName,
            label: 'Source Table (E2E)',
            description: 'Source table for generic query tests',
            isActive: true,
          })
          .expect(201);

        expect(sourceTableRes.body).toHaveProperty('success', true);
        sourceTableId = sourceTableRes.body.data.id;

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${refTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'name_field',
            label: 'Name',
            type: 'string',
            isRequired: true,
            isActive: true,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${sourceTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'title_field',
            label: 'Title',
            type: 'string',
            isRequired: true,
            isActive: true,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${sourceTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'ref_field',
            label: 'Ref',
            type: 'reference',
            referenceTable: refTableName,
            isRequired: false,
            isActive: true,
          })
          .expect(201);
      });

      it('should create records', async () => {
        if (!dbConnected || !tenantId || !refTableId || !sourceTableId) {
          console.log(
            'Skipping test: database not connected or tables missing',
          );
          return;
        }

        const refRes = await request(app.getHttpServer())
          .post(`/grc/data/${refTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ data: { name_field: 'Ref One' } })
          .expect(201);

        refRecordId = refRes.body.data.recordId;

        await request(app.getHttpServer())
          .post(`/grc/data/${sourceTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              title_field: 'Hello',
              ref_field: refRecordId,
            },
          })
          .expect(201);
      });

      it('should query records with q', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const res = await request(app.getHttpServer())
          .get(
            `/grc/platform/tables/${sourceTableName}/records?page=1&pageSize=10&q=Hello`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.total).toBeGreaterThanOrEqual(1);
      });

      it('should filter records by equals', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const filter = JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'title_field', operator: 'equals', value: 'Hello' },
          ],
        });

        const res = await request(app.getHttpServer())
          .get(
            `/grc/platform/tables/${sourceTableName}/records?page=1&pageSize=10&filter=${encodeURIComponent(filter)}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.total).toBe(1);
        expect(res.body.data.length).toBe(1);
      });

      it('should filter records with dot-walking (1 hop)', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const filter = JSON.stringify({
          logic: 'AND',
          conditions: [
            {
              field: 'ref_field.name_field',
              operator: 'equals',
              value: 'Ref One',
            },
          ],
        });

        const res = await request(app.getHttpServer())
          .get(
            `/grc/platform/tables/${sourceTableName}/records?page=1&pageSize=10&filter=${encodeURIComponent(filter)}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.total).toBe(1);
        expect(res.body.data.length).toBe(1);
      });

      it('should enforce tenant isolation (do not return other tenant records)', async () => {
        if (!dbConnected || !tenantId || !otherTenantId) {
          console.log('Skipping test: second tenant not available');
          return;
        }

        const dataSource = app.get<DataSource>(getDataSourceToken());
        await dataSource.manager.query(
          `INSERT INTO dynamic_records (
            id,
            tenant_id,
            table_name,
            record_id,
            data,
            created_at,
            updated_at,
            created_by,
            updated_by,
            is_deleted
          ) VALUES ($1,$2,$3,$4,$5,now(),now(),$6,$7,false)`,
          [
            randomUUID(),
            otherTenantId,
            sourceTableName,
            randomUUID(),
            JSON.stringify({ title_field: 'Hello', ref_field: refRecordId }),
            null,
            null,
          ],
        );

        const filter = JSON.stringify({
          logic: 'AND',
          conditions: [
            { field: 'title_field', operator: 'equals', value: 'Hello' },
          ],
        });

        const res = await request(app.getHttpServer())
          .get(
            `/grc/platform/tables/${sourceTableName}/records?page=1&pageSize=10&filter=${encodeURIComponent(filter)}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.total).toBe(1);
        expect(res.body.data.length).toBe(1);
      });
    });

    // ==================== CLEANUP ====================
    describe('Cleanup', () => {
      it('should delete the test table', async () => {
        if (!dbConnected || !tenantId || !createdTableId) {
          console.log(
            'Skipping test: database not connected or no table created',
          );
          return;
        }

        // First delete remaining records
        const recordsResponse = await request(app.getHttpServer())
          .get(`/grc/data/${testTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);

        if (recordsResponse.body.data?.records?.items) {
          for (const record of recordsResponse.body.data.records.items) {
            await request(app.getHttpServer())
              .delete(`/grc/data/${testTableName}/${record.recordId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .set('x-tenant-id', tenantId);
          }
        }

        // Now delete the table
        const response = await request(app.getHttpServer())
          .delete(`/grc/admin/tables/${createdTableId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });
  });
});
