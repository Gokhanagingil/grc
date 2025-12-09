/**
 * UI Policy Service - No-code Conditional Rules Engine
 * 
 * Provides ServiceNow-like dynamic behavior:
 * - If (field == value) -> hide/show field
 * - If (role == X) -> make field mandatory
 * - If (status == "closed") -> disable editing
 * 
 * Evaluation happens client-side, this service provides the policies.
 */

const db = require('../db');

class UiPolicyService {
  constructor() {
    this.policyCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.policyCache.clear();
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
   * Get UI policies for a table
   * @param {string} tableName - Table name
   * @returns {Promise<Object[]>} Array of UI policies
   */
  async getPolicies(tableName) {
    const cacheKey = `policies:${tableName}`;
    const cached = this.policyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const placeholder = db.isPostgres() ? '$1' : '?';
    const policies = await db.all(
      `SELECT * FROM ui_policies 
       WHERE table_name = ${placeholder} AND is_active = ${db.isPostgres() ? 'TRUE' : '1'}
       ORDER BY priority DESC`,
      [tableName]
    );

    const parsedPolicies = policies.map(policy => ({
      ...policy,
      condition: this.parseJson(policy.condition),
      actions: this.parseJson(policy.actions)
    }));

    this.policyCache.set(cacheKey, { data: parsedPolicies, timestamp: Date.now() });
    return parsedPolicies;
  }

  /**
   * Get all UI policies
   * @returns {Promise<Object[]>} Array of all UI policies
   */
  async getAllPolicies() {
    const policies = await db.all('SELECT * FROM ui_policies ORDER BY table_name, priority DESC');
    return policies.map(policy => ({
      ...policy,
      condition: this.parseJson(policy.condition),
      actions: this.parseJson(policy.actions)
    }));
  }

  /**
   * Get a single UI policy by ID
   * @param {number} id - Policy ID
   * @returns {Promise<Object|null>}
   */
  async getPolicyById(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const policy = await db.get(
      `SELECT * FROM ui_policies WHERE id = ${placeholder}`,
      [id]
    );
    if (!policy) return null;
    return {
      ...policy,
      condition: this.parseJson(policy.condition),
      actions: this.parseJson(policy.actions)
    };
  }

  /**
   * Create a new UI policy
   * @param {Object} policyData - Policy data
   * @returns {Promise<Object>}
   */
  async createPolicy(policyData) {
    const { name, table_name, condition, actions, priority = 0 } = policyData;
    
    const conditionJson = typeof condition === 'string' ? condition : JSON.stringify(condition);
    const actionsJson = typeof actions === 'string' ? actions : JSON.stringify(actions);

    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO ui_policies (name, table_name, condition, actions, priority)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name, table_name, conditionJson, actionsJson, priority]
      );
      this.clearCache();
      return { id: result.lastID, ...policyData };
    } else {
      const result = await db.run(
        `INSERT INTO ui_policies (name, table_name, condition, actions, priority)
         VALUES (?, ?, ?, ?, ?)`,
        [name, table_name, conditionJson, actionsJson, priority]
      );
      this.clearCache();
      return { id: result.lastID, ...policyData };
    }
  }

  /**
   * Update a UI policy
   * @param {number} id - Policy ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>}
   */
  async updatePolicy(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'table_name', 'condition', 'actions', 'priority', 'is_active'].includes(key)) {
        let processedValue = value;
        if (key === 'condition' || key === 'actions') {
          processedValue = typeof value === 'string' ? value : JSON.stringify(value);
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
      `UPDATE ui_policies SET ${fields.join(', ')} WHERE id = ${placeholder}`,
      values
    );

    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Delete a UI policy
   * @param {number} id - Policy ID
   * @returns {Promise<boolean>}
   */
  async deletePolicy(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM ui_policies WHERE id = ${placeholder}`,
      [id]
    );
    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Evaluate a condition against form data (server-side evaluation)
   * Note: Primary evaluation happens client-side, this is for validation
   * @param {Object} condition - Condition object
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context (user, role, etc.)
   * @returns {boolean}
   */
  evaluateCondition(condition, formData, context = {}) {
    if (!condition) return false;

    // Always true condition
    if (condition.always === true) return true;

    // Field-based condition
    if (condition.field) {
      const fieldValue = formData[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        case 'is_empty':
          return !fieldValue || fieldValue === '' || fieldValue === null;
        case 'is_not_empty':
          return fieldValue && fieldValue !== '' && fieldValue !== null;
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'starts_with':
          return String(fieldValue).startsWith(String(condition.value));
        case 'ends_with':
          return String(fieldValue).endsWith(String(condition.value));
        default:
          return false;
      }
    }

    // Role-based condition
    if (condition.role && context.user) {
      if (Array.isArray(condition.role)) {
        return condition.role.includes(context.user.role);
      }
      return condition.role === context.user.role;
    }

    // AND condition (all must be true)
    if (condition.and && Array.isArray(condition.and)) {
      return condition.and.every(c => this.evaluateCondition(c, formData, context));
    }

    // OR condition (at least one must be true)
    if (condition.or && Array.isArray(condition.or)) {
      return condition.or.some(c => this.evaluateCondition(c, formData, context));
    }

    // NOT condition
    if (condition.not) {
      return !this.evaluateCondition(condition.not, formData, context);
    }

    return false;
  }

  /**
   * Get applicable actions for form data
   * @param {string} tableName - Table name
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Aggregated actions
   */
  async getApplicableActions(tableName, formData, context = {}) {
    const policies = await this.getPolicies(tableName);
    
    const result = {
      hiddenFields: [],
      shownFields: [],
      readonlyFields: [],
      editableFields: [],
      mandatoryFields: [],
      optionalFields: [],
      disabledFields: []
    };

    for (const policy of policies) {
      if (this.evaluateCondition(policy.condition, formData, context)) {
        for (const action of (policy.actions || [])) {
          switch (action.type) {
            case 'hide':
              result.hiddenFields.push(...(action.fields || []));
              break;
            case 'show':
              result.shownFields.push(...(action.fields || []));
              break;
            case 'readonly':
              result.readonlyFields.push(...(action.fields || []));
              break;
            case 'editable':
              result.editableFields.push(...(action.fields || []));
              break;
            case 'mandatory':
              result.mandatoryFields.push(...(action.fields || []));
              break;
            case 'optional':
              result.optionalFields.push(...(action.fields || []));
              break;
            case 'disable':
              result.disabledFields.push(...(action.fields || []));
              break;
          }
        }
      }
    }

    // Remove duplicates
    for (const key of Object.keys(result)) {
      result[key] = [...new Set(result[key])];
    }

    return result;
  }

  /**
   * Get available tables with policies
   * @returns {Promise<string[]>}
   */
  async getTablesWithPolicies() {
    const results = await db.all(
      'SELECT DISTINCT table_name FROM ui_policies ORDER BY table_name'
    );
    return results.map(r => r.table_name);
  }

  /**
   * Validate policy structure
   * @param {Object} policy - Policy to validate
   * @returns {{valid: boolean, errors: string[]}}
   */
  validatePolicy(policy) {
    const errors = [];

    if (!policy.name || typeof policy.name !== 'string') {
      errors.push('Policy name is required and must be a string');
    }

    if (!policy.table_name || typeof policy.table_name !== 'string') {
      errors.push('Table name is required and must be a string');
    }

    if (!policy.condition) {
      errors.push('Condition is required');
    }

    if (!policy.actions || !Array.isArray(policy.actions) || policy.actions.length === 0) {
      errors.push('Actions must be a non-empty array');
    } else {
      const validActionTypes = ['hide', 'show', 'readonly', 'editable', 'mandatory', 'optional', 'disable'];
      for (const action of policy.actions) {
        if (!validActionTypes.includes(action.type)) {
          errors.push(`Invalid action type: ${action.type}`);
        }
        if (!action.fields || !Array.isArray(action.fields)) {
          errors.push('Each action must have a fields array');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
const uiPolicyService = new UiPolicyService();
module.exports = uiPolicyService;
