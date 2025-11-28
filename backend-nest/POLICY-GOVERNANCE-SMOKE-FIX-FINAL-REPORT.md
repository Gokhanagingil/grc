# Policy & Governance Smoke Fix - Final Report

## Executive Summary

**Problem:** `SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name`

**Root Cause:** SQLite table has both `name` and `title` columns (both NOT NULL), but entity only mapped `title` property to `title` column. TypeORM couldn't set `name` column, causing NOT NULL constraint failure.

**Solution:** Map `title` property to `name` column and add `titleDb` property mapped to `title` column. Update service to set both columns.

**Status:** ✅ Code changes complete, **BACKEND RESTART REQUIRED** for changes to take effect.

## Root Cause Analysis

### SQLite Schema
The `policies` table has **both** columns:
- `name`: varchar(160), NOT NULL (legacy column)
- `title`: TEXT, NOT NULL (current column)

### Entity Definition (Before Fix)
- Only `title` property mapped to `title` column
- No mapping for `name` column

### Service Logic
- Set `policy.title` from `dto.title`
- Did NOT set `name` column (not in entity)

### Result
TypeORM insert failed because `name` column is NOT NULL but received NULL.

## Solution Implementation

### 1. Entity Changes

**File:** `backend-nest/src/entities/app/policy.entity.ts`

**Changes:**
- Map `title` property to `name` column: `@Column({ name: 'name', type: 'text' }) title!: string;`
- Add `titleDb` property mapped to `title` column: `@Column({ name: 'title', type: 'text' }) titleDb!: string;`

**Rationale:**
- Legacy schema has both `name` and `title` columns
- Both are NOT NULL, so both must be set
- Map `title` property to `name` for backward compatibility
- Add `titleDb` to also set `title` column

### 2. Service Changes

**File:** `backend-nest/src/modules/governance/governance.service.ts`

**Changes in `create()` method:**
```typescript
const titleValue = dto.title.trim();
const policy = this.policyRepo.create({
  // ...
  title: titleValue, // Maps to 'name' column
  titleDb: titleValue, // Maps to 'title' column (legacy schema has both)
  // ...
});
```

**Changes in `update()` method:**
```typescript
if (dto.title) {
  const titleValue = dto.title.trim();
  policy.title = titleValue; // Maps to 'name' column
  (policy as any).titleDb = titleValue; // Maps to 'title' column
}
```

**Rationale:**
- Set both `name` and `title` columns with same value
- Ensures both NOT NULL constraints are satisfied

## Files Modified

1. **`backend-nest/src/entities/app/policy.entity.ts`**
   - Added `titleDb` property mapped to `title` column
   - Changed `title` property mapping to `name` column

2. **`backend-nest/src/modules/governance/governance.service.ts`**
   - Updated `create()` to set both `title` and `titleDb`
   - Updated `update()` to set both `title` and `titleDb`

## Testing Status

**Current Status:** ⚠️ **BACKEND RESTART REQUIRED**

**Expected After Restart:**
- ✅ `npm run smoke:policies` - PASS
- ✅ `npm run smoke:governance` - PASS
- ✅ `npm run smoke:all` - 8/8 PASS

**Note:** Backend must be restarted for entity changes to take effect. TypeORM caches entity metadata at startup.

## Next Steps

1. **Restart Backend:**
   ```bash
   # Stop current backend process
   # Then restart:
   npm run start:dev
   ```

2. **Run Smoke Tests:**
   ```bash
   npm run smoke:policies
   npm run smoke:governance
   npm run smoke:all
   ```

3. **Verify:**
   - No more `policies.name NOT NULL` errors
   - All smoke tests pass
   - No regressions in other modules

## Regression Check

**Other Modules (Should Remain Unchanged):**
- ✅ Login
- ✅ Standards
- ✅ Audit Flow
- ✅ BCM Processes
- ✅ Calendar
- ✅ Admin

**Changes are isolated to:**
- Policy entity mapping
- Governance service create/update methods

**No changes to:**
- DTOs
- Controllers
- Other services
- Other entities

## Long-term Recommendation

**Consider Schema Cleanup:**
- Remove legacy `name` column from SQLite table
- Keep only `title` column
- Update entity to map `title` property to `title` column only

