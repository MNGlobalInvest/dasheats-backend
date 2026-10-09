import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

// Supabase Setup
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yrhpbpzoyzlvjubirfhc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const server = createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'DashEats Backend Service' });
});

app.get('/api/webhooks/doordash', (req, res) => {
  res.json({ status: 'ok', message: 'DoorDash webhook endpoint is live.' });
});

// GET endpoint to fetch all persisted orders
app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST endpoint: Insert into Supabase and broadcast via Socket.IO
app.post('/api/webhooks/doordash', async (req, res) => {
  const payload = req.body;
  const orderData = {
    order_number: payload.orderNumber || payload.id || `DD-${Math.floor(1000 + Math.random() * 9000)}`,
    platform: payload.platform || 'DoorDash',
    customer_name: payload.customerName || 'DoorDash Customer',
    customer_phone: payload.customerPhone || '(901) 555-0142',
    customer_address: payload.customerAddress || 'Memphis, TN',
    delivery_type: payload.deliveryType || 'Delivery',
    stage: 'NEW',
    subtotal: payload.subtotal || 14.99,
    tax: payload.tax || 1.35,
    delivery_fee: payload.deliveryFee || 0.00,
    total: payload.total || 16.34,
    items: payload.items || [
      { id: `i-${Date.now()}-1`, name: 'Red Bull Energy Drink (12 oz)', qty: 2, price: 3.99, category: 'Drinks' },
      { id: `i-${Date.now()}-2`, name: 'Doritos Nacho Cheese Chips (9.25 oz)', qty: 1, price: 4.89, category: 'Snacks' }
    ]
  };

  if (SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await supabase.from('orders').insert([orderData]).select();
    if (error) {
      console.error('[Supabase Error]:', error.message);
    } else {
      console.log('[Supabase Saved]: Order created with ID:', data[0]?.id);
    }
  }

  io.emit('new-order', {
    ...orderData,
    id: orderData.order_number,
    customerName: orderData.customer_name,
    placedAt: 'Just now via Webhook',
    courierName: 'Dasher Assigned',
    courierEtaMinutes: 12
  });

  return res.status(200).json({
    status: 'success',
    message: 'DoorDash order saved & broadcasted',
    orderId: orderData.order_number
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] DashEats Backend listening on port ${PORT}`);
});
