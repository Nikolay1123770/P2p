/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║   💱 EXCHANGE MINI APP - P2P Обменник для Telegram           ║
 * ║   🚀 v2.0.0 - Bothost Edition (Node.js + SQLite)             ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import cors from 'cors';
import crypto from 'crypto';
import { config } from 'dotenv';
import cron from 'node-cron';

config();

// ============================================
// 🎨 КРАСИВОЕ ПРИВЕТСТВИЕ
// ============================================

console.clear();
console.log('\x1b[36m%s\x1b[0m', `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗██╗  ██╗ ██████╗██╗  ██╗ █████╗ ███╗   ██╗ ██████╗ ║
║   ██╔════╝╚██╗██╔╝██╔════╝██║  ██║██╔══██╗████╗  ██║██╔════╝ ║
║   █████╗   ╚███╔╝ ██║     ███████║███████║██╔██╗ ██║██║  ███╗║
║   ██╔══╝   ██╔██╗ ██║     ██╔══██║██╔══██║██║╚██╗██║██║   ██║║
║   ███████╗██╔╝ ██╗╚██████╗██║  ██║██║  ██║██║ ╚████║╚██████╔╝║
║   ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ║
║                                                               ║
║              🚀 TELEGRAM MINI APP BOT v2.0.0 🚀               ║
║                      💎 Bothost Edition 💎                    ║
║                                                               ║
║   💱 P2P обменник валют                                       ║
║   🔐 Безопасные сделки                                        ║
║   💬 Встроенный чат                                           ║
║   📊 Аналитика и статистика                                   ║
║   ⭐ Рейтинговая система                                       ║
║   🗄️  SQLite база данных                                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\x1b[33m%s\x1b[0m', '📋 Инициализация системы...\n');

// ============================================
// ⚙️ КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  WEBAPP_URL: process.env.WEBAPP_URL || 'https://your-app.vercel.app',
  PORT: parseInt(process.env.PORT) || 8888,
  HOST: '0.0.0.0',
  
  SUBSCRIPTION: {
    FREE: { dailyDeals: 3, price: 0 },
    PRO: { dailyDeals: Infinity, price: 500, days: 30 }
  },
  
  PROMOTION: {
    top: { price: 100, hours: 24 },
    highlight: { price: 50 },
    pin: { price: 150, hours: 24 }
  },
  
  CURRENCIES: ['BTC', 'ETH', 'USDT', 'TON', 'BNB', 'USD', 'EUR', 'RUB']
};

// ============================================
// 🗄️ SQLITE DATABASE
// ============================================

console.log('\x1b[33m%s\x1b[0m', '🗄️  Инициализация SQLite базы данных...');

const db = new Database('exchange.db');
db.pragma('journal_mode = WAL');

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    subscription_type TEXT DEFAULT 'free',
    subscription_expires INTEGER,
    rating INTEGER DEFAULT 0,
    completed_deals INTEGER DEFAULT 0,
    cancelled_deals INTEGER DEFAULT 0,
    daily_deals_count INTEGER DEFAULT 0,
    last_deal_date INTEGER,
    balance REAL DEFAULT 0,
    verified INTEGER DEFAULT 0,
    blocked INTEGER DEFAULT 0,
    referral_code TEXT UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    currency_from TEXT NOT NULL,
    currency_to TEXT NOT NULL,
    amount_from REAL NOT NULL,
    amount_to REAL NOT NULL,
    rate REAL NOT NULL,
    payment_method TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    participant_id INTEGER,
    promoted_top_until INTEGER,
    promoted_highlighted INTEGER DEFAULT 0,
    promoted_pinned INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (participant_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    text TEXT,
    type TEXT DEFAULT 'text',
    read INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT,
    category TEXT DEFAULT 'info',
    important INTEGER DEFAULT 0,
    published INTEGER DEFAULT 1,
    views INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT UNIQUE NOT NULL,
    rate REAL NOT NULL,
    change24h REAL DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'completed',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
  CREATE INDEX IF NOT EXISTS idx_deals_creator ON deals(creator_id);
  CREATE INDEX IF NOT EXISTS idx_messages_deal ON messages(deal_id);
`);

console.log('\x1b[32m%s\x1b[0m', '✅ База данных инициализирована!\n');

