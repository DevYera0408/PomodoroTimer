# Проект «Фокус»

Небольшое веб-приложение (Pomodoro + задачи + прогресс за день) для школьников и студентов.
Без бэкенда и аккаунтов: данные в `localStorage`.

## Стек
React 19 · Vite 8 · TypeScript (strict) · Tailwind CSS v4 (`@tailwindcss/vite`) · pnpm · Node 22.

## Ключевые файлы
- `src/App.tsx` — всё приложение: типы, хелперы (`dateKey`, `readTasks`, `readStats`, `playBeep`), иконки, компонент `App`.
- `src/index.css` — Tailwind + тема и кастомные классы (`.card`, `.primary-button`, `.timer-digits`, `.mode-indicator` и др.).
- `index.html` — оболочка; подключение шрифтов IBM Plex.

## Данные (localStorage)
- `Task = { id, text, completed, completedDate? }` → `focus-tasks`
- `DailyStats = { date, focusMinutes }` → `focus-stats` (сбрасывается при смене дня)
- `DayMinutes = { [YYYY-MM-DD]: minutes }` → `focus-days` (история концентрации по дням; нужна для серии)
- `StreakData = { current, best }` → `focus-streak` (текущая серия и рекорд; порог дня `FOCUS_GOAL_MINUTES = 60`)
- Тема → `focus-theme` (`dark` | `light`), класс `dark` на `<html>`

## Внешний вид
Строгая чёрно-белая тема, IBM Plex, скругления ≤ 4px, границы вместо теней (см. `DECISIONS.md`, D-001).

## См. также
- `CURRENT_STATE.md` — текущее состояние и следующий шаг.
- `DECISIONS.md` — принятые решения.
- `SESSION_LOG.md` — журнал сессий.
