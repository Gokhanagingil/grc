import {
  normalizeTableName,
  resolveCanonicalTableName,
  getTableAliases,
  isTableAlias,
  getTableSchema,
  isTableAllowed,
  getFilterableFields,
  getSortableFields,
  getSearchableFields,
  getDefaultVisibleColumns,
} from './table-schema.registry';

describe('TableSchemaRegistry', () => {
  describe('normalizeTableName', () => {
    it('should trim whitespace from table name', () => {
      expect(normalizeTableName('  controls  ')).toBe('controls');
      expect(normalizeTableName(' grc_risks ')).toBe('grc_risks');
    });

    it('should convert table name to lowercase', () => {
      expect(normalizeTableName('CONTROLS')).toBe('controls');
      expect(normalizeTableName('GRC_RISKS')).toBe('grc_risks');
      expect(normalizeTableName('Controls')).toBe('controls');
    });

    it('should replace hyphens with underscores', () => {
      expect(normalizeTableName('grc-controls')).toBe('grc_controls');
      expect(normalizeTableName('grc-risks')).toBe('grc_risks');
    });

    it('should handle combined normalization', () => {
      expect(normalizeTableName('  GRC-Controls  ')).toBe('grc_controls');
      expect(normalizeTableName(' GRC-RISKS ')).toBe('grc_risks');
    });
  });

  describe('resolveCanonicalTableName', () => {
    it('should resolve grc_controls to controls', () => {
      expect(resolveCanonicalTableName('grc_controls')).toBe('controls');
    });

    it('should resolve grc_risks to risks', () => {
      expect(resolveCanonicalTableName('grc_risks')).toBe('risks');
    });

    it('should return canonical name unchanged', () => {
      expect(resolveCanonicalTableName('controls')).toBe('controls');
      expect(resolveCanonicalTableName('risks')).toBe('risks');
    });

    it('should handle uppercase aliases', () => {
      expect(resolveCanonicalTableName('GRC_CONTROLS')).toBe('controls');
      expect(resolveCanonicalTableName('GRC_RISKS')).toBe('risks');
    });

    it('should handle uppercase canonical names', () => {
      expect(resolveCanonicalTableName('CONTROLS')).toBe('controls');
      expect(resolveCanonicalTableName('RISKS')).toBe('risks');
    });

    it('should handle whitespace in table names', () => {
      expect(resolveCanonicalTableName(' grc_controls ')).toBe('controls');
      expect(resolveCanonicalTableName(' grc_risks ')).toBe('risks');
      expect(resolveCanonicalTableName(' controls ')).toBe('controls');
    });

    it('should handle hyphenated aliases', () => {
      expect(resolveCanonicalTableName('grc-controls')).toBe('controls');
      expect(resolveCanonicalTableName('grc-risks')).toBe('risks');
    });

    it('should return unknown table names as-is (normalized)', () => {
      expect(resolveCanonicalTableName('unknown_table')).toBe('unknown_table');
      expect(resolveCanonicalTableName('UNKNOWN_TABLE')).toBe('unknown_table');
    });
  });

  describe('getTableAliases', () => {
    it('should return all table aliases', () => {
      const aliases = getTableAliases();
      expect(aliases).toEqual({
        grc_controls: 'controls',
        grc_risks: 'risks',
      });
    });

    it('should return a copy of aliases (not the original)', () => {
      const aliases1 = getTableAliases();
      const aliases2 = getTableAliases();
      expect(aliases1).not.toBe(aliases2);
      expect(aliases1).toEqual(aliases2);
    });
  });

  describe('isTableAlias', () => {
    it('should return true for known aliases', () => {
      expect(isTableAlias('grc_controls')).toBe(true);
      expect(isTableAlias('grc_risks')).toBe(true);
    });

    it('should return false for canonical names', () => {
      expect(isTableAlias('controls')).toBe(false);
      expect(isTableAlias('risks')).toBe(false);
    });

    it('should handle case-insensitive alias check', () => {
      expect(isTableAlias('GRC_CONTROLS')).toBe(true);
      expect(isTableAlias('GRC_RISKS')).toBe(true);
    });

    it('should return false for unknown table names', () => {
      expect(isTableAlias('unknown_table')).toBe(false);
    });
  });

  describe('getTableSchema', () => {
    it('should return schema for canonical table names', () => {
      const controlsSchema = getTableSchema('controls');
      expect(controlsSchema).not.toBeNull();
      expect(controlsSchema?.tableName).toBe('controls');
      expect(controlsSchema?.displayName).toBe('Controls');

      const risksSchema = getTableSchema('risks');
      expect(risksSchema).not.toBeNull();
      expect(risksSchema?.tableName).toBe('risks');
      expect(risksSchema?.displayName).toBe('Risks');
    });

    it('should return schema for alias table names', () => {
      const controlsSchema = getTableSchema('grc_controls');
      expect(controlsSchema).not.toBeNull();
      expect(controlsSchema?.tableName).toBe('controls');

      const risksSchema = getTableSchema('grc_risks');
      expect(risksSchema).not.toBeNull();
      expect(risksSchema?.tableName).toBe('risks');
    });

    it('should handle case-insensitive lookups', () => {
      expect(getTableSchema('CONTROLS')?.tableName).toBe('controls');
      expect(getTableSchema('GRC_CONTROLS')?.tableName).toBe('controls');
    });

    it('should return null for unknown table names', () => {
      expect(getTableSchema('unknown_table')).toBeNull();
    });
  });

  describe('isTableAllowed', () => {
    it('should return true for canonical table names', () => {
      expect(isTableAllowed('controls')).toBe(true);
      expect(isTableAllowed('risks')).toBe(true);
    });

    it('should return true for alias table names', () => {
      expect(isTableAllowed('grc_controls')).toBe(true);
      expect(isTableAllowed('grc_risks')).toBe(true);
    });

    it('should handle case-insensitive checks', () => {
      expect(isTableAllowed('CONTROLS')).toBe(true);
      expect(isTableAllowed('GRC_CONTROLS')).toBe(true);
    });

    it('should return false for unknown table names', () => {
      expect(isTableAllowed('unknown_table')).toBe(false);
    });
  });

  describe('getFilterableFields', () => {
    it('should return filterable fields for controls table', () => {
      const fields = getFilterableFields('controls');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.name === 'status')).toBe(true);
    });

    it('should work with alias table names', () => {
      const fields = getFilterableFields('grc_controls');
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown table', () => {
      expect(getFilterableFields('unknown_table')).toEqual([]);
    });
  });

  describe('getSortableFields', () => {
    it('should return sortable field names for controls table', () => {
      const fields = getSortableFields('controls');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields).toContain('name');
    });

    it('should work with alias table names', () => {
      const fields = getSortableFields('grc_controls');
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown table', () => {
      expect(getSortableFields('unknown_table')).toEqual([]);
    });
  });

  describe('getSearchableFields', () => {
    it('should return searchable field names for controls table', () => {
      const fields = getSearchableFields('controls');
      expect(fields.length).toBeGreaterThan(0);
      expect(fields).toContain('name');
    });

    it('should work with alias table names', () => {
      const fields = getSearchableFields('grc_controls');
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown table', () => {
      expect(getSearchableFields('unknown_table')).toEqual([]);
    });
  });

  describe('getDefaultVisibleColumns', () => {
    it('should return default visible columns for controls table', () => {
      const columns = getDefaultVisibleColumns('controls');
      expect(columns.length).toBeGreaterThan(0);
      expect(columns).toContain('name');
    });

    it('should work with alias table names', () => {
      const columns = getDefaultVisibleColumns('grc_controls');
      expect(columns.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown table', () => {
      expect(getDefaultVisibleColumns('unknown_table')).toEqual([]);
    });
  });
});
