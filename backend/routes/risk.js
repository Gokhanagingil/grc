const express = require('express');
const { getDb } = require('../database/connection');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all risks
router.get('/risks', authenticateToken, (req, res) => {
  const db = getDb();
  const { category, severity, status, page = 1, limit = 10 } = req.query;
  
  let query = `SELECT r.*, 
               u1.first_name as owner_first_name, u1.last_name as owner_last_name,
               u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
               FROM risks r 
               LEFT JOIN users u1 ON r.owner_id = u1.id 
               LEFT JOIN users u2 ON r.assigned_to = u2.id`;
  let params = [];
  let conditions = [];

  if (category) {
    conditions.push('r.category = ?');
    params.push(category);
  }

  if (severity) {
    conditions.push('r.severity = ?');
    params.push(severity);
  }

  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.risk_score DESC, r.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, risks) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM risks r';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        risks,
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

// Get risk by ID
router.get('/risks/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.get(
    `SELECT r.*, 
     u1.first_name as owner_first_name, u1.last_name as owner_last_name,
     u2.first_name as assigned_first_name, u2.last_name as assigned_last_name
     FROM risks r 
     LEFT JOIN users u1 ON r.owner_id = u1.id 
     LEFT JOIN users u2 ON r.assigned_to = u2.id 
     WHERE r.id = ?`,
    [id],
    (err, risk) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!risk) {
        return res.status(404).json({ message: 'Risk not found' });
      }

      res.json(risk);
    }
  );
});

// Create new risk
router.post('/risks', authenticateToken, logActivity('CREATE', 'risk'), (req, res) => {
  const db = getDb();
  const { title, description, category, severity, likelihood, impact, assignedTo, mitigationPlan, dueDate } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  // Calculate risk score
  const severityScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
  const likelihoodScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };
  const impactScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };

  const riskScore = (severityScores[severity] || 1) * (likelihoodScores[likelihood] || 1) * (impactScores[impact] || 1);

  db.run(
    `INSERT INTO risks (title, description, category, severity, likelihood, impact, risk_score, 
                       owner_id, assigned_to, mitigation_plan, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, category, severity, likelihood, impact, riskScore, 
     req.user.id, assignedTo, mitigationPlan, dueDate, 'open'],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to create risk' });
      }

      res.status(201).json({
        message: 'Risk created successfully',
        risk: {
          id: this.lastID,
          title,
          description,
          category,
          severity,
          likelihood,
          impact,
          riskScore,
          ownerId: req.user.id,
          assignedTo,
          mitigationPlan,
          dueDate,
          status: 'open'
        }
      });
    }
  );
});

// Update risk
router.put('/risks/:id', authenticateToken, logActivity('UPDATE', 'risk'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, description, category, severity, likelihood, impact, status, assignedTo, mitigationPlan, dueDate } = req.body;

  // Calculate risk score if severity, likelihood, or impact changed
  let riskScore = null;
  if (severity || likelihood || impact) {
    const severityScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
    const likelihoodScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };
    const impactScores = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };

    // Get current values if not provided
    db.get('SELECT severity, likelihood, impact FROM risks WHERE id = ?', [id], (err, current) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      const finalSeverity = severity || current.severity;
      const finalLikelihood = likelihood || current.likelihood;
      const finalImpact = impact || current.impact;

      riskScore = (severityScores[finalSeverity] || 1) * (likelihoodScores[finalLikelihood] || 1) * (impactScores[finalImpact] || 1);

      updateRisk();
    });
  } else {
    updateRisk();
  }

  function updateRisk() {
    const updateFields = [];
    const values = [];

    if (title) { updateFields.push('title = ?'); values.push(title); }
    if (description !== undefined) { updateFields.push('description = ?'); values.push(description); }
    if (category) { updateFields.push('category = ?'); values.push(category); }
    if (severity) { updateFields.push('severity = ?'); values.push(severity); }
    if (likelihood) { updateFields.push('likelihood = ?'); values.push(likelihood); }
    if (impact) { updateFields.push('impact = ?'); values.push(impact); }
    if (status) { updateFields.push('status = ?'); values.push(status); }
    if (assignedTo !== undefined) { updateFields.push('assigned_to = ?'); values.push(assignedTo); }
    if (mitigationPlan !== undefined) { updateFields.push('mitigation_plan = ?'); values.push(mitigationPlan); }
    if (dueDate !== undefined) { updateFields.push('due_date = ?'); values.push(dueDate); }
    if (riskScore !== null) { updateFields.push('risk_score = ?'); values.push(riskScore); }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.run(
      `UPDATE risks SET ${updateFields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Failed to update risk' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ message: 'Risk not found' });
        }

        res.json({ message: 'Risk updated successfully' });
      }
    );
  }
});

// Delete risk
router.delete('/risks/:id', authenticateToken, requireRole(['admin', 'manager']), logActivity('DELETE', 'risk'), (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.run('DELETE FROM risks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Failed to delete risk' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Risk not found' });
    }

    res.json({ message: 'Risk deleted successfully' });
  });
});

// Get risk categories
router.get('/risks/categories', authenticateToken, (req, res) => {
  const db = getDb();

  db.all('SELECT DISTINCT category FROM risks WHERE category IS NOT NULL', (err, categories) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(categories.map(cat => cat.category));
  });
});

// Get risk statistics
router.get('/risks/statistics', authenticateToken, (req, res) => {
  const db = getDb();

  const queries = [
    'SELECT COUNT(*) as total FROM risks',
    'SELECT COUNT(*) as open FROM risks WHERE status = "open"',
    'SELECT COUNT(*) as closed FROM risks WHERE status = "closed"',
    'SELECT COUNT(*) as high FROM risks WHERE severity = "High" OR severity = "Critical"',
    'SELECT AVG(risk_score) as avg_score FROM risks WHERE risk_score IS NOT NULL'
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
      open: results[1].open,
      closed: results[2].closed,
      high: results[3].high,
      averageScore: results[4].avg_score || 0
    });
  }).catch(err => {
    res.status(500).json({ message: 'Database error' });
  });
});

// Create risk assessment
router.post('/risks/:id/assessments', authenticateToken, logActivity('CREATE', 'risk_assessment'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { likelihoodScore, impactScore, notes } = req.body;

  if (!likelihoodScore || !impactScore) {
    return res.status(400).json({ message: 'Likelihood and impact scores are required' });
  }

  const overallScore = likelihoodScore * impactScore;

  db.run(
    `INSERT INTO risk_assessments (risk_id, assessor_id, assessment_date, likelihood_score, impact_score, overall_score, notes)
     VALUES (?, ?, CURRENT_DATE, ?, ?, ?, ?)`,
    [id, req.user.id, likelihoodScore, impactScore, overallScore, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to create assessment' });
      }

      res.status(201).json({
        message: 'Risk assessment created successfully',
        assessment: {
          id: this.lastID,
          riskId: id,
          assessorId: req.user.id,
          likelihoodScore,
          impactScore,
          overallScore,
          notes
        }
      });
    }
  );
});

module.exports = router;
