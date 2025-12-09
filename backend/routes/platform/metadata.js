/**
 * Metadata Routes
 * 
 * API endpoints for the Metadata Engine:
 * - /api/platform/metadata/types - Metadata types CRUD
 * - /api/platform/metadata/types/:id/values - Metadata values CRUD
 * - /api/platform/metadata/assign - Object metadata assignment
 * - /api/platform/metadata/assigned/:objectType/:objectId - Get assigned metadata
 */

const express = require('express');
const { authenticateToken, requireRole, logActivity } = require('../../middleware/auth');
const metadataService = require('../../services/MetadataService');
const aclService = require('../../services/AclService');

const router = express.Router();

// =============================================================================
// Metadata Types
// =============================================================================

/**
 * Get all metadata types
 */
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const types = await metadataService.getTypes();
    res.json(types);
  } catch (error) {
    console.error('Error fetching metadata types:', error);
    res.status(500).json({ message: 'Failed to fetch metadata types', error: error.message });
  }
});

/**
 * Get a metadata type by ID
 */
router.get('/types/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const type = await metadataService.getTypeById(id);
    
    if (!type) {
      return res.status(404).json({ message: 'Metadata type not found' });
    }
    
    res.json(type);
  } catch (error) {
    console.error('Error fetching metadata type:', error);
    res.status(500).json({ message: 'Failed to fetch metadata type', error: error.message });
  }
});

/**
 * Create a new metadata type (Admin only)
 */
router.post('/types', authenticateToken, requireRole(['admin']), logActivity('CREATE', 'metadata_type'), async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    // Check if type already exists
    const existing = await metadataService.getTypeByName(name);
    if (existing) {
      return res.status(409).json({ message: 'Metadata type with this name already exists' });
    }
    
    const type = await metadataService.createType(name, description);
    res.status(201).json({
      message: 'Metadata type created successfully',
      type
    });
  } catch (error) {
    console.error('Error creating metadata type:', error);
    res.status(500).json({ message: 'Failed to create metadata type', error: error.message });
  }
});

/**
 * Update a metadata type (Admin only)
 */
router.put('/types/:id', authenticateToken, requireRole(['admin']), logActivity('UPDATE', 'metadata_type'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const existing = await metadataService.getTypeById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Metadata type not found' });
    }
    
    // Check if new name conflicts with another type
    if (name && name !== existing.name) {
      const nameConflict = await metadataService.getTypeByName(name);
      if (nameConflict) {
        return res.status(409).json({ message: 'Metadata type with this name already exists' });
      }
    }
    
    const type = await metadataService.updateType(id, name || existing.name, description !== undefined ? description : existing.description);
    res.json({
      message: 'Metadata type updated successfully',
      type
    });
  } catch (error) {
    console.error('Error updating metadata type:', error);
    res.status(500).json({ message: 'Failed to update metadata type', error: error.message });
  }
});

/**
 * Delete a metadata type (Admin only)
 */
router.delete('/types/:id', authenticateToken, requireRole(['admin']), logActivity('DELETE', 'metadata_type'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await metadataService.getTypeById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Metadata type not found' });
    }
    
    const deleted = await metadataService.deleteType(id);
    if (deleted) {
      res.json({ message: 'Metadata type deleted successfully' });
    } else {
      res.status(500).json({ message: 'Failed to delete metadata type' });
    }
  } catch (error) {
    console.error('Error deleting metadata type:', error);
    res.status(500).json({ message: 'Failed to delete metadata type', error: error.message });
  }
});

// =============================================================================
// Metadata Values
// =============================================================================

/**
 * Get all metadata values
 */
router.get('/values', authenticateToken, async (req, res) => {
  try {
    const values = await metadataService.getAllValues();
    res.json(values);
  } catch (error) {
    console.error('Error fetching metadata values:', error);
    res.status(500).json({ message: 'Failed to fetch metadata values', error: error.message });
  }
});

/**
 * Get values for a specific metadata type
 */
router.get('/types/:id/values', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const type = await metadataService.getTypeById(id);
    if (!type) {
      return res.status(404).json({ message: 'Metadata type not found' });
    }
    
    const values = await metadataService.getValuesByTypeId(id);
    res.json(values);
  } catch (error) {
    console.error('Error fetching metadata values:', error);
    res.status(500).json({ message: 'Failed to fetch metadata values', error: error.message });
  }
});

/**
 * Create a new metadata value (Admin only)
 */
router.post('/types/:id/values', authenticateToken, requireRole(['admin']), logActivity('CREATE', 'metadata_value'), async (req, res) => {
  try {
    const { id } = req.params;
    const { value, color, description } = req.body;
    
    if (!value) {
      return res.status(400).json({ message: 'Value is required' });
    }
    
    const type = await metadataService.getTypeById(id);
    if (!type) {
      return res.status(404).json({ message: 'Metadata type not found' });
    }
    
    const metadataValue = await metadataService.createValue(id, value, color, description);
    res.status(201).json({
      message: 'Metadata value created successfully',
      value: metadataValue
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint') || error.message.includes('duplicate key')) {
      return res.status(409).json({ message: 'This value already exists for this metadata type' });
    }
    console.error('Error creating metadata value:', error);
    res.status(500).json({ message: 'Failed to create metadata value', error: error.message });
  }
});

/**
 * Update a metadata value (Admin only)
 */
router.put('/values/:id', authenticateToken, requireRole(['admin']), logActivity('UPDATE', 'metadata_value'), async (req, res) => {
  try {
    const { id } = req.params;
    const { value, color, description } = req.body;
    
    const existing = await metadataService.getValueById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Metadata value not found' });
    }
    
    const metadataValue = await metadataService.updateValue(
      id,
      value || existing.value,
      color !== undefined ? color : existing.color,
      description !== undefined ? description : existing.description
    );
    res.json({
      message: 'Metadata value updated successfully',
      value: metadataValue
    });
  } catch (error) {
    console.error('Error updating metadata value:', error);
    res.status(500).json({ message: 'Failed to update metadata value', error: error.message });
  }
});

