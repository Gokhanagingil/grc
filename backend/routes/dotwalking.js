const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { DotWalkingParser } = require('../utils/dot-walking-parser');
const { DotWalkingResolver } = require('../utils/dot-walking-resolver');
const { getDb } = require('../database/connection');

const parser = new DotWalkingParser();

router.get('/schema', authenticateToken, (req, res) => {
  try {
    const schema = {
      entities: parser.validEntities,
      fields: parser.entityFields,
      relationships: parser.relationshipMap
    };
    res.json(schema);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schema', message: error.message });
  }
});

router.post('/parse', authenticateToken, (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const result = parser.parse(path);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse path', message: error.message });
  }
});

router.post('/validate', authenticateToken, (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const isValid = parser.validate(path);
    const parsed = parser.parse(path);
    
    res.json({
      valid: isValid,
      error: parsed.error,
      depth: parsed.depth,
      segments: parsed.segments
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate path', message: error.message });
  }
});

router.get('/suggestions', authenticateToken, (req, res) => {
  try {
    const { path } = req.query;
    const suggestions = parser.getSuggestions(path || '');
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get suggestions', message: error.message });
  }
});

router.post('/resolve', authenticateToken, async (req, res) => {
  try {
    const { path, limit = 100, offset = 0, filters = {} } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const db = getDb();
    const resolver = new DotWalkingResolver(db);
    
    const result = await resolver.resolve(path, {
      userId: req.user.id,
      limit: Math.min(limit, 1000),
      offset,
      filters
    });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: 'Failed to resolve path', message: error.message });
  }
});

router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const db = getDb();
    const resolver = new DotWalkingResolver(db);
    
    const result = await resolver.testPath(path);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: 'Failed to test path', message: error.message });
  }
});

router.get('/fields/:entity', authenticateToken, (req, res) => {
  try {
    const { entity } = req.params;
    const fields = parser.getAvailableFields(entity);
    const relationships = parser.getAvailableRelationships(entity);
    
    if (fields.length === 0 && relationships.length === 0) {
      return res.status(404).json({ error: `Entity '${entity}' not found` });
    }
    
    res.json({ entity, fields, relationships });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get fields', message: error.message });
  }
});

module.exports = router;
