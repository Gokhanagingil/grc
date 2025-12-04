const jwt = require('jsonwebtoken');
const { getDb } = require('../database/connection');
const config = require('../config');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Access token required' 
    });
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' 
        ? 'Token has expired' 
        : 'Invalid or expired token';
      return res.status(403).json({ 
        error: 'Forbidden',
        message 
      });
    }
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

const logActivity = (action, entityType, entityId) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the activity
      const db = getDb();
      const logData = {
        user_id: req.user?.id,
        action: action,
        entity_type: entityType,
        entity_id: entityId,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        old_values: null,
        new_values: JSON.stringify(req.body)
      };

      db.run(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, old_values, new_values)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [logData.user_id, logData.action, logData.entity_type, logData.entity_id, 
         logData.ip_address, logData.user_agent, logData.old_values, logData.new_values]
      );

      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  logActivity
};
