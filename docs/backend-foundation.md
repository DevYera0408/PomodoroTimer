# Фундамент бэкенда «Фокус» — проект и контракт v1

*Статус: проект (код не реализован). localStorage остаётся источником истины до отдельного решения. Аккаунты — за скоупом, но задел заложен.*

## 1. Цель, границы и не-цели

**Цель** — спроектировать API и модель данных для будущего серверного бэкенда, чтобы клиент (React + localStorage) мог перейти на синхронизацию без переделок UI и типов.

**В скоупе:**
- REST API v1 (`/api/v1/...`) для задач, дневной статистики, истории по дням, серии дней (streak), настроек темы.
- Контракт: методы, пути, тела запросов/ответов, коды ошибок, версионирование, идемпотентность, пагинация.
- Маппинг localStorage-ключей ↔ таблицы БД ↔ поля API ↔ TS-типы.
- Правила дат/таймзон, миграция/совместимость, feature-flag для включения синхронизации.
- Безопасность на уровне контракта (валидация, лимиты, CORS, секреты, отсутствие PII).
- Критерии готовности и поэтапный план реализации.

**Не в скоупе (не делаем сейчас):**
- Написание кода сервера, настройка БД, деплой, CI/CD.
- Авторизация/аккаунты (задел в схеме есть, эндпоинты — позже).
- Реальная миграция данных пользователей.
- WebSockets / realtime.
- Админка, метрики, логирование.

## 2. Текущая модель данных (фактические типы из `src/App.tsx`)

| Сущность | Поля (TS) | localStorage-ключ | Семантика |
|---|---|---|---|
| **Task** | `id: string`, `text: string`, `completed: boolean`, `completedDate?: string` | `focus-tasks` | Задача. `completedDate` — локальная дата YYYY-MM-DD, когда отмечена выполненной (устанавливается в `toggleTask`). `id` — UUID v4 или фолбэк. |
| **DailyStats** | `date: string`, `focusMinutes: number` | `focus-stats` | Минуты фокуса текущего дня. `date` = `dateKey()` (локальная дата клиента). При смене дня сбрасывается на `{ date: today, focusMinutes: 0 }`. |
| **DayMinutes** | `Record<string, number>` | `focus-days` | История минут фокуса по дням: ключ = `YYYY-MM-DD` (локальная дата), значение = накопленные минуты за день. Используется для streak. |
| **StreakData** | `current: number`, `best: number` | `focus-streak` | `current` — текущая серия подряд идущих дней с `focusMinutes ≥ FOCUS_GOAL_MINUTES (60)`. `best` — максимум за всё время (не сбрасывается). Пересчитывается из `focus-days` функцией `computeStreak`. |
| **Theme** | `'dark' \| 'light'` | `focus-theme` | Тема UI. Применяется как класс `dark` на `<html>`. |
| **Константы** | `DURATIONS = { work: 1500, rest: 300 }` (сек), `FOCUS_GOAL_MINUTES = 60` | — | Режимы таймера и порог зачтённого дня. Не в localStorage. |

**Идентификаторы:**
- Задача: `id` (string, UUID-like).
- День: строка `YYYY-MM-DD` в локальной таймзоне клиента (`dateKey()`).

**Как считается день:** `dateKey()` возвращает локальную дату клиента в формате YYYY-MM-DD.

## 3. Предлагаемый стек и обоснование

| Вариант | Стек | Плюсы | Минусы |
|---|---|---|---|
| **Основной (рекомендуется)** | **Node 22 + Fastify + TypeScript (strict) + Prisma + PostgreSQL** | Единый TS на клиенте и сервере (shared types). Fastify: низкий оверхед, валидация JSON Schema, плагины (CORS, rate-limit, swagger). Prisma: типобезопасные миграции. PostgreSQL: надёжность, ACID. | Требует отдельного серверного пакета (`server/`). Prisma добавляет зависимость. |
| Альтернатива 1 | Node 22 + Hono + SQLite (libSQL / Turso) | Минималистично, edge-ready, файловая БД / serverless. | Ограничения SQLite при конкурентных записях. Меньше экосистемы миграций. |
| Альтернатива 2 | Node 22 + Express + TypeORM + PostgreSQL | Знакомый стек, много примеров. | Express медленнее, нет встроенной валидации, TypeORM менее типобезопасен, чем Prisma. |

