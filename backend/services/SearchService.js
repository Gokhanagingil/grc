/**
 * Search Service - DSL-based Query Engine
 * 
 * Provides a Domain Specific Language (DSL) for searching records.
 * Supports:
 * - Field-based filtering
 * - Operators (equals, contains, greater_than, less_than, in, etc.)
 * - Sorting
 * - Pagination
 * - Saved filters
 */

const db = require('../db');
const aclService = require('./AclService');

class SearchService {
  constructor() {
    this.supportedTables = ['risks', 'policies', 'compliance_requirements', 'users', 'todos', 'audits', 'findings', 'capas', 'evidence', 'audit_reports'];
    this.tableFieldMappings = {
      risks: {
        id: 'r.id',
        title: 'r.title',
        description: 'r.description',
        category: 'r.category',
        severity: 'r.severity',
        likelihood: 'r.likelihood',
        impact: 'r.impact',
        risk_score: 'r.risk_score',
        status: 'r.status',
        owner_id: 'r.owner_id',
        assigned_to: 'r.assigned_to',
        mitigation_plan: 'r.mitigation_plan',
        due_date: 'r.due_date',
        created_at: 'r.created_at',
        updated_at: 'r.updated_at'
      },
      policies: {
        id: 'p.id',
        title: 'p.title',
        description: 'p.description',
        category: 'p.category',
        version: 'p.version',
        status: 'p.status',
        owner_id: 'p.owner_id',
        effective_date: 'p.effective_date',
        review_date: 'p.review_date',
        content: 'p.content',
        created_at: 'p.created_at',
        updated_at: 'p.updated_at'
      },
      compliance_requirements: {
        id: 'c.id',
        title: 'c.title',
        description: 'c.description',
        regulation: 'c.regulation',
        category: 'c.category',
        status: 'c.status',
        due_date: 'c.due_date',
        owner_id: 'c.owner_id',
        assigned_to: 'c.assigned_to',
        evidence: 'c.evidence',
        created_at: 'c.created_at',
        updated_at: 'c.updated_at'
      },
          audits: {
            id: 'a.id',
            name: 'a.name',
            description: 'a.description',
            audit_type: 'a.audit_type',
            status: 'a.status',
            risk_level: 'a.risk_level',
            department: 'a.department',
            owner_id: 'a.owner_id',
            lead_auditor_id: 'a.lead_auditor_id',
            planned_start_date: 'a.planned_start_date',
            planned_end_date: 'a.planned_end_date',
            actual_start_date: 'a.actual_start_date',
            actual_end_date: 'a.actual_end_date',
            scope: 'a.scope',
            objectives: 'a.objectives',
            methodology: 'a.methodology',
            findings_summary: 'a.findings_summary',
            recommendations: 'a.recommendations',
            conclusion: 'a.conclusion',
            created_at: 'a.created_at',
            updated_at: 'a.updated_at'
          },
          findings: {
            id: 'f.id',
            audit_id: 'f.audit_id',
            title: 'f.title',
            description: 'f.description',
            severity: 'f.severity',
            status: 'f.status',
            root_cause: 'f.root_cause',
            recommendation: 'f.recommendation',
            management_response: 'f.management_response',
            owner_id: 'f.owner_id',
            created_by: 'f.created_by',
            created_at: 'f.created_at',
            updated_at: 'f.updated_at'
          },
          capas: {
            id: 'c.id',
            finding_id: 'c.finding_id',
            title: 'c.title',
            description: 'c.description',
            type: 'c.type',
            status: 'c.status',
            validation_status: 'c.validation_status',
            due_date: 'c.due_date',
            validation_date: 'c.validation_date',
            validated_by: 'c.validated_by',
            extended_due_date: 'c.extended_due_date',
            extension_reason: 'c.extension_reason',
            owner_id: 'c.owner_id',
            created_by: 'c.created_by',
            created_at: 'c.created_at',
            updated_at: 'c.updated_at'
          },
          evidence: {
            id: 'e.id',
            finding_id: 'e.finding_id',
            audit_id: 'e.audit_id',
            title: 'e.title',
            description: 'e.description',
            type: 'e.type',
            storage_type: 'e.storage_type',
            storage_ref: 'e.storage_ref',
            external_system: 'e.external_system',
            external_id: 'e.external_id',
            uploaded_by: 'e.uploaded_by',
            uploaded_at: 'e.uploaded_at',
            created_at: 'e.created_at',
            updated_at: 'e.updated_at'
          },
          audit_reports: {
            id: 'ar.id',
            audit_id: 'ar.audit_id',
            version: 'ar.version',
            status: 'ar.status',
            created_by: 'ar.created_by',
            created_at: 'ar.created_at',
            updated_at: 'ar.updated_at'
          }
        };
  }

