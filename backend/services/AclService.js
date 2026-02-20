/**
 * ACL Service - Access Control List Engine
 * 
 * Provides record-level and field-level access control evaluation.
 * Supports:
 * - Permission-based access (role_permissions)
 * - Record-level ACL rules (owner-based, department-based, explicit rules)
 * - Field-level ACL (hide/mask specific fields)
 */

const db = require('../db');

class AclService {
  constructor() {
    this.permissionCache = new Map();
    this.aclRuleCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.permissionCache.clear();
    this.aclRuleCache.clear();
  }

  /**
   * Get permissions for a role
   * @param {string} role - User role
   * @returns {Promise<string[]>} Array of permission keys
   */
  async getPermissionsForRole(role) {
    const cacheKey = `role:${role}`;
    const cached = this.permissionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const placeholder = db.isPostgres() ? '$1' : '?';
    const permissions = await db.all(
      `SELECT p.key FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role = ${placeholder}`,
      [role]
    );

    const permKeys = permissions.map(p => p.key);
    this.permissionCache.set(cacheKey, { data: permKeys, timestamp: Date.now() });
    return permKeys;
  }

  /**
   * Check if user has a specific permission
   * @param {Object} user - User object with id and role
   * @param {string} permissionKey - Permission key (e.g., 'risk.read')
   * @returns {Promise<boolean>}
   */
  async hasPermission(user, permissionKey) {
    if (!user || !user.role) return false;
    const permissions = await this.getPermissionsForRole(user.role);
    return permissions.includes(permissionKey);
  }

  /**
   * Get ACL rules for a table
   * @param {string} tableName - Table name
   * @returns {Promise<Object[]>} Array of ACL rules
   */
  async getAclRulesForTable(tableName) {
    const cacheKey = `acl:${tableName}`;
    const cached = this.aclRuleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const placeholder = db.isPostgres() ? '$1' : '?';
    const rules = await db.all(
      `SELECT * FROM acl_rules 
       WHERE table_name = ${placeholder} AND is_active = ${db.isPostgres() ? 'TRUE' : '1'}
       ORDER BY priority DESC`,
      [tableName]
    );

    // Parse JSON fields
    const parsedRules = rules.map(rule => ({
      ...rule,
      conditions: this.parseJson(rule.conditions),
      fields: this.parseJson(rule.fields),
      actions: rule.actions ? rule.actions.split(',').map(a => a.trim()) : []
    }));

    this.aclRuleCache.set(cacheKey, { data: parsedRules, timestamp: Date.now() });
    return parsedRules;
  }

  /**
   * Parse JSON safely
   * @param {string|Object} value - JSON string or object
   * @returns {Object|null}
   */
  parseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Evaluate a condition against a record and user
   * @param {Object} condition - Condition object
   * @param {Object} user - User object
   * @param {Object} record - Record object (optional)
   * @returns {boolean}
   */
  evaluateCondition(condition, user, record = null) {
    if (!condition) return true;

    // Handle owner-based condition
    if (condition.owner_id === '{{user.id}}') {
      return record && record.owner_id === user.id;
    }

    // Handle created_by condition
    if (condition.created_by === '{{user.id}}') {
      return record && record.created_by === user.id;
    }

    // Handle role-based condition
    if (condition.role) {
      if (Array.isArray(condition.role)) {
        return condition.role.includes(user.role);
      }
      return condition.role === user.role;
    }

    // Handle department-based condition
    if (condition.department && user.department) {
      return condition.department === user.department;
    }

    // Handle explicit user_id condition
    if (condition.user_id) {
      if (Array.isArray(condition.user_id)) {
        return condition.user_id.includes(user.id);
      }
      return condition.user_id === user.id;
    }

    // Handle field value conditions
    if (condition.field && record) {
      const fieldValue = record[condition.field];
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        case 'is_null':
          return fieldValue === null || fieldValue === undefined;
        case 'is_not_null':
          return fieldValue !== null && fieldValue !== undefined;
        default:
          return true;
      }
    }

