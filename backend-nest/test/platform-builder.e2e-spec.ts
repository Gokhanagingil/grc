import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

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

    // ==================== PHASE 4: DATA POLICY VALIDATIONS ====================
    describe('Phase 4: Data Policy Validations', () => {
      let policyTableId: string;
      let policyRefTableId: string;
      let policyRefRecordId: string;
      const policyTableName = 'u_policy_e2e_' + Date.now();
      const policyRefTableName = 'u_polref_e2e_' + Date.now();

      it('should create reference table and record for ref integrity tests', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const res = await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: policyRefTableName,
            label: 'Policy Ref Table',
            isActive: true,
          })
          .expect(201);

        policyRefTableId = res.body.data.id;

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${policyRefTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'ref_name',
            label: 'Ref Name',
            type: 'string',
            isRequired: true,
          })
          .expect(201);

        const recRes = await request(app.getHttpServer())
          .post(`/grc/data/${policyRefTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ data: { ref_name: 'Valid Ref' } })
          .expect(201);

        policyRefRecordId = recRes.body.data.recordId;
      });

      it('should create policy table with maxLength, readOnly, unique, and reference fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const res = await request(app.getHttpServer())
          .post('/grc/admin/tables')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: policyTableName,
            label: 'Policy Test Table',
            isActive: true,
          })
          .expect(201);

        policyTableId = res.body.data.id;

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${policyTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'short_text',
            label: 'Short Text',
            type: 'string',
            maxLength: 10,
            isRequired: true,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${policyTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'locked_field',
            label: 'Locked Field',
            type: 'string',
            readOnly: true,
            isRequired: false,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${policyTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'unique_code',
            label: 'Unique Code',
            type: 'string',
            isUnique: true,
            isRequired: true,
          })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/grc/admin/tables/${policyTableId}/fields`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            fieldName: 'ref_link',
            label: 'Ref Link',
            type: 'reference',
            referenceTable: policyRefTableName,
            isRequired: false,
          })
          .expect(201);
      });

      it('should reject record when field exceeds maxLength', async () => {
        if (!dbConnected || !tenantId || !policyTableId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const res = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'this string is way too long for maxLength 10',
              unique_code: 'ML001',
            },
          })
          .expect(400);

        expect(res.body.message).toContain('exceeds max length');
      });

      it('should accept record within maxLength', async () => {
        if (!dbConnected || !tenantId || !policyTableId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const res = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: '0123456789',
              unique_code: 'OK001',
            },
          })
          .expect(201);

        expect(res.body).toHaveProperty('success', true);
      });

      it('should reject duplicate unique field value', async () => {
        if (!dbConnected || !tenantId || !policyTableId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const res = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'abc',
              unique_code: 'OK001',
            },
          })
          .expect(400);

        expect(res.body.message).toContain('must be unique');
      });

      it('should reject reference to non-existent record', async () => {
        if (!dbConnected || !tenantId || !policyTableId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const res = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'ref test',
              unique_code: 'REF001',
              ref_link: '00000000-0000-0000-0000-000000000000',
            },
          })
          .expect(400);

        expect(res.body.message).toContain('referenced record');
        expect(res.body.message).toContain('not found');
      });

      it('should accept valid reference', async () => {
        if (!dbConnected || !tenantId || !policyTableId || !policyRefRecordId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const res = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'valid ref',
              unique_code: 'REF002',
              ref_link: policyRefRecordId,
            },
          })
          .expect(201);

        expect(res.body).toHaveProperty('success', true);
      });

      it('should reject update to read-only field', async () => {
        if (!dbConnected || !tenantId || !policyTableId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const createRes = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'readonly',
              unique_code: 'RO001',
            },
          })
          .expect(201);

        const recordId = createRes.body.data.recordId;

        const res = await request(app.getHttpServer())
          .patch(`/grc/data/${policyTableName}/${recordId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              locked_field: 'trying to update',
            },
          })
          .expect(400);

        expect(res.body.message).toContain('read-only');
        expect(res.body.message).toContain('locked_field');
      });

      it('should allow updating non-read-only fields', async () => {
        if (!dbConnected || !tenantId || !policyTableId) {
          console.log('Skipping test: setup incomplete');
          return;
        }

        const createRes = await request(app.getHttpServer())
          .post(`/grc/data/${policyTableName}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'editable',
              unique_code: 'ED001',
            },
          })
          .expect(201);

        const recordId = createRes.body.data.recordId;

        const res = await request(app.getHttpServer())
          .patch(`/grc/data/${policyTableName}/${recordId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            data: {
              short_text: 'updated',
            },
          })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.data.data).toHaveProperty('short_text', 'updated');
      });

      afterAll(async () => {
        if (!dbConnected || !tenantId) return;

        const tablesToClean = [policyTableName, policyRefTableName];
        for (const tn of tablesToClean) {
          const recordsRes = await request(app.getHttpServer())
            .get(`/grc/data/${tn}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);

          if (recordsRes.body.data?.records?.items) {
            for (const rec of recordsRes.body.data.records.items) {
              await request(app.getHttpServer())
                .delete(`/grc/data/${tn}/${rec.recordId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .set('x-tenant-id', tenantId);
            }
          }
        }

        if (policyTableId) {
          await request(app.getHttpServer())
            .delete(`/grc/admin/tables/${policyTableId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }

        if (policyRefTableId) {
          await request(app.getHttpServer())
            .delete(`/grc/admin/tables/${policyRefTableId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        }
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
