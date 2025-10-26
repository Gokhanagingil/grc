const express = require('express');
const { getDb } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard overview
router.get('/overview', authenticateToken, (req, res) => {
  const db = getDb();

  const queries = {
    // Risk statistics
    risks: {
      total: 'SELECT COUNT(*) as count FROM risks',
      open: 'SELECT COUNT(*) as count FROM risks WHERE status = "open"',
      high: 'SELECT COUNT(*) as count FROM risks WHERE severity IN ("High", "Critical")',
      overdue: 'SELECT COUNT(*) as count FROM risks WHERE due_date < CURRENT_DATE AND status = "open"'
    },
    // Compliance statistics
    compliance: {
      total: 'SELECT COUNT(*) as count FROM compliance_requirements',
      pending: 'SELECT COUNT(*) as count FROM compliance_requirements WHERE status = "pending"',
      completed: 'SELECT COUNT(*) as count FROM compliance_requirements WHERE status = "completed"',
      overdue: 'SELECT COUNT(*) as count FROM compliance_requirements WHERE due_date < CURRENT_DATE AND status != "completed"'
    },
    // Policy statistics
    policies: {
      total: 'SELECT COUNT(*) as count FROM policies',
      active: 'SELECT COUNT(*) as count FROM policies WHERE status = "active"',
      draft: 'SELECT COUNT(*) as count FROM policies WHERE status = "draft"'
    },
    // User statistics
    users: {
      total: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
      admins: 'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1',
      managers: 'SELECT COUNT(*) as count FROM users WHERE role = "manager" AND is_active = 1'
    }
  };

  const executeQuery = (query) => {
    return new Promise((resolve, reject) => {
      db.get(query, (err, result) => {
        if (err) reject(err);
        else resolve(result.count);
      });
    });
  };

  const executeAllQueries = async () => {
    try {
      const results = {};
      
      for (const [category, queries] of Object.entries(queries)) {
        results[category] = {};
        for (const [key, query] of Object.entries(queries)) {
          results[category][key] = await executeQuery(query);
        }
      }

      res.json(results);
    } catch (err) {
      res.status(500).json({ message: 'Database error' });
    }
  };

  executeAllQueries();
});

// Get recent activities
router.get('/activities', authenticateToken, (req, res) => {
  const db = getDb();
  const { limit = 10 } = req.query;

  db.all(
    `SELECT a.*, u.username, u.first_name, u.last_name 
     FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     ORDER BY a.created_at DESC 
     LIMIT ?`,
    [parseInt(limit)],
    (err, activities) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(activities);
    }
  );
});

// Get risk trends
router.get('/risk-trends', authenticateToken, (req, res) => {
  const db = getDb();
  const { days = 30 } = req.query;

  db.all(
    `SELECT DATE(created_at) as date, 
            COUNT(*) as total_risks,
            COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical,
            COUNT(CASE WHEN severity = 'High' THEN 1 END) as high,
            COUNT(CASE WHEN severity = 'Medium' THEN 1 END) as medium,
            COUNT(CASE WHEN severity = 'Low' THEN 1 END) as low
     FROM risks 
     WHERE created_at >= DATE('now', '-${parseInt(days)} days')
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    (err, trends) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(trends);
    }
  );
});

// Get compliance status by regulation
router.get('/compliance-by-regulation', authenticateToken, (req, res) => {
  const db = getDb();

  db.all(
    `SELECT regulation,
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue
     FROM compliance_requirements 
     WHERE regulation IS NOT NULL
     GROUP BY regulation
     ORDER BY total DESC`,
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(results);
    }
  );
});

// Get top risk categories
router.get('/risk-categories', authenticateToken, (req, res) => {
  const db = getDb();

  db.all(
    `SELECT category,
            COUNT(*) as count,
            AVG(risk_score) as avg_score,
            COUNT(CASE WHEN severity IN ('High', 'Critical') THEN 1 END) as high_severity
     FROM risks 
     WHERE category IS NOT NULL
     GROUP BY category
     ORDER BY count DESC
     LIMIT 10`,
    (err, categories) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(categories);
    }
  );
});

// Get upcoming deadlines
router.get('/upcoming-deadlines', authenticateToken, (req, res) => {
  const db = getDb();
  const { days = 30 } = req.query;

  const query = `
    SELECT 'risk' as type, id, title, due_date, assigned_to, status
    FROM risks 
    WHERE due_date BETWEEN CURRENT_DATE AND DATE('now', '+${parseInt(days)} days')
      AND status = 'open'
    
    UNION ALL
    
    SELECT 'compliance' as type, id, title, due_date, assigned_to, status
    FROM compliance_requirements 
    WHERE due_date BETWEEN CURRENT_DATE AND DATE('now', '+${parseInt(days)} days')
      AND status != 'completed'
    
    ORDER BY due_date ASC
    LIMIT 20
  `;

  db.all(query, (err, deadlines) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(deadlines);
  });
});

// Get policy status distribution
router.get('/policy-status', authenticateToken, (req, res) => {
  const db = getDb();

  db.all(
    `SELECT status, COUNT(*) as count
     FROM policies 
     GROUP BY status
     ORDER BY count DESC`,
    (err, status) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(status);
    }
  );
});

// Get user activity summary
router.get('/user-activity', authenticateToken, (req, res) => {
  const db = getDb();
  const { days = 30 } = req.query;

  db.all(
    `SELECT u.username, u.first_name, u.last_name,
            COUNT(a.id) as activity_count,
            MAX(a.created_at) as last_activity
     FROM users u
     LEFT JOIN audit_logs a ON u.id = a.user_id 
       AND a.created_at >= DATE('now', '-${parseInt(days)} days')
     WHERE u.is_active = 1
     GROUP BY u.id, u.username, u.first_name, u.last_name
     ORDER BY activity_count DESC, last_activity DESC
     LIMIT 10`,
    (err, activities) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json(activities);
    }
  );
});

module.exports = router;
