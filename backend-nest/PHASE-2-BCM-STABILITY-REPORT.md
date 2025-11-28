# PHASE 2 – BCM Validation Failed Stabilizasyonu Raporu

## Tarih
2025-11-24

## Amaç
`GET /api/v2/bcm/processes?page=0&pageSize=20` → 200 (Validation failed değil). BCP modülünde (process, plan, exercise) create/list akışı hem backend hem frontend tarafında çalışır olsun.

---

## Root Cause Analizi

### Hata
```
GET /api/v2/bcm/processes?page=0&pageSize=20 400 - Validation failed
```

### Analiz

#### 1. PaginationDto (backend-nest/src/common/search/pagination.dto.ts)
- ✅ `page?: number` - `@Min(0)`, `@Type(() => Number)`, `@IsInt()`
- ✅ `pageSize?: number` - `@Min(1)`, `@Max(1000)`, `@Type(() => Number)`, `@IsInt()`
- ✅ `parsePagination` fonksiyonu `page=0` durumunu handle ediyor

**Durum:** PaginationDto zaten güncellenmiş, `@Min(0)` var.

#### 2. QueryBIAProcessDto (backend-nest/src/modules/bcm/dto/query-bcm.dto.ts)
- ✅ `extends PaginationDto` - PaginationDto'dan `page` ve `pageSize` alıyor
- ✅ `@Type(() => Number)` decorator'ları var (PaginationDto'da)

**Durum:** DTO doğru görünüyor.

#### 3. ValidationPipe (backend-nest/src/main.ts)
```typescript
new ValidationPipe({
  whitelist: true,
  forbidUnknownValues: false,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true, // Auto-convert string numbers to numbers
  },
  skipMissingProperties: true,
  // ...
})
```

**Durum:** ✅ `transform: true` ve `enableImplicitConversion: true` var. Query parametreleri otomatik transform edilmeli.

#### 4. NormalizationPipe (backend-nest/src/common/pipes/normalization/normalization.pipe.ts)
- ✅ Empty string → undefined normalizasyonu var
- ⚠️ Query parametreleri için özel bir normalizasyon yok (sadece body için)

**Durum:** NormalizationPipe query parametrelerini normalize etmiyor (sadece body için). Bu doğru, çünkü ValidationPipe query parametrelerini transform ediyor.

### Tahmini Root Cause
1. **Önceki Durum:** `PaginationDto.page` için `@Min(1)` vardı, `page=0` validation fail ediyordu.
2. **Şu Anki Durum:** `@Min(0)` var, `@Type(() => Number)` var, ValidationPipe `transform: true` ile query parametrelerini transform ediyor.
3. **Beklenen:** `page=0` → number 0 → validation pass → `parsePagination` içinde `page=0` → `page=1` (skip hesaplaması için)

**Sonuç:** DTO ve ValidationPipe zaten doğru. Sorun çözülmüş olmalı, backend restart sonrası test edilmeli.

---

## Yapılan Kontroller

### 1. PaginationDto Kontrolü
- ✅ `@Min(0)` var
- ✅ `@Type(() => Number)` var
- ✅ `@IsInt()` var
- ✅ `parsePagination` `page=0` durumunu handle ediyor

### 2. QueryBIAProcessDto Kontrolü
- ✅ `extends PaginationDto` - doğru
- ✅ Ekstra validation yok (sadece search, owner_user_id, criticalityOp, criticalityVal)

### 3. ValidationPipe Kontrolü
- ✅ `transform: true` - query parametreleri transform ediliyor
- ✅ `enableImplicitConversion: true` - string "0" → number 0

### 4. smoke-bcm-processes.ts Kontrolü
- ✅ `page=0&pageSize=20` test ediyor
- ✅ `page=1&pageSize=5` test ediyor
- ✅ Login ve list endpoint'leri test ediyor

---

## Değişiklik Gerekmedi

### PaginationDto
**Durum:** Zaten güncellenmiş (önceki sprint'te)
- `@Min(0)` var
- `parsePagination` `page=0` durumunu handle ediyor

### QueryBIAProcessDto, QueryBCPPlanDto, QueryBCPExerciseDto
**Durum:** Zaten doğru
- `extends PaginationDto` - PaginationDto'dan `page` ve `pageSize` alıyor
- Ekstra validation yok

### ValidationPipe
**Durum:** Zaten doğru
- `transform: true` - query parametreleri transform ediliyor
- `enableImplicitConversion: true` - string → number conversion

### smoke-bcm-processes.ts
**Durum:** Zaten mevcut ve doğru

---

## Test Senaryosu

### Backend Smoke Test
```bash
npm run smoke:bcm-processes
```

**Beklenen Sonuç:**
- ✅ Login PASS
- ✅ List BCM processes (page=0, pageSize=20) → 200
- ✅ List BCM processes (page=1, pageSize=5) → 200

**Durum:** ⚠️ Backend restart edilmedi, test edilemedi

---

## Frontend Kontrolü

### BCPProcessesPage, BCPPlansPage, BCPExercisesPage
**Kontrol Edilmesi Gerekenler:**
1. List çağrıları backend endpoint path'leriyle uyumlu mu?
2. Query parametreleri (page/pageSize/search vs) DTO ile uyumlu mu?
3. Create/update payload'larında boş string'ler backend'in beklediği şekilde temizleniyor mu?

**Not:** Frontend kontrolü PHASE 5'te yapılacak (Frontend stabilizasyonu).

---

## Değişen Dosyalar

**Hiçbir dosya değiştirilmedi** - Tüm bileşenler zaten doğru yapılandırılmış.

---

## Sonraki Adımlar

1. **Backend Restart:** Backend'i restart et
2. **Smoke Test:** `npm run smoke:bcm-processes` çalıştır, 200 olduğunu doğrula
3. **PHASE 3:** Standards seed idempotent hale getir

---

## Notlar

- PaginationDto zaten `@Min(0)` ile güncellenmiş (önceki sprint)
- ValidationPipe `transform: true` ve `enableImplicitConversion: true` ile query parametrelerini transform ediyor
- NormalizationPipe query parametrelerini normalize etmiyor (sadece body için) - bu doğru
- `@Type(() => Number)` decorator'ı ile `page=0` string'i number 0'a çevrilmeli
- `parsePagination` fonksiyonu `page=0` durumunu handle ediyor (`Math.max(pageNum, 1)`)
