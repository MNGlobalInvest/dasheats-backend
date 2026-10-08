import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));

const server = createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

io.on('connection', (socket) => {
  console.log(`[Socket.IO] New client connected: ${socket.id}`);
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'DashEats Backend Service' });
});

app.get('/api/webhooks/doordash', (req, res) => {
  res.json({ status: 'ok', message: 'DoorDash webhook endpoint is live. Submit order payloads using HTTP POST.' });
});

app.post('/api/webhooks/doordash', (req, res) => {
  const payload = req.body;
  const orderData = {
    id: payload.id || `ord-${Date.now()}`,
    orderNumber: payload.orderNumber || payload.id || `DD-${Math.floor(1000 + Math.random() * 9000)}`,
    platform: payload.platform || 'DoorDash',
    customerName: payload.customerName || 'DoorDash Customer',
    customerPhone: payload.customerPhone || '(901) 555-0142',
    customerAddress: payload.customerAddress || 'Memphis, TN',
    deliveryType: payload.deliveryType || 'Delivery',
    stage: 'NEW',
    placedAt: 'Just now via Webhook',
    courierName: payload.courierName || 'Dasher Assigned',
    courierEtaMinutes: payload.courierEtaMinutes || 12,
    subtotal: payload.subtotal || 14.99,
    tax: payload.tax || 1.35,
    deliveryFee: payload.deliveryFee || 0.00,
    total: payload.total || 16.34,
    items: payload.items || [
      { id: `i-${Date.now()}-1`, name: 'Red Bull Energy Drink (12 oz)', qty: 2, price: 3.99, category: 'Drinks', packed: false },
      { id: `i-${Date.now()}-2`, name: 'Doritos Nacho Cheese Chips (9.25 oz)', qty: 1, price: 4.89, category: 'Snacks', packed: false }
    ]
  };

  io.emit('new-order', orderData);

  return res.status(200).json({ status: 'success', message: 'DoorDash order received and broadcasted', orderId: orderData.id });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] DashEats Backend listening on port ${PORT}`);
});
