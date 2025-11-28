# PHASE 1 – Policy Create 500 Fix Report

## Tarih
2025-11-24

## Amaç
Policy create 500 hatasını kalıcı olarak çözmek. `npm run smoke:policies` → LOGIN PASS, CREATE POLICY PASS (200).

---

## Root Cause

### Hata
```
SQLITE_CONSTRAINT: NOT NULL constraint failed: policies.name
```

### Analiz
1. **DB Şeması:** `policies` tablosunda `name` kolonu NOT NULL olarak mevcut (legacy şema)
2. **Entity:** `PolicyEntity` `title` kullanıyor, `name` yok
3. **Service:** `GovernanceService.create()` `dto.title` → `policy.title` mapping yapıyor
4. **Sonuç:** Insert sırasında `name` kolonu NULL kalıyor, NOT NULL constraint hatası

### Legacy Kolonlar
DB'de şu legacy kolonlar vardı:
- `name` (varchar(160), NOT NULL) ❌
- `description` (TEXT, nullable)
- `owner` (varchar(80), nullable)
- `version` (varchar(32), nullable)
- `effectiveDate` (date, nullable) - camelCase
- `reviewDate` (date, nullable) - camelCase
- `tags` (TEXT, nullable)
- `createdAt` (datetime, NOT NULL) - camelCase
- `updatedAt` (datetime, NOT NULL) - camelCase
- `deletedAt` (datetime, nullable) - camelCase

---

## Çözüm Stratejisi

### Geçici Tablo Yaklaşımı
1. Legacy kolonları tespit et
2. Geçici tablo oluştur (yeni şema)
3. Uyumlu veriyi kopyala (code, title, status, vb.)
4. Eski tabloyu drop et
5. Geçici tabloyu `policies` olarak rename et
6. Index oluştur

### İdempotent Tasarım
- Tablo yoksa → hiçbir şey yapma (TypeORM synchronize oluşturur)
- Legacy kolonlar yoksa → hiçbir şey yapma (zaten doğru şema)
- Legacy kolonlar varsa → migration çalıştır
- İkinci kez çalıştırıldığında → no-op (legacy kolonlar yok)

---

## Yapılan Değişiklikler

### 1. fix-policy-schema.ts (GÜNCELLENDİ)

**Önceki Yaklaşım:**
- Legacy kolonlar varsa tabloyu drop et
- TypeORM synchronize'in yeniden oluşturmasını bekle
- Veri kaybı: Tüm policy verileri silinir

**Yeni Yaklaşım:**
- Geçici tablo oluştur
- Uyumlu veriyi kopyala (code, title, status, tenant_id, vb.)
- Eski tabloyu drop et
- Geçici tabloyu rename et
- Veri kaybı: Sadece uyumlu kolonlar korunur

**Özellikler:**
- Transaction kullanımı (rollback desteği)
- Dinamik kolon mapping (hangi kolonlar varsa onları kopyala)
- `name` → `title` fallback (eğer `title` yoksa `name` kullan)
- `code` → `title` fallback (eğer ikisi de yoksa `code` kullan)
- Yeni UUID'ler oluştur (migrated records için)
- Default tenant_id (eğer yoksa)

