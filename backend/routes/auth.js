const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/sqlite');
const { signUser } = require('../utils/jwt');

const router = express.Router();

router.post('/register', (req,res)=>{
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  const createdAt = new Date().toISOString();
  db.run('INSERT INTO users(email, password_hash, created_at) VALUES(?,?,?)', [email, hash, createdAt], function(err){
    if (err) {
      req.log?.error({ err, email }, 'register_failed');
      if (String(err.message||'').includes('UNIQUE')) return res.status(409).json({ message: 'email exists' });
      return res.status(500).json({ message: 'db error' });
    }
    return res.status(201).json({ id: this.lastID, email });
  });
});

router.post('/login', (req,res)=>{
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password required' });
  const db = getDb();
  db.get('SELECT id, password_hash FROM users WHERE email=?', [email], (err, row)=>{
    if (err) return res.status(500).json({ message: 'db error' });
    if (!row) return res.status(401).json({ message: 'invalid credentials' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ message: 'invalid credentials' });
    const token = signUser(String(row.id));
    return res.json({ token });
  });
});

module.exports = { authRouter: router };
