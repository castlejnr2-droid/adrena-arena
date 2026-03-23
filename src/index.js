/**
 * Adrena Arena Mode — Main Server
 * Team-based trading competition module for Adrena
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { pool, query } = require('./db/index');
const { startEngine, setWebSocketServer } = require('./engine/score-engine');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'adrena-arena', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/arena/teams', require('./routes/teams'));
app.use('/arena/tournaments', require('./routes/tournaments'));
app.use('/arena', require('./routes/profile'));

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ service: 'adrena-arena', docs: '/health' });
  }
});

// Initialize
async function init() {
  try {
    // Run schema migration
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await query(schema);
    console.log('✅ Database schema initialized');

    // Start HTTP + WebSocket server
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
      console.log('[WS] Client connected');
      ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
      ws.on('close', () => console.log('[WS] Client disconnected'));
    });

    setWebSocketServer(wss);

    server.listen(PORT, () => {
      console.log(`🏟️  Adrena Arena server running on port ${PORT}`);
      console.log(`   API: http://localhost:${PORT}/arena`);
      console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    });

    // Start score engine
    startEngine();

  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await pool.end();
  process.exit(0);
});

init();
