const VALID_ENTITY_TYPES = ['users', 'policies', 'risks', 'compliance_requirements', 'organizations', 'audit_logs', 'risk_assessments'];

const ENTITY_FIELDS = {
  users: ['id', 'username', 'email', 'first_name', 'last_name', 'department', 'role', 'is_active', 'created_at', 'updated_at'],
  policies: ['id', 'title', 'description', 'category', 'version', 'status', 'owner_id', 'effective_date', 'review_date', 'content', 'created_at', 'updated_at'],
  risks: ['id', 'title', 'description', 'category', 'severity', 'likelihood', 'impact', 'risk_score', 'status', 'owner_id', 'assigned_to', 'mitigation_plan', 'due_date', 'created_at', 'updated_at'],
  compliance_requirements: ['id', 'title', 'description', 'regulation', 'category', 'status', 'due_date', 'owner_id', 'assigned_to', 'evidence', 'created_at', 'updated_at'],
  organizations: ['id', 'name', 'description', 'type', 'parent_id', 'created_at', 'updated_at'],
  audit_logs: ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'old_values', 'new_values', 'ip_address', 'user_agent', 'created_at'],
  risk_assessments: ['id', 'risk_id', 'assessor_id', 'assessment_date', 'likelihood_score', 'impact_score', 'overall_score', 'notes', 'created_at'],
  todos: ['id', 'title', 'description', 'priority', 'status', 'category', 'tags', 'due_date', 'completed_at', 'owner_id', 'assigned_to', 'created_at', 'updated_at']
};

const RELATIONSHIP_MAP = {
  users: {},
  policies: {
    owner: { entity: 'users', foreignKey: 'owner_id', type: '1-1' }
  },
  risks: {
    owner: { entity: 'users', foreignKey: 'owner_id', type: '1-1' },
    assignee: { entity: 'users', foreignKey: 'assigned_to', type: '1-1' },
    assessments: { entity: 'risk_assessments', foreignKey: 'risk_id', type: '1-n', reverse: true }
  },
  compliance_requirements: {
    owner: { entity: 'users', foreignKey: 'owner_id', type: '1-1' },
    assignee: { entity: 'users', foreignKey: 'assigned_to', type: '1-1' }
  },
  organizations: {
    parent: { entity: 'organizations', foreignKey: 'parent_id', type: '1-1' },
    children: { entity: 'organizations', foreignKey: 'parent_id', type: '1-n', reverse: true }
  },
  audit_logs: {
    user: { entity: 'users', foreignKey: 'user_id', type: '1-1' }
  },
  risk_assessments: {
    risk: { entity: 'risks', foreignKey: 'risk_id', type: '1-1' },
    assessor: { entity: 'users', foreignKey: 'assessor_id', type: '1-1' }
  },
  todos: {
    owner: { entity: 'users', foreignKey: 'owner_id', type: '1-1' },
    assignee: { entity: 'users', foreignKey: 'assigned_to', type: '1-1' }
  }
};

class DotWalkingParser {
  constructor() {
    this.validEntities = VALID_ENTITY_TYPES;
    this.entityFields = ENTITY_FIELDS;
    this.relationshipMap = RELATIONSHIP_MAP;
  }