/**
 * Delete a metadata value (Admin only)
 */
router.delete('/values/:id', authenticateToken, requireRole(['admin']), logActivity('DELETE', 'metadata_value'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await metadataService.getValueById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Metadata value not found' });
    }
    
    const deleted = await metadataService.deleteValue(id);
    if (deleted) {
      res.json({ message: 'Metadata value deleted successfully' });
    } else {
      res.status(500).json({ message: 'Failed to delete metadata value' });
    }
  } catch (error) {
    console.error('Error deleting metadata value:', error);
    res.status(500).json({ message: 'Failed to delete metadata value', error: error.message });
  }
});

// =============================================================================
// Object Metadata Assignment
// =============================================================================

/**
 * Assign metadata to an object (Manager+)
 */
router.post('/assign', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'object_metadata'), async (req, res) => {
  try {
    const { objectType, objectId, metadataValueId } = req.body;
    
    if (!objectType || !objectId || !metadataValueId) {
      return res.status(400).json({ message: 'objectType, objectId, and metadataValueId are required' });
    }
    
    // Validate object type
    const validObjectTypes = ['requirement', 'policy', 'risk', 'finding', 'evidence', 'service', 'audit'];
    if (!validObjectTypes.includes(objectType)) {
      return res.status(400).json({ message: `Invalid objectType. Must be one of: ${validObjectTypes.join(', ')}` });
    }
    
    // Verify metadata value exists
    const metadataValue = await metadataService.getValueById(metadataValueId);
    if (!metadataValue) {
      return res.status(404).json({ message: 'Metadata value not found' });
    }
    
    const assignment = await metadataService.assignMetadata(objectType, objectId, metadataValueId, req.user.id);
    
    if (assignment.already_exists) {
      return res.status(200).json({
        message: 'Metadata already assigned to this object',
        assignment
      });
    }
    
    res.status(201).json({
      message: 'Metadata assigned successfully',
      assignment
    });
  } catch (error) {
    console.error('Error assigning metadata:', error);
    res.status(500).json({ message: 'Failed to assign metadata', error: error.message });
  }
});

/**
 * Get metadata assigned to an object
 */
router.get('/assigned/:objectType/:objectId', authenticateToken, async (req, res) => {
  try {
    const { objectType, objectId } = req.params;
    
    // Validate object type
    const validObjectTypes = ['requirement', 'policy', 'risk', 'finding', 'evidence', 'service', 'audit'];
    if (!validObjectTypes.includes(objectType)) {
      return res.status(400).json({ message: `Invalid objectType. Must be one of: ${validObjectTypes.join(', ')}` });
    }
    
    const metadata = await metadataService.getAssignedMetadata(objectType, objectId);
    res.json(metadata);
  } catch (error) {
    console.error('Error fetching assigned metadata:', error);
    res.status(500).json({ message: 'Failed to fetch assigned metadata', error: error.message });
  }
});

/**
 * Remove metadata assignment (Manager+)
 */
router.delete('/assigned/:id', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'object_metadata'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await metadataService.removeMetadataAssignment(id);
    if (deleted) {
      res.json({ message: 'Metadata assignment removed successfully' });
    } else {
      res.status(404).json({ message: 'Metadata assignment not found' });
    }
  } catch (error) {
    console.error('Error removing metadata assignment:', error);
    res.status(500).json({ message: 'Failed to remove metadata assignment', error: error.message });
  }
});

/**
 * Remove metadata assignment by object and value (Manager+)
 */
router.delete('/assigned/:objectType/:objectId/:metadataValueId', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'object_metadata'), async (req, res) => {
  try {
    const { objectType, objectId, metadataValueId } = req.params;
    
    const deleted = await metadataService.removeMetadataByObjectAndValue(objectType, objectId, metadataValueId);
    if (deleted) {
      res.json({ message: 'Metadata assignment removed successfully' });
    } else {
      res.status(404).json({ message: 'Metadata assignment not found' });
    }
  } catch (error) {
    console.error('Error removing metadata assignment:', error);
    res.status(500).json({ message: 'Failed to remove metadata assignment', error: error.message });
  }
});

// =============================================================================
// Metadata Statistics
// =============================================================================

/**
 * Get metadata statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await metadataService.getMetadataStats();
    const countByObjectType = await metadataService.getMetadataCountByObjectType();
    
    res.json({
      valueUsage: stats,
      objectTypeCounts: countByObjectType
    });
  } catch (error) {
    console.error('Error fetching metadata statistics:', error);
    res.status(500).json({ message: 'Failed to fetch metadata statistics', error: error.message });
  }
});

module.exports = router;
