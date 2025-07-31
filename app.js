require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { checkConnection, createTables, query } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Newsklad Backend запускается...');
console.log('📅 Время запуска:', new Date().toISOString());
console.log('🌍 Окружение:', process.env.NODE_ENV || 'development');
console.log('🔌 Порт:', PORT);
console.log('🆕 Версия: 1.1.0 - With PostgreSQL');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Инициализация базы данных
let dbConnected = false;

const initDatabase = async () => {
  console.log('🔄 Инициализация базы данных...');
  
  // Проверяем подключение
  const connected = await checkConnection();
  if (!connected) {
    console.log('⚠️ Продолжаем без базы данных (режим без БД)');
    return false;
  }
  
  // Создаем таблицы
  const tablesCreated = await createTables();
  if (tablesCreated) {
    console.log('✅ База данных готова к работе!');
    dbConnected = true;
    return true;
  }
  
  return false;
};

// Базовые роуты
app.get('/', (req, res) => {
  res.json({
    message: 'Newsklad Backend API работает!',
    version: '1.1.0',
    database: dbConnected ? 'подключена' : 'отключена',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: dbConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.1.0'
  });
});

// API для регистрации
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    console.log('📝 Регистрация пользователя:', email);
    
    // Валидация
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля'
      });
    }
    
    if (!dbConnected) {
      // Режим без базы данных - возвращаем mock
      return res.json({
        success: true,
        message: 'Регистрация успешна (режим без БД)',
        data: {
          user: { id: 1, email, firstName, lastName },
          token: 'mock-jwt-token'
        }
      });
    }
    
    // Проверяем существует ли пользователь
    const userExists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    const result = await query(
      'INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at',
      [email, hashedPassword, firstName, lastName]
    );
    
    const user = result.rows[0];
    
    // Создаем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Регистрация успешна',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          createdAt: user.created_at
        },
        token
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера при регистрации'
    });
  }
});

// API для входа
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Попытка входа:', email);
    
    // Валидация
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Введите email и пароль'
      });
    }
    
    if (!dbConnected) {
      // Режим без базы данных - возвращаем mock
      return res.json({
        success: true,
        message: 'Вход выполнен успешно (режим без БД)',
        data: {
          user: { id: 1, email, firstName: 'Тест', lastName: 'Пользователь' },
          token: 'mock-jwt-token'
        }
      });
    }
    
    // Ищем пользователя
    const result = await query(
      'SELECT id, email, password, first_name, last_name FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }
    
    const user = result.rows[0];
    
    // Проверяем пароль
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверные учетные данные'
      });
    }
    
    // Создаем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        },
        token
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера при входе'
    });
  }
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
const startServer = async () => {
  // Сначала инициализируем базу данных
  await initDatabase();
  
  // Затем запускаем сервер
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
✅ Сервер Newsklad Backend запущен!
📍 Адрес: http://0.0.0.0:${PORT}
🌍 Окружение: ${process.env.NODE_ENV || 'development'}
💾 База данных: ${dbConnected ? 'подключена' : 'отключена'}
🕒 Время запуска: ${new Date().toISOString()}
🎯 Готов к подключениям!
    `);
  });
  
  server.on('error', (err) => {
    console.error('❌ Ошибка запуска сервера:', err);
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
};

// Запускаем сервер
startServer().catch(error => {
  console.error('❌ Критическая ошибка запуска:', error);
  process.exit(1);
});

module.exports = app;