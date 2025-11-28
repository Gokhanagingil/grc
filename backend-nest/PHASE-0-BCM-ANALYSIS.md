# PHASE 0 – BCM Validation Failed Durum Tespiti

**Date:** 2025-01-27  
**Status:** ✅ COMPLETED

## Özet

BCM modülündeki "Validation failed" hatasının root cause analizi tamamlandı. Sorun, frontend'den boş string (`''`) olarak gönderilen optional UUID alanlarının (`process_id`, `scope_entity_id`, `owner_user_id`) DTO validation seviyesinde `@IsUUID()` tarafından reddedilmesinden kaynaklanıyor.

## Tespit Edilen Sorunlar

### 1. DTO Validation Seviyesi

**CreateBCPPlanDto:**
- `process_id?: string` - `@IsOptional()` + `@IsUUID()` var
- `scope_entity_id?: string` - `@IsOptional()` + `@IsUUID()` var
- **Sorun:** Frontend boş string (`''`) gönderdiğinde, `@IsOptional()` `undefined` veya `null` için geçerli ama boş string için `@IsUUID()` validation fail ediyor.

**CreateBIAProcessDto:**
- `owner_user_id?: string` - `@IsOptional()` + `@IsUUID()` var
- **Sorun:** Aynı durum - boş string validation fail ediyor.

**CreateBCPExerciseDto:**
- `plan_id!: string` - Zorunlu alan, `@IsUUID()` var
- **Sorun:** Boş string gönderilirse validation fail ediyor (bu durumda zaten zorunlu olduğu için frontend'de kontrol edilmeli).

### 2. Service Seviyesi

**Mevcut Durum:**
- `bcm.service.ts` içinde `createBIAProcess`, `updateBIAProcess`, `createBCPPlan`, `updateBCPPlan`, `createBCPExercise` metodlarında empty string → undefined dönüşümü **zaten yapılıyor**.
- Ancak bu dönüşüm **service seviyesinde** yapıldığı için, DTO validation **önce** çalışıyor ve hata veriyor.

**Örnek Kod:**
```typescript
// bcm.service.ts - createBCPPlan
const processId = dto.process_id && dto.process_id.trim() ? dto.process_id.trim() : undefined;
const scopeEntityId = dto.scope_entity_id && dto.scope_entity_id.trim() ? dto.scope_entity_id.trim() : undefined;
```

### 3. Frontend Payload

**BCPPlansPage.tsx:**
```typescript
const [formData, setFormData] = useState({
  code: '',
  name: '',
  process_id: '',        // ⚠️ Boş string
  scope_entity_id: '',   // ⚠️ Boş string
  version: '1.0',
  status: 'draft',
  steps: '',
});
```

**BCPExercisesPage.tsx:**
```typescript
const [formData, setFormData] = useState({
  plan_id: '',           // ⚠️ Boş string (zorunlu alan)
  code: '',
  name: '',
  date: new Date().toISOString().split('T')[0],
  // ...
});
```

### 4. ValidationPipe Ayarları

**main.ts:**
```typescript
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: false,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
})
```

- `transform: true` var, ancak empty string → undefined dönüşümü için custom transformer gerekli.

## Çözüm Stratejisi

### PHASE 2'de Yapılacaklar:

1. **DTO Seviyesinde Transformer:**
   - `@Transform()` decorator'ı ile empty string → undefined dönüşümü
   - Tüm optional UUID alanlarında uygulanacak

2. **Service Seviyesi:**
   - Mevcut empty string → undefined dönüşümü korunacak (defensive programming)
   - Helper fonksiyon standardize edilecek

3. **Frontend (Opsiyonel):**
   - Boş string yerine `undefined` göndermek için payload cleanup (minimal değişiklik)

## Validation Failed Senaryoları

### Senaryo 1: BCP Plan Create (process_id boş string)
```
POST /api/v2/bcm/plans
Body: { code: "BCP-001", name: "Plan 1", process_id: "", scope_entity_id: "" }
```
**Beklenen Hata:**
```
Validation failed (property process_id should be a UUID)
```

### Senaryo 2: BIA Process Create (owner_user_id boş string)
```
POST /api/v2/bcm/processes
Body: { code: "BIA-001", name: "Process 1", owner_user_id: "" }
```
**Beklenen Hata:**
```
Validation failed (property owner_user_id should be a UUID)
```

### Senaryo 3: BCP Exercise Create (plan_id boş string)
```
POST /api/v2/bcm/exercises
Body: { plan_id: "", code: "EX-001", name: "Exercise 1", date: "2025-01-27" }
```
**Beklenen Hata:**
```
Validation failed (property plan_id should be a UUID)
```

## Mevcut Smoke Test Durumu

✅ **`npm run smoke:bcm`** → PASS (çünkü smoke script boş string göndermiyor, ya UUID ya da hiç göndermiyor)

⚠️ **Frontend'den manuel test** → FAIL (çünkü frontend boş string gönderiyor)

## Sonraki Adımlar

1. PHASE 1: Hatanın yeniden üretilmesi (frontend payload ile)
2. PHASE 2: DTO transformer ekleme
3. PHASE 3: Smoke script güncelleme (empty string senaryoları ekle)
4. PHASE 4: Doğrulama
5. PHASE 5: Final rapor

---

**Not:** Smoke test şu an PASS oluyor çünkü boş string göndermiyor. Ancak frontend'den gelen gerçek kullanım senaryosunda validation fail ediyor.