**Ограничения проекта:**
- Новые зависимости — только с разрешения пользователя.
- Бэкенд — отдельный серверный пакет (не смешивать с клиентом Vite).
- `package.json` клиента не меняем.

## 4. Предлагаемая структура каталогов (server/)

```
server/
├── package.json           # отдельный, собственные зависимости
├── tsconfig.json          # свой strict
├── prisma/
│   ├── schema.prisma      # модели БД (см. раздел 6)
│   └── migrations/
├── src/
│   ├── main.ts            # bootstrap Fastify, plugins, routes
│   ├── config/
│   │   └── env.ts         # валидированные env vars
│   ├── routes/
│   │   ├── health.ts      # GET /api/v1/health
│   │   ├── tasks.ts       # CRUD tasks
│   │   ├── stats.ts       # daily stats, history, streak
│   │   └── settings.ts    # theme
│   ├── services/
│   │   ├── tasks.ts
│   │   ├── stats.ts
│   │   └── streak.ts
│   ├── schemas/           # Zod/JSON Schema для валидации входа
│   │   ├── task.ts
│   │   ├── stats.ts
│   │   └── common.ts
│   ├── middleware/
│   │   ├── auth.ts        # stub: будущий JWT / api-key
│   │   ├── cors.ts
│   │   ├── rate-limit.ts
│   │   └── error.ts
│   └── utils/
│       ├── date.ts        # dateKey, shiftDay, computeStreak (shared с клиентом)
│       └── id.ts          # UUID generator
└── Dockerfile             # опционально, для этапа реализации
```

*Файлы не создаются сейчас — только структура для понимания.*

## 5. API-контракт v1

**Базовый путь:** `/api/v1`
**Версионирование:** в URL (`/api/v1/`). Breaking changes → `/api/v2/`.

**Формат ошибки (все эндпоинты):**
```ts
type ApiError = {
  error: {
    code: string;           // "VALIDATION_ERROR", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "UNAUTHORIZED", "INTERNAL"
    message: string;        // человекочитаемый (RU)
    details?: Record<string, unknown>; // для VALIDATION_ERROR: поле → сообщение
  }
}
```
**HTTP коды:** 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 404 Not Found, 409 Conflict, 422 Unprocessable Entity (валидация), 429 Too Many Requests, 500 Internal Server Error.

**Разделение 400 и 422:** 400 — невалидный JSON, отсутствует обязательное поле или неверный тип; 422 — запрос синтаксически корректен, но нарушены бизнес-правила (`text` > 500, `deltaMinutes` < 0 и т.п.).

**Идемпотентность:**
- `POST /tasks` — идемпотентен по заголовку `Idempotency-Key` (клиент генерирует UUID на создание). Тот же ключ + идентичное тело → 200 и существующий ресурс; тот же ключ + другое тело → 409 `IDEMPOTENCY_KEY_REUSED`. Ключ хранится 24 часа.
- `PUT /stats/today` — идемпотентен по заголовку `Idempotency-Key` (см. §5.3).
- `DELETE /tasks/:id` — идемпотентен (повтор → 204).

**Пагинация / сортировка (где применимо):**
- `GET /tasks?limit=50&cursor=<id>&sort=createdAt:desc` — keyset pagination по `id` (UUID v4 ~= time-ordered) или `createdAt`.
- `GET /stats/history?from=2026-01-01&to=2026-12-31` — диапазон дат включительно.

### 5.1 Health

| Метод | Путь | Ответ (200) |
|---|---|---|
| GET | `/api/v1/health` | `{ status: "ok", version: "1.0.0", serverTime: "2026-10-19T12:34:56.789Z" }` |

### 5.2 Задачи (Tasks)

