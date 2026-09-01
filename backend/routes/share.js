const express = require('express');
const db = require('../db');
const QRCode = require('qrcode');
const router = express.Router();

// Middleware untuk check login
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Generate QR Code
router.post('/generate-qr', requireLogin, async (req, res) => {
  try {
    const { ssid, password } = req.body;

    // Format: WIFI:T:WPA;S:SSID;P:PASSWORD;;
    const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};;`;

    // Generate QR Code sebagai data URL
    const qrCodeDataUrl = await QRCode.toDataURL(wifiString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({ 
      success: true, 
      qrCode: qrCodeDataUrl,
      wifiString: wifiString
    });
  } catch (error) {
    console.error('QR Code generation error:', error);
    res.status(500).json({ success: false, message: 'Gagal generate QR Code' });
  }
});

// Download QR Code
router.post('/download-qr', requireLogin, async (req, res) => {
  try {
    const { ssid, password } = req.body;
    const wifiString = `WIFI:T:WPA;S:${ssid};P:${password};;`;

    const qrCodeBuffer = await QRCode.toBuffer(wifiString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 500
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="WiShare-${Date.now()}.png"`);
    res.send(qrCodeBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Download gagal' });
  }
});

// Get Public Share Info (tanpa login untuk test)
router.get('/info/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const config = await db.get(
      'SELECT ssid, max_users FROM hotspot_config WHERE user_id = ? AND active = 1',
      [userId]
    );

    if (!config) {
      return res.status(404).json({ success: false, message: 'Hotspot tidak ditemukan' });
    }

    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;