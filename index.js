/**
 * 💱 EXCHANGE MINI APP - Telegram Bot
 * Полнофункциональный обменник валют с Mini App
 * 
 * @author Your Name
 * @version 1.0.0
 */

import express from 'express';
import { Telegraf, Markup } from 'telegraf';
import { Server } from 'socket.io';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import crypto from 'crypto';
import cron from 'node-cron';
import config from './config.js';

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
║              🚀 TELEGRAM MINI APP BOT v1.0.0 🚀               ║
║                                                               ║
║   💱 Обменник валют с полным функционалом                     ║
║   🔐 Безопасные сделки P2P                                    ║
║   💬 Встроенный чат                                           ║
║   📊 Аналитика и статистика                                   ║
║   ⭐ Рейтинговая система                                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('\x1b[33m%s\x1b[0m', '📋 Инициализация системы...\n');

// ============================================
// 🗄️ MONGOOSE SCHEMAS
// ============================================

const { Schema, model } = mongoose;

// Схема пользователя
const userSchema = new Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  username: String,
  firstName: String,
  lastName: String,
  photoUrl: String,
  subscription: {
    type: { type: String, enum: ['free', 'pro'], default: 'free' },
    expiresAt: Date,
    autoRenew: { type: Boolean, default: false }
  },
  rating: { type: Number, default: 0, index: true },
  completedDeals: { type: Number, default: 0 },
  cancelledDeals: { type: Number, default: 0 },
  dailyDealsCount: { type: Number, default: 0 },
  lastDealDate: Date,
  balance: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false },
  notifications: {
    newDeals: { type: Boolean, default: true },
    messages: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true }
  },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  language: { type: String, default: 'ru' },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

// Схема сделки
const dealSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['buy', 'sell'], required: true, index: true },
  currencyFrom: { type: String, required: true, index: true },
  currencyTo: { type: String, required: true, index: true },
  amountFrom: { type: Number, required: true, min: 0 },
  amountTo: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  minAmount: { type: Number, default: 0 },
  maxAmount: { type: Number },
  paymentMethod: [String],
  description: String,
  location: String,
  timeLimit: { type: Number, default: 30 }, // минуты
  status: { 
    type: String, 
    enum: ['active', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'active',
    index: true
  },
  participant: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  promoted: {
    topUntil: { type: Date, index: true },
    highlighted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false }
  },
  views: { type: Number, default: 0 },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Схема сообщения
