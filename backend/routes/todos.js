const express = require('express');
const { getDb } = require('../database/connection');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all todos for the current user
router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  
  db.all(
    `SELECT t.*, u.first_name as assigned_first_name, u.last_name as assigned_last_name
     FROM todos t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.owner_id = ? OR t.assigned_to = ?
     ORDER BY t.due_date ASC, t.priority DESC, t.created_at DESC`,
    [userId, userId],
    (err, todos) => {
      if (err) {
        console.error('Error fetching todos:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ todos: todos || [] });
    }
  );
});

// Get a single todo by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const userId = req.user.id;
  
  db.get(
    `SELECT t.*, u.first_name as assigned_first_name, u.last_name as assigned_last_name
     FROM todos t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.id = ? AND (t.owner_id = ? OR t.assigned_to = ?)`,
    [id, userId, userId],
    (err, todo) => {
      if (err) {
        console.error('Error fetching todo:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!todo) {
        return res.status(404).json({ message: 'Todo not found' });
      }
      res.json(todo);
    }
  );
});

// Create a new todo
router.post('/', logActivity('CREATE', 'todo'), (req, res) => {
  const db = getDb();
  const { title, description, priority, status, due_date, assigned_to, category, tags } = req.body;
  const userId = req.user.id;
  
  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }
  
  db.run(
    `INSERT INTO todos (title, description, priority, status, due_date, owner_id, assigned_to, category, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description || null,
      priority || 'medium',
      status || 'pending',
      due_date || null,
      userId,
      assigned_to || userId,
      category || null,
      tags ? JSON.stringify(tags) : null
    ],
    function(err) {
      if (err) {
        console.error('Error creating todo:', err);
        return res.status(500).json({ message: 'Failed to create todo' });
      }
      
      // Fetch the created todo
      db.get(
        'SELECT * FROM todos WHERE id = ?',
        [this.lastID],
        (err, todo) => {
          if (err) {
            console.error('Error fetching created todo:', err);
            return res.status(500).json({ message: 'Todo created but failed to fetch' });
          }
          res.status(201).json(todo);
        }
      );
    }
  );
});

// Update a todo
router.put('/:id', logActivity('UPDATE', 'todo'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { title, description, priority, status, due_date, assigned_to, category, tags, completed_at } = req.body;
  const userId = req.user.id;
  
  // First check if the user owns this todo or is assigned to it
  db.get(
    'SELECT * FROM todos WHERE id = ? AND (owner_id = ? OR assigned_to = ?)',
    [id, userId, userId],
    (err, todo) => {
      if (err) {
        console.error('Error checking todo ownership:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!todo) {
        return res.status(404).json({ message: 'Todo not found or access denied' });
      }
      
      // Build update query dynamically
      const updates = [];
      const values = [];
      
      if (title !== undefined) { updates.push('title = ?'); values.push(title); }
      if (description !== undefined) { updates.push('description = ?'); values.push(description); }
      if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
      if (status !== undefined) { updates.push('status = ?'); values.push(status); }
      if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }
      if (assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(assigned_to); }
      if (category !== undefined) { updates.push('category = ?'); values.push(category); }
      if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
      if (completed_at !== undefined) { updates.push('completed_at = ?'); values.push(completed_at); }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      db.run(
        `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            console.error('Error updating todo:', err);
            return res.status(500).json({ message: 'Failed to update todo' });
          }
          
          // Fetch the updated todo
          db.get(
            'SELECT * FROM todos WHERE id = ?',
            [id],
            (err, updatedTodo) => {
              if (err) {
                console.error('Error fetching updated todo:', err);
                return res.status(500).json({ message: 'Todo updated but failed to fetch' });
              }
              res.json(updatedTodo);
            }
          );
        }
      );
    }
  );
});

// Delete a todo
router.delete('/:id', logActivity('DELETE', 'todo'), (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const userId = req.user.id;
  
  // First check if the user owns this todo
  db.get(
    'SELECT * FROM todos WHERE id = ? AND owner_id = ?',
    [id, userId],
    (err, todo) => {
      if (err) {
        console.error('Error checking todo ownership:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (!todo) {
        return res.status(404).json({ message: 'Todo not found or access denied' });
      }
      
      db.run(
        'DELETE FROM todos WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            console.error('Error deleting todo:', err);
            return res.status(500).json({ message: 'Failed to delete todo' });
          }
          res.json({ message: 'Todo deleted successfully' });
        }
      );
    }
  );
});

// Get todo statistics
router.get('/stats/summary', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  
  db.all(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
       SUM(CASE WHEN due_date < date('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
     FROM todos
     WHERE owner_id = ? OR assigned_to = ?`,
    [userId, userId],
    (err, stats) => {
      if (err) {
        console.error('Error fetching todo stats:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(stats[0] || { total: 0, completed: 0, pending: 0, in_progress: 0, overdue: 0 });
    }
  );
});

module.exports = router;
