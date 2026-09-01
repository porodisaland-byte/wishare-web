const express = require('express');
const db = require('../db');
const router = express.Router();

// Middleware untuk check login
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Get Data Usage Stats
router.get('/usage', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Today
    const today = await db.get(
      `SELECT COALESCE(SUM(data_used), 0) as total 
       FROM share_sessions 
       WHERE user_id = ? AND DATE(start_time) = DATE('now')`,
      [userId]
    );

    // This week
    const week = await db.get(
      `SELECT COALESCE(SUM(data_used), 0) as total 
       FROM share_sessions 
       WHERE user_id = ? AND DATE(start_time) >= DATE('now', '-7 days')`,
      [userId]
    );

    // This month
    const month = await db.get(
      `SELECT COALESCE(SUM(data_used), 0) as total 
       FROM share_sessions 
       WHERE user_id = ? AND strftime('%Y-%m', start_time) = strftime('%Y-%m', 'now')`,
      [userId]
    );

    res.json({
      success: true,
      usage: {
        today: parseFloat(today?.total || 0).toFixed(2),
        week: parseFloat(week?.total || 0).toFixed(2),
        month: parseFloat(month?.total || 0).toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Connected Devices
router.get('/devices/:sessionId', requireLogin, async (req, res) => {
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

    const devices = await db.all(
      `SELECT device_name, connected_at, status 
       FROM connected_devices 
       WHERE session_id = ? AND status = 'connected'
       ORDER BY connected_at DESC`,
      [sessionId]
    );

    res.json({ success: true, devices, count: devices.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Session History with Stats
router.get('/history', requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { limit = 50 } = req.query;

    const history = await db.all(
      `SELECT id, start_time, end_time, duration_minutes, connected_devices, data_used, status
       FROM share_sessions
       WHERE user_id = ?
       ORDER BY start_time DESC
       LIMIT ?`,
      [userId, parseInt(limit)]
    );

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;