// Создание начальных курсов
const ratesCount = db.prepare('SELECT COUNT(*) as count FROM rates').get();
if (ratesCount.count === 0) {
  console.log('\x1b[33m%s\x1b[0m', '📊 Создание начальных курсов...');
  const insertRate = db.prepare('INSERT INTO rates (pair, rate, change24h) VALUES (?, ?, ?)');
  insertRate.run('BTC/USDT', 43500, 2.5);
  insertRate.run('ETH/USDT', 2250, 1.8);
  insertRate.run('TON/USDT', 2.35, -0.5);
  insertRate.run('BNB/USDT', 310, 3.2);
  insertRate.run('USD/RUB', 92.5, 0.1);
  insertRate.run('EUR/RUB', 101.2, -0.3);
  console.log('\x1b[32m%s\x1b[0m', '✅ Курсы созданы!\n');
}

// ============================================
// 🔧 UTILITY FUNCTIONS
// ============================================

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function verifyTelegramWebAppData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(CONFIG.BOT_TOKEN)
      .digest();
    
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    if (calculatedHash !== hash) {
      throw new Error('Invalid hash');
    }
    
    const user = JSON.parse(urlParams.get('user'));
    return user;
  } catch (error) {
    throw new Error('Invalid Telegram data');
  }
}

function getOrCreateUser(telegramId, userData = {}) {
  let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  
  if (!user) {
    const insert = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, last_name, referral_code)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      telegramId,
      userData.username || null,
      userData.first_name || null,
      userData.last_name || null,
      generateReferralCode()
    );
    
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }
  
  return user;
}

function canCreateDeal(user) {
  const now = Math.floor(Date.now() / 1000);
  const isPro = user.subscription_type === 'pro' && user.subscription_expires > now;
  
  if (isPro) {
    return { allowed: true };
  }
  
  // FREE - 3 сделки в день
  const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const lastDealDate = user.last_deal_date || 0;
  const lastDealDay = Math.floor(new Date(lastDealDate * 1000).setHours(0, 0, 0, 0) / 1000);
  
  if (lastDealDay !== today) {
    return { allowed: true };
  }
  
  if (user.daily_deals_count >= CONFIG.SUBSCRIPTION.FREE.dailyDeals) {
    return {
      allowed: false,
      message: `Достигнут лимит (${CONFIG.SUBSCRIPTION.FREE.dailyDeals} сделки/день). Обновите до PRO!`
    };
  }
  
  return { allowed: true };
}

function formatNumber(num) {
  return new Intl.NumberFormat('ru-RU').format(num);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp * 1000));
}

