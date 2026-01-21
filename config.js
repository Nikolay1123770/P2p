import dotenv from 'dotenv';
dotenv.config();

export default {
  // Telegram Bot
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  WEBAPP_URL: process.env.WEBAPP_URL || 'https://your-app.vercel.app',
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || '',
  NEWS_CHANNEL_ID: process.env.NEWS_CHANNEL_ID || '',
  
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/exchange',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  
  // Subscription
  SUBSCRIPTION: {
    FREE: {
      dailyDeals: 3,
      price: 0
    },
    PRO: {
      dailyDeals: Infinity,
      price: 500,
      duration: 30 * 24 * 60 * 60 * 1000 // 30 дней
    }
  },
  
  // Promotion
  PROMOTION: {
    top: { price: 100, duration: 24 * 60 * 60 * 1000 },
    highlight: { price: 50 },
    pin: { price: 150, duration: 24 * 60 * 60 * 1000 }
  },
  
  // Currency pairs
  CURRENCIES: ['BTC', 'ETH', 'USDT', 'TON', 'BNB', 'USD', 'EUR', 'RUB', 'UAH'],
  
  // Payment methods
  PAYMENT_METHODS: [
    'Сбербанк',
    'Тинькофф',
    'Альфа-Банк',
    'ЮMoney',
    'QIWI',
    'PayPal',
    'Wise',
    'Revolut'
  ]
};
