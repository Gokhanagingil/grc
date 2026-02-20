/**
 * Metadata Service
 * 
 * Provides business logic for the Metadata Engine:
 * - Metadata types management
 * - Metadata values management
 * - Object metadata assignment
 */

const db = require('../db');

class MetadataService {
  /**
   * Get all metadata types
   */
  async getTypes() {
    const placeholder = db.isPostgres() ? '' : '';
    return await db.all(
      `SELECT * FROM metadata_types ORDER BY name`
    );
  }

  /**
   * Get a metadata type by ID
   */
  async getTypeById(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.get(
      `SELECT * FROM metadata_types WHERE id = ${placeholder}`,
      [id]
    );
  }

  /**
   * Get a metadata type by name
   */
  async getTypeByName(name) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.get(
      `SELECT * FROM metadata_types WHERE name = ${placeholder}`,
      [name]
    );
  }

  /**
   * Create a new metadata type
   */
  async createType(name, description) {
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO metadata_types (name, description) VALUES ($1, $2) RETURNING id`,
        [name, description]
      );
      return { id: result.lastID, name, description };
    } else {
      const result = await db.run(
        `INSERT INTO metadata_types (name, description) VALUES (?, ?)`,
        [name, description]
      );
      return { id: result.lastID, name, description };
    }
  }

  /**
   * Update a metadata type
   */
  async updateType(id, name, description) {
    const placeholder = db.isPostgres() ? ['$1', '$2', '$3'] : ['?', '?', '?'];
    await db.run(
      `UPDATE metadata_types SET name = ${placeholder[0]}, description = ${placeholder[1]}, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder[2]}`,
      [name, description, id]
    );
    return this.getTypeById(id);
  }

  /**
   * Delete a metadata type
   */
  async deleteType(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM metadata_types WHERE id = ${placeholder}`,
      [id]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  /**
   * Get all values for a metadata type
   */
  async getValuesByTypeId(typeId) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.all(
      `SELECT mv.*, mt.name as type_name 
       FROM metadata_values mv
       JOIN metadata_types mt ON mv.type_id = mt.id
       WHERE mv.type_id = ${placeholder}
       ORDER BY mv.value`,
      [typeId]
    );
  }

  /**
   * Get all metadata values
   */
  async getAllValues() {
    return await db.all(
      `SELECT mv.*, mt.name as type_name 
       FROM metadata_values mv
       JOIN metadata_types mt ON mv.type_id = mt.id
       ORDER BY mt.name, mv.value`
    );
  }

  /**
   * Get a metadata value by ID
   */
  async getValueById(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    return await db.get(
      `SELECT mv.*, mt.name as type_name 
       FROM metadata_values mv
       JOIN metadata_types mt ON mv.type_id = mt.id
       WHERE mv.id = ${placeholder}`,
      [id]
    );
  }

  /**
   * Create a new metadata value
   */
  async createValue(typeId, value, color, description) {
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO metadata_values (type_id, value, color, description) VALUES ($1, $2, $3, $4) RETURNING id`,
        [typeId, value, color, description]
      );
      return { id: result.lastID, type_id: typeId, value, color, description };
    } else {
      const result = await db.run(
        `INSERT INTO metadata_values (type_id, value, color, description) VALUES (?, ?, ?, ?)`,
        [typeId, value, color, description]
      );
      return { id: result.lastID, type_id: typeId, value, color, description };
    }
  }

  /**
   * Update a metadata value
   */
  async updateValue(id, value, color, description) {
    const placeholder = db.isPostgres() ? ['$1', '$2', '$3', '$4'] : ['?', '?', '?', '?'];
    await db.run(
      `UPDATE metadata_values SET value = ${placeholder[0]}, color = ${placeholder[1]}, description = ${placeholder[2]}, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder[3]}`,
      [value, color, description, id]
    );
    return this.getValueById(id);
  }

  /**
   * Delete a metadata value
   */
  async deleteValue(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM metadata_values WHERE id = ${placeholder}`,
      [id]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  /**
   * Assign metadata to an object
   */
  async assignMetadata(objectType, objectId, metadataValueId, userId) {
    const placeholder = db.isPostgres() ? ['$1', '$2', '$3', '$4'] : ['?', '?', '?', '?'];
    
    // Check if already assigned
    const existing = await db.get(
      `SELECT id FROM object_metadata WHERE object_type = ${placeholder[0]} AND object_id = ${placeholder[1]} AND metadata_value_id = ${placeholder[2]}`,
      [objectType, objectId, metadataValueId]
    );
    
    if (existing) {
      return { id: existing.id, object_type: objectType, object_id: objectId, metadata_value_id: metadataValueId, already_exists: true };
    }
    
    if (db.isPostgres()) {
      const result = await db.run(
        `INSERT INTO object_metadata (object_type, object_id, metadata_value_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [objectType, objectId, metadataValueId, userId]
      );
      return { id: result.lastID, object_type: objectType, object_id: objectId, metadata_value_id: metadataValueId };
    } else {
      const result = await db.run(
        `INSERT INTO object_metadata (object_type, object_id, metadata_value_id, created_by) VALUES (?, ?, ?, ?)`,
        [objectType, objectId, metadataValueId, userId]
      );
      return { id: result.lastID, object_type: objectType, object_id: objectId, metadata_value_id: metadataValueId };
    }
  }

  /**
   * Remove metadata assignment
   */
  async removeMetadataAssignment(id) {
    const placeholder = db.isPostgres() ? '$1' : '?';
    const result = await db.run(
      `DELETE FROM object_metadata WHERE id = ${placeholder}`,
      [id]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  /**
   * Remove metadata assignment by object and value
   */
  async removeMetadataByObjectAndValue(objectType, objectId, metadataValueId) {
    const placeholder = db.isPostgres() ? ['$1', '$2', '$3'] : ['?', '?', '?'];
    const result = await db.run(
      `DELETE FROM object_metadata WHERE object_type = ${placeholder[0]} AND object_id = ${placeholder[1]} AND metadata_value_id = ${placeholder[2]}`,
      [objectType, objectId, metadataValueId]
    );
    return result.rowCount > 0 || result.changes > 0;
  }

  /**
   * Get all metadata assigned to an object
   */
  async getAssignedMetadata(objectType, objectId) {
    const placeholder = db.isPostgres() ? ['$1', '$2'] : ['?', '?'];
    return await db.all(
      `SELECT om.*, mv.value, mv.color, mv.description as value_description, mt.name as type_name, mt.id as type_id
       FROM object_metadata om
       JOIN metadata_values mv ON om.metadata_value_id = mv.id
       JOIN metadata_types mt ON mv.type_id = mt.id
       WHERE om.object_type = ${placeholder[0]} AND om.object_id = ${placeholder[1]}
       ORDER BY mt.name, mv.value`,
      [objectType, objectId]
    );
  }

  /**
   * Get objects by metadata value
   */
  async getObjectsByMetadataValue(metadataValueId, objectType = null) {
    let query = `
      SELECT om.*, mv.value, mv.color, mt.name as type_name
      FROM object_metadata om
      JOIN metadata_values mv ON om.metadata_value_id = mv.id
      JOIN metadata_types mt ON mv.type_id = mt.id
      WHERE om.metadata_value_id = ${db.isPostgres() ? '$1' : '?'}
    `;
    const params = [metadataValueId];
    
    if (objectType) {
      query += ` AND om.object_type = ${db.isPostgres() ? '$2' : '?'}`;
      params.push(objectType);
    }
    
    query += ' ORDER BY om.object_type, om.object_id';
    
    return await db.all(query, params);
  }

  /**
   * Get metadata statistics
   */
  async getMetadataStats() {
    const stats = await db.all(`
      SELECT mt.name as type_name, mv.value, mv.color, COUNT(om.id) as usage_count
      FROM metadata_types mt
      LEFT JOIN metadata_values mv ON mt.id = mv.type_id
      LEFT JOIN object_metadata om ON mv.id = om.metadata_value_id
      GROUP BY mt.id, mt.name, mv.id, mv.value, mv.color
      ORDER BY mt.name, mv.value
    `);
    
    return stats;
  }

  /**
   * Get metadata count by object type
   */
  async getMetadataCountByObjectType() {
    return await db.all(`
      SELECT object_type, COUNT(*) as count
      FROM object_metadata
      GROUP BY object_type
      ORDER BY count DESC
    `);
  }
}

module.exports = new MetadataService();
