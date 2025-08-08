require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const { checkConnection, createTables, query } = require('./database');
const emailService = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Newsklad Backend запускается...');
console.log('📅 Время запуска:', new Date().toISOString());
console.log('🌍 Окружение:', process.env.NODE_ENV || 'development');
console.log('🔌 Порт:', PORT);
console.log('🆕 Версия: 1.1.0 - With PostgreSQL');

// Меры безопасности
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS настройки для React Native
app.use(cors({
  origin: true, // Разрешаем все домены для мобильного приложения
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с IP
  message: {
    error: 'Слишком много запросов с вашего IP. Попробуйте позже.',
    retryAfter: '15 минут'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток авторизации
  message: {
    error: 'Слишком много попыток входа. Попробуйте через 15 минут.'
  },
  skipSuccessfulRequests: true,
});

app.use(generalLimiter);
app.use(morgan('combined'));

// Отладочный middleware для всех запросов
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  if (req.method === 'POST' && req.body) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.use(express.json({ limit: '1mb' })); // уменьшил лимит для безопасности
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware для авторизации
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Токен доступа не предоставлен'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Ошибка верификации токена:', err.message);
      return res.status(403).json({
        success: false,
        message: 'Недействительный токен доступа'
      });
    }

    req.user = user; // Добавляем информацию о пользователе в request
    next();
  });
};

// Опциональная авторизация (не блокирует запрос если токена нет)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  
  next();
};

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
  console.log('🏠 GET / запрос получен');
  res.json({
    message: 'Newsklad Backend API работает!',
    version: '1.2.0',
    database: dbConnected ? 'подключена' : 'отключена',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: 'enabled',
    endpoints: [
      'GET /',
      'GET /health',
      'GET /api/db-check',
      'POST /api/create-test-account',
      'GET /api/users [AUTH]',
      'GET /api/profile [AUTH]',
      'PUT /api/profile [AUTH]',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/verify-email'
    ]
  });
});

// Простой тестовый endpoint
app.post('/api/test', (req, res) => {
  console.log('🧪 POST /api/test запрос получен');
  console.log('📦 Тест данные:', req.body);
  res.json({
    success: true,
    message: 'API тест успешен!',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// GET версия для простого тестирования
app.get('/api/test', (req, res) => {
  console.log('🧪 GET /api/test запрос получен');
  res.json({
    success: true,
    message: 'GET API тест успешен!',
    database: dbConnected ? 'подключена' : 'отключена',
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent')
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

// Детальная проверка БД
app.get('/api/db-check', async (req, res) => {
  try {
    console.log('🔍 Проверка работоспособности БД...');
    
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: 'База данных недоступна',
        details: 'Подключение к БД не установлено'
      });
    }

    // Проверяем подключение
    const timeResult = await query('SELECT NOW() as current_time, version() as version');
    
    // Проверяем таблицы
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Считаем количество пользователей
    const usersCount = await query('SELECT COUNT(*) as count FROM users');
    
    // Считаем количество компаний
    const companiesCount = await query('SELECT COUNT(*) as count FROM companies');
    
    // Считаем количество запчастей
    const partsCount = await query('SELECT COUNT(*) as count FROM parts');

    res.json({
      success: true,
      message: 'База данных работает корректно',
      database: {
        connected: true,
        serverTime: timeResult.rows[0].current_time,
        version: timeResult.rows[0].version.split(' ')[0],
        tables: tablesResult.rows.map(row => row.table_name),
        statistics: {
          users: parseInt(usersCount.rows[0].count),
          companies: parseInt(companiesCount.rows[0].count),
          parts: parseInt(partsCount.rows[0].count)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка проверки БД:', error.message);
    res.status(500).json({
      success: false,
      message: 'Ошибка при проверке базы данных',
      error: error.message
    });
  }
});

// Создание тестового аккаунта для проверки синхронизации
app.post('/api/create-test-account', async (req, res) => {
  try {
    console.log('🧪 Создание тестового аккаунта...');
    
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: 'База данных недоступна'
      });
    }

    const testEmail = `test_${Date.now()}@newsklad.test`;
    const testPassword = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    
    // Создаем тестового пользователя
    const userResult = await query(
      `INSERT INTO users (email, password, first_name, last_name, email_verified, role) 
       VALUES ($1, $2, $3, $4, true, $5) 
       RETURNING id, email, first_name, last_name, created_at`,
      [testEmail, hashedPassword, 'Test', 'User', 'user']
    );
    
    const user = userResult.rows[0];
    
    // Создаем тестовую компанию
    const companyResult = await query(
      `INSERT INTO companies (name, description, owner_id) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, created_at`,
      [`Test Company ${Date.now()}`, 'Тестовая компания для проверки синхронизации', user.id]
    );
    
    const company = companyResult.rows[0];
    
    // Создаем несколько тестовых запчастей
    const parts = [];
    for (let i = 1; i <= 3; i++) {
      const partResult = await query(
        `INSERT INTO parts (name, description, sku, quantity, price, company_id) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, name, sku, quantity, price`,
        [
          `Test Part ${i}`,
          `Тестовая запчасть №${i}`,
          `TEST-${Date.now()}-${i}`,
          Math.floor(Math.random() * 100) + 1,
          (Math.random() * 1000).toFixed(2),
          company.id
        ]
      );
      parts.push(partResult.rows[0]);
    }

    res.json({
      success: true,
      message: 'Тестовый аккаунт создан успешно',
      testAccount: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          createdAt: user.created_at
        },
        credentials: {
          email: testEmail,
          password: testPassword
        },
        company: {
          id: company.id,
          name: company.name,
          createdAt: company.created_at
        },
        parts: parts
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка создания тестового аккаунта:', error.message);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании тестового аккаунта',
      error: error.message
    });
  }
});

// Получение всех пользователей (только для администраторов)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Получение списка пользователей...');
    
    if (!dbConnected) {
      return res.status(503).json({
        success: false,
        message: 'База данных недоступна'
      });
    }

    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.email_verified,
        u.created_at,
        COUNT(c.id) as companies_count
      FROM users u
      LEFT JOIN companies c ON u.id = c.owner_id
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.email_verified, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      message: `Найдено ${result.rows.length} пользователей`,
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        emailVerified: user.email_verified,
        companiesCount: parseInt(user.companies_count),
        createdAt: user.created_at
      }))
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения пользователей:', error.message);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка пользователей',
      error: error.message
    });
  }
});