**Общий формат задачи (API):**
```ts
type TaskDto = {
  id: string;
  text: string;
  completed: boolean;
  completedDate: string | null;   // YYYY-MM-DD или null
  createdAt: string;              // ISO 8601 UTC
  updatedAt: string;              // ISO 8601 UTC
}
```

**Совместимость с клиентом:** клиентский `Task` — структурное подмножество `TaskDto`. Клиент игнорирует незнакомые поля ответа и не пишет `createdAt`/`updatedAt` в localStorage; при синхронизации мапит ответ в локальный тип без этих полей. Поля нужны серверу для разрешения конфликтов и пагинации.

| Метод | Путь | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| GET | `/api/v1/tasks` | Query: `limit?`, `cursor?`, `sort?` | `{ items: TaskDto[], nextCursor?: string }` | 400 (валидация query) |
| POST | `/api/v1/tasks` | Body: `{ text: string }`, Header: `Idempotency-Key: <uuid>` | 201 `TaskDto` (повтор — 200 `TaskDto`) | 400 (нет обязательного поля/неверный тип), 409 (`IDEMPOTENCY_KEY_REUSED`: ключ + другое тело), 422 (бизнес-правила, например `text` > 500) |
| PATCH | `/api/v1/tasks/:id` | Body: `{ text?: string, completed?: boolean }` | 200 `TaskDto` | 400, 404, 422 |
| DELETE | `/api/v1/tasks/:id` | — | 204 | 404 |

**Примечания:**
- `completedDate` устанавливает сервер при переходе `completed: false → true`. День берётся из `clientDay` клиента (`X-Client-Day` или поле тела); `clientDay` при этом обязателен, сервер не подставляет свою дату.
- `createdAt` / `updatedAt` — UTC ISO строки, генерирует сервер.
- `POST /tasks`: тот же `Idempotency-Key` + идентичное тело → 200 и существующий ресурс; тот же ключ + другое тело → 409 `IDEMPOTENCY_KEY_REUSED`. Ключ хранится 24 часа.

### 5.3 Дневная статистика и история (Stats)

**DTO:**
```ts
type DailyStatsDto = { date: string; focusMinutes: number }  // date = YYYY-MM-DD
type DayMinutesDto = Record<string, number>;                  // ключ = YYYY-MM-DD
type StreakDto = { current: number; best: number };           // v1: порог фиксирован 60 (FOCUS_GOAL_MINUTES)
```

| Метод | Путь | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| GET | `/api/v1/stats/today` | Query: `clientDay` (YYYY-MM-DD, обязательный) или заголовок `X-Client-Day` | 200 `DailyStatsDto` за указанный день; если записи нет — `{ date: clientDay, focusMinutes: 0 }` | 400 (отсутствует/невалиден `clientDay`) |
| PUT | `/api/v1/stats/today` | Body: `{ clientDay: string, deltaMinutes: number }`, Header: `Idempotency-Key: <uuid>` | 200 `DailyStatsDto` — накопленный итог дня | 400 (невалидные данные), 409 (тот же `Idempotency-Key` с другим телом), 429 |
| GET | `/api/v1/stats/history` | Query: `from`, `to` (YYYY-MM-DD) | 200 `DayMinutesDto` | 400 |
| GET | `/api/v1/stats/streak` | — | 200 `StreakDto` | — |

**Примечания:**
- `PUT /stats/today` — upsert: сервер прибавляет `deltaMinutes` (целое ≥ 0, ≤ 1440) к дню `clientDay` и возвращает накопленный итог `{ date, focusMinutes }`. Сервер не угадывает дату.
- `Idempotency-Key` обязателен для `PUT /stats/today`: повтор с тем же ключом и тем же телом не прибавляет минуты второй раз и возвращает 200 с тем же итогом; тот же ключ с другим телом → 409. Ключ хранится 24 часа.
- `GET /stats/today` возвращает статистику именно за `clientDay` (query-параметр или `X-Client-Day`), сервер не подставляет свой день.
- `GET /stats/streak`: в v1 порог фиксирован 60 (`FOCUS_GOAL_MINUTES`), `goalMinutes` в API не отдаётся.
- История (`focus-days`) хранится записями (строками таблицы) в БД; `DayMinutesDto` собирается из них.

