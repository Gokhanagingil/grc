# PHASE 2.1 - Policy/Requirement/BCM Durum Tespiti Raporu

## Özet

**Amaç:** Policy, Requirement ve BCM create/validation hatalarını tespit etmek.

**Durum:** 
- ✅ Policy Create: Frontend ve backend uyumlu görünüyor
- ❌ Requirement Create: Frontend'de TODO olarak bırakılmış
- ⚠️ BCM: Frontend ve backend uyumlu görünüyor, ama validation hataları olabilir

---

## Analiz Sonuçları

### 1. Policy Create

**Frontend:** `frontend/src/components/PolicyCreateForm.tsx`

**Endpoint:** `POST /api/v2/governance/policies`

**Payload Gönderilen:**
```javascript
{
  code: string,
  title: string,
  status: 'draft' | 'approved' | 'retired',
  owner_first_name?: string,
  owner_last_name?: string,
  effective_date?: string,  // dd/MM/yyyy format
  review_date?: string,      // dd/MM/yyyy format
  content?: string
}
```

**Backend:** `backend-nest/src/modules/governance/governance.controller.ts`

**DTO:** `CreateGovernancePolicyDto`

**Beklenen:**
```typescript
{
  code: string (required, Length(2, 64)),
  title: string (required, MaxLength(500)),
  status: 'draft' | 'approved' | 'retired' (required, IsIn),
  owner_first_name?: string (optional, MaxLength(80)),
  owner_last_name?: string (optional, MaxLength(80)),
  effective_date?: string (optional, dd/MM/yyyy format),
  review_date?: string (optional, dd/MM/yyyy format),
  content?: string (optional)
}
```

**Uyumluluk:**
- ✅ `code`: Frontend'de required, backend'de required
- ✅ `title`: Frontend'de required, backend'de required
- ✅ `status`: Frontend'de required, backend'de required
- ✅ `owner_first_name`: Frontend'de optional, backend'de optional
- ✅ `owner_last_name`: Frontend'de optional, backend'de optional
- ✅ `effective_date`: Frontend'de optional, backend'de optional (dd/MM/yyyy format)
- ✅ `review_date`: Frontend'de optional, backend'de optional (dd/MM/yyyy format)
- ✅ `content`: Frontend'de optional, backend'de optional

**Sonuç:** ✅ **UYUMLU** - Frontend ve backend payload/DTO uyumlu görünüyor.

**Olası Sorunlar:**
- Date format: Frontend `dd/MM/yyyy` gönderiyor, backend `parseTrDateToIso()` ile ISO formatına çeviriyor
- ValidationPipe hatası: Eğer `effective_date` veya `review_date` geçersiz format ise validation hatası olabilir

---

### 2. Requirement Create

**Frontend:** `frontend/src/pages/Compliance.tsx`

**Endpoint:** `POST /api/v2/compliance` (TODO olarak bırakılmış)

**Payload Gönderilen:**
```javascript
// TODO: Wire API endpoints when backend supports it
// Şu anda hiçbir şey gönderilmiyor!
```

**Backend:** `backend-nest/src/modules/compliance/comp.controller.ts`

**Endpoint:** `POST /api/v2/compliance`

**DTO:** `CreateRequirementDto`

**Beklenen:**
```typescript
{
  title: string (required, Length(1, 160)),
  description?: string (optional, MaxLength(5000)),
  regulation?: string (optional, MaxLength(120)),
  category?: string (optional, MaxLength(80)),
  status?: string (optional, MaxLength(32)),
  dueDate?: string (optional, IsDateString),
  evidence?: string (optional, MaxLength(10000))
}
```

**Frontend Form Data:**
```javascript
{
  title: string,
  description?: string,
  regulation?: string,
  category?: string,
  status: 'pending',
  dueDate: Date | null,
  evidence?: string,
  assignedTo?: string  // Backend DTO'da yok!
}
```

