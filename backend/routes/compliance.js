const express = require('express');
const { getDb } = require('../database/connection');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all compliance requirements
router.get('/requirements', authenticateToken, (req, res) => {
  const db = getDb();
  const { regulation, category, status, page = 1, limit = 10 } = req.query;
  
  let query = `SELECT c.*, 
               u1.first_name as owner_first_name, u1.last_name as owner_last_name,
               u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
               FROM compliance_requirements c 
               LEFT JOIN users u1 ON c.owner_id = u1.id 
               LEFT JOIN users u2 ON c.assigned_to = u2.id`;
  let params = [];
  let conditions = [];

  if (regulation) {
    conditions.push('c.regulation = ?');
    params.push(regulation);
  }

  if (category) {
    conditions.push('c.category = ?');
    params.push(category);
  }

  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY c.due_date ASC, c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, requirements) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM compliance_requirements c';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        requirements,
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

// Get compliance requirement by ID
router.get('/requirements/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.get(
    `SELECT c.*, 
     u1.first_name as owner_first_name, u1.last_name as owner_last_name,
     u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
     FROM compliance_requirements c 
     LEFT JOIN users u1 ON c.owner_id = u1.id 
     LEFT JOIN users u2 ON c.assigned_to = u2.id 
     WHERE c.id = ?`,
    [id],
    (err, requirement) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!requirement) {
        return res.status(404).json({ message: 'Compliance requirement not found' });
      }

      res.json(requirement);
    }
  );
});

// Create new compliance requirement
router.post('/requirements', authenticateToken, requireRole(['admin', 'manager']), logActivity('CREATE', 'compliance_requirement'), (req, res) => {
  const db = getDb();
  const { title, description, regulation, category, dueDate, assignedTo, evidence } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  db.run(
    `INSERT INTO compliance_requirements (title, description, regulation, category, due_date, owner_id, assigned_to, evidence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, regulation, category, dueDate, req.user.id, assignedTo, evidence, 'pending'],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to create compliance requirement' });
      }

      res.status(201).json({
        message: 'Compliance requirement created successfully',
        requirement: {
          id: this.lastID,
          title,
          description,
          regulation,
          category,
          dueDate,
          ownerId: req.user.id,
          assignedTo,
          evidence,
          status: 'pending'
        }
      });
    }
  );
});

// Update compliance requirement
router.put('/requirements/:id', authenticateToken, logActivity('UPDATE', 'compliance_requirement'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, description, regulation, category, status, dueDate, assignedTo, evidence } = req.body;

  const updateFields = [];
  const values = [];

  if (title) { updateFields.push('title = ?'); values.push(title); }
  if (description !== undefined) { updateFields.push('description = ?'); values.push(description); }
  if (regulation) { updateFields.push('regulation = ?'); values.push(regulation); }
  if (category) { updateFields.push('category = ?'); values.push(category); }
  if (status) { updateFields.push('status = ?'); values.push(status); }
  if (dueDate !== undefined) { updateFields.push('due_date = ?'); values.push(dueDate); }
  if (assignedTo !== undefined) { updateFields.push('assigned_to = ?'); values.push(assignedTo); }
  if (evidence !== undefined) { updateFields.push('evidence = ?'); values.push(evidence); }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.run(
    `UPDATE compliance_requirements SET ${updateFields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to update compliance requirement' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Compliance requirement not found' });
      }

      res.json({ message: 'Compliance requirement updated successfully' });
    }
  );
});

// Delete compliance requirement
router.delete('/requirements/:id', authenticateToken, requireRole(['admin']), logActivity('DELETE', 'compliance_requirement'), (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.run('DELETE FROM compliance_requirements WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Failed to delete compliance requirement' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Compliance requirement not found' });
    }

    res.json({ message: 'Compliance requirement deleted successfully' });
  });
});

// Get compliance categories
router.get('/requirements/categories', authenticateToken, (req, res) => {
  const db = getDb();

  db.all('SELECT DISTINCT category FROM compliance_requirements WHERE category IS NOT NULL', (err, categories) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(categories.map(cat => cat.category));
  });
});

// Get regulations
router.get('/requirements/regulations', authenticateToken, (req, res) => {
  const db = getDb();

  db.all('SELECT DISTINCT regulation FROM compliance_requirements WHERE regulation IS NOT NULL', (err, regulations) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(regulations.map(reg => reg.regulation));
  });
});

// Get compliance statistics
router.get('/requirements/statistics', authenticateToken, (req, res) => {
  const db = getDb();

  const queries = [
    'SELECT COUNT(*) as total FROM compliance_requirements',
    'SELECT COUNT(*) as pending FROM compliance_requirements WHERE status = "pending"',
    'SELECT COUNT(*) as completed FROM compliance_requirements WHERE status = "completed"',
    'SELECT COUNT(*) as overdue FROM compliance_requirements WHERE due_date < CURRENT_DATE AND status != "completed"',
    'SELECT COUNT(*) as due_soon FROM compliance_requirements WHERE due_date BETWEEN CURRENT_DATE AND DATE(CURRENT_DATE, "+7 days") AND status != "completed"'
  ];

  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.get(query, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    })
  )).then(results => {
    res.json({
      total: results[0].total,
      pending: results[1].pending,
      completed: results[2].completed,
      overdue: results[3].overdue,
      dueSoon: results[4].due_soon
    });
  }).catch(err => {
    res.status(500).json({ message: 'Database error' });
  });
});

// Get audit logs
router.get('/audit-logs', authenticateToken, requireRole(['admin', 'manager']), (req, res) => {
  const db = getDb();
  const { page = 1, limit = 20, entityType, action } = req.query;
  
  let query = `SELECT a.*, u.username, u.first_name, u.last_name 
               FROM audit_logs a 
               LEFT JOIN users u ON a.user_id = u.id`;
  let params = [];
  let conditions = [];

  if (entityType) {
    conditions.push('a.entity_type = ?');
    params.push(entityType);
  }

  if (action) {
    conditions.push('a.action = ?');
    params.push(action);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, logs) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs a';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        logs,
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

module.exports = router;
