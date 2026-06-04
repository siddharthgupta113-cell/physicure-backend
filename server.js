require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// ─── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5500', 'https://physicure.fit', 'https://www.physicure.fit'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const time = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${time}] ${req.method} ${req.path}`);
  next();
});

// ─── ROUTES ────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/content', require('./routes/content'));
app.use('/api/admin',   require('./routes/admin'));

// ─── HEALTH CHECK ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'PhysiCure API',
    version: '2.0.0',
    database: 'Supabase PostgreSQL',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// ─── API OVERVIEW ──────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    service: 'PhysiCure.fit REST API',
    version: '2.0.0',
    database: 'Supabase PostgreSQL',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/request-otp'],
      users: ['GET /api/users/me', 'PUT /api/users/profile', 'POST /api/users/register-product', 'GET /api/users/leaderboard'],
      content: ['GET /api/content/exercises', 'POST /api/content/exercises/log', 'GET /api/content/diet', 'GET /api/content/supplements', 'POST /api/content/supplements/order', 'POST /api/content/daily-log', 'GET /api/content/gamification', 'POST /api/content/appointments'],
      admin: ['GET /api/admin/dashboard', 'GET /api/admin/users', 'GET /api/admin/users/:id', 'GET /api/admin/products']
    }
  });
});

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────────┐');
  console.log('│   PhysiCure.fit API v2.0 — Supabase        │');
  console.log(`│   Running on http://localhost:${PORT}         │`);
  console.log('└─────────────────────────────────────────────┘\n');
});

module.exports = app;
