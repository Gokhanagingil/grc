# PHASE 0: Analiz Raporu

## Tespit Edilen Hatalar

### 1. Policy Create 500 - Schema Uyumsuzluğu

**Problem:**
- `policies` tablosu mevcut ama eski şema ile oluşturulmuş
- Tabloda eski kolonlar var: `name`, `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`
- Entity'de yeni kolonlar var: `title`, `owner_first_name`, `owner_last_name`, `effective_date`, `review_date`, `content`, `created_at`, `updated_at`
- Entity'de `id` ve `tenant_id` NOT NULL ama default yok
- Insert sırasında şema uyumsuzluğu hatası oluşuyor

**Smoke Test:**
- Endpoint: `POST /api/v2/governance/policies`
- Payload: `{ code: "POL-SMOKE-...", title: "Smoke Test Policy", status: "draft" }`
- Service: `GovernanceService.create()` metodu mevcut ve doğru görünüyor

**Kök Sebep:**
- `policies` tablosu eski şema ile oluşturulmuş
- TypeORM synchronize çalışmamış veya tablo manuel oluşturulmuş
- Tabloyu drop edip TypeORM ile yeniden oluşturmak gerekiyor

---

### 2. BCM Processes 400 - Validation Failed

**Problem:**
- Endpoint: `GET /api/v2/bcm/processes?page=0&pageSize=20`
- `QueryBIAProcessDto` extends `PaginationDto`
- `PaginationDto` içinde:
  ```typescript
  @Min(1)
  page?: number;
  ```
- Frontend veya client `page=0` gönderiyor ama `@Min(1)` validation'ı var
- Bu yüzden validation fail oluyor

**Kök Sebep:**
- `PaginationDto.page` için `@Min(1)` var (1-based pagination)
- Ama request `page=0` gönderiyor (0-based indexing)
- İki seçenek:
  1. `@Min(1)` kaldırıp `@Min(0)` yapmak (0-based)
  2. Frontend'i `page=1` gönderecek şekilde düzeltmek (1-based)

**Not:** `PaginationDto` zaten `@Type(() => Number)` kullanıyor, bu doğru. Problem sadece `@Min(1)` validation'ı.

---

## Çözüm Önerileri

### Policy Create 500
1. `policies` tablosunu drop et
2. Backend restart ile TypeORM synchronize tabloyu yeniden oluştursun
3. Veya `fix-policy-schema.ts` script'ini kullan

### BCM Processes 400
1. `PaginationDto.page` için `@Min(1)` yerine `@Min(0)` yapmak (0-based pagination)
2. Veya frontend'i `page=1` gönderecek şekilde düzeltmek

**Tercih:** 0-based pagination daha yaygın (REST API'lerde), `@Min(0)` yapmak daha mantıklı.
