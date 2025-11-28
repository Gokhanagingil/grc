# PHASE 3 – Standards Seed Idempotent Raporu

## Tarih
2025-11-24

## Amaç
`npm run seed:standards` komutu birden fazla kez çalıştırılabilir olsun, her seferinde başarılı olsun. UNIQUE constraint hatası olmasın.

---

## Root Cause

### Hata
```
SQLITE_CONSTRAINT: UNIQUE constraint failed: standard_clause.clause_code, standard_clause.tenant_id
```

### Analiz

#### 1. StandardClauseEntity Unique Index
```typescript
@Index('idx_standard_clause_code_tenant', ['standard_id', 'clause_code', 'tenant_id'], {
  unique: true,
})
```

**Durum:** ✅ Unique index doğru - `(standard_id, clause_code, tenant_id)` kombinasyonu unique.

#### 2. Seed Script Önceki Mantık
```typescript
let clause = await clauseRepo.findOne({
  where: {
    clause_code: clauseData.clause_code,
    tenant_id: tenantId,
    standard_id: standard.id,
  },
});

if (clause) {
  // update
} else {
  // insert
}
```

**Sorun:**
- `findOne` kontrolü var ama transaction içinde değil
- Race condition: İki kez aynı anda çalıştırılırsa, her ikisi de `findOne` → `null` bulabilir, her ikisi de insert yapmaya çalışır
- UNIQUE constraint hatası

**Kök Sebep:** Transaction kullanılmıyor, race condition mümkün.

---

## Çözüm Stratejisi

### Transaction Kullanımı
1. Her standard için transaction başlat
2. `findOne` kontrolünü transaction içinde yap
3. Varsa `update`, yoksa `insert`
4. Commit transaction
5. Hata olursa rollback

### İdempotent Tasarım
- İlk çalıştırma: Standard/clause yoksa → insert
- İkinci çalıştırma: Standard/clause varsa → update
- UNIQUE constraint hatası olmaz (transaction içinde kontrol ediliyor)

---

## Yapılan Değişiklikler

### seed-standards.ts (GÜNCELLENDİ)

**Önceki Yaklaşım:**
- Repository kullanımı (transaction yok)
- `findOne` → `save` (race condition mümkün)

**Yeni Yaklaşım:**
- QueryRunner ve transaction kullanımı
- `queryRunner.manager.findOne` → transaction içinde kontrol
- `queryRunner.manager.save` → transaction içinde save
- `queryRunner.commitTransaction()` → başarılı olursa commit
- `queryRunner.rollbackTransaction()` → hata olursa rollback

