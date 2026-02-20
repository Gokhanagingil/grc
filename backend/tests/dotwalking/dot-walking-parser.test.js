const { DotWalkingParser, VALID_ENTITY_TYPES, ENTITY_FIELDS, RELATIONSHIP_MAP } = require('../../utils/dot-walking-parser');

describe('DotWalkingParser', () => {
  let parser;

  beforeEach(() => {
    parser = new DotWalkingParser();
  });

  describe('parse()', () => {
    test('should parse simple entity path', () => {
      const result = parser.parse('users');
      expect(result.valid).toBe(true);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].type).toBe('entity');
      expect(result.segments[0].value).toBe('users');
    });

    test('should parse entity.field path', () => {
      const result = parser.parse('users.email');
      expect(result.valid).toBe(true);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].type).toBe('entity');
      expect(result.segments[1].type).toBe('field');
      expect(result.segments[1].value).toBe('email');
    });

    test('should parse owner.email path (1-1 relationship)', () => {
      const result = parser.parse('risks.owner.email');
      expect(result.valid).toBe(true);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].type).toBe('entity');
      expect(result.segments[1].type).toBe('relationship');
      expect(result.segments[1].targetEntity).toBe('users');
      expect(result.segments[2].type).toBe('field');
      expect(result.segments[2].value).toBe('email');
    });

    test('should parse assignee.department.name path', () => {
      const result = parser.parse('risks.assignee.department');
      expect(result.valid).toBe(true);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[1].type).toBe('relationship');
      expect(result.segments[2].type).toBe('field');
    });

    test('should parse organization hierarchy (parent relationship)', () => {
      const result = parser.parse('organizations.parent.name');
      expect(result.valid).toBe(true);
      expect(result.segments).toHaveLength(3);
      expect(result.segments[1].type).toBe('relationship');
      expect(result.segments[1].targetEntity).toBe('organizations');
    });

    test('should reject invalid entity type', () => {
      const result = parser.parse('invalid_entity');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid entity type');
    });

    test('should reject invalid field', () => {
      const result = parser.parse('users.invalid_field');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid field or relationship');
    });

    test('should reject empty path', () => {
      const result = parser.parse('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path cannot be empty');
    });

    test('should reject null path', () => {
      const result = parser.parse(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path must be a non-empty string');
    });

    test('should calculate correct depth for nested relationships', () => {
      const result = parser.parse('risks.owner.email');
      expect(result.depth).toBe(1);
    });

    test('should handle multiple relationship traversals', () => {
      const result = parser.parse('risk_assessments.risk.owner.email');
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(2);
    });
  });

  describe('validate()', () => {
    test('should return true for valid paths', () => {
      expect(parser.validate('users')).toBe(true);
      expect(parser.validate('users.email')).toBe(true);
      expect(parser.validate('risks.owner.email')).toBe(true);
    });

    test('should return false for invalid paths', () => {
      expect(parser.validate('')).toBe(false);
      expect(parser.validate('invalid')).toBe(false);
      expect(parser.validate('users.invalid')).toBe(false);
    });
  });

  describe('getAvailableFields()', () => {
    test('should return fields for valid entity', () => {
      const fields = parser.getAvailableFields('users');
      expect(fields).toContain('email');
      expect(fields).toContain('username');
      expect(fields).toContain('role');
    });

    test('should return empty array for invalid entity', () => {
      const fields = parser.getAvailableFields('invalid');
      expect(fields).toEqual([]);
    });
  });

  describe('getAvailableRelationships()', () => {
    test('should return relationships for entity with relationships', () => {
      const relationships = parser.getAvailableRelationships('risks');
      expect(relationships).toContain('owner');
      expect(relationships).toContain('assignee');
    });

    test('should return empty array for entity without relationships', () => {
      const relationships = parser.getAvailableRelationships('users');
      expect(relationships).toEqual([]);
    });
  });

  describe('getSuggestions()', () => {
    test('should suggest entities for empty path', () => {
      const suggestions = parser.getSuggestions('');
      expect(suggestions).toEqual(VALID_ENTITY_TYPES);
    });

    test('should suggest matching entities for partial entity name', () => {
      const suggestions = parser.getSuggestions('us');
      expect(suggestions).toContain('users');
    });

    test('should suggest fields and relationships after entity', () => {
      const suggestions = parser.getSuggestions('risks.');
      expect(suggestions).toContain('title');
      expect(suggestions).toContain('owner');
    });

    test('should filter suggestions based on partial input', () => {
      const suggestions = parser.getSuggestions('risks.ow');
      expect(suggestions).toContain('owner');
      expect(suggestions).toContain('owner_id');
    });
  });

  describe('buildQuery()', () => {
    test('should build query for simple entity', () => {
      const parsed = parser.parse('users');
      const query = parser.buildQuery(parsed);
      expect(query.baseTable).toBe('users');
      expect(query.joins).toHaveLength(0);
    });

    test('should build query with join for relationship', () => {
      const parsed = parser.parse('risks.owner');
      const query = parser.buildQuery(parsed);
      expect(query.baseTable).toBe('risks');
      expect(query.joins).toHaveLength(1);
      expect(query.joins[0].table).toBe('users');
    });

    test('should build query with multiple joins', () => {
      const parsed = parser.parse('risk_assessments.risk.owner');
      const query = parser.buildQuery(parsed);
      expect(query.joins).toHaveLength(2);
    });
  });
});

describe('Constants', () => {
  test('VALID_ENTITY_TYPES should include all expected entities', () => {
    expect(VALID_ENTITY_TYPES).toContain('users');
    expect(VALID_ENTITY_TYPES).toContain('policies');
    expect(VALID_ENTITY_TYPES).toContain('risks');
    expect(VALID_ENTITY_TYPES).toContain('compliance_requirements');
    expect(VALID_ENTITY_TYPES).toContain('organizations');
  });

  test('ENTITY_FIELDS should have fields for all entities', () => {
    for (const entity of VALID_ENTITY_TYPES) {
      expect(ENTITY_FIELDS[entity]).toBeDefined();
      expect(Array.isArray(ENTITY_FIELDS[entity])).toBe(true);
      expect(ENTITY_FIELDS[entity].length).toBeGreaterThan(0);
    }
  });

  test('RELATIONSHIP_MAP should be defined for all entities', () => {
    for (const entity of VALID_ENTITY_TYPES) {
      expect(RELATIONSHIP_MAP[entity]).toBeDefined();
    }
  });
});
