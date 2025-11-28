# PHASE 1-2: Policy & BCM Fix Raporu

## PHASE 1: Policy Create 500 Fix

### Problem
- `policies` tablosu eski şema ile oluşturulmuş
- Eski kolonlar: `name`, `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`
- Yeni entity kolonları: `title`, `owner_first_name`, `owner_last_name`, `effective_date`, `review_date`, `content`, `created_at`, `updated_at`
- Insert sırasında şema uyumsuzluğu hatası

### Çözüm
- `npm run fix:policy-schema` çalıştırıldı
- `policies` tablosu drop edildi
- Backend restart ile TypeORM synchronize tabloyu doğru şema ile yeniden oluşturacak

### Değişiklik
- **Dosya**: `scripts/fix-policy-schema.ts` (zaten mevcuttu, çalıştırıldı)
- **Sonuç**: Tablo drop edildi, backend restart sonrası doğru şema ile oluşacak

---

## PHASE 2: BCM Processes 400 Validation Failed Fix

### Problem
- Endpoint: `GET /api/v2/bcm/processes?page=0&pageSize=20`
- `QueryBIAProcessDto` extends `PaginationDto`
- `PaginationDto.page` için `@Min(1)` validation'ı var
- Request `page=0` gönderiyor (0-based indexing)
- Validation fail oluyor

### Çözüm
- `PaginationDto.page` için `@Min(1)` → `@Min(0)` olarak değiştirildi
- `parsePagination()` fonksiyonu güncellendi: `page=0` → `page=1` dönüşümü yapıyor
- Hem 0-based hem 1-based indexing destekleniyor

### Değişiklik
- **Dosya**: `backend-nest/src/common/search/pagination.dto.ts`
- **Değişiklikler**:
  1. `@Min(1)` → `@Min(0)` (line 22)
  2. `parsePagination()` fonksiyonu: `page=0` → `page=1` dönüşümü eklendi (line 59)

---

## Test Sonuçları

### Policy Schema Fix
```bash
npm run fix:policy-schema
✅ policies table dropped
✅ Backend restart ile tablo yeniden oluşturulacak
```

### BCM Processes Fix
- `@Min(0)` ile `page=0` artık geçerli
- `parsePagination()` `page=0` → `page=1` dönüşümü yapıyor
- Backend restart sonrası test edilecek