**Migration Script:**
```sql
-- Future migration to clean up schema
ALTER TABLE policies DROP COLUMN name;
```

This would simplify the entity and remove the need for dual mapping.

---

## Complete File Contents

### --- FILE: backend-nest/src/entities/app/policy.entity.ts ---

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'policies' })
@Index('idx_policies_tenant', ['tenant_id'])
export class PolicyEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') tenant_id!: string;
  @Column({ type: 'text' }) code!: string;
  // Map title property to both 'name' and 'title' columns (legacy schema has both)
  @Column({ name: 'name', type: 'text' }) title!: string;
  @Column({ name: 'title', type: 'text' }) titleDb!: string;
  @Column({ type: 'text' }) status!: string;
  @Column({ type: 'text', nullable: true }) owner_first_name?: string;
  @Column({ type: 'text', nullable: true }) owner_last_name?: string;
  @Column({ type: 'date', nullable: true }) effective_date?: string;
  @Column({ type: 'date', nullable: true }) review_date?: string;
  @Column({ type: 'text', nullable: true }) content?: string;
  @Column('uuid', { nullable: true }) created_by?: string;
  @Column('uuid', { nullable: true }) updated_by?: string;
  @CreateDateColumn() created_at!: Date;
  @UpdateDateColumn() updated_at!: Date;
}
```

### --- FILE: backend-nest/src/modules/governance/governance.service.ts ---

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  ILike,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { PolicyEntity } from '../../entities/app/policy.entity';
import { CreateGovernancePolicyDto } from './dto/create-policy.dto';
import { UpdateGovernancePolicyDto } from './dto/update-policy.dto';
import { QueryPolicyDto } from './dto/query-policy.dto';
import { tenantWhere } from '../../common/tenant/tenant-query.util';
import { parseTrDateToIso } from './utils/date-parser.util';
import { randomUUID } from 'crypto';
import { parseSort } from '../../common/http/listing.util';

@Injectable()
export class GovernanceService {
  private readonly logger = new Logger(GovernanceService.name);

  constructor(
    @InjectRepository(PolicyEntity)
    private readonly policyRepo: Repository<PolicyEntity>,
  ) {}

  async list(query: QueryPolicyDto, tenantId: string) {
    try {
      const page = Math.max(parseInt(query.page ?? '1', 10), 1);
      const limit = Math.min(
        Math.max(parseInt(query.limit ?? query.pageSize ?? '20', 10), 1),
        200,
      );

      // Build where clause with tenant and filters
      const whereBase: any = {
        ...tenantWhere(tenantId),
      };

      // Status filter
      if (query.status) {
        whereBase.status = query.status;
      }

      // Text search (q or search parameter)
      const searchTerm = query.q || query.search;
      if (searchTerm) {
        whereBase.title = ILike(`%${searchTerm}%`) as any;
      }

      // Date range filters (if provided, parse from TR format)
      if (query.from) {
        const fromDate = parseTrDateToIso(query.from);
        if (fromDate) {
          whereBase.effective_date = MoreThanOrEqual(fromDate) as any;
        }
      }

      if (query.to) {
        const toDate = parseTrDateToIso(query.to);
        if (toDate) {
          whereBase.effective_date = LessThanOrEqual(toDate) as any;
        }
      }

      // Parse sort (whitelist: created_at, title, updated_at, effective_date)
      const { column, direction } = parseSort(
        query.sort,
        ['created_at', 'title', 'updated_at', 'effective_date'],
        'created_at',
        'DESC',
      );

      const [items, total] = await this.policyRepo.findAndCount({
        where: whereBase,
        order: { [column]: direction },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items,
        total,
        page,
        limit,
        pageSize: limit,
      };
    } catch (error: any) {
      this.logger.warn('Error listing policies:', error?.message || error);
      // Return empty list on error (defensive)
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        pageSize: 20,
      };
    }
  }

  async getOne(id: string, tenantId: string) {
    try {
      const policy = await this.policyRepo.findOne({
        where: {
          id,
          ...tenantWhere(tenantId),
        },
      });

      if (!policy) {
        throw new NotFoundException(`Policy ${id} not found`);
      }

      return policy;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error getting policy:', error?.message || error);
      throw new NotFoundException(`Policy ${id} not found`);
    }
  }

  async create(dto: CreateGovernancePolicyDto, tenantId: string) {
    try {
      // Validate tenantId
      if (!tenantId || !tenantId.trim()) {
        this.logger.error('Tenant ID is missing in create request');
        throw new BadRequestException('Tenant ID is required');
      }

      // Validate required fields
      if (!dto.code || !dto.code.trim()) {
        throw new BadRequestException('Policy code is required');
      }
      if (!dto.title || !dto.title.trim()) {
        throw new BadRequestException('Policy title is required');
      }

      // Check for duplicate code within tenant
      const existing = await this.policyRepo.findOne({
        where: {
          code: dto.code.trim(),
          ...tenantWhere(tenantId),
        },
      });

      if (existing) {
        throw new ConflictException(
          `Policy with code ${dto.code} already exists`,
        );
      }

      // Parse dates from TR format
      const effectiveDate = dto.effective_date
        ? parseTrDateToIso(dto.effective_date)
        : undefined;
      const reviewDate = dto.review_date
        ? parseTrDateToIso(dto.review_date)
        : undefined;

      const titleValue = dto.title.trim();
      const policy = this.policyRepo.create({
        id: randomUUID(),
        tenant_id: tenantId,
        code: dto.code.trim(),
        title: titleValue, // Maps to 'name' column
        titleDb: titleValue, // Maps to 'title' column (legacy schema has both)
        status: dto.status || 'draft', // Default to 'draft' if not provided
        // TODO: Implement status transition validation (e.g., via UI policy engine)
        // TODO: Consider code generator for status dictionaries to avoid duplication across modules
        owner_first_name: dto.owner_first_name?.trim() || undefined,
        owner_last_name: dto.owner_last_name?.trim() || undefined,
        effective_date: effectiveDate || undefined,
        review_date: reviewDate || undefined,
        content: dto.content?.trim() || undefined,
        // created_by and updated_by are nullable, can be set later from auth context
        created_by: undefined,
        updated_by: undefined,
      });

      this.logger.debug(`Creating policy with data:`, {
        id: policy.id,
        tenant_id: policy.tenant_id,
        code: policy.code,
        title: policy.title,
        status: policy.status,
      });

      const saved = await this.policyRepo.save(policy);

      this.logger.log(`Policy created successfully: ${saved.id} (${saved.code})`);
      return saved;
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error creating policy:', error?.message || error);
      this.logger.error('Error name:', error?.name);
      this.logger.error('Error code:', error?.code);
      this.logger.error('Stack trace:', error?.stack);
      if (error?.sql) {
        this.logger.error('SQL:', error.sql);
      }
      if (error?.parameters) {
        this.logger.error('SQL Parameters:', error.parameters);
      }
      // Re-throw as InternalServerError to get 500 status
      throw new InternalServerErrorException(
        `Failed to create policy: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async update(id: string, dto: UpdateGovernancePolicyDto, tenantId: string) {
    try {
      const policy = await this.getOne(id, tenantId);

      // Check code uniqueness if code is being updated
      if (dto.code && dto.code !== policy.code) {
        const existing = await this.policyRepo.findOne({
          where: {
            code: dto.code,
            ...tenantWhere(tenantId),
          },
        });

        if (existing) {
          throw new ConflictException(
            `Policy with code ${dto.code} already exists`,
          );
        }
      }

      // Parse dates if provided
      if (dto.effective_date) {
        policy.effective_date = parseTrDateToIso(dto.effective_date);
      }
      if (dto.review_date) {
        policy.review_date = parseTrDateToIso(dto.review_date);
      }

      // Update other fields
      if (dto.title) {
        const titleValue = dto.title.trim();
        policy.title = titleValue; // Maps to 'name' column
        (policy as any).titleDb = titleValue; // Maps to 'title' column (legacy schema has both)
      }
      if (dto.status) policy.status = dto.status;
      if (dto.owner_first_name !== undefined)
        policy.owner_first_name = dto.owner_first_name;
      if (dto.owner_last_name !== undefined)
        policy.owner_last_name = dto.owner_last_name;
      if (dto.content !== undefined) policy.content = dto.content;

      const updated = await this.policyRepo.save(policy);

      return updated;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error('Error updating policy:', error?.message || error);
      throw new Error(
        `Failed to update policy: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string, tenantId: string) {
    try {
      const policy = await this.getOne(id, tenantId);
      await this.policyRepo.remove(policy);
      return { success: true, id };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error removing policy:', error?.message || error);
      throw new Error(
        `Failed to remove policy: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  // Policy-Standard Mapping (temporarily disabled - requires PolicyStandardEntity table)
  async getPolicyStandards(policyId: string, tenantId: string) {
    this.logger.warn('Standard mapping feature not available - returning empty list');
    return [];
  }

  async addPolicyStandard(
    policyId: string,
    standardId: string,
    tenantId: string,
  ) {
    throw new BadRequestException('Standard mapping feature is not available. Please ensure policy_standards table exists.');
  }

  async removePolicyStandard(
    policyId: string,
    standardId: string,
    tenantId: string,
  ) {
    throw new BadRequestException('Standard mapping feature is not available. Please ensure policy_standards table exists.');
  }
}
```

### --- FILE: backend-nest/scripts/smoke-policies.ts ---

```typescript
#!/usr/bin/env ts-node
/**
 * Policy Module Smoke Test
 * 
 * Tests basic CRUD operations for Governance/Policy module.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/smoke-policies.ts
 */

import 'reflect-metadata';
import { config } from 'dotenv';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

const BASE = (process.env.API_BASE || 'http://localhost:5002').replace(/\/+$/, '');
const TENANT = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
const EMAIL = process.env.SMOKE_USER || 'grc1@local';
const PASS = process.env.SMOKE_PASS || 'grc1';

interface Policy {
  id: string;
  code: string;
  title: string;
  status: string;
  tenant_id: string;
}

async function jsonFetch(url: string, opts: any = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

async function login(): Promise<string | null> {
  console.log('[SMOKE] Logging in...');
  const login = await jsonFetch(`${BASE}/api/v2/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASS }),
    headers: { 'x-tenant-id': TENANT },
  });

  if ((login.status !== 200 && login.status !== 201) || !login.body?.access_token) {
    console.error('FAIL LOGIN', login.status, login.body);
    return null;
  }
  console.log('✅ PASS LOGIN');
  return login.body.access_token;
}

async function main() {
  console.log('=== Policy Module Smoke Test ===\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`Tenant ID: ${TENANT}\n`);

  // Step 1: Login
  const token = await login();
  if (!token) {
    console.error('❌ Cannot proceed without authentication');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': TENANT,
  };

  // Step 2: Create Policy
  console.log('\n[SMOKE] Creating policy...');
  const policyCode = `POL-SMOKE-${Date.now()}`;
  const createPayload = {
    code: policyCode,
    title: 'Smoke Test Policy',
    status: 'draft',
  };

  const create = await jsonFetch(`${BASE}/api/v2/governance/policies`, {
    method: 'POST',
    body: JSON.stringify(createPayload),
    headers,
  });

  if (create.status !== 201 && create.status !== 200) {
    console.error('FAIL CREATE', create.status, create.body);
    process.exit(1);
  }

  const createdPolicy: Policy = create.body;
  console.log('✅ PASS CREATE');
  console.log(`  Policy ID: ${createdPolicy.id}`);
  console.log(`  Code: ${createdPolicy.code}`);

  // Step 3: List Policies
  console.log('\n[SMOKE] Listing policies...');
  const list = await jsonFetch(`${BASE}/api/v2/governance/policies?page=1&pageSize=10`, {
    method: 'GET',
    headers,
  });

  if (list.status !== 200) {
    console.error('FAIL LIST', list.status, list.body);
    process.exit(1);
  }

  const policies = list.body.items || [];
  const found = policies.find((p: Policy) => p.id === createdPolicy.id);
  if (!found) {
    console.error('FAIL LIST - Created policy not found in list');
    process.exit(1);
  }
  console.log('✅ PASS LIST');
  console.log(`  Found ${policies.length} policies`);

  // Step 4: Get Policy by ID
  console.log('\n[SMOKE] Getting policy by ID...');
  const get = await jsonFetch(`${BASE}/api/v2/governance/policies/${createdPolicy.id}`, {
    method: 'GET',
    headers,
  });

  if (get.status !== 200) {
    console.error('FAIL GET', get.status, get.body);
    process.exit(1);
  }

  const policy: Policy = get.body;
  if (policy.id !== createdPolicy.id || policy.code !== policyCode) {
    console.error('FAIL GET - Policy data mismatch');
    process.exit(1);
  }
  console.log('✅ PASS GET');
  console.log(`  Title: ${policy.title}`);

  // Step 5: List Standards (for mapping)
  console.log('\n[SMOKE] Listing standards for mapping...');
  const listStandards = await jsonFetch(`${BASE}/api/v2/standards`, {
    method: 'GET',
    headers,
  });

  if (listStandards.status !== 200) {
    console.warn('⚠️  WARN LIST STANDARDS', listStandards.status, listStandards.body);
  } else {
    const standards = Array.isArray(listStandards.body) ? listStandards.body : [];
    console.log('✅ PASS LIST STANDARDS');
    console.log(`  Found ${standards.length} standards`);

    // Step 6: Map Standard to Policy (if standards available)
    if (standards.length > 0) {
      const firstStandard = standards[0];
      console.log('\n[SMOKE] Mapping standard to policy...');
      const mapStandard = await jsonFetch(
        `${BASE}/api/v2/governance/policies/${createdPolicy.id}/standards`,
        {
          method: 'POST',
          body: JSON.stringify({ standardId: firstStandard.id }),
          headers,
        }
      );

      if (mapStandard.status !== 201 && mapStandard.status !== 200) {
        console.warn('⚠️  WARN MAP STANDARD', mapStandard.status, mapStandard.body);
      } else {
        console.log('✅ PASS MAP STANDARD');
        console.log(`  Mapped standard: ${firstStandard.code || firstStandard.name}`);

        // Step 7: Get Policy Standards
        console.log('\n[SMOKE] Getting policy standards...');
        const getPolicyStandards = await jsonFetch(
          `${BASE}/api/v2/governance/policies/${createdPolicy.id}/standards`,
          {
            method: 'GET',
            headers,
          }
        );

        if (getPolicyStandards.status !== 200) {
          console.warn('⚠️  WARN GET POLICY STANDARDS', getPolicyStandards.status, getPolicyStandards.body);
        } else {
          const mappings = Array.isArray(getPolicyStandards.body) ? getPolicyStandards.body : [];
          console.log('✅ PASS GET POLICY STANDARDS');
          console.log(`  Found ${mappings.length} standard mapping(s)`);
        }
      }
    }
  }

  // Step 8: Update Policy
  console.log('\n[SMOKE] Updating policy...');
  const updatePayload = {
    title: 'Updated Smoke Test Policy',
    status: 'approved',
  };

  const update = await jsonFetch(`${BASE}/api/v2/governance/policies/${createdPolicy.id}`, {
    method: 'PUT',
    body: JSON.stringify(updatePayload),
    headers,
  });

  if (update.status !== 200) {
    console.warn('⚠️  WARN UPDATE', update.status, update.body);
  } else {
    console.log('✅ PASS UPDATE');
    console.log(`  Updated title: ${update.body.title}`);
  }

  console.log('\n✅ All Policy smoke tests passed!');
  process.exitCode = 0;
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
```

### --- FILE: backend-nest/scripts/smoke-governance.ts ---

**Note:** `smoke:governance` script does not exist. It delegates to `smoke:policies` via `package.json`:

```json
"smoke:governance": "npm run smoke:policies"
```

### --- FILE: backend-nest/POLICY-NAME-CONSTRAINT-DIAGNOSIS.md ---

(Full file content - see above)

### --- FILE: backend-nest/POLICY-GOVERNANCE-SMOKE-FIX-FINAL-REPORT.md ---

(This file)

---

**Report Date:** 2025-11-25
**Status:** ✅ Code Complete, ⚠️ Backend Restart Required

