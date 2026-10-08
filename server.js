const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enable Socket.IO with CORS support
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Persistent store storage setup
const STORES_FILE = path.join(__dirname, 'stores.json');

const loadStores = () => {
  if (!fs.existsSync(STORES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORES_FILE, 'utf8'));
  } catch (err) {
    console.error('[ADMIN] Error reading stores.json:', err);
    return {};
  }
};

// --- ROUTES ---

// Root endpoint (Fixes Cannot GET /)
app.get('/', (req, res) => {
  res.status(200).send('DashEats Middleware Server is running!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Admin Store Provisioning Endpoint (Visual Admin Form Target)
app.post('/api/admin/store-config', (req, res) => {
  const { storeId, storeName, doorDashMerchantId, doorDashSigningSecret, uberEatsStoreId, uberEatsClientSecret } = req.body;

  const stores = loadStores();
  const id = storeId || 'store_001';

  stores[id] = {
    storeName: storeName || 'Memphis Convenience Store',
    doorDashMerchantId: doorDashMerchantId || '',
    doorDashSigningSecret: doorDashSigningSecret || '',
    uberEatsStoreId: uberEatsStoreId || '',
    uberEatsClientSecret: uberEatsClientSecret || '',
    updatedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(STORES_FILE, JSON.stringify(stores, null, 2));
    console.log(`[ADMIN] Saved configuration for store ID: ${id}`);
    return res.status(200).json({ success: true, message: 'Store credentials updated.' });
  } catch (err) {
    console.error('[ADMIN] Error writing stores.json:', err);
    return res.status(500).json({ success: false, message: 'Server file write error.' });
  }
});

// DoorDash Webhook Route
app.post('/api/webhooks/doordash', (req, res) => {
  console.log('[WEBHOOK] DoorDash payload received:', req.body);

  const order = {
    id: req.body.merchant_order_reference_id || `DD-${Date.now()}`,
    platform: 'DoorDash',
    customerName: req.body.consumer ? `${req.body.consumer.first_name} ${req.body.consumer.last_name}` : 'DoorDash Customer',
    items: req.body.items || [],
    status: 'action_needed',
    createdAt: new Date()
  };

  io.emit('new_order', order);
  res.status(200).json({ status: 'success', message: 'DoorDash order received' });
});

// Uber Eats Webhook Route
app.post('/api/webhooks/uber', (req, res) => {
  console.log('[WEBHOOK] Uber Eats payload received:', req.body);

  const order = {
    id: req.body.order_id || `UBER-${Date.now()}`,
    platform: 'Uber Eats',
    customerName: req.body.eater ? req.body.eater.first_name : 'Uber Eats Customer',
    items: req.body.cart ? req.body.cart.items : [],
    status: 'action_needed',
    createdAt: new Date()
  };

  io.emit('new_order', order);
  res.status(200).json({ status: 'success', message: 'Uber Eats order received' });
});

// Socket.IO Connection Event
io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected to DashEats backend:', socket.id);

  socket.on('disconnect', () => {
    console.log('[SOCKET] Client disconnected:', socket.id);
  });
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`DashEats Middleware Server running on port ${PORT}`);
});
