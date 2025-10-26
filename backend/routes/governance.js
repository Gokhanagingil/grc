const express = require('express');
const { getDb } = require('../database/connection');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all policies
router.get('/policies', authenticateToken, (req, res) => {
  const db = getDb();
  const { category, status, page = 1, limit = 10 } = req.query;
  
  let query = 'SELECT p.*, u.first_name, u.last_name FROM policies p LEFT JOIN users u ON p.owner_id = u.id';
  let params = [];
  let conditions = [];

  if (category) {
    conditions.push('p.category = ?');
    params.push(category);
  }

  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, policies) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM policies p';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        policies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / parseInt(limit))
        }
      });
    });
  });
});

// Get policy by ID
router.get('/policies/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.get(
    `SELECT p.*, u.first_name, u.last_name 
     FROM policies p 
     LEFT JOIN users u ON p.owner_id = u.id 
     WHERE p.id = ?`,
    [id],
    (err, policy) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!policy) {
        return res.status(404).json({ message: 'Policy not found' });
      }

      res.json(policy);
    }
  );
});

// Create new policy
router.post('/policies', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'policy'), (req, res) => {
  const db = getDb();
  const { title, description, category, version, status, effectiveDate, reviewDate, content } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  db.run(
    `INSERT INTO policies (title, description, category, version, status, owner_id, effective_date, review_date, content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, category, version || '1.0', status || 'draft', req.user.id, effectiveDate, reviewDate, content],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to create policy' });
      }

      res.status(201).json({
        message: 'Policy created successfully',
        policy: {
          id: this.lastID,
          title,
          description,
          category,
          version: version || '1.0',
          status: status || 'draft',
          ownerId: req.user.id,
          effectiveDate,
          reviewDate,
          content
        }
      });
    }
  );
});

// Update policy
router.put('/policies/:id', authenticateToken, requireRole(['admin', 'manager']), logActivity('UPDATE', 'policy'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, description, category, version, status, effectiveDate, reviewDate, content } = req.body;

  db.run(
    `UPDATE policies 
     SET title = ?, description = ?, category = ?, version = ?, status = ?, 
         effective_date = ?, review_date = ?, content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [title, description, category, version, status, effectiveDate, reviewDate, content, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to update policy' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Policy not found' });
      }

      res.json({ message: 'Policy updated successfully' });
    }
  );
});

// Delete policy
router.delete('/policies/:id', authenticateToken, requireRole(['admin']), logActivity('DELETE', 'policy'), (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.run('DELETE FROM policies WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Failed to delete policy' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    res.json({ message: 'Policy deleted successfully' });
  });
});

// Get policy categories
router.get('/policies/categories', authenticateToken, (req, res) => {
  const db = getDb();

  db.all('SELECT DISTINCT category FROM policies WHERE category IS NOT NULL', (err, categories) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(categories.map(cat => cat.category));
  });
});

// Get organizations
router.get('/organizations', authenticateToken, (req, res) => {
  const db = getDb();

  db.all('SELECT * FROM organizations ORDER BY name', (err, organizations) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(organizations);
  });
});

// Create organization
router.post('/organizations', authenticateToken, requireRole(['admin']), logActivity('CREATE', 'organization'), (req, res) => {
  const db = getDb();
  const { name, description, type, parentId } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  db.run(
    'INSERT INTO organizations (name, description, type, parent_id) VALUES (?, ?, ?, ?)',
    [name, description, type, parentId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to create organization' });
      }

      res.status(201).json({
        message: 'Organization created successfully',
        organization: {
          id: this.lastID,
          name,
          description,
          type,
          parentId
        }
      });
    }
  );
});

module.exports = router;
