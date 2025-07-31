const { Pool } = require('pg');

// URL для подключения к базе данных Timeweb
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://gen_user:%2Fd%2FgQAoi7J%26%26Yd@37.252.23.194:5432/default_db';

console.log('🔌 Инициализация подключения к PostgreSQL...');
console.log('🔗 DATABASE_URL:', DATABASE_URL ? 'УСТАНОВЛЕН' : 'НЕ НАЙДЕН');

// Создаем пул подключений
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false, // Timeweb не требует SSL для внутренних подключений
  max: 10, // максимум 10 подключений
  min: 1,  // минимум 1 подключение
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Функция для проверки подключения
const checkConnection = async () => {
  try {
    console.log('🔄 Проверяем подключение к базе данных...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();
    
    console.log('✅ Подключение к PostgreSQL успешно!');
    console.log('🕒 Время сервера БД:', result.rows[0].current_time);
    console.log('📦 Версия PostgreSQL:', result.rows[0].version.split(' ')[0]);
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к PostgreSQL:', error.message);
    console.error('🔍 Детали ошибки:', error.code);
    return false;
  }
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