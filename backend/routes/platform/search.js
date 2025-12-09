/**
 * Search Routes - DSL-based Query API
 * 
 * Provides endpoints for:
 * - Searching records using DSL queries
 * - Getting field metadata
 * - Getting distinct values for filters
 */

const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const searchService = require('../../services/SearchService');

const router = express.Router();

/**
 * POST /api/platform/search/:tableName
 * Search records using DSL query
 */
router.post('/:tableName', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const query = req.body;

    // Validate query
    const validation = searchService.validateQuery(query);
    if (!validation.valid) {
      return res.status(400).json({ 
        message: 'Invalid query',
        errors: validation.errors 
      });
    }

    const result = await searchService.search(tableName, query, req.user);
    res.json(result);
  } catch (error) {
    console.error('Error searching records:', error);
    if (error.message.includes('Unsupported table')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to search records' });
  }
});

/**
 * GET /api/platform/search/:tableName/metadata
 * Get field metadata for a table
 */
router.get('/:tableName/metadata', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.params;
    const metadata = searchService.getFieldMetadata(tableName);
    
    if (Object.keys(metadata).length === 0) {
      return res.status(404).json({ message: 'Table metadata not found' });
    }

    res.json({ tableName, fields: metadata });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ message: 'Failed to fetch metadata' });
  }
});

/**
 * GET /api/platform/search/:tableName/distinct/:fieldName
 * Get distinct values for a field
 */
router.get('/:tableName/distinct/:fieldName', authenticateToken, async (req, res) => {
  try {
    const { tableName, fieldName } = req.params;
    const values = await searchService.getDistinctValues(tableName, fieldName);
    res.json({ tableName, fieldName, values });
  } catch (error) {
    console.error('Error fetching distinct values:', error);
    if (error.message.includes('Unsupported table')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to fetch distinct values' });
  }
});

/**
 * GET /api/platform/search/tables
 * Get list of searchable tables
 */
router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = searchService.supportedTables.map(table => ({
      name: table,
      metadata: searchService.getFieldMetadata(table)
    }));
    res.json({ tables });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ message: 'Failed to fetch tables' });
  }
});

/**
 * POST /api/platform/search/validate
 * Validate a DSL query without executing
 */
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const query = req.body;
    const validation = searchService.validateQuery(query);
    res.json(validation);
  } catch (error) {
    console.error('Error validating query:', error);
    res.status(500).json({ message: 'Failed to validate query' });
  }
});

module.exports = router;
