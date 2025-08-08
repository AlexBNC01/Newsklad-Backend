const { Client } = require("pg");

console.log("🔌 Инициализация подключения к PostgreSQL...");

let client = null;

const checkConnection = async () => {
  try {
    console.log("🔄 Подключение к PostgreSQL...");

    client = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    });

    await client.connect();

    const result = await client.query(
      "SELECT NOW() as current_time, version() as version"
    );

    console.log("✅ Подключение к PostgreSQL успешно!");
    console.log("🕒 Время сервера БД:", result.rows[0].current_time);
    console.log("📦 Версия PostgreSQL:", result.rows[0].version.split(" ")[0]);

    return true;
  } catch (error) {
    console.error("❌ Ошибка подключения к БД:", error.message);
    console.error("🔍 Код ошибки:", error.code);
    return false;
  }
};

// Функция для создания таблиц
const createTables = async () => {
  try {
    console.log("🔨 Создание таблиц...");

    // Таблица пользователей
    await client.query(`
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица запчастей
    await client.query(`
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

    console.log("✅ Таблицы созданы успешно!");
    return true;
  } catch (error) {
    console.error("❌ Ошибка создания таблиц:", error.message);
    return false;
  }
};

// Функция для выполнения запросов
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    console.log("📊 Запрос выполнен за", duration, "мс");
    return result;
  } catch (error) {
    console.error("❌ Ошибка запроса:", error.message);
    throw error;
  }
};

// Экспортируем функции
module.exports = {
  client,
  query,
  checkConnection,
  createTables,
};
