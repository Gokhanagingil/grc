# PHASE 1-2: Backend Entity Fix + Standards Seed Fix

## PHASE 1: Backend ProcessEntity/ProcessControlEntity Fix

### Problem
- `audit.module.ts` içinde `ProcessEntity` ve `ProcessControlEntity` kullanılmış ama import edilmemiş
- TypeScript derleme hatası: `Cannot find name 'ProcessEntity'`

### Çözüm
- `backend-nest/src/modules/audit/audit.module.ts` dosyasına import eklendi:
  ```typescript
  import {
    ...
    ProcessEntity,
    ProcessControlEntity,
  } from '../../entities/app';
  ```

### Değişiklik
- **Dosya**: `backend-nest/src/modules/audit/audit.module.ts`
- **Değişiklik**: Import statement'a `ProcessEntity` ve `ProcessControlEntity` eklendi

---

## PHASE 2: Standards Seed Unique Constraint Fix

### Problem
- `StandardClauseEntity` içinde unique index sadece `['clause_code', 'tenant_id']` üzerinde
- Bu, farklı standartlarda aynı clause_code kullanılmasını engelliyor (örn: ISO27001:5.1 ve ISO20000:5.1)
- Seed script UNIQUE constraint hatası veriyordu

### Çözüm
- Unique index `['standard_id', 'clause_code', 'tenant_id']` olarak güncellendi
- Artık aynı tenant içinde, aynı standard içinde clause_code unique olacak
- Farklı standartlarda aynı clause_code kullanılabilir

### Değişiklik
- **Dosya**: `backend-nest/src/entities/app/standard-clause.entity.ts`
- **Değişiklik**: Line 17-19'daki unique index güncellendi:
  ```typescript
  @Index('idx_standard_clause_code_tenant', ['standard_id', 'clause_code', 'tenant_id'], {
    unique: true,
  })
  ```

### Seed Script Durumu
- Seed script zaten idempotent: `findOne` ile kontrol ediyor, varsa update, yoksa create
- Entity fix'ten sonra seed script hatasız çalışacak

### Not
- Development ortamında `standard_clause` tablosu mevcut unique constraint ile oluşturulmuş olabilir
- Backend restart edildiğinde TypeORM synchronize ile tablo yeniden oluşturulacak (veri kaybı olabilir)
- Production'da migration gerekir

---

## PHASE 4: Frontend Standards.tsx TS6133 Fix (Erken Uygulandı)

### Problem
- `Paper` ve `DescriptionIcon` import edilmiş ama kullanılmamış
- TypeScript TS6133 hatası

### Çözüm
- Kullanılmayan import'lar kaldırıldı

### Değişiklik
- **Dosya**: `frontend/src/pages/Standards.tsx`
- **Değişiklik**: `Paper` ve `DescriptionIcon` import'ları kaldırıldı

