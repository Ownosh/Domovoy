# Нагрузочное тестирование Domovoy API

Сервер должен быть запущен: `npm run dev` (порт **3001**).

## Полная проверка (рекомендуется)

Один запуск: диагностика → smoke (5 VU) → load (30 VU, ~5 мин).

```powershell
cd D:\vashdom\Domovoy\backend
$env:BASE_URL = "http://127.0.0.1:3001"
$env:TEST_EMAIL = "ваш@email.com"
$env:TEST_PASSWORD = "пароль"
npm run loadtest:check
```

## Профили нагрузки

| Команда | Пользователей | Длительность | Когда |
|---------|---------------|--------------|-------|
| `loadtest:check` | 5 → 30 | ~6 мин | Перед релизом |
| `loadtest:k6:smoke` | 5 | 30 сек | Быстро «жив ли сервер» |
| `loadtest:k6:load` | 30 | ~5 мин | Нормальная проверка |
| `loadtest:k6:peak` | 50 | ~4 мин | Пик (крупный ЖК) |
| `loadtest:k6:stress` | до 150 | ~8 мин | Только `/health`, предел системы |

## Отдельные шаги

```powershell
npm run loadtest:diagnose
npm run loadtest:k6:smoke
npm run loadtest:k6:load
```

Без k6 (autocannon + fetch):

```powershell
npm run loadtest:health
npm run loadtest:app
```

## Переменные

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `BASE_URL` | `http://127.0.0.1:3001` | Адрес API (локально, не прод!) |
| `TEST_EMAIL` / `TEST_PASSWORD` | — | Тестовый пользователь из `users` |
| `LOAD_PROFILE` | `load` | `quick` / `load` / `peak` |
| `VUS` | из профиля | Переопределить число пользователей |
| `K6_BIN` | авто | Путь к k6.exe |

Установка k6: `winget install GrafanaLabs.k6`

## Пул MySQL

```
DB_POOL_SIZE=20
DB_POOL_MAX_IDLE=10
```

## Ошибки

| Симптом | Причина |
|--------|---------|
| `Login failed: 0` | Неверный `BASE_URL` или сервер не запущен |
| `5.181.109.109` в логах | Задайте `$env:BASE_URL = "http://127.0.0.1:3001"` |
| 500 на `/api/...` | SQL/схема — сначала `loadtest:diagnose` |
| 429 | Rate limit на login — не гоните auth в цикле |