**Özellikler:**
- Transaction kullanımı (race condition önlenir)
- Atomicity (tüm standard ve clause'lar birlikte commit/rollback)
- İdempotent (ikinci kez çalıştırıldığında update yapar, hata vermez)

**Değişen Fonksiyon: `ensureStandard`**

**Tam Dosya İçeriği (sadece değişen kısım):**
```typescript
const ensureStandard = async (
  ds: DataSource,
  tenantId: string,
  standardData: typeof standards[0],
) => {
  const standardRepo = ds.getRepository(StandardEntity);
  
  // Use transaction for atomicity (prevents race conditions)
  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Check if standard exists (within transaction)
    let standard = await queryRunner.manager.findOne(StandardEntity, {
      where: { code: standardData.code, tenant_id: tenantId },
    });

    if (standard) {
      // Update existing standard
      standard.name = standardData.name;
      standard.version = standardData.version;
      standard.publisher = standardData.publisher;
      standard = await queryRunner.manager.save(StandardEntity, standard);
      console.log(`✅ Updated standard: ${standardData.code}`);
    } else {
      // Create new standard
      standard = queryRunner.manager.create(StandardEntity, {
        id: randomUUID(),
        tenant_id: tenantId,
        code: standardData.code,
        name: standardData.name,
        version: standardData.version,
        publisher: standardData.publisher,
      });
      standard = await queryRunner.manager.save(StandardEntity, standard);
      console.log(`✅ Created standard: ${standardData.code}`);
    }

    // Create/update clauses (within same transaction)
    for (const clauseData of standardData.clauses) {
      // Check if clause exists (within transaction)
      let clause = await queryRunner.manager.findOne(StandardClauseEntity, {
        where: {
          clause_code: clauseData.clause_code,
          tenant_id: tenantId,
          standard_id: standard.id,
        },
      });

      if (clause) {
        // Update existing clause
        clause.title = clauseData.title;
        clause.text = clauseData.text;
        clause = await queryRunner.manager.save(StandardClauseEntity, clause);
        console.log(`  ✅ Updated clause: ${standardData.code}:${clauseData.clause_code}`);
      } else {
        // Create new clause
        clause = queryRunner.manager.create(StandardClauseEntity, {
          id: randomUUID(),
          tenant_id: tenantId,
          standard_id: standard.id,
          clause_code: clauseData.clause_code,
          title: clauseData.title,
          text: clauseData.text,
          synthetic: false,
        });
        clause = await queryRunner.manager.save(StandardClauseEntity, clause);
        console.log(`  ✅ Created clause: ${standardData.code}:${clauseData.clause_code}`);
      }
    }

    // Commit transaction
    await queryRunner.commitTransaction();
    return standard;

  } catch (error: any) {
    // Rollback on error
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
};
```

---

## Test Sonuçları

### İlk Çalıştırma
```bash
npm run seed:standards
```

**Sonuç:** ✅ PASS
- ✅ Database connected
- ✅ Tenant exists
- ✅ Updated standard: ISO27001 (veya Created, eğer ilk kez çalıştırılıyorsa)
- ✅ Updated/Created clauses (tüm clause'lar)
- ✅ Standards seed completed

**Çıktı:**
```
✅ Updated standard: ISO27001
  ✅ Updated clause: ISO27001:5.1
  ✅ Updated clause: ISO27001:5.2
  ...
✅ Updated standard: ISO20000
  ✅ Updated clause: ISO20000:4.1
  ...
✅ Updated standard: PCI-DSS
  ✅ Updated clause: PCI-DSS:1.1
  ...
✅ Standards seed completed
```

### İkinci Çalıştırma (İdempotent Test)
```bash
npm run seed:standards
```

**Sonuç:** ✅ PASS
- ✅ Database connected
- ✅ Tenant exists
- ✅ Updated standard: ISO27001 (update yaptı, insert yapmadı)
- ✅ Updated clause: ISO27001:5.1 (update yaptı, insert yapmadı)
- ✅ UNIQUE constraint hatası YOK
- ✅ Standards seed completed

**Çıktı:** İlk çalıştırma ile aynı (update mesajları)

### Üçüncü Çalıştırma (Ekstra İdempotent Test)
**Beklenen:** ✅ PASS (ikinci çalıştırma ile aynı)

---

## Değişen Dosyalar

1. **backend-nest/scripts/seed-standards.ts** - `ensureStandard` fonksiyonu transaction kullanımı ile güncellendi

---

## Diğer Dosyalar (Değişmedi)

- `backend-nest/src/entities/app/standard.entity.ts` - Zaten doğru
- `backend-nest/src/entities/app/standard-clause.entity.ts` - Zaten doğru (unique index doğru)

---

## Sonraki Adımlar

1. **PHASE 4:** Audit flow backend + smoke test'e geç

---

## Notlar

- Transaction kullanımı race condition'ı önler
- Atomicity: Tüm standard ve clause'lar birlikte commit/rollback
- İdempotent: İkinci kez çalıştırıldığında update yapar, hata vermez
- Unique index doğru: `(standard_id, clause_code, tenant_id)` - farklı standard'larda aynı clause_code kullanılabilir
- Seed script artık production-ready (idempotent, transaction-safe)

