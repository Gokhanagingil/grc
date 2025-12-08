const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/connection');
const { authenticateToken, requireRole, logActivity } = require('../middleware/auth');

const router = express.Router();

/**
 * DEPRECATION NOTICE
 * 
 * These Express user management routes are deprecated and will be removed in a future release.
 * Please migrate to the NestJS backend endpoints at port 3002.
 * 
 * See docs/NEST-USER-MANAGEMENT-MIGRATION.md for migration details.
 * 
 * Sunset date: 2025-06-01
 */
const deprecationMiddleware = (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Jun 2025 00:00:00 GMT');
  res.set('Link', '</api/v2/users>; rel="successor-version"');
  console.warn(`[DEPRECATED] Express user route accessed: ${req.method} ${req.originalUrl}`);
  next();
};

// Apply deprecation middleware to all user routes
router.use(deprecationMiddleware);

// Get all users
router.get('/', authenticateToken, requireRole(['admin', 'manager']), (req, res) => {
  const db = getDb();
  const { page = 1, limit = 10, role, department, search } = req.query;
  
  let query = 'SELECT id, username, email, first_name, last_name, department, role, is_active, created_at FROM users';
  let params = [];
  let conditions = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }

  if (department) {
    conditions.push('department = ?');
    params.push(department);
  }

  if (search) {
    conditions.push('(username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      res.json({
        users,
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

// Get user by ID
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const { id } = req.params;

  // Users can only view their own profile unless they're admin/manager
  if (req.user.id != id && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  db.get(
    'SELECT id, username, email, first_name, last_name, department, role, is_active, created_at FROM users WHERE id = ?',
    [id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    }
  );
});

// Update user profile
router.put('/:id', authenticateToken, logActivity('UPDATE', 'user'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { firstName, lastName, department, email } = req.body;

  // Users can only update their own profile unless they're admin
  if (req.user.id != id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const updateFields = [];
  const values = [];

  if (firstName !== undefined) { updateFields.push('first_name = ?'); values.push(firstName); }
  if (lastName !== undefined) { updateFields.push('last_name = ?'); values.push(lastName); }
  if (department !== undefined) { updateFields.push('department = ?'); values.push(department); }
  if (email !== undefined) { updateFields.push('email = ?'); values.push(email); }

  if (updateFields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.run(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to update user' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User updated successfully' });
    }
  );
});

// Update user role (admin only)
router.put('/:id/role', authenticateToken, requireRole(['admin']), logActivity('UPDATE', 'user_role'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { role } = req.body;

  if (!role || !['admin', 'manager', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  db.run(
    'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [role, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to update user role' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User role updated successfully' });
    }
  );
});

// Change password
router.put('/:id/password', authenticateToken, logActivity('UPDATE', 'user_password'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Users can only change their own password
  if (req.user.id != id) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  // Get current password hash
  db.get('SELECT password FROM users WHERE id = ?', [id], async (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    db.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Failed to update password' });
        }

        res.json({ message: 'Password updated successfully' });
      }
    );
  });
});

// Deactivate user (admin only)
router.put('/:id/deactivate', authenticateToken, requireRole(['admin']), logActivity('DEACTIVATE', 'user'), (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.run(
    'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to deactivate user' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deactivated successfully' });
    }
  );
});

// Activate user (admin only)
router.put('/:id/activate', authenticateToken, requireRole(['admin']), logActivity('ACTIVATE', 'user'), (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.run(
    'UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Failed to activate user' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User activated successfully' });
    }
  );
});

// Get user statistics
router.get('/statistics/overview', authenticateToken, requireRole(['admin', 'manager']), (req, res) => {
  const db = getDb();

  const queries = [
    'SELECT COUNT(*) as total FROM users WHERE is_active = 1',
    'SELECT COUNT(*) as admins FROM users WHERE role = "admin" AND is_active = 1',
    'SELECT COUNT(*) as managers FROM users WHERE role = "manager" AND is_active = 1',
    'SELECT COUNT(*) as users FROM users WHERE role = "user" AND is_active = 1',
    'SELECT COUNT(*) as inactive FROM users WHERE is_active = 0'
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
      admins: results[1].admins,
      managers: results[2].managers,
      users: results[3].users,
      inactive: results[4].inactive
    });
  }).catch(err => {
    res.status(500).json({ message: 'Database error' });
  });
});

// Get departments
router.get('/departments/list', authenticateToken, (req, res) => {
  const db = getDb();

  db.all('SELECT DISTINCT department FROM users WHERE department IS NOT NULL ORDER BY department', (err, departments) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    res.json(departments.map(dept => dept.department));
  });
});

module.exports = router;
