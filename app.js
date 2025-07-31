require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// Получаем порт от Timeweb или используем 3000 для разработки
const PORT = process.env.PORT || 3000;

console.log('🚀 Newsklad Backend запускается...');
console.log('📅 Время запуска:', new Date().toISOString());
console.log('🌍 Окружение:', process.env.NODE_ENV || 'development');
console.log('🔌 Порт:', PORT);
console.log('🆕 Версия: 1.0.1 - Fresh Deploy');

// Базовые middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:19006', 'http://localhost:19000'],
  credentials: true
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Роуты
app.get('/', (req, res) => {
  res.json({
    message: 'Newsklad Backend API работает!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API роуты для авторизации (пока mock)
app.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  console.log('📝 Регистрация пользователя:', email);
  
  // Базовая валидация
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      success: false,
      message: 'Заполните все обязательные поля'
    });
  }
  
  // Mock ответ
  res.json({
    success: true,
    message: 'Регистрация успешна',
    data: {
      user: {
        id: 1,
        email,
        firstName,
        lastName,
        createdAt: new Date().toISOString()
      },
      token: 'mock-jwt-token-' + Date.now()
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Попытка входа:', email);
  
  // Базовая валидация
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Введите email и пароль'
    });
  }
  
  // Mock ответ
  res.json({
    success: true,
    message: 'Вход выполнен успешно',
    data: {
      user: {
        id: 1,
        email,
        firstName: 'Тестовый',
        lastName: 'Пользователь'
      },
      token: 'mock-jwt-token-' + Date.now()
    }
  });
});

// 404 обработчик
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Эндпоинт не найден',
    path: req.originalUrl
  });
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('❌ Ошибка сервера:', err);
  res.status(500).json({
    success: false,
    message: 'Внутренняя ошибка сервера'
  });
});

// Запуск сервера
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
✅ Сервер Newsklad Backend запущен!
📍 Адрес: http://0.0.0.0:${PORT}
🌍 Окружение: ${process.env.NODE_ENV || 'development'}
🕒 Время запуска: ${new Date().toISOString()}
🎯 Готов к подключениям!
  `);
});

// Обработка ошибок сервера
server.on('error', (err) => {
  console.error('❌ Ошибка запуска сервера:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} уже используется`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен SIGTERM, завершаем сервер...');
  server.close(() => {
    console.log('✅ Сервер закрыт корректно');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Получен SIGINT, завершаем сервер...');
  server.close(() => {
    console.log('✅ Сервер закрыт корректно');
    process.exit(0);
  });
});

module.exports = app;