const { DotWalkingParser } = require('./dot-walking-parser');

class DotWalkingResolver {
  constructor(db) {
    this.db = db;
    this.parser = new DotWalkingParser();
    this.maxDepth = 5;
  }

  async resolve(path, options = {}) {
    const { tenantId, userId, limit = 100, offset = 0, filters = {} } = options;
    
    const parsed = this.parser.parse(path);
    
    if (!parsed.valid) {
      throw new Error(`Invalid dot-walking path: ${parsed.error}`);
    }

    if (parsed.depth > this.maxDepth) {
      throw new Error(`Path depth ${parsed.depth} exceeds maximum allowed depth of ${this.maxDepth}`);
    }

    const queryInfo = this.parser.buildQuery(parsed);
    const sql = this.buildSQL(queryInfo, { limit, offset, filters, tenantId });
    
    return new Promise((resolve, reject) => {
      this.db.all(sql.query, sql.params, (err, rows) => {
        if (err) {
          reject(new Error(`Query execution failed: ${err.message}`));
        } else {
          resolve({
            data: rows,
            path: parsed.originalPath,
            depth: parsed.depth,
            count: rows.length,
            limit,
            offset
          });
        }
      });
    });
  }

  buildSQL(queryInfo, options = {}) {
    const { limit, offset, filters, tenantId } = options;
    const params = [];
    
    let selectClause = queryInfo.selectFields.length > 0 
      ? queryInfo.selectFields.join(', ')
      : `${queryInfo.finalAlias}.*`;
    
    let sql = `SELECT ${selectClause} FROM ${queryInfo.baseTable} AS t0`;
    
    for (const join of queryInfo.joins) {
      sql += ` LEFT JOIN ${join.table} AS ${join.alias} ON ${join.condition}`;
    }

    const whereConditions = [];
    
    if (filters && Object.keys(filters).length > 0) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          whereConditions.push(`t0.${field} = ?`);
          params.push(value);
        }
      }
    }

    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return { query: sql, params };
  }

  async resolveField(entityType, entityId, fieldPath) {
    const fullPath = `${entityType}.${fieldPath}`;
    const parsed = this.parser.parse(fullPath);
    
    if (!parsed.valid) {
      throw new Error(`Invalid field path: ${parsed.error}`);
    }

    const result = await this.resolve(fullPath, {
      filters: { id: entityId },
      limit: 1
    });

    if (result.data.length === 0) {
      return null;
    }

    const lastSegment = parsed.segments[parsed.segments.length - 1];
    if (lastSegment.type === 'field') {
      return result.data[0][lastSegment.value];
    }

    return result.data[0];
  }

  async resolveRelationship(entityType, entityId, relationshipPath) {
    const fullPath = `${entityType}.${relationshipPath}`;
    const parsed = this.parser.parse(fullPath);
    
    if (!parsed.valid) {
      throw new Error(`Invalid relationship path: ${parsed.error}`);
    }

    const lastSegment = parsed.segments[parsed.segments.length - 1];
    if (lastSegment.type !== 'relationship') {
      throw new Error('Path must end with a relationship');
    }

    const queryInfo = this.parser.buildQuery(parsed);
    const sql = this.buildSQL(queryInfo, {
      filters: { id: entityId },
      limit: 1000
    });

    return new Promise((resolve, reject) => {
      this.db.all(sql.query, sql.params, (err, rows) => {
        if (err) {
          reject(new Error(`Relationship resolution failed: ${err.message}`));
        } else {
          resolve({
            data: rows,
            relationshipType: lastSegment.relationshipType,
            sourceEntity: lastSegment.sourceEntity,
            targetEntity: lastSegment.targetEntity
          });
        }
      });
    });
  }

  async testPath(path) {
    const parsed = this.parser.parse(path);
    
    if (!parsed.valid) {
      return {
        valid: false,
        error: parsed.error,
        suggestions: this.parser.getSuggestions(path)
      };
    }

    try {
      const result = await this.resolve(path, { limit: 5 });
      return {
        valid: true,
        path: parsed.originalPath,
        depth: parsed.depth,
        segments: parsed.segments,
        sampleData: result.data,
        sampleCount: result.count
      };
    } catch (err) {
      return {
        valid: false,
        error: err.message,
        parsed: parsed
      };
    }
  }

  getSchema() {
    return {
      entities: this.parser.validEntities,
      fields: this.parser.entityFields,
      relationships: this.parser.relationshipMap
    };
  }
}

module.exports = { DotWalkingResolver };