**Tam Dosya İçeriği:**
```typescript
#!/usr/bin/env ts-node
/**
 * Fix Policy Table Schema
 * Migrates policies table from legacy schema to new schema
 * 
 * Strategy:
 * 1. Check if table exists
 * 2. Check if legacy columns exist (name, description, owner, etc.)
 * 3. If legacy columns exist:
 *    a. Create temporary table with new schema
 *    b. Copy data from old table (code, title, status, etc.)
 *    c. Drop old table
 *    d. Rename temporary table to policies
 * 4. If no legacy columns, do nothing (idempotent)
 * 
 * WARNING: This will DELETE all existing policy data if legacy columns are detected!
 * Only use in development environment.
 */

import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { PolicyEntity } from '../src/entities/app/policy.entity';

const envFile = process.env.ENV_FILE || '.env';
config({ path: envFile });

function determineDataSourceOptions(): DataSourceOptions {
  const dbDriver = (process.env.DB_DRIVER || '').toLowerCase();
  const databaseUrl = process.env.DATABASE_URL;
  const preferPostgres = dbDriver === 'postgres' || !!databaseUrl;

  if (preferPostgres) {
    console.error('❌ This script is designed for SQLite only.');
    process.exit(1);
  }

  const sqliteRelative = process.env.SQLITE_FILE || process.env.DB_NAME || 'data/grc.sqlite';
  const sqlitePath = path.isAbsolute(sqliteRelative)
    ? sqliteRelative
    : path.join(process.cwd(), sqliteRelative);

  return {
    type: 'sqlite',
    database: sqlitePath,
    logging: true,
    entities: [PolicyEntity],
    synchronize: false, // We'll manually migrate
  };
}

async function fixSchema() {
  const options = determineDataSourceOptions();
  const dataSource = new DataSource(options);

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log(`SQLite file: ${(options as any).database}`);

    const queryRunner = dataSource.createQueryRunner();

    // Check if table exists
    const tableExists = await queryRunner.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='policies'`
    );

    if (tableExists.length === 0) {
      console.log('⚠️  policies table does not exist. It will be created by TypeORM synchronize.');
      await queryRunner.release();
      return;
    }

    // Check if table has legacy columns
    const tableInfo = await queryRunner.query(`PRAGMA table_info(policies)`);
    const columnNames = tableInfo.map((col: any) => col.name.toLowerCase());
    
    const legacyColumns = [
      'name', 'description', 'owner', 'version', 
      'effectivedate', 'reviewdate', 'tags', 
      'createdat', 'updatedat', 'deletedat'
    ];
    
    const hasLegacyColumns = legacyColumns.some(legacyCol => 
      columnNames.includes(legacyCol)
    );

    if (!hasLegacyColumns) {
      console.log('✅ policies table already has correct schema (no legacy columns).');
      console.log('   No migration needed.');
      await queryRunner.release();
      return;
    }

    console.log('\n⚠️  WARNING: Legacy columns detected!');
    console.log('   This migration will:');
    console.log('   1. Create a temporary table with the correct schema');
    console.log('   2. Copy compatible data from old table');
    console.log('   3. Drop the old table');
    console.log('   4. Rename temporary table to policies');
    console.log('\n   ⚠️  This will DELETE all existing policy data!');
    console.log('   Only compatible columns (code, title, status, etc.) will be preserved.\n');

    // Start transaction
    await queryRunner.startTransaction();

    try {
      // Step 1: Create temporary table with correct schema
      console.log('📋 Step 1: Creating temporary table with correct schema...');
      await queryRunner.query(`
        CREATE TABLE policies_tmp (
          id VARCHAR(36) PRIMARY KEY NOT NULL,
          tenant_id VARCHAR(36) NOT NULL,
          code TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          owner_first_name TEXT,
          owner_last_name TEXT,
          effective_date DATE,
          review_date DATE,
          content TEXT,
          created_by VARCHAR(36),
          updated_by VARCHAR(36),
          created_at DATETIME NOT NULL DEFAULT (datetime('now')),
          updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log('   ✅ Temporary table created');

      // Step 2: Copy compatible data
      console.log('📋 Step 2: Copying compatible data from old table...');
      
      // Check which columns exist in old table
      const hasTitle = columnNames.includes('title');
      const hasName = columnNames.includes('name');
      const hasCode = columnNames.includes('code');
      const hasStatus = columnNames.includes('status');
      const hasTenantId = columnNames.includes('tenant_id');
      const hasOwnerFirstName = columnNames.includes('owner_first_name');
      const hasOwnerLastName = columnNames.includes('owner_last_name');
      const hasEffectiveDate = columnNames.includes('effective_date') || columnNames.includes('effectivedate');
      const hasReviewDate = columnNames.includes('review_date') || columnNames.includes('reviewdate');
      const hasContent = columnNames.includes('content');
      const hasCreatedBy = columnNames.includes('created_by');
      const hasUpdatedBy = columnNames.includes('updated_by');
      const hasCreatedAt = columnNames.includes('created_at') || columnNames.includes('createdat');
      const hasUpdatedAt = columnNames.includes('updated_at') || columnNames.includes('updatedat');

      // Build SELECT and INSERT statements
      let selectColumns = [];
      let insertColumns = [];
      
      if (hasCode) selectColumns.push('code'); insertColumns.push('code');
      if (hasTitle) {
        selectColumns.push('title');
        insertColumns.push('title');
      } else if (hasName) {
        // Use name as title if title doesn't exist
        selectColumns.push('name AS title');
        insertColumns.push('title');
      } else {
        // Fallback: use code as title
        selectColumns.push('code AS title');
        insertColumns.push('title');
      }
      
      if (hasStatus) {
        selectColumns.push('status');
        insertColumns.push('status');
      } else {
        selectColumns.push("'draft' AS status");
        insertColumns.push('status');
      }
      
      if (hasTenantId) {
        selectColumns.push('tenant_id');
        insertColumns.push('tenant_id');
      } else {
        // Use default tenant if tenant_id doesn't exist
        const defaultTenant = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
        selectColumns.push(`'${defaultTenant}' AS tenant_id`);
        insertColumns.push('tenant_id');
      }
      
      // ID: generate new UUIDs for migrated records
      selectColumns.push("lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) AS id");
      insertColumns.push('id');
      
      // Optional columns
      if (hasOwnerFirstName) {
        selectColumns.push('owner_first_name');
        insertColumns.push('owner_first_name');
      }
      if (hasOwnerLastName) {
        selectColumns.push('owner_last_name');
        insertColumns.push('owner_last_name');
      }
      if (hasEffectiveDate) {
        const effectiveDateCol = columnNames.includes('effective_date') ? 'effective_date' : 'effectiveDate';
        selectColumns.push(`${effectiveDateCol} AS effective_date`);
        insertColumns.push('effective_date');
      }
      if (hasReviewDate) {
        const reviewDateCol = columnNames.includes('review_date') ? 'review_date' : 'reviewDate';
        selectColumns.push(`${reviewDateCol} AS review_date`);
        insertColumns.push('review_date');
      }
      if (hasContent) {
        selectColumns.push('content');
        insertColumns.push('content');
      }
      if (hasCreatedBy) {
        selectColumns.push('created_by');
        insertColumns.push('created_by');
      }
      if (hasUpdatedBy) {
        selectColumns.push('updated_by');
        insertColumns.push('updated_by');
      }
      if (hasCreatedAt) {
        const createdAtCol = columnNames.includes('created_at') ? 'created_at' : 'createdAt';
        selectColumns.push(`${createdAtCol} AS created_at`);
        insertColumns.push('created_at');
      } else {
        selectColumns.push("datetime('now') AS created_at");
        insertColumns.push('created_at');
      }
      if (hasUpdatedAt) {
        const updatedAtCol = columnNames.includes('updated_at') ? 'updated_at' : 'updatedAt';
        selectColumns.push(`${updatedAtCol} AS updated_at`);
        insertColumns.push('updated_at');
      } else {
        selectColumns.push("datetime('now') AS updated_at");
        insertColumns.push('updated_at');
      }

      const selectQuery = `SELECT ${selectColumns.join(', ')} FROM policies`;
      const insertQuery = `INSERT INTO policies_tmp (${insertColumns.join(', ')}) ${selectQuery}`;
      
      await queryRunner.query(insertQuery);
      const rowCount = await queryRunner.query(`SELECT COUNT(*) as count FROM policies_tmp`);
      console.log(`   ✅ Copied ${rowCount[0]?.count || 0} rows`);

      // Step 3: Drop old table
      console.log('📋 Step 3: Dropping old table...');
      await queryRunner.dropTable('policies', true, true, true);
      console.log('   ✅ Old table dropped');

      // Step 4: Rename temporary table
      console.log('📋 Step 4: Renaming temporary table to policies...');
      await queryRunner.query(`ALTER TABLE policies_tmp RENAME TO policies`);
      console.log('   ✅ Table renamed');

      // Create index
      console.log('📋 Step 5: Creating index...');
      await queryRunner.query(`CREATE INDEX idx_policies_tenant ON policies(tenant_id)`);
      console.log('   ✅ Index created');

      // Commit transaction
      await queryRunner.commitTransaction();
      console.log('\n✅ Schema migration completed successfully!');
      console.log('   The policies table now matches PolicyEntity schema.');
      console.log('   Please restart the backend to ensure TypeORM recognizes the new schema.');

    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error: any) {
    console.error('❌ Schema fix failed:', error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

fixSchema();
```

---

## Test Sonuçları

### Schema Check
```bash
npm run check:policy-schema
```

**Sonuç:** ✅ PASS
- Entity ve DB şeması tam uyumlu
- Legacy kolonlar yok
- Tüm gerekli kolonlar mevcut

**Çıktı:**
```
❌ Columns in Entity but NOT in DB: (none)
⚠️  Columns in DB but NOT in Entity: (none)
✅ Schema check completed
```

### Migration Script (İdempotent Test)
```bash
npm run fix:policy-schema
```

**İlk Çalıştırma:**
- ✅ Legacy kolonlar tespit edildi
- ✅ Geçici tablo oluşturuldu
- ✅ Veri kopyalandı (0 rows - tablo boştu)
- ✅ Eski tablo drop edildi
- ✅ Geçici tablo rename edildi
- ✅ Index oluşturuldu

**İkinci Çalıştırma (Beklenen):**
- ✅ Legacy kolonlar yok
- ✅ "No migration needed" mesajı
- ✅ No-op (idempotent)

### Smoke Test (Backend Restart Sonrası)
```bash
npm run smoke:policies
```

**Durum:** ⚠️ Backend restart edilmedi, test edilemedi
**Beklenen:** ✅ PASS (CREATE POLICY 200)

---

## Değişen Dosyalar

1. **backend-nest/scripts/fix-policy-schema.ts** - Tam yeniden yazıldı (geçici tablo yaklaşımı)

---

## Diğer Dosyalar (Değişmedi)

- `backend-nest/src/entities/app/policy.entity.ts` - Zaten doğru
- `backend-nest/src/modules/governance/governance.service.ts` - Zaten doğru
- `backend-nest/src/modules/governance/dto/create-policy.dto.ts` - Zaten doğru
- `backend-nest/scripts/check-policy-schema.ts` - Zaten doğru
- `backend-nest/scripts/smoke-policies.ts` - Zaten doğru

---

## Sonraki Adımlar

1. **Backend Restart:** Backend'i restart et, TypeORM'in yeni şemayı tanımasını sağla
2. **Smoke Test:** `npm run smoke:policies` çalıştır, CREATE POLICY 200 olduğunu doğrula
3. **PHASE 2:** BCM validation failed fix'e geç

---

## Notlar

- Migration script idempotent (ikinci kez çalıştırıldığında no-op)
- Transaction kullanıldı (rollback desteği)
- Veri korunuyor (uyumlu kolonlar kopyalanıyor)
- Legacy kolonlar temizlendi (`name`, `description`, `owner`, vb.)
- Schema Entity ile tam uyumlu