**Uyumluluk:**
- ✅ `title`: Frontend'de var, backend'de required
- ✅ `description`: Frontend'de optional, backend'de optional
- ✅ `regulation`: Frontend'de optional, backend'de optional
- ✅ `category`: Frontend'de optional, backend'de optional
- ✅ `status`: Frontend'de var (default: 'pending'), backend'de optional
- ⚠️ `dueDate`: Frontend'de `Date` objesi, backend'de `string` (IsDateString) - format dönüşümü gerekebilir
- ✅ `evidence`: Frontend'de optional, backend'de optional
- ❌ `assignedTo`: Frontend'de var ama backend DTO'da yok

**Sonuç:** ❌ **TODO - İMPLEMENTE EDİLMEMİŞ**

**Sorunlar:**
1. `handleSaveRequirement` fonksiyonu TODO olarak bırakılmış, hiçbir API çağrısı yapılmıyor
2. `dueDate` formatı: Frontend `Date` objesi gönderiyor, backend `string` (ISO date) bekliyor
3. `assignedTo` field'ı frontend'de var ama backend DTO'da yok (görmezden gelinebilir)

**Çözüm:**
- `handleSaveRequirement` fonksiyonunu implemente et
- `dueDate`'i ISO formatına çevir (`toISOString().split('T')[0]`)
- `assignedTo` field'ını payload'dan çıkar veya backend DTO'ya ekle

---

### 3. BCM Create

#### 3.1. BIA Process Create

**Frontend:** `frontend/src/pages/BIAProcessesPage.tsx`

**Endpoint:** `POST /api/v2/bcm/processes`

**Payload Gönderilen:**
```javascript
{
  code: string,
  name: string,
  description?: string,
  owner_user_id?: string,
  criticality?: number,
  rto_hours?: number,
  rpo_hours?: number,
  mtpd_hours?: number
}
```

**Backend:** `backend-nest/src/modules/bcm/bcm.controller.ts`

**DTO:** `CreateBIAProcessDto`

**Beklenen:**
```typescript
{
  code: string (required, Length(2, 100)),
  name: string (required, Length(2)),
  description?: string (optional),
  owner_user_id?: string (optional, IsUUID),
  criticality?: number (optional, Min(1)),
  rto_hours?: number (optional, Min(0)),
  rpo_hours?: number (optional, Min(0)),
  mtpd_hours?: number (optional, Min(0))
}
```

**Uyumluluk:**
- ✅ `code`: Frontend'de var, backend'de required
- ✅ `name`: Frontend'de var, backend'de required
- ✅ `description`: Frontend'de optional, backend'de optional
- ✅ `owner_user_id`: Frontend'de optional, backend'de optional (IsUUID)
- ✅ `criticality`: Frontend'de optional, backend'de optional
- ✅ `rto_hours`: Frontend'de optional, backend'de optional
- ✅ `rpo_hours`: Frontend'de optional, backend'de optional
- ✅ `mtpd_hours`: Frontend'de optional, backend'de optional

**Sonuç:** ✅ **UYUMLU** - Frontend ve backend payload/DTO uyumlu görünüyor.

#### 3.2. BCP Plan Create

**Frontend:** `frontend/src/pages/BCPPlansPage.tsx`

**Endpoint:** `POST /api/v2/bcm/plans`

**Payload Gönderilen:**
```javascript
{
  code: string,
  name: string,
  process_id?: string | undefined,
  scope_entity_id?: string | undefined,
  version?: string,
  status?: 'draft' | 'approved' | 'retired',
  steps?: Array<{ step: number, title: string, description?: string, owner?: string }>
}
```

**Backend:** `backend-nest/src/modules/bcm/bcm.controller.ts`

**DTO:** `CreateBCPPlanDto`

**Beklenen:**
```typescript
{
  code: string (required, Length(2, 100)),
  name: string (required, Length(2)),
  process_id?: string (optional, IsUUID),
  scope_entity_id?: string (optional, IsUUID),
  version?: string (optional),
  status?: BCPPlanStatus (optional, IsEnum),
  steps?: BCPPlanStep[] (optional, IsArray)
}
```

