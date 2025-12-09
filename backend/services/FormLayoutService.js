/**
 * Form Layout Service - Dynamic Forms per Role
 * 
 * Provides form layout configuration based on user roles.
 * Supports:
 * - Field ordering and sections
 * - Hidden fields per role
 * - Readonly fields per role
 * - Custom layouts per table and role
 */

const db = require('../db');

class FormLayoutService {
  constructor() {
    this.layoutCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.layoutCache.clear();
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
   * Get layout for a table and user roles
   * @param {string} tableName - Table name
   * @param {string|string[]} userRoles - User role(s)
   * @returns {Promise<Object|null>} Layout configuration
   */
  async getLayout(tableName, userRoles) {
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    
    // Check cache first
    const cacheKey = `${tableName}:${roles.sort().join(',')}`;
    const cached = this.layoutCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Try to find layout for each role in order of priority
    // Admin > Manager > User > default
    const rolePriority = ['admin', 'manager', 'user'];
    let layout = null;

    for (const role of rolePriority) {
      if (roles.includes(role)) {
        const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
        const result = await db.get(
          `SELECT * FROM form_layouts 
           WHERE table_name = ${placeholder[0]} AND role = ${placeholder[1]} 
           AND is_active = ${db.isPostgres() ? 'TRUE' : '1'}`,
          [tableName, role]
        );
        if (result) {
          layout = {
            ...result,
            layout_json: this.parseJson(result.layout_json)
          };
          break;
        }
      }
    }

    // If no specific layout found, try to get a default layout
    if (!layout) {
      const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
      const result = await db.get(
        `SELECT * FROM form_layouts 
         WHERE table_name = ${placeholder[0]} AND role = ${placeholder[1]}
         AND is_active = ${db.isPostgres() ? 'TRUE' : '1'}`,
        [tableName, 'default']
      );
      if (result) {
        layout = {
          ...result,
          layout_json: this.parseJson(result.layout_json)
        };
      }
    }

    // Cache the result
    this.layoutCache.set(cacheKey, { data: layout, timestamp: Date.now() });
    return layout;
  }

  /**
   * Get all layouts for a table
   * @param {string} tableName - Table name
   * @returns {Promise<Object[]>} Array of layouts
   */
  async getLayoutsForTable(tableName) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const layouts = await db.all(
      `SELECT * FROM form_layouts WHERE table_name = ${placeholder} ORDER BY role`,
      [tableName]
    );
    return layouts.map(layout => ({
      ...layout,
      layout_json: this.parseJson(layout.layout_json)
    }));
  }

  /**
   * Get all layouts
   * @returns {Promise<Object[]>} Array of all layouts
   */
  async getAllLayouts() {
    const layouts = await db.all('SELECT * FROM form_layouts ORDER BY table_name, role');
    return layouts.map(layout => ({
      ...layout,
      layout_json: this.parseJson(layout.layout_json)
    }));
  }

  /**
   * Create a new form layout
   * @param {Object} layoutData - Layout data
   * @returns {Promise<Object>}
   */
  async createLayout(layoutData) {
    const { table_name, role, layout_json } = layoutData;
    
    const layoutJsonStr = typeof layout_json === 'string' 
      ? layout_json 
      : JSON.stringify(layout_json);

    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO form_layouts (table_name, role, layout_json)
         VALUES ($1, $2, $3) RETURNING id`,
        [table_name, role, layoutJsonStr]
      );
      this.clearCache();
      return { id: result.lastID, ...layoutData };
    } else {
      const result = await db.run(
        `INSERT INTO form_layouts (table_name, role, layout_json)
         VALUES (?, ?, ?)`,
        [table_name, role, layoutJsonStr]
      );
      this.clearCache();
      return { id: result.lastID, ...layoutData };
    }
  }

  /**
   * Update a form layout
   * @param {number} id - Layout ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>}
   */
  async updateLayout(id, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['table_name', 'role', 'layout_json', 'is_active'].includes(key)) {
        let processedValue = value;
        if (key === 'layout_json') {
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
      `UPDATE form_layouts SET ${fields.join(', ')} WHERE id = ${placeholder}`,
      values
    );

    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Delete a form layout
   * @param {number} id - Layout ID
   * @returns {Promise<boolean>}
   */
  async deleteLayout(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM form_layouts WHERE id = ${placeholder}`,
      [id]
    );
    this.clearCache();
    return result.rowCount > 0;
  }

  /**
   * Apply layout to form data
   * @param {Object} layout - Layout configuration
   * @param {Object} formData - Form data
   * @param {string} mode - 'view' or 'edit'
   * @returns {Object} Processed form configuration
   */
  applyLayout(layout, formData, mode = 'view') {
    if (!layout || !layout.layout_json) {
      return {
        sections: [{ title: 'Details', fields: Object.keys(formData || {}) }],
        hiddenFields: [],
        readonlyFields: [],
        data: formData
      };
    }

    const config = layout.layout_json;
    const result = {
      sections: config.sections || [],
      hiddenFields: config.hiddenFields || [],
      readonlyFields: config.readonlyFields || [],
      data: { ...formData }
    };

    // Remove hidden fields from data in view mode
    if (mode === 'view') {
      for (const field of result.hiddenFields) {
        delete result.data[field];
      }
    }

    return result;
  }

  /**
   * Get available tables with layouts
   * @returns {Promise<string[]>}
   */
  async getTablesWithLayouts() {
    const results = await db.all(
      'SELECT DISTINCT table_name FROM form_layouts ORDER BY table_name'
    );
    return results.map(r => r.table_name);
  }

  /**
   * Get default layout structure for a table
   * @param {string} tableName - Table name
   * @returns {Object} Default layout structure
   */
  getDefaultLayoutStructure(tableName) {
    const defaultLayouts = {
      risks: {
        sections: [
          { title: 'Basic Information', fields: ['title', 'description', 'category', 'status'] },
          { title: 'Risk Assessment', fields: ['severity', 'likelihood', 'impact', 'risk_score'] },
          { title: 'Mitigation', fields: ['mitigation_plan', 'assigned_to', 'due_date'] },
          { title: 'Metadata', fields: ['owner_id', 'created_at', 'updated_at'] }
        ],
        hiddenFields: [],
        readonlyFields: ['risk_score', 'created_at', 'updated_at']
      },
      policies: {
        sections: [
          { title: 'Policy Details', fields: ['title', 'description', 'category', 'version', 'status'] },
          { title: 'Dates', fields: ['effective_date', 'review_date'] },
          { title: 'Content', fields: ['content'] },
          { title: 'Metadata', fields: ['owner_id', 'created_at', 'updated_at'] }
        ],
        hiddenFields: [],
        readonlyFields: ['created_at', 'updated_at']
      },
      compliance_requirements: {
        sections: [
          { title: 'Requirement Details', fields: ['title', 'description', 'regulation', 'category'] },
          { title: 'Status', fields: ['status', 'due_date', 'assigned_to'] },
          { title: 'Evidence', fields: ['evidence'] },
          { title: 'Metadata', fields: ['owner_id', 'created_at', 'updated_at'] }
        ],
        hiddenFields: [],
        readonlyFields: ['created_at', 'updated_at']
      }
    };

    return defaultLayouts[tableName] || {
      sections: [{ title: 'Details', fields: [] }],
      hiddenFields: [],
      readonlyFields: ['created_at', 'updated_at']
    };
  }
}

// Export singleton instance
const formLayoutService = new FormLayoutService();
module.exports = formLayoutService;