### 5.4 Настройки (Settings)

| Метод | Путь | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| GET | `/api/v1/settings/theme` | — | 200 `{ theme: "dark" \| "light" }` | — |
| PUT | `/api/v1/settings/theme` | Body: `{ theme: "dark" \| "light" }` | 200 `{ theme: "dark" \| "light" }` | 400 (невалидное значение) |

### 5.5 Синхронизация

| Метод | Путь | Запрос | Ответ | Ошибки |
|---|---|---|---|---|
| POST | `/api/v1/sync/bootstrap` | Body: см. ниже | 200 `{ serverVersion: number, applied: { tasks: number, days: number }, conflicts: Conflict[] }` | 400 (невалидный дамп), 413 (дамп слишком большой), 429 |

```ts
type BootstrapRequest = {
  tasks: Task[];
  stats: DailyStats;
  days: Record<string, number>;
  streak: { current: number; best: number };
  theme: "dark" | "light";
  clientDay: string; // YYYY-MM-DD
};

type Conflict = {
  entity: "task" | "day";
  id?: string;    // для entity: "task"
  date?: string;  // для entity: "day"
  reason: string;
};
```

**Примечания:**
- Идемпотентность: повторный bootstrap не задваивает минуты — для дней берётся `max(server, client)`; задачи мержатся по `id` с правилом `updatedAt` (побеждает больший; при равенстве — серверная).
- Streak пересчитывается на сервере из `DayMinute` после мержа истории.
- Эндпоинт нужен только на этапе 4; его реализация не входит в текущий скоуп.

## 6. Таблица соответствия: localStorage ↔ БД ↔ API ↔ TS

| localStorage-ключ | Поле в LS | Таблица БД (Prisma) | Поле БД | Поле API (DTO) | TS-тип (клиент) |
|---|---|---|---|---|---|
| `focus-tasks` | `id` | `Task` | `id` (UUID, PK) | `id` | `string` |
|  | `text` |  | `text` (String, ≤500) | `text` | `string` |
|  | `completed` |  | `completed` (Boolean) | `completed` | `boolean` |
|  | `completedDate` |  | `completedDate` (Date?, @db.Date) | `completedDate` (`string \| null`) | `string \| undefined` (`null` → `undefined` и наоборот при отправке) |
|  | — |  | `createdAt` (DateTime, @default(now())) | `createdAt` | `string` (ISO) |
|  | — |  | `updatedAt` (DateTime, @updatedAt) | `updatedAt` | `string` (ISO) |
| `focus-stats` | `date` | `DailyStat` | `date` (Date, @db.Date, unique) | `date` | `string` (YYYY-MM-DD) |
|  | `focusMinutes` |  | `focusMinutes` (Int, @default(0)) | `focusMinutes` | `number` |
| `focus-days` | ключ `YYYY-MM-DD` | `DayMinute` | `date` (Date, @db.Date, PK) | ключ объекта | `string` |
|  | значение `number` |  | `minutes` (Int) | значение объекта | `number` |
| `focus-streak` | `current` | `Streak` | `current` (Int) | `current` | `number` |
|  | `best` |  | `best` (Int) | `best` | `number` |
|  | — |  | `goalMinutes` (Int, @default(60), в API v1 не отдаётся) | — | — |
| `focus-theme` | `'dark'\|'light'` | `Setting` (key-value) | `key='theme'`, `value` (String) | `theme` | `'dark' \| 'light'` |

**Prisma schema (для понимания, файл не создавать):**
```prisma
model Task {
  id              String   @id @default(uuid())
  text            String   @db.VarChar(500)
  completed       Boolean  @default(false)
  completedDate   Date?    @db.Date
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model DailyStat {
  date          Date   @id @db.Date
  focusMinutes  Int    @default(0)
}

model DayMinute {
  date     Date @id @db.Date
  minutes  Int  @default(0)
}

model Streak {
  id           Int @id @default(1) // singleton in v1; with userId becomes one row per user
  current      Int @default(0)
  best         Int @default(0)
  goalMinutes  Int @default(60) // не отдаётся в API v1; задел на будущую настройку цели
}

model Setting {
  key   String @id
  value String
}
```