**Uyumluluk:**
- ✅ `code`: Frontend'de var, backend'de required
- ✅ `name`: Frontend'de var, backend'de required
- ✅ `process_id`: Frontend'de optional, backend'de optional (IsUUID)
- ✅ `scope_entity_id`: Frontend'de optional, backend'de optional (IsUUID)
- ✅ `version`: Frontend'de optional (default: '1.0'), backend'de optional
- ✅ `status`: Frontend'de optional (default: 'draft'), backend'de optional (IsEnum)
- ✅ `steps`: Frontend'de optional (JSON string'den parse ediliyor), backend'de optional (IsArray)

**Olası Sorunlar:**
- `steps` formatı: Frontend JSON string gönderiyor (parse edilmiş), backend array bekliyor
- `process_id` ve `scope_entity_id`: Frontend `undefined` gönderiyor, backend `IsUUID` validation'ı geçersiz UUID için hata verebilir

**Sonuç:** ⚠️ **UYUMLU AMA VALIDATION HATALARI OLABİLİR**

#### 3.3. BCP Exercise Create

**Frontend:** `frontend/src/pages/BCPExercisesPage.tsx`

**Endpoint:** `POST /api/v2/bcm/exercises`

**Payload Gönderilen:**
```javascript
{
  plan_id: string,
  code: string,
  name: string,
  date: string,  // ISO date format (yyyy-MM-dd)
  scenario?: string,
  result?: string,
  findings_count?: number,
  caps_count?: number
}
```

**Backend:** `backend-nest/src/modules/bcm/bcm.controller.ts`

**DTO:** `CreateBCPExerciseDto`

**Beklenen:**
```typescript
{
  plan_id: string (required, IsUUID),
  code: string (required, Length(2, 100)),
  name: string (required, Length(2)),
  date: string (required, IsDateString),
  scenario?: string (optional),
  result?: string (optional),
  findings_count?: number (optional, Min(0)),
  caps_count?: number (optional, Min(0))
}
```

**Uyumluluk:**
- ✅ `plan_id`: Frontend'de var, backend'de required (IsUUID)
- ✅ `code`: Frontend'de var, backend'de required
- ✅ `name`: Frontend'de var, backend'de required
- ✅ `date`: Frontend'de ISO date format, backend'de IsDateString
- ✅ `scenario`: Frontend'de optional, backend'de optional
- ✅ `result`: Frontend'de optional, backend'de optional
- ✅ `findings_count`: Frontend'de optional, backend'de optional (Min(0))
- ✅ `caps_count`: Frontend'de optional, backend'de optional (Min(0))

**Sonuç:** ✅ **UYUMLU** - Frontend ve backend payload/DTO uyumlu görünüyor.

---

## Sorun Listesi

### 1. Requirement Create - TODO

**Sorun:** Frontend'de `handleSaveRequirement` fonksiyonu TODO olarak bırakılmış, API çağrısı yapılmıyor.

**Çözüm:** 
- `handleSaveRequirement` fonksiyonunu implemente et
- `dueDate`'i ISO formatına çevir
- `assignedTo` field'ını payload'dan çıkar (backend DTO'da yok)

### 2. BCP Plan Create - Validation Hataları

**Sorun:** 
- `process_id` ve `scope_entity_id` için `undefined` gönderildiğinde `IsUUID` validation hatası olabilir
- `steps` formatı kontrol edilmeli

**Çözüm:**
- `undefined` değerleri payload'dan çıkar (sadece değer varsa gönder)
- `steps` array formatını kontrol et

### 3. Policy Create - Date Format

**Sorun:** 
- Frontend `dd/MM/yyyy` formatında gönderiyor
- Backend `parseTrDateToIso()` ile ISO formatına çeviriyor
- Eğer format geçersizse validation hatası olabilir

**Çözüm:**
- Frontend'de date formatını kontrol et
- Backend'de validation hatalarını daha anlaşılır hale getir

---

## Bir Sonraki Adımlar

1. ✅ PHASE 2.1 tamamlandı - Durum tespiti yapıldı
2. ⏳ PHASE 2.2: Requirement create TODO'sunu implemente et
3. ⏳ PHASE 2.3: BCP Plan validation hatalarını düzelt
4. ⏳ PHASE 2.4: Policy create date format sorunlarını kontrol et

