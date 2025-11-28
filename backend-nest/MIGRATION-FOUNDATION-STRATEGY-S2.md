# Migration Foundation Strategy - Sprint 2

**Tarih:** 2025-01-26  
**Sprint:** DB FOUNDATION - SPRINT 2  
**Amaç:** Migration-first mimariye geçiş stratejisi ve yol haritası

---

## 1. Şu Anki Durum (Sprint 2 Başlangıcı)

### 1.1 Mevcut Migration Yapısı

**Migration Dosyaları:**
- **Konum:** `backend-nest/src/migrations/`
- **Toplam:** 12 aktif migration dosyası
- **Format:** TypeORM MigrationInterface implementasyonu
- **İsimlendirme:** Timestamp-based (örn. `1700000000000_bootstrap_db.ts`)

**Mevcut Migration'lar:**
1. `1700000000000_bootstrap_db.ts` - Temel şema (auth, tenant, app, audit, comms)
2. `1730000005000_DataFoundations_Squashed.ts` - App şeması tabloları
3. `1730000005100_AddSyntheticFlags.ts`
4. `1730000005200_MoveTablesToPublic.ts` - Schema taşıma
5. `1730000005300_AddPolicyContent.ts`
6. `1731000000000_AddRiskInstanceAndCatalogFields.ts`
7. `1731000000100_AddControlEffectiveness.ts`
8. `1731000000200_AddPolicyComplianceRelations.ts`
9. `1732000000000_CreateEntityRegistry.ts`
10. `1733000000000_CreateAuditLifecycle.ts`
11. `1734000000000_CreateBCMAndAuditRefinements.ts`
12. `1735000000000_FixAuditLogsSchema.ts`

### 1.2 Database Config Durumu

**Dosya:** `backend-nest/src/config/database.config.ts`

**Mevcut Davranış:**