## 7. Семантика дат и таймзон

**Правило:** клиент — единственный источник «какой сегодня день».
- Клиент передаёт `clientDay: string` (YYYY-MM-DD) в заголовке `X-Client-Day` или теле запроса при изменении минут/задач.
- GET-эндпоинты, зависящие от дня (`GET /stats/today`), также требуют `clientDay` (query-параметр или `X-Client-Day`); сервер не подставляет свою дату.
- Сервер не угадывает дату из своего часового пояса.
- Сервер хранит даты как `DATE` (без времени/таймзоны) в БД.
- `createdAt` / `updatedAt` — `TIMESTAMPTZ` (UTC) для аудита, но не для бизнес-логики дней.

**Риск:** разные устройства (телефон + десктоп) могут иметь разные таймзоны → один и тот же календарный день будет разным `YYYY-MM-DD` на сервере.
**Миграция:** при синхронизации клиент шлёт свои `clientDay` для каждой записи. Сервер мержит по `(date, user_id)`.

## 8. Миграция и обратная совместимость

**Принцип:** существующие данные в localStorage не теряются и не мигрируются автоматически.

**Режим работы (feature flag):**
- Клиент читает `localStorage.getItem('focus-sync-enabled') === 'true'`.
- Если флаг выключен (дефолт) — работает как сейчас (только localStorage).
- Если включён — клиент параллельно пишет в localStorage и делает API-запросы (optimistic UI + background sync).

**Первичная загрузка (bootstrap) при включении флага:**
1. Клиент читает весь localStorage (`focus-tasks`, `focus-stats`, `focus-days`, `focus-streak`, `focus-theme`).
2. Отправляет `POST /api/v1/sync/bootstrap` с полным дампом.
3. Сервер идемпотентно создаёт/обновляет записи (по `id` задач, по `date` статистики).
4. Сервер возвращает `{ serverVersion, applied, conflicts }`.
5. Клиент применяет серверные версии (побеждает `updatedAt` / `serverVersion`), разрешает конфликты.

**Разрешение конфликтов:**
- Задачи: побеждает запись с бо́льшим `updatedAt` (серверный timestamp). При равенстве — серверная.
- Статистика минут: правило `max(server, client)` применяется только при первичном bootstrap (импорт существующего localStorage), чтобы не задвоить уже накопленные минуты. После bootstrap все изменения идут дельтами через `PUT /stats/today` с `Idempotency-Key`, и сервер их суммирует.
- Streak: пересчитывается на сервере из `DayMinute` после мержа истории.

**Офлайн-поведение:**
- Клиент накапливает изменения в локальной очереди (IndexedDB или localStorage `focus-sync-queue`).
- При восстановлении сети — реплей очереди в порядке FIFO с `Idempotency-Key` для задач.
- Конфликты при реплее решаются тем же правилом (`updatedAt`).

**Версионирование данных:** каждая сущность на сервере имеет `version` (инкремент при изменении) или `updatedAt`. Клиент хранит `lastSyncedVersion` для инкрементальной синхронизации (будущее).

## 9. Безопасность на уровне контракта

| Аспект | Правило в контракте |
|---|---|
| **Валидация входа** | Все входящие тела — Zod/JSON Schema. `text` задачи: 1..500 символов, strip HTML. `deltaMinutes`: integer ≥ 0, ≤ 1440. `clientDay`: regex `^\d{4}-\d{2}-\d{2}$` + валидная дата. |
| **Rate limiting** | Глобальный: 100 req/min на IP. На запись (`POST/PATCH/PUT/DELETE`): 30 req/min. Заголовки `RateLimit-*` в ответе. |
| **CORS** | `Access-Control-Allow-Origin`: только production-домен клиента (env). `Allow-Credentials: false` (пока нет кук/авторизации). |
| **Секреты** | Только через env vars (`DATABASE_URL`, `JWT_SECRET` — для будущего). Никаких секретов в коде/репозитории. |
| **PII** | В данных нет PII (нет email, имени, IP). Только задачи (текст пользователя), минуты, даты. |
| **Авторизация (задел)** | Middleware `auth.ts` проверяет `Authorization: Bearer <token>` или `X-API-Key`. Сейчас — stub (пропускает все). Эндпоинты готовы к подключению. |
| **Аудит** | Логирование: метод, путь, статус, IP (hash), `userId` (когда будет), latency. Без тел запросов. |

