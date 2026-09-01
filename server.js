const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Keamanan
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  }
}));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Database Setup
const db = require('./backend/db');
db.initialize();

// Routes
const authRoutes = require('./backend/routes/auth');
const adminRoutes = require('./backend/routes/admin');
const shareRoutes = require('./backend/routes/share');
const statsRoutes = require('./backend/routes/stats');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/stats', statsRoutes);

// Serve index.html untuk SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
if (process.env.HTTPS_ENABLED === 'true') {
  const options = {
    key: fs.readFileSync('./ssl/private-key.pem'),
    cert: fs.readFileSync('./ssl/certificate.pem')
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`🔒 HTTPS Server berjalan di port ${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`🚀 WiShare Web berjalan di http://localhost:${PORT}`);
    console.log(`📱 Buka browser: http://localhost:${PORT}`);
  });
}

module.exports = app;