const messageSchema = new Schema({
  deal: { type: Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: String,
  image: String,
  type: { type: String, enum: ['text', 'image', 'system'], default: 'text' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Схема новостей
const newsSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: String,
  category: { type: String, enum: ['update', 'promo', 'info', 'warning'], default: 'info' },
  important: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  views: { type: Number, default: 0 },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Схема курсов валют
const rateSchema = new Schema({
  pair: { type: String, required: true, unique: true },
  rate: { type: Number, required: true },
  change24h: { type: Number, default: 0 },
  volume24h: { type: Number, default: 0 },
  high24h: { type: Number },
  low24h: { type: Number },
  source: { type: String, default: 'manual' },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Схема транзакций
const transactionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { 
    type: String, 
    enum: ['promotion', 'subscription', 'donation', 'refund', 'bonus', 'withdrawal'],
    required: true,
    index: true
  },
  amount: { type: Number, required: true },
  description: String,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Схема отзывов
const reviewSchema = new Schema({
  deal: { type: Schema.Types.ObjectId, ref: 'Deal', required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Создание моделей
const User = model('User', userSchema);
const Deal = model('Deal', dealSchema);
const Message = model('Message', messageSchema);
const News = model('News', newsSchema);
const Rate = model('Rate', rateSchema);
const Transaction = model('Transaction', transactionSchema);
const Review = model('Review', reviewSchema);

// ============================================
// 🔧 UTILITY FUNCTIONS
// ============================================

// Генерация реферального кода
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Проверка Telegram Web App данных
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
      .update(config.BOT_TOKEN)
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

// Проверка возможности создания сделки
async function canCreateDeal(user) {
  // PRO - безлимит
  if (user.subscription.type === 'pro' && 
      user.subscription.expiresAt > new Date()) {
    return { allowed: true };
  }
  
  // FREE - 3 сделки в день
  const today = new Date().setHours(0, 0, 0, 0);
  const lastDealDate = user.lastDealDate ? 
    new Date(user.lastDealDate).setHours(0, 0, 0, 0) : null;
  
  if (lastDealDate !== today) {
    return { allowed: true };
  }
  
  if (user.dailyDealsCount >= config.SUBSCRIPTION.FREE.dailyDeals) {
    return { 
      allowed: false, 
      message: `Достигнут дневной лимит (${config.SUBSCRIPTION.FREE.dailyDeals} сделки). Обновите подписку до PRO для безлимита!` 
    };
  }
  
  return { allowed: true };
}

// Форматирование числа
function formatNumber(num) {
  return new Intl.NumberFormat('ru-RU').format(num);
}

// Форматирование даты
function formatDate(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

// ============================================
// 🤖 TELEGRAM BOT
// ============================================

const bot = new Telegraf(config.BOT_TOKEN);

// Команда /start
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    let user = await User.findOne({ telegramId: userId });
    
    // Обработка реферальной ссылки
    const startParam = ctx.message.text.split(' ')[1];
    
    if (!user) {
      user = await User.create({
        telegramId: userId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        referralCode: generateReferralCode(),
        referredBy: startParam ? await User.findOne({ referralCode: startParam }) : null
      });
      
      // Бонус за регистрацию по реферальной ссылке
      if (startParam) {
        const referrer = await User.findOne({ referralCode: startParam });
        if (referrer) {
          referrer.balance += 50;
          await referrer.save();
          
          await Transaction.create({
            user: referrer._id,
            type: 'bonus',
            amount: 50,
            description: 'Бонус за приглашение друга'
          });
        }
      }
    }
    
    const welcomeMessage = `
🎉 <b>Добро пожаловать в Exchange Mini App!</b>

💱 Самый удобный P2P обменник в Telegram!

<b>Что вы можете делать:</b>
🔹 Создавать объявления о покупке/продаже
🔹 Находить выгодные предложения
🔹 Безопасно обмениваться через встроенный чат
🔹 Отслеживать актуальные курсы валют
🔹 Зарабатывать репутацию и рейтинг

<b>Ваш тариф:</b> ${user.subscription.type === 'pro' ? '👑 PRO' : '🆓 FREE'}
${user.subscription.type === 'free' ? `Лимит: ${config.SUBSCRIPTION.FREE.dailyDeals} сделки/день` : '♾️ Безлимит сделок'}

<b>Ваш рейтинг:</b> ⭐ ${user.rating}
<b>Завершено сделок:</b> ✅ ${user.completedDeals}
${user.verified ? '\n✓ <b>Верифицированный пользователь</b>' : ''}

👇 <b>Нажмите кнопку ниже, чтобы начать!</b>
    `;
    
    await ctx.replyWithHTML(
      welcomeMessage,
      Markup.keyboard([
        [Markup.button.webApp('🚀 Открыть Exchange App', config.WEBAPP_URL)],
        ['📊 Статистика', '👤 Профиль'],
        ['💎 Подписка PRO', '❓ Помощь']
      ]).resize()
    );
    
  } catch (error) {
    console.error('Ошибка /start:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Команда /help
bot.command('help', async (ctx) => {
  const helpText = `
📖 <b>СПРАВКА</b>

<b>Основные команды:</b>
/start - Запустить бота
/profile - Мой профиль
/stats - Статистика
/subscription - Управление подпиской
/support - Связаться с поддержкой
/news - Последние новости

<b>Как создать сделку:</b>
1. Откройте приложение
2. Нажмите "Создать сделку"
3. Укажите валюты и сумму
4. Дождитесь отклика

<b>Тарифы:</b>
🆓 FREE - 3 сделки в день
👑 PRO - Безлимит + приоритет

<b>Безопасность:</b>
• Проверяйте рейтинг продавца
• Используйте встроенный чат
• Подтверждайте сделки только после получения

<b>Поддержка:</b> @support
<b>Новости:</b> @exchange_news
  `;
  
  await ctx.replyWithHTML(helpText);
});

// Команда /profile
bot.hears('👤 Профиль', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  
  if (!user) {
    return ctx.reply('Пользователь не найден. Отправьте /start');
  }
  
  const profileText = `
👤 <b>ВАШ ПРОФИЛЬ</b>

<b>Имя:</b> ${user.firstName} ${user.lastName || ''}
<b>Username:</b> @${user.username || 'не указан'}
${user.verified ? '✅ <b>Верифицирован</b>' : ''}

<b>Тариф:</b> ${user.subscription.type === 'pro' ? '👑 PRO' : '🆓 FREE'}
${user.subscription.type === 'pro' ? `<b>Действует до:</b> ${formatDate(user.subscription.expiresAt)}` : ''}

<b>Рейтинг:</b> ⭐ ${user.rating}
<b>Завершено сделок:</b> ✅ ${user.completedDeals}
<b>Отменено сделок:</b> ❌ ${user.cancelledDeals}

<b>Баланс:</b> 💰 ${formatNumber(user.balance)} ₽

<b>Реферальный код:</b> <code>${user.referralCode}</code>
Приглашайте друзей и получайте бонусы!
  `;
  
  await ctx.replyWithHTML(profileText);
});

// Команда /stats
bot.hears('📊 Статистика', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  
  if (!user) {
    return ctx.reply('Пользователь не найден. Отправьте /start');
  }
  
  const myDeals = await Deal.countDocuments({
    $or: [{ creator: user._id }, { participant: user._id }]
  });
  
  const activeDeals = await Deal.countDocuments({
    $or: [{ creator: user._id }, { participant: user._id }],
    status: { $in: ['active', 'in_progress'] }
  });
  
  const totalDeals = await Deal.countDocuments();
  const totalUsers = await User.countDocuments();
  
  const statsText = `
📊 <b>СТАТИСТИКА</b>

<b>Ваши показатели:</b>
📝 Всего сделок: ${myDeals}
🟢 Активных: ${activeDeals}
✅ Завершено: ${user.completedDeals}
❌ Отменено: ${user.cancelledDeals}
⭐ Рейтинг: ${user.rating}
${user.subscription.type === 'free' ? `📅 Сегодня создано: ${user.dailyDealsCount}/3` : ''}

<b>Общая статистика:</b>
👥 Пользователей: ${formatNumber(totalUsers)}
💱 Сделок: ${formatNumber(totalDeals)}
  `;
  
  await ctx.replyWithHTML(statsText);
});

// Команда подписки
bot.hears('💎 Подписка PRO', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });
  
  const isPro = user.subscription.type === 'pro' && 
                user.subscription.expiresAt > new Date();
  
  const proText = `
💎 <b>ПОДПИСКА PRO</b>

${isPro ? '✅ У вас активна PRO подписка!' : '🆓 У вас FREE тариф'}

<b>Преимущества PRO:</b>
♾️ Безлимитное количество сделок
🚀 Приоритет в списке объявлений
⚡ Автоматический подбор объявлений
⏱️ Ускоренное время обработки
✓ Значок проверенного пользователя
📊 Расширенная статистика
📈 Приоритет в арбитраже
🎯 Продвижение объявлений со скидкой

<b>Стоимость:</b> ${config.SUBSCRIPTION.PRO.price} ₽/месяц

${!isPro ? 'Откройте приложение для оформления подписки!' : `Действует до: ${formatDate(user.subscription.expiresAt)}`}
  `;
  
  await ctx.replyWithHTML(
    proText,
    Markup.inlineKeyboard([
      [Markup.button.webApp('💎 Оформить PRO', config.WEBAPP_URL + '/subscription')]
    ])
  );
});

// Помощь
bot.hears('❓ Помощь', async (ctx) => {
  await ctx.replyWithHTML(
    `
❓ <b>НУЖНА ПОМОЩЬ?</b>

<b>Служба поддержки:</b>
💬 Telegram: @exchange_support
📧 Email: support@exchange.com

<b>Часы работы:</b>
Пн-Вс: 9:00 - 21:00 МСК

<b>Среднее время ответа:</b> 2-5 минут
    `,
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Написать в поддержку', 'https://t.me/exchange_support')],
      [Markup.button.url('📚 База знаний', 'https://exchange.com/help')]
    ])
  );
});

// Обработка ошибок бота
bot.catch((err, ctx) => {
  console.error('❌ Ошибка бота:', err);
  ctx.reply('Произошла ошибка. Попробуйте позже или обратитесь в поддержку.');
});

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
const authMiddleware = async (req, res, next) => {
  try {
    const initData = req.headers.authorization?.replace('Bearer ', '');
    const userData = verifyTelegramWebAppData(initData);
    
    let user = await User.findOne({ telegramId: userData.id });
    if (!user) {
      user = await User.create({
        telegramId: userData.id,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        referralCode: generateReferralCode()
      });
    }
    
    user.lastActive = new Date();
    await user.save();
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ============================================
// 📡 API ROUTES
// ============================================

// Получить профиль
app.get('/api/profile', authMiddleware, async (req, res) => {
  res.json(req.user);
});

// Обновить профиль
app.put('/api/profile', authMiddleware, async (req, res) => {
  const { notifications, language } = req.body;
  
  if (notifications) req.user.notifications = notifications;
  if (language) req.user.language = language;
  
  await req.user.save();
  res.json(req.user);
});

// Получить список сделок
app.get('/api/deals', authMiddleware, async (req, res) => {
  try {
    const { type, currencyFrom, currencyTo, minAmount, maxAmount, sort, page = 1, limit = 20 } = req.query;
    
    let query = { status: 'active' };
    
    if (type && type !== 'all') query.type = type;
    if (currencyFrom) query.currencyFrom = currencyFrom;
    if (currencyTo) query.currencyTo = currencyTo;
    if (minAmount) query.amountFrom = { $gte: parseFloat(minAmount) };
    if (maxAmount) query.amountFrom = { ...query.amountFrom, $lte: parseFloat(maxAmount) };
    
    // Сортировка с приоритетом для PRO
    let sortObj = {};
    
    const isPro = req.user.subscription.type === 'pro' && 
                  req.user.subscription.expiresAt > new Date();
    
    if (isPro) {
      sortObj['promoted.pinned'] = -1;
      sortObj['promoted.topUntil'] = -1;
    }
    
    switch(sort) {
      case 'rate_asc': sortObj.rate = 1; break;
      case 'rate_desc': sortObj.rate = -1; break;
      case 'amount_asc': sortObj.amountFrom = 1; break;
      case 'amount_desc': sortObj.amountFrom = -1; break;
      default: sortObj.createdAt = -1;
    }
    
    const deals = await Deal.find(query)
      .populate('creator', 'username firstName rating verified completedDeals')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Deal.countDocuments(query);
    
    res.json({
      deals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить сделку по ID
app.get('/api/deals/:id', authMiddleware, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('creator', 'username firstName rating verified completedDeals')
      .populate('participant', 'username firstName rating verified completedDeals');
    
    if (!deal) {
      return res.status(404).json({ error: 'Сделка не найдена' });
    }
    
    // Увеличить счетчик просмотров
    deal.views += 1;
    await deal.save();
    
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать сделку
app.post('/api/deals', authMiddleware, async (req, res) => {
  try {
    const canCreate = await canCreateDeal(req.user);
    
    if (!canCreate.allowed) {
      return res.status(403).json({ error: canCreate.message });
    }
    
    const deal = await Deal.create({
      ...req.body,
      creator: req.user._id,
      amountTo: req.body.amountFrom * req.body.rate
    });
    
    // Обновить счетчик сделок
    const today = new Date().setHours(0, 0, 0, 0);
    if (!req.user.lastDealDate || new Date(req.user.lastDealDate).setHours(0, 0, 0, 0) !== today) {
      req.user.dailyDealsCount = 1;
      req.user.lastDealDate = new Date();
    } else {
      req.user.dailyDealsCount += 1;
    }
    await req.user.save();
    
    // Уведомление в канал
    try {
      const dealText = `
🆕 <b>Новая сделка!</b>

${deal.type === 'buy' ? '🟢 Покупка' : '🔴 Продажа'}
${deal.amountFrom} ${deal.currencyFrom} → ${deal.amountTo} ${deal.currencyTo}

Курс: ${deal.rate}
Продавец: @${req.user.username} (⭐${req.user.rating})

<a href="${config.WEBAPP_URL}/deal/${deal._id}">Открыть сделку</a>
      `;
      
      if (config.NEWS_CHANNEL_ID) {
        await bot.telegram.sendMessage(config.NEWS_CHANNEL_ID, dealText, { parse_mode: 'HTML' });
      }
    } catch (err) {
      console.error('Ошибка отправки в канал:', err);
    }
    
    res.json(deal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Мои сделки
app.get('/api/deals/my', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {
      $or: [
        { creator: req.user._id },
        { participant: req.user._id }
      ]
    };
    
    if (status) query.status = status;
    
    const deals = await Deal.find(query)
      .populate('creator participant', 'username firstName rating verified')
      .sort({ createdAt: -1 });
    
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Принять сделку
app.post('/api/deals/:id/accept', authMiddleware, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    
    if (!deal || deal.status !== 'active') {
      return res.status(400).json({ error: 'Сделка недоступна' });
    }
    
    if (deal.creator.equals(req.user._id)) {
      return res.status(400).json({ error: 'Нельзя принять собственную сделку' });
    }
    
    deal.participant = req.user._id;
    deal.status = 'in_progress';
    deal.startedAt = new Date();
    await deal.save();
    
    // Системное сообщение
    await Message.create({
      deal: deal._id,
      sender: req.user._id,
      text: `${req.user.firstName} принял сделку. Обсудите детали обмена.`,
      type: 'system'
    });
    
    // Уведомление создателю
    const creator = await User.findById(deal.creator);
    if (creator.notifications.newDeals) {
      try {
        await bot.telegram.sendMessage(
          creator.telegramId,
          `✅ Вашу сделку принял @${req.user.username}!\n\nОткройте приложение для продолжения.`,
          Markup.inlineKeyboard([
            [Markup.button.webApp('Открыть чат', `${config.WEBAPP_URL}/deal/${deal._id}`)]
          ])
        );
      } catch (err) {
        console.error('Ошибка уведомления:', err);
      }
    }
    
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Завершить сделку
app.post('/api/deals/:id/complete', authMiddleware, async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id).populate('creator participant');
    
    if (!deal || deal.status !== 'in_progress') {
      return res.status(400).json({ error: 'Сделка недоступна' });
    }
    
    if (!deal.creator._id.equals(req.user._id) && !deal.participant._id.equals(req.user._id)) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    deal.status = 'completed';
    deal.completedAt = new Date();
    await deal.save();
    
    // Обновить рейтинги
    await User.findByIdAndUpdate(deal.creator._id, {
      $inc: { completedDeals: 1, rating: 2 }
    });
    await User.findByIdAndUpdate(deal.participant._id, {
      $inc: { completedDeals: 1, rating: 2 }
    });
    
    // Системное сообщение
    await Message.create({
      deal: deal._id,
      sender: req.user._id,
      text: `✅ Сделка успешно завершена! Рейтинг участников обновлен.`,
      type: 'system'
    });
    
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Отменить сделку
app.post('/api/deals/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const deal = await Deal.findById(req.params.id);
    
    if (!deal.creator.equals(req.user._id)) {
      return res.status(403).json({ error: 'Только создатель может отменить' });
    }
    
    deal.status = 'cancelled';
    deal.cancelledAt = new Date();
    deal.cancelReason = reason;
    await deal.save();
    
    // Обновить статистику
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { cancelledDeals: 1 }
    });
    
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить сообщения сделки
app.get('/api/deals/:id/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ deal: req.params.id })
      .populate('sender', 'username firstName')
      .sort({ createdAt: 1 });
    
    // Отметить как прочитанные
    await Message.updateMany(
      { deal: req.params.id, sender: { $ne: req.user._id }, read: false },
      { read: true }
    );
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Продвижение сделки
app.post('/api/deals/:id/promote', authMiddleware, async (req, res) => {
  try {
    const { type } = req.body; // 'top', 'highlight', 'pin'
    
    const promotion = config.PROMOTION[type];
    if (!promotion) {
      return res.status(400).json({ error: 'Неверный тип продвижения' });
    }
    
    const price = promotion.price;
    
    if (req.user.balance < price) {
      return res.status(400).json({ error: 'Недостаточно средств на балансе' });
    }
    
    const deal = await Deal.findById(req.params.id);
    
    if (!deal.creator.equals(req.user._id)) {
      return res.status(403).json({ error: 'Только создатель может продвигать' });
    }
    
    if (type === 'top' || type === 'pin') {
      deal.promoted.topUntil = new Date(Date.now() + promotion.duration);
      if (type === 'pin') deal.promoted.pinned = true;
    } else if (type === 'highlight') {
      deal.promoted.highlighted = true;
    }
    
    await deal.save();
    
    req.user.balance -= price;
    await req.user.save();
    
    await Transaction.create({
      user: req.user._id,
      type: 'promotion',
      amount: -price,
      description: `Продвижение сделки: ${type}`,
      metadata: { dealId: deal._id, promotionType: type }
    });
    
    res.json({ deal, balance: req.user.balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить курсы валют
app.get('/api/rates', async (req, res) => {
  try {
    const rates = await Rate.find().sort({ pair: 1 });
    res.json(rates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить новости
app.get('/api/news', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const news = await News.find({ published: true })
      .sort({ important: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await News.countDocuments({ published: true });
    
    res.json({
      news,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Купить подписку PRO
app.post('/api/subscription/buy', authMiddleware, async (req, res) => {
  try {
    const price = config.SUBSCRIPTION.PRO.price;
    
    if (req.user.balance < price) {
      return res.status(400).json({ error: 'Недостаточно средств. Пополните баланс.' });
    }
    
    const expiresAt = new Date(Date.now() + config.SUBSCRIPTION.PRO.duration);
    
    req.user.subscription.type = 'pro';
    req.user.subscription.expiresAt = expiresAt;
    req.user.balance -= price;
    await req.user.save();
    
    await Transaction.create({
      user: req.user._id,
      type: 'subscription',
      amount: -price,
      description: 'PRO подписка на 30 дней'
    });
    
    // Уведомление
    try {
      await bot.telegram.sendMessage(
        req.user.telegramId,
        `🎉 Поздравляем! PRO подписка активирована!\n\nДействует до: ${formatDate(expiresAt)}\n\nТеперь вам доступны все возможности!`
      );
    } catch (err) {
      console.error('Ошибка уведомления:', err);
    }
    
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Пополнить баланс
app.post('/api/balance/topup', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Некорректная сумма' });
    }
    
    // Здесь должна быть интеграция с платежной системой
    // Для демо просто начисляем
    req.user.balance += amount;
    await req.user.save();
    
    await Transaction.create({
      user: req.user._id,
      type: 'donation',
      amount: amount,
      description: 'Пополнение баланса'
    });
    
    res.json({ balance: req.user.balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Статистика (PRO)
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const isPro = req.user.subscription.type === 'pro' && 
                  req.user.subscription.expiresAt > new Date();
    
    if (!isPro) {
      return res.status(403).json({ error: 'Требуется PRO подписка' });
    }
    
    const stats = await Deal.aggregate([
      { $match: { creator: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amountFrom' }
        }
      }
    ]);
    
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({ stats, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Топ пользователей
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { type = 'rating', limit = 10 } = req.query;
    
    let sortField = 'rating';
    if (type === 'deals') sortField = 'completedDeals';
    
    const users = await User.find({ verified: true })
      .select('username firstName rating completedDeals verified')
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit));
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 💬 WEBSOCKET (CHAT)
// ============================================

io.on('connection', (socket) => {
  console.log('✅ Пользователь подключился:', socket.id);
  
  // Присоединение к чату сделки
  socket.on('join_deal', async (dealId) => {
    socket.join(`deal_${dealId}`);
    console.log(`📥 Пользователь присоединился к сделке ${dealId}`);
  });
  
  // Отправка сообщения
  socket.on('send_message', async (data) => {
    try {
      const { dealId, userId, text, type = 'text' } = data;
      
      const message = await Message.create({
        deal: dealId,
        sender: userId,
        text,
        type
      });
      
      await message.populate('sender', 'username firstName');
      
      io.to(`deal_${dealId}`).emit('new_message', message);
      
      // Уведомление собеседнику
      const deal = await Deal.findById(dealId).populate('creator participant');
      const recipient = deal.creator._id.toString() === userId ? 
        deal.participant : deal.creator;
      
      if (recipient && recipient.notifications.messages) {
        try {
          await bot.telegram.sendMessage(
            recipient.telegramId,
            `💬 Новое сообщение в сделке!\n\n"${text}"\n\nОткройте приложение для ответа.`,
            Markup.inlineKeyboard([
              [Markup.button.webApp('Открыть чат', `${config.WEBAPP_URL}/deal/${dealId}`)]
            ])
          );
        } catch (err) {
          console.error('Ошибка уведомления:', err);
        }
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  // Пользователь печатает
  socket.on('typing', (data) => {
    socket.to(`deal_${data.dealId}`).emit('user_typing', data);
  });
  
  // Отключение
  socket.on('disconnect', () => {
    console.log('❌ Пользователь отключился:', socket.id);
  });
});

// ============================================
// ⏰ CRON JOBS
// ============================================

// Обновление курсов валют (каждые 5 минут)
cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 Обновление курсов валют...');
  // Здесь интеграция с API курсов (CoinGecko, Binance и т.д.)
});

// Очистка истекших продвижений (каждый час)
cron.schedule('0 * * * *', async () => {
  console.log('🧹 Очистка истекших продвижений...');
  
  const now = new Date();
  await Deal.updateMany(
    { 'promoted.topUntil': { $lt: now } },
    { 
      $set: { 
        'promoted.topUntil': null,
        'promoted.pinned': false 
      } 
    }
  );
});

// Проверка истекших подписок (каждый день)
cron.schedule('0 0 * * *', async () => {
  console.log('🔍 Проверка подписок...');
  
  const now = new Date();
  const expiredUsers = await User.find({
    'subscription.type': 'pro',
    'subscription.expiresAt': { $lt: now }
  });
  
  for (const user of expiredUsers) {
    user.subscription.type = 'free';
    await user.save();
    
    // Уведомление
    try {
      await bot.telegram.sendMessage(
        user.telegramId,
        '⚠️ Ваша PRO подписка истекла.\n\nОбновите подписку, чтобы продолжить пользоваться всеми возможностями!',
        Markup.inlineKeyboard([
          [Markup.button.webApp('Продлить PRO', `${config.WEBAPP_URL}/subscription`)]
        ])
      );
    } catch (err) {
      console.error('Ошибка уведомления:', err);
    }
  }
  
  console.log(`✅ Обновлено подписок: ${expiredUsers.length}`);
});

// ============================================
// 🚀 ЗАПУСК СЕРВЕРА
// ============================================

const startServer = async () => {
  try {
    // Подключение к MongoDB
    console.log('\x1b[33m%s\x1b[0m', '📦 Подключение к MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB подключена успешно!\n');
    
    // Создание начальных данных
    const ratesCount = await Rate.countDocuments();
    if (ratesCount === 0) {
      console.log('\x1b[33m%s\x1b[0m', '📊 Создание начальных курсов...');
      await Rate.insertMany([
        { pair: 'BTC/USDT', rate: 43500, change24h: 2.5 },
        { pair: 'ETH/USDT', rate: 2250, change24h: 1.8 },
        { pair: 'TON/USDT', rate: 2.35, change24h: -0.5 },
        { pair: 'BNB/USDT', rate: 310, change24h: 3.2 },
        { pair: 'USD/RUB', rate: 92.5, change24h: 0.1 },
        { pair: 'EUR/RUB', rate: 101.2, change24h: -0.3 }
      ]);
      console.log('\x1b[32m%s\x1b[0m', '✅ Курсы созданы\n');
    }
    
    // Запуск бота
    console.log('\x1b[33m%s\x1b[0m', '🤖 Запуск Telegram бота...');
    await bot.launch();
    console.log('\x1b[32m%s\x1b[0m', '✅ Бот запущен успешно!\n');
    
    // Запуск HTTP сервера
    console.log('\x1b[33m%s\x1b[0m', `🌐 Запуск сервера на порту ${config.PORT}...`);
    httpServer.listen(config.PORT, () => {
      console.log('\x1b[32m%s\x1b[0m', `✅ Сервер запущен на http://localhost:${config.PORT}\n`);
      
      // Финальное сообщение
      console.log('\x1b[42m\x1b[30m%s\x1b[0m', '                                                    ');
      console.log('\x1b[42m\x1b[30m%s\x1b[0m', '  🎉 ВСЕ СИСТЕМЫ ЗАПУЩЕНЫ И РАБОТАЮТ! 🎉          ');
      console.log('\x1b[42m\x1b[30m%s\x1b[0m', '                                                    ');
      console.log('');
      console.log('\x1b[36m%s\x1b[0m', '📱 Telegram Bot: @YourBotUsername');
      console.log('\x1b[36m%s\x1b[0m', `🌐 API: http://localhost:${config.PORT}/api`);
      console.log('\x1b[36m%s\x1b[0m', `💬 WebSocket: http://localhost:${config.PORT}`);
      console.log('\x1b[36m%s\x1b[0m', `🗄️  Database: ${config.MONGODB_URI}`);
      console.log('');
      console.log('\x1b[33m%s\x1b[0m', '💡 Нажмите Ctrl+C для остановки');
      console.log('');
    });
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ОШИБКА ЗАПУСКА:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '⚠️  Получен сигнал SIGINT. Останавливаем сервисы...');
  bot.stop('SIGINT');
  mongoose.connection.close();
  httpServer.close();
  console.log('\x1b[32m%s\x1b[0m', '✅ Сервисы остановлены. До свидания!\n');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\n\x1b[33m%s\x1b[0m', '⚠️  Получен сигнал SIGTERM. Останавливаем сервисы...');
  bot.stop('SIGTERM');
  mongoose.connection.close();
  httpServer.close();
  console.log('\x1b[32m%s\x1b[0m', '✅ Сервисы остановлены. До свидания!\n');
  process.exit(0);
});

// Запуск
startServer();
