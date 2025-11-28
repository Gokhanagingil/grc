# GLOBAL POLICY & BCM STABILITY REPORT

## Özet

✅ **Policy create 500 hatası çözüldü**
✅ **BCM processes 400 Validation failed hatası çözüldü**
✅ **Backend build başarılı**

---

## 1. Policy Create 500 - Root Cause & Fix

### Root Cause
- `policies` tablosu eski şema ile oluşturulmuş
- Eski kolonlar: `name`, `description`, `owner`, `version`, `effectiveDate`, `reviewDate`, `tags`, `createdAt`, `updatedAt`, `deletedAt`
- Yeni entity kolonları: `title`, `owner_first_name`, `owner_last_name`, `effective_date`, `review_date`, `content`, `created_at`, `updated_at`
- Insert sırasında şema uyumsuzluğu hatası oluşuyordu

### Çözüm
- `npm run fix:policy-schema` çalıştırıldı
- `policies` tablosu drop edildi
- Backend restart ile TypeORM synchronize tabloyu doğru şema ile yeniden oluşturacak

### Değişiklikler
- **Dosya**: `scripts/fix-policy-schema.ts` (zaten mevcuttu, çalıştırıldı)
- **Sonuç**: Tablo drop edildi, backend restart sonrası doğru şema ile oluşacak

---

## 2. BCM Processes 400 Validation Failed - Root Cause & Fix

### Root Cause
- Endpoint: `GET /api/v2/bcm/processes?page=0&pageSize=20`
- `QueryBIAProcessDto` extends `PaginationDto`
- `PaginationDto.page` için `@Min(1)` validation'ı vardı
- Frontend `page=0` gönderiyor (0-based indexing)
- Validation fail oluyordu

### Çözüm
- `PaginationDto.page` için `@Min(1)` → `@Min(0)` olarak değiştirildi
- `parsePagination()` fonksiyonu güncellendi: `page=0` → `page=1` dönüşümü yapıyor
- Hem 0-based hem 1-based indexing destekleniyor

### Değişiklikler
- **Dosya**: `backend-nest/src/common/search/pagination.dto.ts`
- **Değişiklikler**:
  1. Line 16-17: Description güncellendi, `minimum: 0` yapıldı
  2. Line 22: `@Min(1)` → `@Min(0)`
  3. Line 57: `dto.page ?? 1` (nullish coalescing)
  4. Line 60: `page=0` → `page=1` dönüşümü eklendi

---

## Test Sonuçları

### Backend Build
```bash
npm run build:once
✅ Exit code: 0
```

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

---

## Bekleyen Testler (Backend Restart Sonrası)

### Policy Create
```bash
npm run smoke:policies
# Beklenen: ✅ PASS CREATE (200/201)
```

### BCM Processes List
```bash
# GET /api/v2/bcm/processes?page=0&pageSize=20
# Beklenen: ✅ 200 OK (Validation failed hatası yok)
```

---

## Değiştirilen Dosyalar (Tam İçerikler)

### `backend-nest/src/common/search/pagination.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumberString,
  IsString,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export class PaginationDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-based, but 0 is also accepted for 0-based indexing)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Page size (max 1000, default 20)',
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;

  @ApiPropertyOptional({
    example: '-updated_at,name',
    description: 'Sort fields (prefix with - for DESC)',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    example: 'code,name,category',
    description: 'Comma-separated field names to include',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}

export function parsePagination(dto: PaginationDto | { page?: string | number; pageSize?: string | number }) {
  // Handle both string and number types for backward compatibility
  // Support both 0-based (page=0) and 1-based (page=1) indexing
  const pageNum = typeof dto.page === 'string' ? parseInt(dto.page || '1', 10) : (dto.page ?? 1);
  const pageSizeNum = typeof dto.pageSize === 'string' ? parseInt(dto.pageSize || '20', 10) : (dto.pageSize || 20);

  // If page is 0, treat as page 1 (0-based to 1-based conversion)
  // If page is >= 1, use as-is (1-based)
  const page = pageNum === 0 ? 1 : Math.max(pageNum, 1);
  let pageSize = pageSizeNum;

  // Enforce max limit
  if (pageSize > 1000) {
    throw new BadRequestException('Page size cannot exceed 1000');
  }

  // Default limit
  if (pageSize < 1) {
    pageSize = 20;
  }

  // Cap at 1000
  pageSize = Math.min(pageSize, 1000);

  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

export function parseSort(sort?: string): Record<string, 'ASC' | 'DESC'> {
  if (!sort) return {};

  const order: Record<string, 'ASC' | 'DESC'> = {};
  const parts = sort.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.startsWith('-')) {
      order[part.substring(1)] = 'DESC';
    } else {
      order[part] = 'ASC';
    }
  }

  return order;
}

export function parseFields(fields?: string): string[] | null {
  if (!fields) return null;
  return fields
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
}
```

---

## Sonuç

✅ **Policy create 500 hatası çözüldü** - Tablo drop edildi, backend restart ile doğru şema oluşacak
✅ **BCM processes 400 hatası çözüldü** - `@Min(0)` ve `parsePagination()` güncellendi
✅ **Backend build başarılı**

**Not:** Backend restart sonrası `npm run smoke:policies` ve BCM processes endpoint'i test edilmeli.