// Получение профиля текущего пользователя
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    console.log('👤 Получение профиля пользователя:', req.user.userId);
    
    if (!dbConnected) {
      return res.json({
        success: true,
        message: 'Профиль пользователя (режим без БД)',
        user: {
          id: req.user.userId,
          email: req.user.email,
          firstName: 'Test',
          lastName: 'User'
        }
      });
    }

    // Получаем данные пользователя с информацией о компаниях
    const result = await query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.email_verified,
        u.created_at,
        u.last_login,
        COUNT(c.id) as companies_count
      FROM users u
      LEFT JOIN companies c ON u.id = c.owner_id
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.email_verified, u.created_at, u.last_login
    `, [req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const user = result.rows[0];

    // Обновляем время последнего входа
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [req.user.userId]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        emailVerified: user.email_verified,
        companiesCount: parseInt(user.companies_count),
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения профиля:', error.message);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении профиля пользователя'
    });
  }
});

// Обновление профиля пользователя
app.put('/api/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Имя от 2 до 50 символов'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Фамилия от 2 до 50 символов'),
], async (req, res) => {
  try {
    // Проверяем ошибки валидации
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    console.log('✏️ Обновление профиля пользователя:', req.user.userId);
    
    const { firstName, lastName } = req.body;

    if (!firstName && !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать хотя бы одно поле для обновления'
      });
    }

    if (!dbConnected) {
      return res.json({
        success: true,
        message: 'Профиль обновлен (режим без БД)',
        user: {
          id: req.user.userId,
          email: req.user.email,
          firstName: firstName || 'Test',
          lastName: lastName || 'User'
        }
      });
    }

    // Строим динамический запрос обновления
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName) {
      updates.push(`first_name = $${paramCount}`);
      values.push(firstName);
      paramCount++;
    }

    if (lastName) {
      updates.push(`last_name = $${paramCount}`);
      values.push(lastName);
      paramCount++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.user.userId); // для WHERE условия

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, role, email_verified, updated_at
    `;

    const result = await query(updateQuery, values);
    const updatedUser = result.rows[0];

    res.json({
      success: true,
      message: 'Профиль успешно обновлен',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        emailVerified: updatedUser.email_verified,
        updatedAt: updatedUser.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error.message);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении профиля'
    });
  }
});

// Валидация для регистрации
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Введите корректный email'),
  body('password').isLength({ min: 8 }).withMessage('Пароль должен содержать минимум 8 символов'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('Имя от 2 до 50 символов'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Фамилия от 2 до 50 символов'),
];

// API для регистрации
app.post('/api/auth/register', authLimiter, registerValidation, async (req, res) => {
  try {
    // Проверяем ошибки валидации
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName } = req.body;
    
    console.log('📝 Регистрация пользователя:', email);
    
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
    const hashedPassword = await bcrypt.hash(password, 12); // увеличил rounds для безопасности
    
    // Генерируем код подтверждения
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
    
    // Создаем пользователя (email_verified = false)
    const result = await query(
      `INSERT INTO users (email, password, first_name, last_name, email_verified, verification_code, verification_expires) 
       VALUES ($1, $2, $3, $4, false, $5, $6) 
       RETURNING id, email, first_name, last_name, created_at, email_verified`,
      [email, hashedPassword, firstName, lastName, verificationCode, verificationExpires]
    );
    
    const user = result.rows[0];
    
    // Отправляем email подтверждения
    const emailSent = await emailService.sendVerificationEmail(email, firstName, verificationCode);
    
    // НЕ создаем JWT токен до подтверждения email
    res.json({
      success: true,
      message: emailSent.success 
        ? 'Регистрация успешна! Проверьте email для подтверждения аккаунта.'
        : 'Регистрация успешна! Email подтверждение отключено - можете входить.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          emailVerified: user.email_verified,
          createdAt: user.created_at
        },
        emailSent: emailSent.success,
        // Токен выдаем только если email подтверждение отключено
        token: emailSent.success ? null : jwt.sign(
          { userId: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        )
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

// API для подтверждения email
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Код подтверждения обязателен'
      });
    }
    
    if (!dbConnected) {
      return res.json({
        success: true,
        message: 'Email подтвержден (режим без БД)'
      });
    }
    
    // Ищем пользователя с данным кодом
    const result = await query(
      `SELECT id, email, first_name, last_name, verification_expires 
       FROM users 
       WHERE verification_code = $1 AND email_verified = false`,
      [code]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Неверный или уже использованный код подтверждения'
      });
    }
    
    const user = result.rows[0];
    
    // Проверяем не истек ли код
    if (new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Код подтверждения истек. Запросите новый.'
      });
    }
    
    // Подтверждаем email
    await query(
      `UPDATE users 
       SET email_verified = true, verification_code = NULL, verification_expires = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );
    
    // Создаем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Email подтвержден:', user.email);
    
    res.json({
      success: true,
      message: 'Email успешно подтвержден! Добро пожаловать в Newsklad!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          emailVerified: true
        },
        token
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка подтверждения email:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
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
      process.env.JWT_SECRET,
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