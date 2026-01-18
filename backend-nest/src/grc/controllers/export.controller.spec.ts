import { ExportEntity } from '../enums';
import { EXPORT_ENTITY_MAP, sanitizeFilename } from './export.controller';

describe('ExportController', () => {
  describe('ExportEntity enum', () => {
    it('should have all expected entity values', () => {
      expect(ExportEntity.ISSUES).toBe('issues');
      expect(ExportEntity.ISSUE).toBe('issue');
      expect(ExportEntity.CAPAS).toBe('capas');
      expect(ExportEntity.CAPA).toBe('capa');
      expect(ExportEntity.EVIDENCE).toBe('evidence');
    });

    it('should have exactly 5 entity values', () => {
      const values = Object.values(ExportEntity);
      expect(values.length).toBe(5);
    });
  });

  describe('EXPORT_ENTITY_MAP', () => {
    it('should have mapping for all ExportEntity values', () => {
      const entityValues = Object.values(ExportEntity);
      entityValues.forEach((entity) => {
        expect(EXPORT_ENTITY_MAP[entity]).toBeDefined();
        expect(EXPORT_ENTITY_MAP[entity].entity).toBeDefined();
        expect(EXPORT_ENTITY_MAP[entity].table).toBeDefined();
        expect(EXPORT_ENTITY_MAP[entity].safeName).toBeDefined();
      });
    });

    it('should have safe names that match expected pattern', () => {
      const safePattern = /^[a-z]+$/;
      Object.values(EXPORT_ENTITY_MAP).forEach((config) => {
        expect(safePattern.test(config.safeName)).toBe(true);
      });
    });

    it('should map issues and issue to the same entity', () => {
      expect(EXPORT_ENTITY_MAP[ExportEntity.ISSUES].entity).toBe(
        EXPORT_ENTITY_MAP[ExportEntity.ISSUE].entity,
      );
      expect(EXPORT_ENTITY_MAP[ExportEntity.ISSUES].safeName).toBe(
        EXPORT_ENTITY_MAP[ExportEntity.ISSUE].safeName,
      );
    });

    it('should map capas and capa to the same entity', () => {
      expect(EXPORT_ENTITY_MAP[ExportEntity.CAPAS].entity).toBe(
        EXPORT_ENTITY_MAP[ExportEntity.CAPA].entity,
      );
      expect(EXPORT_ENTITY_MAP[ExportEntity.CAPAS].safeName).toBe(
        EXPORT_ENTITY_MAP[ExportEntity.CAPA].safeName,
      );
    });
  });

  describe('sanitizeFilename', () => {
    describe('valid filenames', () => {
      it('should accept valid CSV filename', () => {
        expect(sanitizeFilename('issues-2026-01-17.csv')).toBe(
          'issues-2026-01-17.csv',
        );
      });

      it('should accept filename with underscores', () => {
        expect(sanitizeFilename('my_export_file.csv')).toBe(
          'my_export_file.csv',
        );
      });

      it('should accept filename with hyphens', () => {
        expect(sanitizeFilename('export-data-2026.csv')).toBe(
          'export-data-2026.csv',
        );
      });

      it('should accept filename with numbers', () => {
        expect(sanitizeFilename('export123.csv')).toBe('export123.csv');
      });

      it('should accept mixed case filenames', () => {
        expect(sanitizeFilename('Export.csv')).toBe('Export.csv');
        expect(sanitizeFilename('EXPORT.CSV')).toBe('EXPORT.CSV');
      });
    });

    describe('dangerous characters - XSS/header injection prevention', () => {
      it('should strip double quotes from filename', () => {
        const result = sanitizeFilename('file"name.csv');
        expect(result).not.toContain('"');
      });

      it('should strip backslashes from filename', () => {
        const result = sanitizeFilename('file\\name.csv');
        expect(result).not.toContain('\\');
      });

      it('should strip carriage returns from filename', () => {
        const result = sanitizeFilename('file\rname.csv');
        expect(result).not.toContain('\r');
      });

      it('should strip newlines from filename', () => {
        const result = sanitizeFilename('file\nname.csv');
        expect(result).not.toContain('\n');
      });

      it('should handle multiple dangerous characters', () => {
        const result = sanitizeFilename('file"\r\n\\name.csv');
        expect(result).not.toContain('"');
        expect(result).not.toContain('\r');
        expect(result).not.toContain('\n');
        expect(result).not.toContain('\\');
      });
    });

    describe('invalid filenames - fallback to export.csv', () => {
      it('should fallback for filename without .csv extension', () => {
        expect(sanitizeFilename('filename')).toBe('export.csv');
        expect(sanitizeFilename('filename.txt')).toBe('export.csv');
        expect(sanitizeFilename('filename.xlsx')).toBe('export.csv');
      });

      it('should fallback for filename with spaces', () => {
        expect(sanitizeFilename('file name.csv')).toBe('export.csv');
      });

      it('should fallback for filename with special characters', () => {
        expect(sanitizeFilename('file@name.csv')).toBe('export.csv');
        expect(sanitizeFilename('file#name.csv')).toBe('export.csv');
        expect(sanitizeFilename('file$name.csv')).toBe('export.csv');
        expect(sanitizeFilename('file%name.csv')).toBe('export.csv');
      });

      it('should fallback for filename with path traversal attempts', () => {
        expect(sanitizeFilename('../../../etc/passwd.csv')).toBe('export.csv');
        expect(sanitizeFilename('..\\..\\windows\\system32.csv')).toBe(
          'export.csv',
        );
      });

      it('should fallback for empty filename', () => {
        expect(sanitizeFilename('')).toBe('export.csv');
      });

      it('should fallback for filename with only extension', () => {
        expect(sanitizeFilename('.csv')).toBe('export.csv');
      });

      it('should fallback for filename with multiple dots', () => {
        expect(sanitizeFilename('file.name.csv')).toBe('export.csv');
      });

      it('should fallback for XSS injection attempts', () => {
        expect(sanitizeFilename('<script>alert(1)</script>.csv')).toBe(
          'export.csv',
        );
        expect(sanitizeFilename('file<img src=x onerror=alert(1)>.csv')).toBe(
          'export.csv',
        );
      });

      it('should fallback for header injection attempts', () => {
        expect(sanitizeFilename('file.csv\r\nContent-Type: text/html')).toBe(
          'export.csv',
        );
        expect(sanitizeFilename('file.csv\nX-Injected-Header: value')).toBe(
          'export.csv',
        );
      });
    });

    describe('edge cases', () => {
      it('should handle very long filenames by validating pattern', () => {
        const longName = 'a'.repeat(200) + '.csv';
        const result = sanitizeFilename(longName);
        expect(result).toBe(longName);
      });

      it('should handle unicode characters by falling back', () => {
        expect(sanitizeFilename('файл.csv')).toBe('export.csv');
        expect(sanitizeFilename('文件.csv')).toBe('export.csv');
        expect(sanitizeFilename('ファイル.csv')).toBe('export.csv');
      });
    });
  });

  describe('ParseEnumPipe validation (integration behavior)', () => {
    it('should only accept valid ExportEntity values', () => {
      const validEntities = ['issues', 'issue', 'capas', 'capa', 'evidence'];
      validEntities.forEach((entity) => {
        expect(Object.values(ExportEntity)).toContain(entity);
      });
    });

    it('should reject invalid entity values', () => {
      const invalidEntities = [
        'invalid',
        'users',
        'admin',
        'risks',
        'controls',
        'policies',
        '../../../etc/passwd',
        '<script>alert(1)</script>',
      ];
      invalidEntities.forEach((entity) => {
        expect(Object.values(ExportEntity)).not.toContain(entity);
      });
    });
  });
});
