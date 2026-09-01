const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Middleware untuk check login
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Buat/Update Hotspot Configuration
router.post('/hotspot', requireLogin, [
  body('ssid').trim().escape(),
  body('password').trim().escape(),
  body('max_users').isInt({ min: 1, max: 20 }),
  body('duration_minutes').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { ssid, password, max_users, duration_minutes } = req.body;
    const userId = req.session.userId;

    // Check existing config
    const existing = await db.get(
      'SELECT id FROM hotspot_config WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      // Update
      await db.run(
        'UPDATE hotspot_config SET ssid = ?, password = ?, max_users = ?, duration_minutes = ? WHERE user_id = ?',
        [ssid, password, max_users, duration_minutes, userId]
      );
      res.json({ success: true, message: 'Konfigurasi diperbarui' });
    } else {
      // Create
      const result = await db.run(
        'INSERT INTO hotspot_config (user_id, ssid, password, max_users, duration_minutes) VALUES (?, ?, ?, ?, ?)',
        [userId, ssid, password, max_users, duration_minutes]
      );
      res.json({ success: true, message: 'Konfigurasi dibuat', configId: result.id });
    }
  } catch (error) {
    console.error('Hotspot config error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Hotspot Configuration
router.get('/hotspot', requireLogin, async (req, res) => {
  try {
    const config = await db.get(
      'SELECT * FROM hotspot_config WHERE user_id = ?',
      [req.session.userId]
    );
    res.json({ success: true, config: config || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Generate Password
router.post('/generate-password', requireLogin, (req, res) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  res.json({ success: true, password });
});

// Generate SSID
router.post('/generate-ssid', requireLogin, (req, res) => {
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ssid = `WiShare-${randomPart}`;
  res.json({ success: true, ssid });
});

// Start Share Session
router.post('/start-session', requireLogin, async (req, res) => {
  try {
    const { hotspot_config_id, duration_minutes } = req.body;
    const userId = req.session.userId;

    const result = await db.run(
      'INSERT INTO share_sessions (user_id, hotspot_config_id, duration_minutes, status) VALUES (?, ?, ?, ?)',
      [userId, hotspot_config_id, duration_minutes, 'active']
    );

    res.json({ 
      success: true, 
      message: 'Sesi dimulai',
      sessionId: result.id 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// End Share Session
router.post('/end-session/:sessionId', requireLogin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.userId;

    // Verify ownership
    const session = await db.get(
      'SELECT id FROM share_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan' });
    }

    await db.run(
      'UPDATE share_sessions SET status = ?, end_time = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', sessionId]
    );

    res.json({ success: true, message: 'Sesi berakhir' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Sessions History
router.get('/sessions', requireLogin, async (req, res) => {
  try {
    const sessions = await db.all(
      `SELECT * FROM share_sessions 
       WHERE user_id = ? 
       ORDER BY start_time DESC 
       LIMIT 50`,
      [req.session.userId]
    );
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Dashboard Stats
router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get current session
    const currentSession = await db.get(
      `SELECT id, start_time, duration_minutes, connected_devices, data_used 
       FROM share_sessions 
       WHERE user_id = ? AND status = 'active'
       LIMIT 1`,
      [userId]
    );

    // Get hotspot config
    const config = await db.get(
      'SELECT ssid, max_users FROM hotspot_config WHERE user_id = ?',
      [userId]
    );

    // Get today stats
    const todayStats = await db.get(
      `SELECT COALESCE(SUM(data_used), 0) as total_data 
       FROM share_sessions 
       WHERE user_id = ? AND DATE(start_time) = DATE('now')`,
      [userId]
    );

    res.json({ 
      success: true, 
      data: {
        currentSession: currentSession || null,
        config: config || null,
        todayUsage: todayStats?.total_data || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;