  parse(path) {
    if (path === null || path === undefined || typeof path !== 'string') {
      return {
        valid: false,
        error: 'Path must be a non-empty string',
        segments: [],
        resolvedPath: null
      };
    }

    const segments = path.split('.').filter(s => s.trim());
    
    if (segments.length === 0) {
      return {
        valid: false,
        error: 'Path cannot be empty',
        segments: [],
        resolvedPath: null
      };
    }

    const parsedSegments = [];
    let currentEntity = null;
    let isValid = true;
    let errorMessage = null;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (i === 0) {
        if (this.validEntities.includes(segment)) {
          currentEntity = segment;
          parsedSegments.push({
            type: 'entity',
            value: segment,
            index: i
          });
        } else {
          isValid = false;
          errorMessage = `Invalid entity type: ${segment}. Valid entities: ${this.validEntities.join(', ')}`;
          break;
        }
      } else {
        const entityFields = this.entityFields[currentEntity] || [];
        const relationships = this.relationshipMap[currentEntity] || {};
        
        if (entityFields.includes(segment)) {
          parsedSegments.push({
            type: 'field',
            value: segment,
            entity: currentEntity,
            index: i
          });
        } else if (relationships[segment]) {
          const rel = relationships[segment];
          parsedSegments.push({
            type: 'relationship',
            value: segment,
            sourceEntity: currentEntity,
            targetEntity: rel.entity,
            foreignKey: rel.foreignKey,
            relationshipType: rel.type,
            reverse: rel.reverse || false,
            index: i
          });
          currentEntity = rel.entity;
        } else {
          isValid = false;
          errorMessage = `Invalid field or relationship '${segment}' for entity '${currentEntity}'. Valid fields: ${entityFields.join(', ')}. Valid relationships: ${Object.keys(relationships).join(', ') || 'none'}`;
          break;
        }
      }
    }

    return {
      valid: isValid,
      error: errorMessage,
      segments: parsedSegments,
      originalPath: path,
      resolvedEntity: currentEntity,
      depth: parsedSegments.filter(s => s.type === 'relationship').length
    };
  }

  validate(path) {
    const result = this.parse(path);
    return result.valid;
  }

  getAvailableFields(entityType) {
    return this.entityFields[entityType] || [];
  }

  getAvailableRelationships(entityType) {
    return Object.keys(this.relationshipMap[entityType] || {});
  }

  getSuggestions(partialPath) {
    if (!partialPath) {
      return this.validEntities;
    }

    const segments = partialPath.split('.');
    const lastSegment = segments[segments.length - 1];
    const basePath = segments.slice(0, -1).join('.');
    
    const parseResult = basePath ? this.parse(basePath) : { valid: true, resolvedEntity: null };
    
    if (!parseResult.valid && basePath) {
      return [];
    }

    let suggestions = [];
    
    if (segments.length === 1) {
      suggestions = this.validEntities.filter(e => e.startsWith(lastSegment));
    } else {
      const currentEntity = parseResult.resolvedEntity || segments[0];
      const fields = this.getAvailableFields(currentEntity);
      const relationships = this.getAvailableRelationships(currentEntity);
      
      suggestions = [...fields, ...relationships].filter(s => s.startsWith(lastSegment));
    }

    return suggestions;
  }

  buildQuery(parsedPath, baseTable, conditions = {}) {
    if (!parsedPath.valid) {
      throw new Error(parsedPath.error);
    }

    const joins = [];
    const selectFields = [];
    let currentAlias = 't0';
    let aliasCounter = 1;

    for (const segment of parsedPath.segments) {
      if (segment.type === 'entity') {
        selectFields.push(`${currentAlias}.*`);
      } else if (segment.type === 'field') {
        selectFields.push(`${currentAlias}.${segment.value}`);
      } else if (segment.type === 'relationship') {
        const newAlias = `t${aliasCounter++}`;
        
        if (segment.reverse) {
          joins.push({
            table: segment.targetEntity,
            alias: newAlias,
            condition: `${newAlias}.${segment.foreignKey} = ${currentAlias}.id`
          });
        } else {
          joins.push({
            table: segment.targetEntity,
            alias: newAlias,
            condition: `${newAlias}.id = ${currentAlias}.${segment.foreignKey}`
          });
        }
        
        currentAlias = newAlias;
      }
    }

    return {
      baseTable: parsedPath.segments[0].value,
      joins,
      selectFields,
      finalAlias: currentAlias
    };
  }
}

module.exports = {
  DotWalkingParser,
  VALID_ENTITY_TYPES,
  ENTITY_FIELDS,
  RELATIONSHIP_MAP
};
