import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Option {
  id: 'left' | 'right';
  name: string;
  image: string;
  description: string;
  price: number;
  totalPurchases: number;
  recentGrowth: number; // Purchases in last 5 min
}

interface Purchase {
  id: string;
  side: 'left' | 'right';
  code: string;
  amount: number;
  timestamp: number;
  position: number;
  status: 'confirmed' | 'pending';
}

interface AppSettings {
  mainTitle: string;
  subTitle: string;
  leftName: string;
  rightName: string;
}

// Global State
let settings: AppSettings = {
  mainTitle: 'Guia de Viagem Grátis',
  subTitle: 'A cada compra, ficamos mais perto do próximo benefício',
  leftName: 'Destino Alpha',
  rightName: 'Destino Beta'
};

let options: Record<'left' | 'right', Option> = {
  left: {
    id: 'left',
    name: 'Praia do Forte, BA',
    image: 'https://picsum.photos/seed/praia/800/800',
    description: 'Paraíso tropical com águas cristalinas e conservação ambiental.',
    price: 99.00,
    totalPurchases: 145,
    recentGrowth: 0
  },
  right: {
    id: 'right',
    name: 'Chapada Diamantina, BA',
    image: 'https://picsum.photos/seed/chapada/800/800',
    description: 'Cachoeiras majestosas e trilhas épicas em plena natureza selvagem.',
    price: 120.00,
    totalPurchases: 132,
    recentGrowth: 0
  }
};

let purchases: Purchase[] = [];

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { 
  cors: { origin: '*' },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});
io.on('connection', (socket) => {
  console.log('Cliente conectado via Socket.io:', socket.id);
  // Send current state immediately on connection
  socket.emit('state_update', { options, settings, totalPurchases: purchases.length });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

app.use(express.json());

// Helper to calculate trends
const updateTrends = () => {
  const now = Date.now();
  const fiveMinsAgo = now - 5 * 60 * 1000;
  
  options.left.recentGrowth = purchases.filter(p => p.side === 'left' && p.timestamp > fiveMinsAgo).length;
  options.right.recentGrowth = purchases.filter(p => p.side === 'right' && p.timestamp > fiveMinsAgo).length;
};

// Admin Authentication Middleware
const authGuard = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${ADMIN_PASSWORD}`) return next();
  res.status(401).json({ error: 'Ops! Acesso negado.' });
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/state', (req, res) => {
  console.log('API: Solicitando estado da arena');
  updateTrends();
  res.json({ options, settings, totalPurchases: purchases.length });
});

app.post('/api/purchase', (req, res) => {
  const { side } = req.body;
  if (side !== 'left' && side !== 'right') return res.status(400).json({ error: 'Lado inválido' });

  const option = options[side];
  
  // Custom unique code format BR-XXXXXX
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomCode = '';
  for (let i = 0; i < 6; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const uniqueCode = `BR-${randomCode}`;
  
  const position = purchases.length + 1;
  const purchase: Purchase = {
    id: Math.random().toString(36).substring(2, 11),
    side,
    code: uniqueCode,
    amount: option.price,
    timestamp: Date.now(),
    position,
    status: 'confirmed'
  };

  option.totalPurchases++;
  purchases.push(purchase);
  
  updateTrends();

  io.emit('state_update', { 
    options, 
    settings,
    totalPurchases: purchases.length,
    latestPurchase: { 
      side, 
      code: uniqueCode, 
      position 
    } 
  });

  res.json({ purchase });
});

// Admin Routes
app.get('/api/admin/data', authGuard, (req, res) => {
  res.json({ purchases, options, settings });
});

app.post('/api/admin/update-settings', authGuard, (req, res) => {
  settings = { ...settings, ...req.body };
  io.emit('state_update', { options, settings, totalPurchases: purchases.length });
  res.json({ success: true });
});

app.post('/api/admin/update-option', authGuard, (req, res) => {
  const { id, ...data } = req.body;
  if (options[id as 'left' | 'right']) {
    options[id as 'left' | 'right'] = { ...options[id as 'left' | 'right'], ...data };
    io.emit('state_update', { options, settings, totalPurchases: purchases.length });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Opção não encontrada' });
});

app.post('/api/admin/bulk-update', authGuard, (req, res) => {
  const { settings: newSettings, options: newOptions } = req.body;
  if (newSettings) settings = { ...settings, ...newSettings };
  if (newOptions) {
    if (newOptions.left) options.left = { ...options.left, ...newOptions.left };
    if (newOptions.right) options.right = { ...options.right, ...newOptions.right };
  }
  io.emit('state_update', { options, settings, totalPurchases: purchases.length });
  res.json({ success: true });
});

app.post('/api/admin/reset', authGuard, (req, res) => {
  purchases = [];
  options.left.totalPurchases = 0;
  options.right.totalPurchases = 0;
  options.left.recentGrowth = 0;
  options.right.recentGrowth = 0;
  io.emit('state_update', { options, settings, totalPurchases: 0 });
  res.json({ success: true });
});

app.post('/api/admin/adjust-count', authGuard, (req, res) => {
  const { id, count } = req.body;
  if (options[id as 'left' | 'right']) {
    options[id as 'left' | 'right'].totalPurchases = count;
    io.emit('state_update', { options, settings, totalPurchases: purchases.length });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Opção não encontrada' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = 3000;

  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist/index.html')));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Brasil Trends rodando em http://localhost:${PORT}`);
  });
}

startServer();
