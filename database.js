const { Pool } = require('pg');

// URL для подключения к базе данных Timeweb  
// Попробуем разные варианты подключения
const databaseVariants = [
  process.env.DATABASE_URL,
  'postgresql://gen_user:/d/gQAoi7J&&Yd@37.252.23.194:5432/gen_user',
  'postgresql://gen_user:/d/gQAoi7J&&Yd@37.252.23.194:5432/default_db',
  'postgresql://gen_user:/d/gQAoi7J&&Yd@37.252.23.194:5432/postgres'
].filter(Boolean);

let DATABASE_URL = null;
let connectionAttempt = 0;

console.log('🔌 Инициализация подключения к PostgreSQL...');
console.log('🔗 Попробуем варианты:', databaseVariants.length);

let pool = null;

// Функция для создания пула с определенным URL
const createPool = (url) => {
  return new Pool({
    connectionString: url,
    ssl: false,
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    acquireTimeoutMillis: 10000,
  });
};

// Функция для проверки подключения - перебираем все варианты
const checkConnection = async () => {
  for (let i = 0; i < databaseVariants.length; i++) {
    const url = databaseVariants[i];
    connectionAttempt = i + 1;
    
    try {
      console.log(`🔄 Попытка ${connectionAttempt}/${databaseVariants.length}:`);
      
      // Показываем детали подключения (без пароля)
      const dbUrl = new URL(url);
      console.log('🏠 Host:', dbUrl.hostname);
      console.log('🔌 Port:', dbUrl.port);
      console.log('👤 User:', dbUrl.username);
      console.log('💾 Database:', dbUrl.pathname.slice(1));
      
      // Создаем временный пул для тестирования
      const testPool = createPool(url);
      const client = await testPool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();
      await testPool.end();
      
      // Если дошли сюда - подключение успешно!
      console.log('✅ Подключение к PostgreSQL успешно!');
      console.log('🕒 Время сервера БД:', result.rows[0].current_time);
      console.log('📦 Версия PostgreSQL:', result.rows[0].version.split(' ')[0]);
      
      // Сохраняем рабочий URL и создаем основной пул
      DATABASE_URL = url;
      pool = createPool(url);
      
      console.log(`🎯 Используем вариант ${connectionAttempt}: ${dbUrl.pathname.slice(1)}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Вариант ${connectionAttempt} провален:`, error.message);
      console.error('🔍 Код ошибки:', error.code);
      
      // Если не последний вариант, продолжаем
      if (i < databaseVariants.length - 1) {
        console.log('⏭️ Пробуем следующий вариант...');
      }
    }
  }
  
  console.error('💥 Все варианты подключения к БД провалены!');
  return false;
};

// Функция для создания таблиц
const createTables = async () => {
  try {
    console.log('🔨 Создание таблиц...');
    
    // Таблица пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        email_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(255),
        verification_expires TIMESTAMP,
        login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица компаний
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Таблица запчастей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sku VARCHAR(100) UNIQUE,
        quantity INTEGER DEFAULT 0,
        price DECIMAL(10,2),
        company_id INTEGER REFERENCES companies(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Таблицы созданы успешно!');
    return true;
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error.message);
    return false;
  }
};

// Функция для выполнения запросов
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Запрос выполнен за', duration, 'мс');
    return result;
  } catch (error) {
    console.error('❌ Ошибка запроса:', error.message);
    throw error;
  }
};

// Экспортируем функции
module.exports = {
  pool,
  query,
  checkConnection,
  createTables
};