**SQLite (Dev):**
- `synchronize: true` (dev ortamında)
- `synchronize: false` (prod ortamında)
- `migrationsRun: false` (migration'lar otomatik çalışmıyor)
- Migration path: `src/migrations/*.ts` (dev) veya `dist/migrations/*.js` (prod)

**Postgres:**
- `synchronize: false` (her zaman)
- `migrationsRun: false` (manuel çalıştırma gerekiyor)
- Migration path: Aynı (dev/prod ayrımı var)

**Kritik Gözlem:**
- SQLite dev ortamında `synchronize: true` olduğu için entity'lerden otomatik tablo oluşturuluyor
- Postgres için migration-first yaklaşım var ama SQLite için yok
- İki farklı yaklaşım tutarsızlık yaratıyor

### 1.3 Migration Script'leri

**package.json içinde:**
- ✅ `migration:generate` - Migration oluşturma (TypeORM CLI)
- ✅ `migration:create` - Boş migration oluşturma
- ✅ `migration:run` - Migration çalıştırma
- ✅ `migration:revert` - Migration geri alma
- ✅ `migration:show` - Migration durumu gösterme

**Data Source:** `src/data-source.ts` üzerinden çalışıyor

---

## 2. Hedef Durum (Migration-First)

### 2.1 Migration-First Prensipleri

1. **Tüm Schema Değişiklikleri Migration ile:**
   - Entity değişiklikleri → Migration oluştur
   - Tablo ekleme/değiştirme → Migration ile
   - Index/constraint ekleme → Migration ile

2. **Synchronize Kapatılacak:**
   - Dev ortamında da `synchronize: false`
   - Tüm ortamlarda migration-first yaklaşım

3. **SQLite ve Postgres Uyumluluğu:**
   - Baseline migration hem SQLite hem Postgres'te çalışmalı
   - DB-agnostic SQL kullanımı (mümkün olduğunca)
   - DB-specific kısımlar için conditional logic

4. **Versioning:**
   - Tüm schema değişiklikleri versionlanmış olacak
   - Rollback mümkün olacak
   - Migration history takip edilecek

### 2.2 Migration Dosya Yapısı

**Kaynak Dosyalar:**
- `backend-nest/src/migrations/` - TypeScript migration dosyaları
- İsimlendirme: `YYYYMMDDHHMM-description.ts` (deterministik, açıklayıcı)

**Build Edilmiş Dosyalar:**
- `backend-nest/dist/migrations/` - JavaScript migration dosyaları
- Build sonrası otomatik oluşur

**Baseline Migration:**
- `20250126000000-baseline-grc-schema.ts` - Mevcut şemayı resmileştiren migration
- Tüm core tabloları içerir
- Hem SQLite hem Postgres'te çalışır

### 2.3 Database Config Hedef Yapısı

**DB_STRATEGY Flag'i:**
- `legacy-sync` (varsayılan, Sprint 2'de): SQLite dev'de `synchronize: true`
- `migration-dev` (gelecek sprint): Dev'de de migration-first
- `migration-prod` (prod): Her zaman migration-first

**Sprint 2'de:**
- Varsayılan: `legacy-sync` (mevcut davranış korunur)
- Config hazırlığı yapılır ama aktif edilmez

---

## 3. Bu Sprintte Yapılacaklar (Sprint 2)

### 3.1 Baseline Migration Oluşturma

**Amaç:** Mevcut SQLite şemasını migration dosyası ile resmileştirmek

**Yaklaşım:**
1. Mevcut SQLite şemasını analiz et (entity'lerden + mevcut tablolardan)
2. Baseline migration oluştur:
   - Tüm core tablolar (tenant, user, roles, permissions, governance, risk, audit, bcm, calendar, queue, vb.)
   - İlgili index'ler ve foreign key'ler
   - DB-agnostic SQL (hem SQLite hem Postgres'te çalışır)

3. Migration test et:
   - Boş bir SQLite DB'de çalıştır
   - Tablolar düzgün oluşuyor mu kontrol et
   - Entity'lerle uyumlu mu kontrol et

**Dikkat:**
- Mevcut dev SQLite dosyasını zorla migrate etme
- Sadece yeni DB'ler için baseline migration kullanılacak
- Mevcut dev DB synchronize ile yaşamaya devam edecek

### 3.2 Migration Path'lerini Netleştirme

**Dev Ortamı:**
- Migration path: `src/migrations/*.ts` (TypeScript)
- TypeORM doğrudan TS dosyalarını okuyabilir (ts-node ile)

**Prod Ortamı:**
- Migration path: `dist/migrations/*.js` (JavaScript)
- Build sonrası JS dosyaları kullanılır

**Config'de:**
- `isDev` flag'i ile path'ler otomatik belirleniyor
- Mevcut yapı zaten doğru, sadece dokümante edilecek

### 3.3 DB_STRATEGY Flag Hazırlığı

**Config'e Eklenecek (Aktif Edilmeyecek):**
```typescript
const dbStrategy = process.env.DB_STRATEGY || 'legacy-sync';

// SQLite dev için:
if (dbStrategy === 'migration-dev') {
  synchronize: false;  // Migration-first
} else {
  synchronize: isProd ? false : true;  // Mevcut davranış
}
```

**Sprint 2'de:**
- Flag eklenir ama varsayılan `legacy-sync` kalır
- Gelecek sprint'te `migration-dev`'e geçiş yapılabilir

### 3.4 Postgres Dry-Run Hazırlığı

**Script Oluşturulacak:**
- `backend-nest/scripts/postgres-dryrun.ts`
- Postgres'e bağlanır, migration'ları çalıştırır
- Başarı/hata raporlar

**Dokümantasyon:**
- `POSTGRES-DRYRUN-PLAYBOOK-S2.md`
- Lokal Postgres setup
- Env değişkenleri
- Troubleshooting

---

## 4. Gelecek Sprintler

### 4.1 Sprint 3: Dev Ortamı Migration-First'e Geçiş

**Hedef:**
- `DB_STRATEGY=migration-dev` ile dev ortamında migration-first
- `synchronize: false` dev ortamında
- Mevcut dev SQLite dosyasını migration'a align etme (kontrollü)

**Adımlar:**
1. Baseline migration'ı mevcut dev DB'ye uygula (kontrollü, manuel)
2. `DB_STRATEGY=migration-dev` ile test et
3. Tüm smoke test'lerin geçtiğini doğrula
4. Varsayılan olarak `migration-dev`'e geç

### 4.2 Sprint 4: Postgres Cutover (Stage/Prod)

**Hedef:**
- Gerçek Postgres ortamına geçiş
- Migration'ların stage/prod'da çalıştığını doğrula
- Multi-env strategy (dev/stage/prod)

**Adımlar:**
1. Stage ortamında Postgres test et
2. Prod ortamında Postgres cutover planı
3. Rollback stratejisi hazırla
4. Monitoring ve alerting ekle

### 4.3 Sprint 5+: Multi-Env ve İyileştirmeler

**Hedef:**
- Multi-env migration stratejisi
- Auto-generation from entity changes
- Comprehensive testing
- CI/CD integration

---

## 5. Migration İsimlendirme Konvansiyonu

### 5.1 Timestamp Format

**Format:** `YYYYMMDDHHMM-description.ts`

**Örnekler:**
- `20250126000000-baseline-grc-schema.ts`
- `20250126120000-add-user-preferences.ts`
- `20250126150000-fix-policy-constraints.ts`

**Neden:**
- Deterministik sıralama
- Açıklayıcı isimler
- Kolay takip

### 5.2 Migration İçeriği

**up() Fonksiyonu:**
- Schema değişikliklerini uygular
- DB-agnostic SQL kullan (mümkün olduğunca)
- Conditional logic ile DB-specific kısımlar

**down() Fonksiyonu:**
- Rollback için gerekli değişiklikler
- Minimal ama anlamlı
- Test edilebilir olmalı

---

## 6. Riskler ve Mitigasyon

### 6.1 SQLite vs Postgres Uyumsuzluğu

**Risk:**
- Postgres migration'ları SQLite'da çalışmayabilir
- Schema prefix'leri, extension'lar, data type'lar farklı

**Mitigasyon:**
- Baseline migration DB-agnostic yazılacak
- DB-specific kısımlar için conditional logic
- Her iki DB'de test edilecek

### 6.2 Mevcut Dev DB'yi Bozma Riski

**Risk:**
- Mevcut dev SQLite dosyasına migration uygulanırsa veri kaybı olabilir

**Mitigasyon:**
- Sprint 2'de mevcut dev DB'ye dokunulmayacak
- Sadece yeni DB'ler için baseline migration kullanılacak
- Gelecek sprint'te kontrollü align işlemi yapılacak

### 6.3 Entity vs Migration Tutarsızlığı

**Risk:**
- Entity'ler ile migration'lar arasında uyumsuzluk olabilir

**Mitigasyon:**
- Baseline migration entity'lerden oluşturulacak
- Schema check script'leri ile doğrulama
- Smoke test'ler ile uyumluluk kontrolü

---

## 7. Başarı Kriterleri (Sprint 2)

### 7.1 Teknik Kriterler

✅ **Baseline Migration Oluşturuldu:**
- Tüm core tabloları içeriyor
- Hem SQLite hem Postgres'te çalışıyor
- Entity'lerle uyumlu

✅ **Migration Path'leri Netleştirildi:**
- Dev/prod path'leri doğru
- TypeORM migration script'leri çalışıyor

✅ **DB_STRATEGY Flag Hazırlığı:**
- Config'e eklendi (aktif edilmedi)
- Gelecek sprint'te kullanıma hazır

✅ **Postgres Dry-Run Hazırlığı:**
- Script oluşturuldu
- Dokümantasyon hazır

### 7.2 Regression Kriterleri

✅ **Mevcut Sistem Bozulmadı:**
- `npm run build:once` ✅
- `npm run start:dev` ✅ (SQLite ile)
- `npm run smoke:all` → 8/8 PASS ✅

✅ **Mevcut Dev DB Korundu:**
- Mevcut SQLite dosyasına dokunulmadı
- Synchronize davranışı değişmedi

---

## 8. Dokümantasyon

### 8.1 Bu Sprint'te Oluşturulan Dokümantasyon

1. ✅ `MIGRATION-FOUNDATION-STRATEGY-S2.md` (bu dosya)
2. ✅ `DB-FOUNDATION-SPRINT-2-PHASE0-SUMMARY.md`
3. ✅ `POSTGRES-DRYRUN-PLAYBOOK-S2.md` (PHASE 4'te oluşturulacak)
4. ✅ `DB-FOUNDATION-SPRINT-2-REPORT.md` (PHASE 5'te oluşturulacak)

### 8.2 Gelecek Sprint'lerde Oluşturulacak

1. Migration workflow dokümantasyonu
2. Multi-env strategy dokümantasyonu
3. Rollback stratejisi dokümantasyonu

---

## 9. Sonuç

**Sprint 2 Hedefleri:**
- ✅ Baseline migration oluşturma
- ✅ Migration-first yapısını kurma
- ✅ Postgres dry-run hazırlığı
- ✅ Mevcut sistemi bozmadan ilerleme

**Sprint 2 Sonrası:**
- Dev ortamı migration-first'e geçiş (Sprint 3)
- Postgres cutover (Sprint 4)
- Multi-env ve iyileştirmeler (Sprint 5+)

---

**Dokümantasyon Durumu:** ✅ Tamamlandı  
**Sonraki Adım:** PHASE 2 - Baseline Migration Oluşturma