    return true;
  }

  /**
   * Check if user can perform an action on a record
   * @param {Object} user - User object with id, role, department
   * @param {string} action - Action (read, write, delete, assign)
   * @param {string} tableName - Table name
   * @param {Object} record - Record object (optional for list operations)
   * @param {string} fieldName - Field name (optional for field-level check)
   * @returns {Promise<{allowed: boolean, deniedFields: string[], maskedFields: string[]}>}
   */
  async can(user, action, tableName, record = null, fieldName = null) {
    const result = {
      allowed: false,
      deniedFields: [],
      maskedFields: []
    };

    if (!user || !user.role) {
      return result;
    }

    // First check permission-based access
    const permissionKey = `${tableName.replace('_', '')}.${action}`;
    const hasBasicPermission = await this.hasPermission(user, permissionKey);
    
    // Admin always has access
    if (user.role === 'admin') {
      result.allowed = true;
      return result;
    }

    if (!hasBasicPermission) {
      return result;
    }

    // Get ACL rules for the table
    const rules = await this.getAclRulesForTable(tableName);
    
    // Default to allowed if user has permission and no deny rules match
    result.allowed = true;

    // Evaluate each rule
    for (const rule of rules) {
      // Check if rule applies to this action
      if (!rule.actions.includes(action)) {
        continue;
      }

      // Evaluate condition
      const conditionMatches = this.evaluateCondition(rule.conditions, user, record);
      
      if (!conditionMatches) {
        continue;
      }

      // Handle field-level rules
      if (rule.fields && rule.fields.length > 0) {
        if (fieldName) {
          // Checking specific field
          if (rule.fields.includes(fieldName)) {
            if (rule.effect === 'deny') {
              result.deniedFields.push(fieldName);
              if (action === 'read') {
                result.maskedFields.push(fieldName);
              }
            }
          }
        } else {
          // Collecting all denied/masked fields
          if (rule.effect === 'deny') {
            result.deniedFields.push(...rule.fields);
            if (action === 'read') {
              result.maskedFields.push(...rule.fields);
            }
          }
        }
        continue;
      }

      // Handle record-level rules
      if (rule.effect === 'allow') {
        result.allowed = true;
      } else if (rule.effect === 'deny') {
        result.allowed = false;
        break; // Deny takes precedence
      }
    }

    // Remove duplicates
    result.deniedFields = [...new Set(result.deniedFields)];
    result.maskedFields = [...new Set(result.maskedFields)];

    return result;
  }

  /**
   * Filter records based on ACL rules
   * @param {Object} user - User object
   * @param {string} tableName - Table name
   * @param {Object[]} records - Array of records
   * @returns {Promise<Object[]>} Filtered records with masked fields
   */
  async filterRecords(user, tableName, records) {
    if (!records || records.length === 0) return [];
    if (user.role === 'admin') return records;

    const filteredRecords = [];

    for (const record of records) {
      const aclResult = await this.can(user, 'read', tableName, record);
      
      if (aclResult.allowed) {
        // Mask denied fields
        const maskedRecord = { ...record };
        for (const field of aclResult.maskedFields) {
          if (maskedRecord[field] !== undefined) {
            maskedRecord[field] = '***MASKED***';
          }
        }
        filteredRecords.push(maskedRecord);
      }
    }

    return filteredRecords;
  }

  /**
   * Get all permissions
   * @returns {Promise<Object[]>}
   */
  async getAllPermissions() {
    return await db.all('SELECT * FROM permissions ORDER BY module, key');
  }

  /**
   * Get all ACL rules
   * @returns {Promise<Object[]>}
   */
  async getAllAclRules() {
    const rules = await db.all('SELECT * FROM acl_rules ORDER BY table_name, priority DESC');
    return rules.map(rule => ({
      ...rule,
      conditions: this.parseJson(rule.conditions),
      fields: this.parseJson(rule.fields),
      actions: rule.actions ? rule.actions.split(',').map(a => a.trim()) : []
    }));
  }

  /**
   * Create a new ACL rule
   * @param {Object} rule - ACL rule data
   * @returns {Promise<Object>}
   */
  async createAclRule(rule) {
    const { name, table_name, effect, conditions, fields, actions, priority = 0 } = rule;
    
    const conditionsJson = typeof conditions === 'string' ? conditions : JSON.stringify(conditions);
    const fieldsJson = fields ? (typeof fields === 'string' ? fields : JSON.stringify(fields)) : null;
    const actionsStr = Array.isArray(actions) ? actions.join(',') : actions;

    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO acl_rules (name, table_name, effect, conditions, fields, actions, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [name, table_name, effect, conditionsJson, fieldsJson, actionsStr, priority]
      );
      this.clearCache();
      return { id: result.lastID, ...rule };
    } else {
      const result = await db.run(
        `INSERT INTO acl_rules (name, table_name, effect, conditions, fields, actions, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, table_name, effect, conditionsJson, fieldsJson, actionsStr, priority]
      );
      this.clearCache();
      return { id: result.lastID, ...rule };
    }
  }

  /**
   * Update an ACL rule
   * @param {number} id - Rule ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>}
   */
  async updateAclRule(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'table_name', 'effect', 'conditions', 'fields', 'actions', 'priority', 'is_active'].includes(key)) {
        let processedValue = value;
        if (key === 'conditions' || key === 'fields') {
          processedValue = typeof value === 'string' ? value : JSON.stringify(value);
        }
        if (key === 'actions' && Array.isArray(value)) {
          processedValue = value.join(',');
        }
        
        if (db.isPostgres()) {
          fields.push(`${key} = $${paramIndex++}`);
        } else {
          fields.push(`${key} = ?`);
        }
        values.push(processedValue);
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const placeholder = db.isPostgres() ? `$${paramIndex}` : '?';
    const result = await db.run(
      `UPDATE acl_rules SET ${fields.join(', ')} WHERE id = ${placeholder}`,
      values
    );

    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Delete an ACL rule
   * @param {number} id - Rule ID
   * @returns {Promise<boolean>}
   */
  async deleteAclRule(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM acl_rules WHERE id = ${placeholder}`,
      [id]
    );
    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Assign permission to role
   * @param {string} role - Role name
   * @param {string} permissionKey - Permission key
   * @returns {Promise<boolean>}
   */
  async assignPermissionToRole(role, permissionKey) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const permission = await db.get(
      `SELECT id FROM permissions WHERE key = ${placeholder}`,
      [permissionKey]
    );

    if (!permission) return false;

    try {
      if (db.isPostgres()) {
        await db.run(
          `INSERT INTO role_permissions (role, permission_id) VALUES ($1, $2)
           ON CONFLICT (role, permission_id) DO NOTHING`,
          [role, permission.id]
        );
      } else {
        await db.run(
          `INSERT OR IGNORE INTO role_permissions (role, permission_id) VALUES (?, ?)`,
          [role, permission.id]
        );
      }
      this.clearCache();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove permission from role
   * @param {string} role - Role name
   * @param {string} permissionKey - Permission key
   * @returns {Promise<boolean>}
   */
  async removePermissionFromRole(role, permissionKey) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const permission = await db.get(
      `SELECT id FROM permissions WHERE key = ${placeholder}`,
      [permissionKey]
    );

    if (!permission) return false;

    const placeholder2 = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    const result = await db.run(
      `DELETE FROM role_permissions WHERE role = ${placeholder2[0]} AND permission_id = ${placeholder2[1]}`,
      [role, permission.id]
    );

    this.clearCache();
    return result.rowCount > 0;
  }
}

// Export singleton instance
const aclService = new AclService();
module.exports = aclService;
