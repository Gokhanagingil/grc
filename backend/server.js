// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./database/connection');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const governanceRoutes = require('./routes/governance');
const riskRoutes = require('./routes/risk');
const complianceRoutes = require('./routes/compliance');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '5000', 10);

// === Middleware ===
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000'], // Frontend dev server
  credentials: true,
}));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// === Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// === Health Check ===
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', env: NODE_ENV, message: 'GRC Platform API is running' });
});

// === 404 Handler (Error handler'dan önce olmalı) ===
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// === Global Error Handler (En sonda) ===
/* eslint-disable no-unused-vars */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    message: 'Something went wrong!',
    error: NODE_ENV === 'development' ? (err.message || err) : {},
  });
});
/* eslint-enable no-unused-vars */

// === DB Init & Server Start ===
(async () => {
  try {
    const dbPath = process.env.DB_PATH;
    if (dbPath) {
      const dir = path.dirname(dbPath);
      fs.mkdirSync(dir, { recursive: true });
    }

    await db.init();
    app.listen(PORT, () => {
      console.log(`✅ GRC Platform API running on http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  }
})();

module.exports = app;