*Детальный security-аудит — на этапе реализации.*

## 10. Критерии готовности и план по этапам

| Этап | Название | Критерии готовности (Definition of Done) |
|---|---|---|
| **0** | **Согласование** | Документ `docs/backend-foundation.md` утверждён пользователем. Открытые вопросы закрыты. |
| **1** | **Каркас + Health** | `server/` инициализирован (package.json, tsconfig, Prisma schema). `GET /api/v1/health` возвращает 200. Сборка и запуск работают. Dockerfile собирается. |
| **2** | **Задачи (CRUD)** | `GET/POST/PATCH/DELETE /api/v1/tasks` работают по контракту. Валидация. Идемпотентность `POST` через `Idempotency-Key`. Интеграционные тесты покрывают happy path + 400/404/409. |
| **3** | **Статистика / Streak** | `GET/PUT /stats/today`, `GET /stats/history`, `GET /stats/streak` работают. `computeStreak` на сервере даёт тот же результат, что клиентский (unit-тесты на идентичных данных). |
| **4** | **Синхронизация + Feature flag** | `POST /sync/bootstrap` принимает дамп localStorage, мержит по правилам §8. Клиент: флаг `focus-sync-enabled`, очередь офлайн-изменений, реплей. E2E: включение флага → данные на сервере = localStorage. |
| **5** | **Аккаунты (опционально)** | Регистрация/логин (email+password или magic link), JWT access+refresh, привязка данных к `userId`. Миграция анонимных данных при первом логине. За скоупом текущей задачи — только задел в схеме (`userId` на моделях, nullable пока). |

## 11. Открытые вопросы к пользователю (макс. 4)

1. **Хостинг БД:** PostgreSQL на VPS / управляемый (Neon, Supabase, Railway) / SQLite (Turso/libSQL) — что предпочтительнее для старта?
2. **Авторизация:** нужен ли MVP с анонимным доступом (API-key в localStorage) или сразу email/password / magic link? Это влияет на этап 5 и схему БД (`userId` nullable vs required).
3. **Конфликты минут:** правило bootstrap `max(server, client)` и последующее суммирование дельт (§8) устраивает или нужен last-write-wins по `updatedAt` с риском потери минут?
4. **Порог streak:** в v1 порог фиксирован 60 (`FOCUS_GOAL_MINUTES`) и `goalMinutes` в API не отдаётся. Настраиваемая цель (`goalMinutes`) — отдельное решение для будущей версии.

## 12. Приложение: shared-утилиты (эскиз для будущего `server/src/utils/date.ts`, сейчас не создавать)

```ts
// Эскиз для гарантии идентичного streak; не является реализацией
export const dateKey = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export const shiftDay = (key: string, delta: number): string => {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day + delta);
  // getTimezoneOffset() берётся для уже сдвинутой даты, поэтому переходы на летнее/зимнее время учитываются.
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

// Третий аргумент — только для серверных тестов/будущей настройки;
// клиентская реализация остаётся с двумя аргументами и той же константой FOCUS_GOAL_MINUTES.
export const computeStreak = (days: Record<string, number>, today: string, goalMinutes = FOCUS_GOAL_MINUTES): number => {
  let cursor = (days[today] ?? 0) >= goalMinutes ? today : shiftDay(today, -1);
  let count = 0;
  while ((days[cursor] ?? 0) >= goalMinutes) {
    count += 1;
    cursor = shiftDay(cursor, -1);
  }
  return count;
};
```

---

*Конец документа. Готов к реализации при согласовании.*
