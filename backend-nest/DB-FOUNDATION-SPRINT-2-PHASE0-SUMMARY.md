# DB FOUNDATION SPRINT 2 - PHASE 0: Mevcut Durum Snapshot

**Tarih:** 2025-01-26  
**Amaç:** Mevcut migration ve DB yapısını analiz etmek (read-only)

---

## 1. Mevcut Durum Özeti

### 1.1 Migration Klasörü Durumu

**Konum:** `backend-nest/src/migrations/`

**Mevcut Migration Dosyaları:**
- ✅ `1700000000000_bootstrap_db.ts` - Postgres için temel şema (auth, tenant, app, audit, comms)
- ✅ `1730000005000_DataFoundations_Squashed.ts` - App şeması tabloları (risk_category, standard, policies, vb.)
- ✅ `1730000005100_AddSyntheticFlags.ts`
- ✅ `1730000005200_MoveTablesToPublic.ts` - App şemasından public şemasına taşıma
- ✅ `1730000005300_AddPolicyContent.ts` - Policies tablosuna content kolonu ekleme
- ✅ `1731000000000_AddRiskInstanceAndCatalogFields.ts`
- ✅ `1731000000100_AddControlEffectiveness.ts`
- ✅ `1731000000200_AddPolicyComplianceRelations.ts`
- ✅ `1732000000000_CreateEntityRegistry.ts`
- ✅ `1733000000000_CreateAuditLifecycle.ts`
- ✅ `1734000000000_CreateBCMAndAuditRefinements.ts`
- ✅ `1735000000000_FixAuditLogsSchema.ts`

**Arşivlenmiş Migration'lar:** `_archive/` klasöründe eski migration'lar var

**Toplam Aktif Migration:** 12 adet

### 1.2 Migration Yapısı Analizi

**Postgres Odaklı:**
- Tüm migration'lar Postgres syntax kullanıyor
- Schema prefix'leri var (`app.`, `auth.`, `tenant.`, `audit.`, `comms.`)
- Postgres extension'ları kullanılıyor (`pgcrypto`, `uuid-ossp`, `citext`, `ltree`)
- `TIMESTAMPTZ`, `UUID`, `CITEXT`, `JSONB` gibi Postgres-specific tipler var

**SQLite Uyumluluğu:**
- ❌ SQLite için özel migration yok
- ❌ SQLite'da schema prefix'leri çalışmaz
- ❌ SQLite'da extension'lar yok
- ⚠️ Mevcut migration'lar SQLite'da çalışmaz

### 1.3 Database Config Durumu

**Dosya:** `backend-nest/src/config/database.config.ts`