  /**
   * Build SQL condition from DSL filter
   * @param {Object} filter - DSL filter object
   * @param {string} tableName - Table name
   * @param {Array} params - Parameters array to populate
   * @param {number} paramIndex - Starting parameter index (for PostgreSQL)
   * @returns {{sql: string, paramIndex: number}}
   */
  buildCondition(filter, tableName, params, paramIndex = 1) {
    const fieldMappings = this.tableFieldMappings[tableName] || {};
    
    if (!filter || Object.keys(filter).length === 0) {
      return { sql: '1=1', paramIndex };
    }

    // Handle AND conditions
    if (filter.and && Array.isArray(filter.and)) {
      const conditions = [];
      for (const subFilter of filter.and) {
        const result = this.buildCondition(subFilter, tableName, params, paramIndex);
        conditions.push(result.sql);
        paramIndex = result.paramIndex;
      }
      return { sql: `(${conditions.join(' AND ')})`, paramIndex };
    }

    // Handle OR conditions
    if (filter.or && Array.isArray(filter.or)) {
      const conditions = [];
      for (const subFilter of filter.or) {
        const result = this.buildCondition(subFilter, tableName, params, paramIndex);
        conditions.push(result.sql);
        paramIndex = result.paramIndex;
      }
      return { sql: `(${conditions.join(' OR ')})`, paramIndex };
    }

    // Handle NOT condition
    if (filter.not) {
      const result = this.buildCondition(filter.not, tableName, params, paramIndex);
      return { sql: `NOT (${result.sql})`, paramIndex: result.paramIndex };
    }

    // Handle field-based condition
    if (filter.field) {
      const fieldName = fieldMappings[filter.field] || filter.field;
      const operator = filter.operator || 'equals';
      const value = filter.value;
      const placeholder = db.isPostgres() ? `$${paramIndex}` : '?';

      switch (operator) {
        case 'equals':
          params.push(value);
          return { sql: `${fieldName} = ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'not_equals':
          params.push(value);
          return { sql: `${fieldName} != ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'contains':
          params.push(`%${value}%`);
          return { sql: `${fieldName} LIKE ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'starts_with':
          params.push(`${value}%`);
          return { sql: `${fieldName} LIKE ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'ends_with':
          params.push(`%${value}`);
          return { sql: `${fieldName} LIKE ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'greater_than':
          params.push(value);
          return { sql: `${fieldName} > ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'greater_than_or_equals':
          params.push(value);
          return { sql: `${fieldName} >= ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'less_than':
          params.push(value);
          return { sql: `${fieldName} < ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'less_than_or_equals':
          params.push(value);
          return { sql: `${fieldName} <= ${placeholder}`, paramIndex: paramIndex + 1 };
        
        case 'in':
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map((_, i) => {
              return db.isPostgres() ? `$${paramIndex + i}` : '?';
            });
            params.push(...value);
            return { 
              sql: `${fieldName} IN (${placeholders.join(', ')})`, 
              paramIndex: paramIndex + value.length 
            };
          }
          return { sql: '1=0', paramIndex }; // Empty IN clause
        
        case 'not_in':
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map((_, i) => {
              return db.isPostgres() ? `$${paramIndex + i}` : '?';
            });
            params.push(...value);
            return { 
              sql: `${fieldName} NOT IN (${placeholders.join(', ')})`, 
              paramIndex: paramIndex + value.length 
            };
          }
          return { sql: '1=1', paramIndex }; // Empty NOT IN clause
        
        case 'is_null':
          return { sql: `${fieldName} IS NULL`, paramIndex };
        
        case 'is_not_null':
          return { sql: `${fieldName} IS NOT NULL`, paramIndex };
        
        case 'between':
          if (Array.isArray(value) && value.length === 2) {
            const ph1 = db.isPostgres() ? `$${paramIndex}` : '?';
            const ph2 = db.isPostgres() ? `$${paramIndex + 1}` : '?';
            params.push(value[0], value[1]);
            return { 
              sql: `${fieldName} BETWEEN ${ph1} AND ${ph2}`, 
              paramIndex: paramIndex + 2 
            };
          }
          return { sql: '1=1', paramIndex };
        
        default:
          return { sql: '1=1', paramIndex };
      }
    }

    return { sql: '1=1', paramIndex };
  }

  /**
   * Build ORDER BY clause from DSL sort
   * @param {Object|Array} sort - Sort specification
   * @param {string} tableName - Table name
   * @returns {string}
   */
  buildOrderBy(sort, tableName) {
    const fieldMappings = this.tableFieldMappings[tableName] || {};
    
    if (!sort) {
      return 'created_at DESC';
    }

    const sortArray = Array.isArray(sort) ? sort : [sort];
    const orderParts = [];

    for (const s of sortArray) {
      const field = fieldMappings[s.field] || s.field;
      const direction = s.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderParts.push(`${field} ${direction}`);
    }

    return orderParts.length > 0 ? orderParts.join(', ') : 'created_at DESC';
  }

  /**
   * Get base query for a table
   * @param {string} tableName - Table name
   * @returns {string}
   */
  getBaseQuery(tableName) {
    switch (tableName) {
      case 'risks':
        return `SELECT r.*, 
                u1.first_name as owner_first_name, u1.last_name as owner_last_name,
                u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
                FROM risks r 
                LEFT JOIN users u1 ON r.owner_id = u1.id 
                LEFT JOIN users u2 ON r.assigned_to = u2.id`;
      
      case 'policies':
        return `SELECT p.*, u.first_name, u.last_name 
                FROM policies p 
                LEFT JOIN users u ON p.owner_id = u.id`;
      
      case 'compliance_requirements':
        return `SELECT c.*, 
                u1.first_name as owner_first_name, u1.last_name as owner_last_name,
                u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
                FROM compliance_requirements c 
                LEFT JOIN users u1 ON c.owner_id = u1.id 
                LEFT JOIN users u2 ON c.assigned_to = u2.id`;
      
            case 'audits':
              return `SELECT a.*, 
                      u1.first_name as owner_first_name, u1.last_name as owner_last_name,
                      u2.first_name as lead_auditor_first_name, u2.last_name as lead_auditor_last_name
                      FROM audits a 
                      LEFT JOIN users u1 ON a.owner_id = u1.id 
                      LEFT JOIN users u2 ON a.lead_auditor_id = u2.id`;
      
            case 'findings':
              return `SELECT f.*, 
                      a.name as audit_name,
                      u1.first_name as owner_first_name, u1.last_name as owner_last_name,
                      u2.first_name as created_by_first_name, u2.last_name as created_by_last_name
                      FROM findings f 
                      LEFT JOIN audits a ON f.audit_id = a.id
                      LEFT JOIN users u1 ON f.owner_id = u1.id 
                      LEFT JOIN users u2 ON f.created_by = u2.id`;
      
            case 'capas':
              return `SELECT c.*, 
                      f.title as finding_title,
                      u1.first_name as owner_first_name, u1.last_name as owner_last_name,
                      u2.first_name as validated_by_first_name, u2.last_name as validated_by_last_name
                      FROM capas c 
                      LEFT JOIN findings f ON c.finding_id = f.id
                      LEFT JOIN users u1 ON c.owner_id = u1.id 
                      LEFT JOIN users u2 ON c.validated_by = u2.id`;
      
            case 'evidence':
              return `SELECT e.*, 
                      f.title as finding_title,
                      a.name as audit_name,
                      u.first_name as uploaded_by_first_name, u.last_name as uploaded_by_last_name
                      FROM evidence e 
                      LEFT JOIN findings f ON e.finding_id = f.id
                      LEFT JOIN audits a ON e.audit_id = a.id
                      LEFT JOIN users u ON e.uploaded_by = u.id`;
      
            case 'audit_reports':
              return `SELECT ar.*, 
                      a.name as audit_name,
                      u.first_name as created_by_first_name, u.last_name as created_by_last_name
                      FROM audit_reports ar 
                      LEFT JOIN audits a ON ar.audit_id = a.id
                      LEFT JOIN users u ON ar.created_by = u.id`;
      
            default:
              return `SELECT * FROM ${tableName}`;
    }
  }

  /**
   * Get count query for a table
   * @param {string} tableName - Table name
   * @returns {string}
   */
  getCountQuery(tableName) {
    switch (tableName) {
      case 'risks':
        return 'SELECT COUNT(*) as total FROM risks r';
      case 'policies':
        return 'SELECT COUNT(*) as total FROM policies p';
      case 'compliance_requirements':
        return 'SELECT COUNT(*) as total FROM compliance_requirements c';
            case 'audits':
              return 'SELECT COUNT(*) as total FROM audits a';
            case 'findings':
              return 'SELECT COUNT(*) as total FROM findings f';
            case 'capas':
              return 'SELECT COUNT(*) as total FROM capas c';
            case 'evidence':
              return 'SELECT COUNT(*) as total FROM evidence e';
            case 'audit_reports':
              return 'SELECT COUNT(*) as total FROM audit_reports ar';
            default:
              return `SELECT COUNT(*) as total FROM ${tableName}`;
    }
  }

  /**
   * Search records using DSL query
   * @param {string} tableName - Table name
   * @param {Object} query - DSL query object
   * @param {Object} user - User object for ACL filtering
   * @returns {Promise<{records: Object[], pagination: Object}>}
   */
  async search(tableName, query, user) {
    if (!this.supportedTables.includes(tableName)) {
      throw new Error(`Unsupported table: ${tableName}`);
    }

    const { filter, sort, page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const params = [];
    const { sql: whereClause, paramIndex } = this.buildCondition(filter, tableName, params);

    // Build ORDER BY clause
    const orderBy = this.buildOrderBy(sort, tableName);

    // Build main query
    const baseQuery = this.getBaseQuery(tableName);
    const limitPlaceholder = db.isPostgres() ? `$${paramIndex}` : '?';
    const offsetPlaceholder = db.isPostgres() ? `$${paramIndex + 1}` : '?';
    
    const mainQuery = `${baseQuery} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
    params.push(limit, offset);

    // Execute main query
    const records = await db.all(mainQuery, params);

    // Build and execute count query
    const countQuery = `${this.getCountQuery(tableName)} WHERE ${whereClause}`;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await db.get(countQuery, countParams);
    const total = countResult?.total || 0;

    // Apply ACL filtering if user is provided
    let filteredRecords = records;
    if (user && user.role !== 'admin') {
      filteredRecords = await aclService.filterRecords(user, tableName, records);
    }

    return {
      records: filteredRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get distinct values for a field (for filter dropdowns)
   * @param {string} tableName - Table name
   * @param {string} fieldName - Field name
   * @returns {Promise<Array>}
   */
  async getDistinctValues(tableName, fieldName) {
    if (!this.supportedTables.includes(tableName)) {
      throw new Error(`Unsupported table: ${tableName}`);
    }

    const fieldMappings = this.tableFieldMappings[tableName] || {};
    const field = fieldMappings[fieldName] || fieldName;
    
    // Extract just the column name without table alias
    const columnName = field.includes('.') ? field.split('.')[1] : field;

    const query = `SELECT DISTINCT ${columnName} FROM ${tableName} WHERE ${columnName} IS NOT NULL ORDER BY ${columnName}`;
    const results = await db.all(query);
    
    return results.map(r => r[columnName]);
  }

  /**
   * Get field metadata for a table
   * @param {string} tableName - Table name
   * @returns {Object}
   */
  getFieldMetadata(tableName) {
    const metadata = {
      risks: {
        title: { type: 'string', label: 'Title', searchable: true },
        description: { type: 'text', label: 'Description', searchable: true },
        category: { type: 'string', label: 'Category', filterable: true },
        severity: { type: 'enum', label: 'Severity', values: ['Low', 'Medium', 'High', 'Critical'], filterable: true },
        likelihood: { type: 'enum', label: 'Likelihood', values: ['Low', 'Medium', 'High', 'Very High'], filterable: true },
        impact: { type: 'enum', label: 'Impact', values: ['Low', 'Medium', 'High', 'Critical'], filterable: true },
        risk_score: { type: 'number', label: 'Risk Score', sortable: true },
        status: { type: 'enum', label: 'Status', values: ['open', 'closed'], filterable: true },
        due_date: { type: 'date', label: 'Due Date', sortable: true },
        created_at: { type: 'datetime', label: 'Created At', sortable: true },
        updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
      },
      policies: {
        title: { type: 'string', label: 'Title', searchable: true },
        description: { type: 'text', label: 'Description', searchable: true },
        category: { type: 'string', label: 'Category', filterable: true },
        version: { type: 'string', label: 'Version' },
        status: { type: 'enum', label: 'Status', values: ['draft', 'review', 'published', 'archived'], filterable: true },
        effective_date: { type: 'date', label: 'Effective Date', sortable: true },
        review_date: { type: 'date', label: 'Review Date', sortable: true },
        created_at: { type: 'datetime', label: 'Created At', sortable: true },
        updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
      },
      compliance_requirements: {
        title: { type: 'string', label: 'Title', searchable: true },
        description: { type: 'text', label: 'Description', searchable: true },
        regulation: { type: 'string', label: 'Regulation', filterable: true },
        category: { type: 'string', label: 'Category', filterable: true },
        status: { type: 'enum', label: 'Status', values: ['pending', 'in_progress', 'completed'], filterable: true },
        due_date: { type: 'date', label: 'Due Date', sortable: true },
        created_at: { type: 'datetime', label: 'Created At', sortable: true },
        updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
      },
          audits: {
            name: { type: 'string', label: 'Name', searchable: true },
            description: { type: 'text', label: 'Description', searchable: true },
            audit_type: { type: 'enum', label: 'Audit Type', values: ['internal', 'external'], filterable: true },
            status: { type: 'enum', label: 'Status', values: ['planned', 'in_progress', 'completed', 'closed'], filterable: true },
            risk_level: { type: 'enum', label: 'Risk Level', values: ['low', 'medium', 'high', 'critical'], filterable: true },
            department: { type: 'string', label: 'Department', filterable: true },
            owner_id: { type: 'reference', label: 'Owner', filterable: true },
            lead_auditor_id: { type: 'reference', label: 'Lead Auditor', filterable: true },
            planned_start_date: { type: 'date', label: 'Planned Start Date', sortable: true },
            planned_end_date: { type: 'date', label: 'Planned End Date', sortable: true },
            actual_start_date: { type: 'date', label: 'Actual Start Date', sortable: true },
            actual_end_date: { type: 'date', label: 'Actual End Date', sortable: true },
            created_at: { type: 'datetime', label: 'Created At', sortable: true },
            updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
          },
          findings: {
            title: { type: 'string', label: 'Title', searchable: true },
            description: { type: 'text', label: 'Description', searchable: true },
            severity: { type: 'enum', label: 'Severity', values: ['low', 'medium', 'high', 'critical'], filterable: true },
            status: { type: 'enum', label: 'Status', values: ['draft', 'under_discussion', 'action_agreed', 'in_progress', 'pending_validation', 'closed', 'reopened'], filterable: true },
            audit_id: { type: 'reference', label: 'Audit', filterable: true },
            owner_id: { type: 'reference', label: 'Owner', filterable: true },
            created_at: { type: 'datetime', label: 'Created At', sortable: true },
            updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
          },
          capas: {
            title: { type: 'string', label: 'Title', searchable: true },
            description: { type: 'text', label: 'Description', searchable: true },
            type: { type: 'enum', label: 'Type', values: ['corrective', 'preventive', 'containment'], filterable: true },
            status: { type: 'enum', label: 'Status', values: ['not_started', 'in_progress', 'implemented', 'overdue'], filterable: true },
            validation_status: { type: 'enum', label: 'Validation Status', values: ['not_validated', 'validated', 'rejected'], filterable: true },
            finding_id: { type: 'reference', label: 'Finding', filterable: true },
            owner_id: { type: 'reference', label: 'Owner', filterable: true },
            due_date: { type: 'date', label: 'Due Date', sortable: true },
            created_at: { type: 'datetime', label: 'Created At', sortable: true },
            updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
          },
          evidence: {
            title: { type: 'string', label: 'Title', searchable: true },
            description: { type: 'text', label: 'Description', searchable: true },
            type: { type: 'enum', label: 'Type', values: ['document', 'screenshot', 'log', 'configuration', 'ticket', 'interview', 'observation'], filterable: true },
            storage_type: { type: 'enum', label: 'Storage Type', values: ['link', 'external', 'reference'], filterable: true },
            finding_id: { type: 'reference', label: 'Finding', filterable: true },
            audit_id: { type: 'reference', label: 'Audit', filterable: true },
            uploaded_by: { type: 'reference', label: 'Uploaded By', filterable: true },
            uploaded_at: { type: 'datetime', label: 'Uploaded At', sortable: true },
            created_at: { type: 'datetime', label: 'Created At', sortable: true },
            updated_at: { type: 'datetime', label: 'Updated At', sortable: true }
          }
        };

        return metadata[tableName] || {};
  }

  /**
   * Validate DSL query
   * @param {Object} query - DSL query object
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateQuery(query) {
    const errors = [];

    if (query.page && (typeof query.page !== 'number' || query.page < 1)) {
      errors.push('Page must be a positive number');
    }

    if (query.limit && (typeof query.limit !== 'number' || query.limit < 1 || query.limit > 100)) {
      errors.push('Limit must be a number between 1 and 100');
    }

    if (query.filter) {
      this.validateFilter(query.filter, errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate filter recursively
   * @param {Object} filter - Filter object
   * @param {string[]} errors - Errors array
   */
  validateFilter(filter, errors) {
    if (filter.and) {
      if (!Array.isArray(filter.and)) {
        errors.push('AND condition must be an array');
      } else {
        filter.and.forEach(f => this.validateFilter(f, errors));
      }
    }

    if (filter.or) {
      if (!Array.isArray(filter.or)) {
        errors.push('OR condition must be an array');
      } else {
        filter.or.forEach(f => this.validateFilter(f, errors));
      }
    }

    if (filter.not) {
      this.validateFilter(filter.not, errors);
    }

    if (filter.field) {
      if (!filter.operator) {
        errors.push(`Missing operator for field: ${filter.field}`);
      }
      
      const validOperators = [
        'equals', 'not_equals', 'contains', 'starts_with', 'ends_with',
        'greater_than', 'greater_than_or_equals', 'less_than', 'less_than_or_equals',
        'in', 'not_in', 'is_null', 'is_not_null', 'between'
      ];
      
      if (filter.operator && !validOperators.includes(filter.operator)) {
        errors.push(`Invalid operator: ${filter.operator}`);
      }
    }
  }
}

// Export singleton instance
const searchService = new SearchService();
module.exports = searchService;
