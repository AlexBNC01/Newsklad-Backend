# Newsklad Backend

Backend API для системы управления складом Newsklad.

## Функциональность
- ✅ Базовая структура Express сервера
- ✅ CORS настройки для React Native
- ✅ Безопасность (Helmet)
- ✅ Логирование (Morgan)
- ✅ Mock API для авторизации
- 🔄 База данных (будет добавлена)
- 🔄 JWT авторизация (будет добавлена)

## API Endpoints

### Базовые
- `GET /` - информация о API
- `GET /health` - проверка здоровья сервера

### Авторизация (Mock)
- `POST /api/auth/register` - регистрация пользователя
- `POST /api/auth/login` - вход пользователя

## Локальная разработка
```bash
npm install
npm run dev
```

## Деплой на Timeweb
См. инструкцию в DEPLOY.md