// ============================================
// 🌐 EXPRESS SERVER
// ============================================

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Middleware авторизации
const authMiddleware = (req, res, next) => {
  try {
    const initData = req.headers.authorization?.replace('Bearer ', '');
    if (!initData) throw new Error('No auth data');
    
    const userData = verifyTelegramWebAppData(initData);
    const user = getOrCreateUser(userData.id, userData);
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ============================================
// 📡 API ROUTES
// ============================================

app.get('/', (req, res) => {
  res.json({
    app: 'Exchange Mini App Bot',
    version: '2.0.0',
    status: 'running',
    platform: 'Bothost',
    database: 'SQLite',
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Профиль
app.get('/api/profile', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.put('/api/profile', authMiddleware, (req, res) => {
  const { language } = req.body;
  
  if (language) {
    db.prepare('UPDATE users SET language = ? WHERE id = ?').run(language, req.user.id);
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Получить сделки
app.get('/api/deals', authMiddleware, (req, res) => {
  const { type, currency_from, currency_to, page = 1, limit = 20 } = req.query;
  
  let query = 'SELECT d.*, u.username, u.first_name, u.rating, u.verified, u.completed_deals FROM deals d JOIN users u ON d.creator_id = u.id WHERE d.status = ?';
  const params = ['active'];
  
  if (type && type !== 'all') {
    query += ' AND d.type = ?';
    params.push(type);
  }
  if (currency_from) {
    query += ' AND d.currency_from = ?';
    params.push(currency_from);
  }
  if (currency_to) {
    query += ' AND d.currency_to = ?';
    params.push(currency_to);
  }
  
  // Сортировка
  const isPro = req.user.subscription_type === 'pro' && 
                req.user.subscription_expires > Math.floor(Date.now() / 1000);
  
  if (isPro) {
    query += ' ORDER BY d.promoted_pinned DESC, d.promoted_top_until DESC, d.created_at DESC';
  } else {
    query += ' ORDER BY d.created_at DESC';
  }
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);
  
  const deals = db.prepare(query).all(...params);
  
  const countQuery = 'SELECT COUNT(*) as total FROM deals WHERE status = ?';
  const { total } = db.prepare(countQuery).get('active');
  
  res.json({
    deals: deals.map(d => ({
      ...d,
      creator: {
        username: d.username,
        first_name: d.first_name,
        rating: d.rating,
        verified: d.verified === 1,
        completed_deals: d.completed_deals
      }
    })),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Создать сделку
app.post('/api/deals', authMiddleware, (req, res) => {
  try {
    const can = canCreateDeal(req.user);
    if (!can.allowed) {
      return res.status(403).json({ error: can.message });
    }
    
    const { type, currency_from, currency_to, amount_from, rate, payment_method, description } = req.body;
    
    const insert = db.prepare(`
      INSERT INTO deals (creator_id, type, currency_from, currency_to, amount_from, amount_to, rate, payment_method, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      req.user.id,
      type,
      currency_from,
      currency_to,
      amount_from,
      amount_from * rate,
      rate,
      payment_method ? JSON.stringify(payment_method) : null,
      description
    );
    
    // Обновить счетчик
    const now = Math.floor(Date.now() / 1000);
    const today = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const lastDealDay = req.user.last_deal_date ? 
      Math.floor(new Date(req.user.last_deal_date * 1000).setHours(0, 0, 0, 0) / 1000) : 0;
    
    if (lastDealDay !== today) {
      db.prepare('UPDATE users SET daily_deals_count = 1, last_deal_date = ? WHERE id = ?')
        .run(now, req.user.id);
    } else {
      db.prepare('UPDATE users SET daily_deals_count = daily_deals_count + 1, last_deal_date = ? WHERE id = ?')
        .run(now, req.user.id);
    }
    
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid);
    res.json(deal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Мои сделки
app.get('/api/deals/my', authMiddleware, (req, res) => {
  const deals = db.prepare(`
    SELECT d.*, 
      c.username as creator_username, c.first_name as creator_name, c.rating as creator_rating,
      p.username as participant_username, p.first_name as participant_name
    FROM deals d
    LEFT JOIN users c ON d.creator_id = c.id
    LEFT JOIN users p ON d.participant_id = p.id
    WHERE d.creator_id = ? OR d.participant_id = ?
    ORDER BY d.created_at DESC
  `).all(req.user.id, req.user.id);
  
  res.json(deals);
});

// Принять сделку
app.post('/api/deals/:id/accept', authMiddleware, (req, res) => {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  
  if (!deal || deal.status !== 'active') {
    return res.status(400).json({ error: 'Сделка недоступна' });
  }
  
  if (deal.creator_id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя принять собственную сделку' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE deals SET participant_id = ?, status = ?, started_at = ? WHERE id = ?')
    .run(req.user.id, 'in_progress', now, req.params.id);
  
  // Системное сообщение
  db.prepare('INSERT INTO messages (deal_id, sender_id, text, type) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.user.id, `${req.user.first_name} принял сделку`, 'system');
  
  const updatedDeal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  res.json(updatedDeal);
});

// Завершить сделку
app.post('/api/deals/:id/complete', authMiddleware, (req, res) => {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  
  if (!deal || deal.status !== 'in_progress') {
    return res.status(400).json({ error: 'Сделка недоступна' });
  }
  
  if (deal.creator_id !== req.user.id && deal.participant_id !== req.user.id) {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE deals SET status = ?, completed_at = ? WHERE id = ?')
    .run('completed', now, req.params.id);
  
  // Обновить рейтинги
  db.prepare('UPDATE users SET completed_deals = completed_deals + 1, rating = rating + 2 WHERE id = ?')
    .run(deal.creator_id);
  
  if (deal.participant_id) {
    db.prepare('UPDATE users SET completed_deals = completed_deals + 1, rating = rating + 2 WHERE id = ?')
      .run(deal.participant_id);
  }
  
  res.json({ success: true });
});

// Отменить сделку
app.post('/api/deals/:id/cancel', authMiddleware, (req, res) => {
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  
  if (deal.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Только создатель может отменить' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE deals SET status = ?, cancelled_at = ? WHERE id = ?')
    .run('cancelled', now, req.params.id);
  
  db.prepare('UPDATE users SET cancelled_deals = cancelled_deals + 1 WHERE id = ?')
    .run(req.user.id);
  
  res.json({ success: true });
});

// Сообщения
app.get('/api/deals/:id/messages', authMiddleware, (req, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.username, u.first_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.deal_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id);
  
  res.json(messages.map(m => ({
    ...m,
    sender: {
      username: m.username,
      first_name: m.first_name
    }
  })));
});

// Продвижение
app.post('/api/deals/:id/promote', authMiddleware, (req, res) => {
  const { type } = req.body;
  const promotion = CONFIG.PROMOTION[type];
  
  if (!promotion) {
    return res.status(400).json({ error: 'Неверный тип продвижения' });
  }
  
  if (req.user.balance < promotion.price) {
    return res.status(400).json({ error: 'Недостаточно средств' });
  }
  
  const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  
  if (deal.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  if (type === 'top' || type === 'pin') {
    const until = now + (promotion.hours * 3600);
    const pinned = type === 'pin' ? 1 : 0;
    db.prepare('UPDATE deals SET promoted_top_until = ?, promoted_pinned = ? WHERE id = ?')
      .run(until, pinned, req.params.id);
  } else if (type === 'highlight') {
    db.prepare('UPDATE deals SET promoted_highlighted = 1 WHERE id = ?')
      .run(req.params.id);
  }
  
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?')
    .run(promotion.price, req.user.id);
  
  db.prepare('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(req.user.id, 'promotion', -promotion.price, `Продвижение: ${type}`);
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, balance: user.balance });
});

// Курсы
app.get('/api/rates', (req, res) => {
  const rates = db.prepare('SELECT * FROM rates ORDER BY pair').all();
  res.json(rates);
});

// Новости
app.get('/api/news', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const news = db.prepare('SELECT * FROM news WHERE published = 1 ORDER BY important DESC, created_at DESC LIMIT ? OFFSET ?')
    .all(parseInt(limit), offset);
  
  const { total } = db.prepare('SELECT COUNT(*) as total FROM news WHERE published = 1').get();
  
  res.json({
    news,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Подписка
app.post('/api/subscription/buy', authMiddleware, (req, res) => {
  const price = CONFIG.SUBSCRIPTION.PRO.price;
  
  if (req.user.balance < price) {
    return res.status(400).json({ error: 'Недостаточно средств' });
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (CONFIG.SUBSCRIPTION.PRO.days * 24 * 3600);
  
  db.prepare('UPDATE users SET subscription_type = ?, subscription_expires = ?, balance = balance - ? WHERE id = ?')
    .run('pro', expiresAt, price, req.user.id);
  
  db.prepare('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(req.user.id, 'subscription', -price, 'PRO подписка на 30 дней');
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Пополнение баланса
app.post('/api/balance/topup', authMiddleware, (req, res) => {
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Некорректная сумма' });
  }
  
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
    .run(amount, req.user.id);
  
  db.prepare('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .run(req.user.id, 'donation', amount, 'Пополнение баланса');
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ balance: user.balance });
});

// Статистика
app.get('/api/stats', authMiddleware, (req, res) => {
  const isPro = req.user.subscription_type === 'pro' && 
                req.user.subscription_expires > Math.floor(Date.now() / 1000);
  
  if (!isPro) {
    return res.status(403).json({ error: 'Требуется PRO подписка' });
  }
  
  const dealsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count, SUM(amount_from) as total_amount
    FROM deals
    WHERE creator_id = ?
    GROUP BY status
  `).all(req.user.id);
  
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10')
    .all(req.user.id);
  
  res.json({ stats: dealsByStatus, transactions });
});

// Топ пользователей
app.get('/api/leaderboard', (req, res) => {
  const { type = 'rating', limit = 10 } = req.query;
  const field = type === 'deals' ? 'completed_deals' : 'rating';
  
  const users = db.prepare(`
    SELECT id, username, first_name, rating, completed_deals, verified
    FROM users
    WHERE verified = 1
    ORDER BY ${field} DESC
    LIMIT ?
  `).all(parseInt(limit));
  
  res.json(users);
});

// ============================================
// 💬 WEBSOCKET
// ============================================

const wsConnections = {};

io.on('connection', (socket) => {
  console.log('✅ WebSocket подключение:', socket.id);
  
  socket.on('join_deal', (dealId) => {
    socket.join(`deal_${dealId}`);
    if (!wsConnections[dealId]) wsConnections[dealId] = [];
    wsConnections[dealId].push(socket.id);
    console.log(`📥 Присоединение к сделке ${dealId}`);
  });
  
  socket.on('send_message', (data) => {
    try {
      const { dealId, userId, text, type = 'text' } = data;
      
      const insert = db.prepare('INSERT INTO messages (deal_id, sender_id, text, type) VALUES (?, ?, ?, ?)');
      const result = insert.run(dealId, userId, text, type);
      
      const message = db.prepare(`
        SELECT m.*, u.username, u.first_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);
      
      io.to(`deal_${dealId}`).emit('new_message', {
        ...message,
        sender: {
          username: message.username,
          first_name: message.first_name
        }
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ WebSocket отключение:', socket.id);
    for (const dealId in wsConnections) {
      wsConnections[dealId] = wsConnections[dealId].filter(id => id !== socket.id);
    }
  });
});

// ============================================
// 🤖 TELEGRAM BOT
// ============================================

console.log('\x1b[33m%s\x1b[0m', '🤖 Инициализация Telegram бота...');

const bot = new Telegraf(CONFIG.BOT_TOKEN);

bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const user = getOrCreateUser(userId, {
    username: ctx.from.username,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name
  });
  
  const welcomeText = `
🎉 <b>Добро пожаловать в Exchange Mini App!</b>

💱 Самый удобный P2P обменник в Telegram!

<b>Что вы можете делать:</b>
🔹 Создавать объявления о покупке/продаже
🔹 Находить выгодные предложения
🔹 Безопасно обмениваться через чат
🔹 Отслеживать актуальные курсы
🔹 Зарабатывать рейтинг

<b>Ваш тариф:</b> ${user.subscription_type === 'pro' ? '👑 PRO' : '🆓 FREE'}
${user.subscription_type === 'free' ? `Лимит: ${CONFIG.SUBSCRIPTION.FREE.dailyDeals} сделки/день` : '♾️ Безлимит'}

<b>Рейтинг:</b> ⭐ ${user.rating}
<b>Сделок:</b> ✅ ${user.completed_deals}

👇 <b>Нажмите кнопку ниже!</b>
  `;
  
  await ctx.replyWithHTML(
    welcomeText,
    Markup.keyboard([
      [Markup.button.webApp('🚀 Открыть Exchange App', CONFIG.WEBAPP_URL)],
      ['📊 Статистика', '👤 Профиль'],
      ['💎 Подписка PRO', '❓ Помощь']
    ]).resize()
  );
});

bot.hears('👤 Профиль', async (ctx) => {
  const user = getOrCreateUser(ctx.from.id);
  
  const profileText = `
👤 <b>ВАШ ПРОФИЛЬ</b>

<b>Имя:</b> ${user.first_name || ''} ${user.last_name || ''}
<b>Username:</b> @${user.username || 'не указан'}

<b>Тариф:</b> ${user.subscription_type === 'pro' ? '👑 PRO' : '🆓 FREE'}
<b>Рейтинг:</b> ⭐ ${user.rating}
<b>Завершено:</b> ✅ ${user.completed_deals}
<b>Отменено:</b> ❌ ${user.cancelled_deals}

<b>Баланс:</b> 💰 ${formatNumber(user.balance)} ₽

<b>Реферальный код:</b> <code>${user.referral_code}</code>
  `;
  
  await ctx.replyWithHTML(profileText);
});

bot.hears('📊 Статистика', async (ctx) => {
  const user = getOrCreateUser(ctx.from.id);
  
  const myDeals = db.prepare('SELECT COUNT(*) as count FROM deals WHERE creator_id = ? OR participant_id = ?')
    .get(user.id, user.id);
  
  const activeDeals = db.prepare(`
    SELECT COUNT(*) as count FROM deals 
    WHERE (creator_id = ? OR participant_id = ?) AND status IN ('active', 'in_progress')
  `).get(user.id, user.id);
  
  const totals = db.prepare('SELECT COUNT(*) as deals, (SELECT COUNT(*) FROM users) as users FROM deals').get();
  
  const statsText = `
📊 <b>СТАТИСТИКА</b>

<b>Ваши показатели:</b>
📝 Всего сделок: ${myDeals.count}
🟢 Активных: ${activeDeals.count}
✅ Завершено: ${user.completed_deals}
❌ Отменено: ${user.cancelled_deals}
⭐ Рейтинг: ${user.rating}
${user.subscription_type === 'free' ? `📅 Сегодня: ${user.daily_deals_count}/3` : ''}

<b>Общая статистика:</b>
👥 Пользователей: ${formatNumber(totals.users)}
💱 Сделок: ${formatNumber(totals.deals)}
  `;
  
  await ctx.replyWithHTML(statsText);
});

bot.hears('💎 Подписка PRO', async (ctx) => {
  const user = getOrCreateUser(ctx.from.id);
  const now = Math.floor(Date.now() / 1000);
  const isPro = user.subscription_type === 'pro' && user.subscription_expires > now;
  
  const proText = `
💎 <b>ПОДПИСКА PRO</b>

${isPro ? '✅ У вас PRO подписка!' : '🆓 У вас FREE тариф'}

<b>Преимущества PRO:</b>
♾️ Безлимит сделок
🚀 Приоритет в списке
⚡ Автоподбор объявлений
✓ Значок проверенного
📊 Статистика
🎯 Скидки на продвижение

<b>Цена:</b> ${CONFIG.SUBSCRIPTION.PRO.price} ₽/месяц

${!isPro ? 'Откройте приложение для покупки!' : `Действует до: ${formatDate(user.subscription_expires)}`}
  `;
  
  await ctx.replyWithHTML(
    proText,
    Markup.inlineKeyboard([
      [Markup.button.webApp('💎 Оформить PRO', `${CONFIG.WEBAPP_URL}/subscription`)]
    ])
  );
});

bot.hears('❓ Помощь', async (ctx) => {
  const helpText = `
❓ <b>ПОМОЩЬ</b>

<b>Команды:</b>
/start - Запуск бота
/help - Помощь

<b>Как создать сделку:</b>
1. Откройте приложение
2. "Создать сделку"
3. Укажите параметры
4. Дождитесь отклика

<b>Тарифы:</b>
🆓 FREE - 3 сделки/день
👑 PRO - Безлимит

<b>Поддержка:</b> @support
  `;
  
  await ctx.replyWithHTML(helpText);
});

bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err);
  ctx.reply('Произошла ошибка. Попробуйте позже.');
});

// ============================================
// ⏰ CRON JOBS
// ============================================

// Очистка истекших продвижений (каждый час)
cron.schedule('0 * * * *', () => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE deals SET promoted_top_until = NULL, promoted_pinned = 0 WHERE promoted_top_until < ?')
    .run(now);
  console.log('🧹 Очистка истекших продвижений');
});

// Проверка подписок (раз в день)
cron.schedule('0 0 * * *', () => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET subscription_type = ? WHERE subscription_type = ? AND subscription_expires < ?')
    .run('free', 'pro', now);
  console.log('🔍 Проверка подписок');
});

// ============================================
// 🚀 ЗАПУСК
// ============================================

async function start() {
  try {
    // Запуск HTTP сервера
    httpServer.listen(CONFIG.PORT, CONFIG.HOST, () => {
      console.log('\x1b[32m%s\x1b[0m', `✅ HTTP сервер запущен на ${CONFIG.HOST}:${CONFIG.PORT}\n`);
    });
    
    // Запуск бота
    await bot.launch();
    console.log('\x1b[32m%s\x1b[0m', '✅ Telegram бот запущен!\n');
    
    // Финальное сообщение
    console.log('\x1b[42m\x1b[30m%s\x1b[0m', '                                                    ');
    console.log('\x1b[42m\x1b[30m%s\x1b[0m', '  🎉 ВСЕ СИСТЕМЫ ЗАПУЩЕНЫ И РАБОТАЮТ! 🎉          ');
    console.log('\x1b[42m\x1b[30m%s\x1b[0m', '                                                    ');
    console.log('');
    console.log('\x1b[36m%s\x1b[0m', '📱 Telegram Bot: @YourBotUsername');
    console.log('\x1b[36m%s\x1b[0m', `🌐 API: http://${CONFIG.HOST}:${CONFIG.PORT}/api`);
    console.log('\x1b[36m%s\x1b[0m', `💬 WebSocket: ws://${CONFIG.HOST}:${CONFIG.PORT}`);
    console.log('\x1b[36m%s\x1b[0m', `🗄️  Database: SQLite (exchange.db)`);
    console.log('\x1b[36m%s\x1b[0m', `🌍 Bothost URL: https://cryptobot.bothost.ru`);
    console.log('');
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ОШИБКА ЗАПУСКА:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '⚠️  Остановка сервисов...');
  bot.stop('SIGINT');
  httpServer.close();
  db.close();
  console.log('\x1b[32m%s\x1b[0m', '✅ Остановлено. До свидания!\n');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '⚠️  Остановка сервисов...');
  bot.stop('SIGTERM');
  httpServer.close();
  db.close();
  console.log('\x1b[32m%s\x1b[0m', '✅ Остановлено. До свидания!\n');
  process.exit(0);
});

// Запуск!
start();