**Mevcut Davranış:**
- **SQLite (Dev):**
  - `synchronize: true` (dev ortamında)
  - `synchronize: false` (prod ortamında)
  - `migrationsRun: false` (migration'lar otomatik çalışmıyor)
  - Migration path: `src/migrations/*.ts` (dev) veya `dist/migrations/*.js` (prod)

- **Postgres:**
  - `synchronize: false` (her zaman)
  - `migrationsRun: false` (manuel çalıştırma gerekiyor)
  - Migration path: Aynı (dev/prod ayrımı var)

**Kritik Gözlem:**
- SQLite dev ortamında `synchronize: true` olduğu için entity'lerden otomatik tablo oluşturuluyor
- Postgres için migration-first yaklaşım var ama SQLite için yok
- İki farklı yaklaşım tutarsızlık yaratıyor

### 1.4 Entity Sayısı

**Toplam Entity Dosyası:** 44 adet

**Kategoriler:**
- `entities/app/` - 20+ entity (policies, standards, risks, audit, bcm, vb.)
- `entities/auth/` - 5 entity (users, roles, permissions, vb.)
- `entities/tenant/` - 1 entity
- `entities/audit/` - 1 entity
- `entities/queue/` - 2 entity
- `modules/*/` - Legacy entity'ler (policy, governance, risk, vb.)

### 1.5 Data Source Yapısı

**Dosya:** `backend-nest/src/data-source.ts`

- TypeORM CLI için DataSource export ediliyor
- `dbConfigFactory()` kullanılıyor
- Migration script'leri için hazır

---

## 2. Migration Script'leri Durumu

**package.json içinde:**
- ✅ `migration:generate` - Migration oluşturma
- ✅ `migration:create` - Boş migration oluşturma
- ✅ `migration:run` - Migration çalıştırma
- ✅ `migration:revert` - Migration geri alma
- ✅ `migration:show` - Migration durumu gösterme

**Data Source:** `src/data-source.ts` üzerinden çalışıyor

---

## 3. Tespit Edilen Sorunlar

### 3.1 SQLite Migration Eksikliği

**Sorun:**
- Mevcut migration'lar sadece Postgres için
- SQLite'da `synchronize: true` ile çalışıyor
- Migration-first yaklaşım SQLite'da yok

**Etki:**
- SQLite'dan Postgres'e geçişte migration'lar test edilemiyor
- SQLite dev ortamında schema değişiklikleri versionlanmıyor

### 3.2 Schema Prefix Uyumsuzluğu

**Sorun:**
- Postgres migration'ları `app.`, `auth.` gibi schema prefix'leri kullanıyor
- SQLite'da schema prefix'leri yok (tüm tablolar `public` gibi davranıyor)
- Entity'lerde schema prefix belirtilmemiş (TypeORM otomatik yönetiyor)

**Etki:**
- Aynı migration hem SQLite hem Postgres'te çalışamaz
- Baseline migration oluştururken dikkatli olmak gerekiyor

### 3.3 Synchronize vs Migration Tutarsızlığı

**Sorun:**
- Postgres: Migration-first (`synchronize: false`)
- SQLite Dev: Synchronize-first (`synchronize: true`)
- SQLite Prod: Migration-first (`synchronize: false`) ama migration'lar SQLite için hazır değil

**Etki:**
- İki farklı yaklaşım, tutarsızlık riski
- Dev ortamında schema değişiklikleri versionlanmıyor

---

## 4. Mevcut Yardımcı Script'ler

### 4.1 Schema Check Script'leri

- ✅ `scripts/check-sqlite-schema.ts` - SQLite schema kontrolü
- ✅ `scripts/phase0-db-snapshot.ts` - Entity vs DB karşılaştırması
- ✅ `scripts/check-db-schema.ts` - Genel schema kontrolü

### 4.2 Diğer Script'ler

- ✅ `scripts/fix-policy-schema.ts` - Policy schema düzeltme (idempotent)
- ✅ `scripts/reset-db.ts` - DB reset (manuel)

---

## 5. PHASE 0 Sonuçları

### 5.1 Mevcut Durum

✅ **Migration yapısı var:**
- 12 aktif migration dosyası
- TypeORM migration script'leri hazır
- Data source yapılandırması tamam

⚠️ **SQLite uyumluluğu eksik:**
- Migration'lar sadece Postgres için
- SQLite için migration-first yaklaşım yok

⚠️ **Synchronize davranışı:**
- Dev ortamında `synchronize: true` (otomatik tablo oluşturma)
- Prod ortamında `synchronize: false` (migration gerekli)

### 5.2 Risk Noktaları

1. **SQLite Migration Eksikliği:**
   - SQLite'da migration-first'e geçiş için baseline migration gerekli
   - Mevcut migration'lar SQLite'da çalışmaz

2. **Schema Prefix Uyumsuzluğu:**
   - Postgres migration'ları schema prefix kullanıyor
   - SQLite'da prefix'ler çalışmaz, baseline migration'da dikkatli olmak gerekiyor

3. **Entity vs Migration Tutarlılığı:**
   - Entity'ler ile migration'lar arasında uyum kontrolü gerekli
   - Özellikle SQLite'da `synchronize: true` ile oluşan tablolar ile migration'lar arasında fark olabilir

### 5.3 Sonraki Adımlar (PHASE 1)

1. Migration stratejisini netleştirme
2. Baseline migration için planlama
3. SQLite uyumlu migration yaklaşımı belirleme
4. DB_STRATEGY flag'i ekleme (legacy-sync vs migration-dev)

---

## 6. Dosyalar (Read-Only Analiz)

**Okunan Dosyalar:**
- ✅ `backend-nest/src/config/database.config.ts`
- ✅ `backend-nest/src/data-source.ts`
- ✅ `backend-nest/package.json`
- ✅ `backend-nest/src/migrations/*.ts` (12 dosya)
- ✅ `backend-nest/DB-FOUNDATION-SPRINT-1-REPORT.md`
- ✅ `backend-nest/DB-FOUNDATION-PHASE0-SNAPSHOT.md`
- ✅ `backend-nest/scripts/phase0-db-snapshot.ts`
- ✅ `backend-nest/scripts/check-sqlite-schema.ts`

**Değişiklik Yapılan Dosya:** ❌ Yok (read-only analiz)

---

**PHASE 0 Durumu:** ✅ Tamamlandı  
**Sonraki Faz:** PHASE 1 - Migration Stratejisini Netleştirme

