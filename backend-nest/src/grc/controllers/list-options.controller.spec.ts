import {
  getEntityAllowlist,
  getRegisteredEntities,
} from '../../common/list-query/list-query.allowlist';

describe('ListOptionsController', () => {
  describe('Entity Allowlist Integration', () => {
    describe('getRegisteredEntities', () => {
      it('should return a list of registered entities', () => {
        const entities = getRegisteredEntities();
        expect(Array.isArray(entities)).toBe(true);
        expect(entities.length).toBeGreaterThan(0);
      });

      it('should include core GRC entities', () => {
        const entities = getRegisteredEntities();
        expect(entities).toContain('control');
        expect(entities).toContain('issue');
        expect(entities).toContain('capa');
      });
    });

    describe('getEntityAllowlist', () => {
      it('should return allowlist for issues entity', () => {
        const allowlist = getEntityAllowlist('issues');
        expect(allowlist).toBeDefined();
        expect(allowlist?.entityName).toBe('issue');
        expect(allowlist?.fields).toBeDefined();
        expect(Array.isArray(allowlist?.fields)).toBe(true);
      });

      it('should return allowlist for capas entity', () => {
        const allowlist = getEntityAllowlist('capas');
        expect(allowlist).toBeDefined();
        expect(allowlist?.entityName).toBe('capa');
        expect(allowlist?.fields).toBeDefined();
      });

      it('should return allowlist for evidence entity', () => {
        const allowlist = getEntityAllowlist('evidence');
        expect(allowlist).toBeDefined();
        expect(allowlist?.entityName).toBe('evidence');
        expect(allowlist?.fields).toBeDefined();
      });

      it('should return allowlist for control entity', () => {
        const allowlist = getEntityAllowlist('control');
        expect(allowlist).toBeDefined();
        expect(allowlist?.entityName).toBe('control');
        expect(allowlist?.fields).toBeDefined();
      });

      it('should return null for unknown entity', () => {
        const allowlist = getEntityAllowlist('unknown_entity');
        expect(allowlist).toBeNull();
      });

      it('should be case-insensitive for entity names', () => {
        const lowerCase = getEntityAllowlist('issues');
        const upperCase = getEntityAllowlist('ISSUES');
        const mixedCase = getEntityAllowlist('Issues');

        expect(lowerCase).toBeDefined();
        expect(upperCase).toBeDefined();
        expect(mixedCase).toBeDefined();
        expect(lowerCase?.entityName).toBe(upperCase?.entityName);
        expect(lowerCase?.entityName).toBe(mixedCase?.entityName);
      });
    });

    describe('Allowlist Field Structure', () => {
      it('should have sortable fields for issues', () => {
        const allowlist = getEntityAllowlist('issues');
        expect(allowlist?.fields).toBeDefined();

        const sortableTypes = ['string', 'date', 'number', 'enum'];
        const sortableFields = allowlist?.fields.filter((f) =>
          sortableTypes.includes(f.type),
        );

        expect(sortableFields?.length).toBeGreaterThan(0);
      });

      it('should have createdAt and updatedAt fields', () => {
        const allowlist = getEntityAllowlist('issues');
        const fieldNames = allowlist?.fields.map((f) => f.name) || [];

        expect(fieldNames).toContain('createdAt');
        expect(fieldNames).toContain('updatedAt');
      });

      it('should have status field with enum values for issues', () => {
        const allowlist = getEntityAllowlist('issues');
        const statusField = allowlist?.fields.find((f) => f.name === 'status');

        expect(statusField).toBeDefined();
        expect(statusField?.type).toBe('enum');
        expect(statusField?.enumValues).toBeDefined();
        expect(Array.isArray(statusField?.enumValues)).toBe(true);
      });

      it('should have severity field with enum values for issues', () => {
        const allowlist = getEntityAllowlist('issues');
        const severityField = allowlist?.fields.find(
          (f) => f.name === 'severity',
        );

        expect(severityField).toBeDefined();
        expect(severityField?.type).toBe('enum');
        expect(severityField?.enumValues).toBeDefined();
      });

      it('should have priority field with enum values for capas', () => {
        const allowlist = getEntityAllowlist('capas');
        const priorityField = allowlist?.fields.find(
          (f) => f.name === 'priority',
        );

        expect(priorityField).toBeDefined();
        expect(priorityField?.type).toBe('enum');
        expect(priorityField?.enumValues).toBeDefined();
      });
    });

    describe('Response Format Validation', () => {
      it('should format sortable fields correctly', () => {
        const allowlist = getEntityAllowlist('issues');
        const sortableTypes = ['string', 'date', 'number', 'enum'];
        const sortableFields =
          allowlist?.fields
            .filter((f) => sortableTypes.includes(f.type))
            .map((f) => ({
              name: f.name,
              label: formatFieldName(f.name),
              type: f.type,
            })) || [];

        expect(sortableFields.length).toBeGreaterThan(0);
        sortableFields.forEach((field) => {
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('label');
          expect(field).toHaveProperty('type');
          expect(typeof field.name).toBe('string');
          expect(typeof field.label).toBe('string');
          expect(typeof field.type).toBe('string');
        });
      });

      it('should format filterable fields correctly', () => {
        const allowlist = getEntityAllowlist('issues');
        const filterableFields =
          allowlist?.fields.map((f) => ({
            name: f.name,
            label: formatFieldName(f.name),
            type: f.type,
            enumValues: f.enumValues,
          })) || [];

        expect(filterableFields.length).toBeGreaterThan(0);
        filterableFields.forEach((field) => {
          expect(field).toHaveProperty('name');
          expect(field).toHaveProperty('label');
          expect(field).toHaveProperty('type');
        });
      });
    });
  });
});

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
