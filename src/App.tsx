import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'work' | 'rest'
type Task = { id: string; text: string; completed: boolean; completedDate?: string }
type DailyStats = { date: string; focusMinutes: number }
type DayMinutes = Record<string, number>
type StreakData = { current: number; best: number }

const DURATIONS: Record<Mode, number> = { work: 25 * 60, rest: 5 * 60 }
const FOCUS_GOAL_MINUTES = 60

const dateKey = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const readTasks = (): Task[] => {
  try {
    const saved = JSON.parse(localStorage.getItem('focus-tasks') ?? '[]')
    if (!Array.isArray(saved)) return []
    return saved.filter(
      (task): task is Task =>
        task !== null &&
        typeof task === 'object' &&
        typeof task.id === 'string' &&
        typeof task.text === 'string' &&
        typeof task.completed === 'boolean',
    )
  } catch {
    return []
  }
}

const readStats = (): DailyStats => {
  try {
    const saved = JSON.parse(localStorage.getItem('focus-stats') ?? '{}')
    if (saved.date === dateKey()) return saved
  } catch {
    // Start fresh if saved data cannot be read.
  }
  return { date: dateKey(), focusMinutes: 0 }
}

const readDays = (): DayMinutes => {
  try {
    const saved = JSON.parse(localStorage.getItem('focus-days') ?? '{}')
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const result: DayMinutes = {}
      for (const [key, value] of Object.entries(saved)) {
        if (typeof value === 'number' && Number.isFinite(value)) result[key] = value
      }
      return result
    }
  } catch {
    // Start with an empty history if saved data cannot be read.
  }
  return {}
}

const readStreak = (): StreakData => {
  try {
    const saved = JSON.parse(localStorage.getItem('focus-streak') ?? '{}')
    if (saved && typeof saved === 'object') {
      return {
        current: typeof saved.current === 'number' ? saved.current : 0,
        best: typeof saved.best === 'number' ? saved.best : 0,
      }
    }
  } catch {
    // Start with an empty streak if saved data cannot be read.
  }
  return { current: 0, best: 0 }
}

const shiftDay = (key: string, delta: number) => {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day + delta)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const computeStreak = (days: DayMinutes, today: string) => {
  let cursor = (days[today] ?? 0) >= FOCUS_GOAL_MINUTES ? today : shiftDay(today, -1)
  let count = 0
  while ((days[cursor] ?? 0) >= FOCUS_GOAL_MINUTES) {
    count += 1
    cursor = shiftDay(cursor, -1)
  }
  return count
}

const isMilestone = (day: number) => day >= 10 && day % 10 === 0

const heatLevel = (minutes: number) =>
  minutes <= 0 ? 0 : minutes < 15 ? 1 : minutes < 30 ? 2 : minutes < 60 ? 3 : 4

const heatDayLabel = (day: string, minutes: number) => {
  const date = new Date(`${day}T00:00:00`)
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return minutes ? `${formatted}: ${minutes} мин` : formatted
}

const MILESTONE_NAMES: Record<number, string> = {
  10: 'Первый рубеж',
  20: 'На волне',
  30: 'Мастер фокуса',
  40: 'Железная воля',
  50: 'Полтинник',
}

const rewardName = (day: number) => MILESTONE_NAMES[day] ?? `Серия ${day} дней`

const daysLabel = (value: number) => {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
  return 'дней'
}

let audioContext: AudioContext | undefined

function playBeep() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  audioContext ??= new AudioContextClass()
  const context = audioContext
  if (context.state === 'suspended') void context.resume()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = 720
  gain.gain.setValueAtTime(0.12, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.25)
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" strokeLinecap="round" />
    </svg>
  )
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" strokeLinejoin="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M8 5.4v13.2L19 12z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" />
    </svg>
  )
}

function FlameIcon({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={`streak-flame ${lit ? 'streak-flame--lit' : ''}`}
    >
      <path d="M12 2s-5 5-5 10a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5 0 1.5-1 2.5-2 2.5.7-2.5.5-6-1-8Z" />
    </svg>
  )
}

function RewardIcon({ day }: { day: number }) {
  switch (Math.floor(day / 10) % 4) {
    case 1:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="10" r="5" />
          <path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7" strokeLinejoin="round" />
        </svg>
      )
    case 2:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M12 3v18M5 7h14M6 7l-2.5 6a3 3 0 0 0 5 0L6 7Zm12 0-2.5 6a3 3 0 0 0 5 0L18 7Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 3:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="m12 3 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.2l5.9-.8L12 3Z" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="m3 8 4 10h10l4-10-6 4-3-6-3 6-6-4Z" strokeLinejoin="round" />
        </svg>
      )
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(readTasks)
  const [stats, setStats] = useState<DailyStats>(readStats)
  const [days, setDays] = useState<DayMinutes>(readDays)
  const [streak, setStreak] = useState<StreakData>(readStreak)
  const [reward, setReward] = useState<number>()
  const [mode, setMode] = useState<Mode>('work')
  const [seconds, setSeconds] = useState(DURATIONS.work)
  const [running, setRunning] = useState(false)
  const [input, setInput] = useState('')
  const [newTaskId, setNewTaskId] = useState<string>()
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('focus-theme') === 'dark'
    } catch {
      return false
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const workSecondsRef = useRef(0)
  const sessionDayRef = useRef(dateKey())
  const streakSeenRef = useRef(streak.current)
  const today = stats.date

  useEffect(() => {
    try {
      localStorage.setItem('focus-tasks', JSON.stringify(tasks))
    } catch {}
  }, [tasks])

  useEffect(() => {
    try {
      localStorage.setItem('focus-stats', JSON.stringify(stats))
    } catch {}
  }, [stats])

  useEffect(() => {
    try {
      localStorage.setItem('focus-days', JSON.stringify(days))
    } catch {}
  }, [days])

  useEffect(() => {
    try {
      localStorage.setItem('focus-streak', JSON.stringify(streak))
    } catch {}
  }, [streak])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.lang = 'ru'
    try {
      localStorage.setItem('focus-theme', dark ? 'dark' : 'light')
    } catch {}
  }, [dark])

  useEffect(() => {
    const checkDay = () => {
      const current = dateKey()
      setStats((value) => (value.date === current ? value : { date: current, focusMinutes: 0 }))
    }
    const id = window.setInterval(checkDay, 60_000)
    window.addEventListener('focus', checkDay)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', checkDay)
    }
  }, [])

  useEffect(() => {
    if (!running) return
    if (mode === 'work') sessionDayRef.current = dateKey()
    const id = window.setInterval(() => {
      setSeconds((value) => (value > 0 ? value - 1 : 0))
      if (mode === 'work') {
        workSecondsRef.current += 1
        if (workSecondsRef.current % 60 === 0) {
          setStats((current) => ({ ...current, focusMinutes: current.focusMinutes + 1 }))
          const sessionDay = sessionDayRef.current
          setDays((current) => ({ ...current, [sessionDay]: (current[sessionDay] ?? 0) + 1 }))
        }
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, mode])

  useEffect(() => {
    if (seconds > 0) return
    playBeep()
    if (mode === 'work') {
      setMode('rest')
      setSeconds(DURATIONS.rest)
    } else {
      setMode('work')
      setSeconds(DURATIONS.work)
    }
  }, [seconds, mode])

  useEffect(() => {
    const current = computeStreak(days, dateKey())
    setStreak((prev) =>
      current === prev.current && current <= prev.best
        ? prev
        : { current, best: Math.max(prev.best, current) },
    )
  }, [days])

  useEffect(() => {
    const previous = streakSeenRef.current
    streakSeenRef.current = streak.current
    if (streak.current <= previous) return
    for (let day = previous + 1; day <= streak.current; day += 1) {
      if (!isMilestone(day)) continue
      setReward(day)
      window.setTimeout(() => setReward((value) => (value === day ? undefined : value)), 4000)
    }
  }, [streak.current])

  const todayTasks = useMemo(
    () => tasks.filter((task) => !task.completed || task.completedDate === today),
    [tasks, today],
  )
  const completed = useMemo(
    () => todayTasks.filter((task) => task.completed).length,
    [todayTasks],
  )
  const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0
  const goalReached = stats.focusMinutes >= FOCUS_GOAL_MINUTES
  const goalPercent = Math.min(100, Math.round((stats.focusMinutes / FOCUS_GOAL_MINUTES) * 100))
  const milestones = useMemo(() => {
    const highest = Math.max(streak.current, streak.best, 10)
    const last = (Math.floor(highest / 10) + 2) * 10
    const list: number[] = []
    for (let day = 10; day <= last; day += 10) list.push(day)
    return list
  }, [streak.current, streak.best])
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const heatWeeks = useMemo(() => {
    const weekday = (new Date(`${today}T00:00:00`).getDay() + 6) % 7
    const start = shiftDay(today, -weekday - 51 * 7)
    const weeks: { day: string; minutes: number }[][] = []
    for (let w = 0; w < 52; w += 1) {
      const column: { day: string; minutes: number }[] = []
      for (let d = 0; d < 7; d += 1) {
        const key = shiftDay(start, w * 7 + d)
        column.push({ day: key, minutes: days[key] ?? 0 })
      }
      weeks.push(column)
    }
    return weeks
  }, [days, today])
  const displayDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date())

  const chooseMode = (next: Mode) => {
    setMode(next)
    setSeconds(DURATIONS[next])
    setRunning(false)
  }

  const addTask = () => {
    const text = input.trim()
    if (!text) return
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    const task = { id, text, completed: false }
    setTasks((current) => [task, ...current])
    setNewTaskId(task.id)
    window.setTimeout(() => setNewTaskId(undefined), 300)
    setInput('')
    inputRef.current?.focus()
  }

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
              completedDate: !task.completed ? dateKey() : undefined,
            }
          : task,
      ),
    )
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
        <header className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1a1a1a] dark:text-white">Фокус</h1>
            <p className="mt-0.5 capitalize text-sm text-[#1a1a1a]/70 dark:text-white/70">{displayDate}</p>
          </div>
          <button
            className="icon-button"
            onClick={() => setDark((value) => !value)}
            aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
            title={dark ? 'Светлая тема' : 'Тёмная тема'}
          >
            <ThemeIcon dark={dark} />
          </button>
        </header>

        <section className="card p-5 sm:p-7" aria-labelledby="timer-heading">
          <h2 id="timer-heading" className="mb-3 text-xs font-semibold text-[#1a1a1a]/70 dark:text-white/70">Таймер</h2>
          <div className="relative grid grid-cols-2 rounded-[4px] border border-[#1a1a1a]/15 p-1 dark:border-white/20">
            <span
              className={`mode-indicator ${mode === 'rest' ? 'translate-x-full' : 'translate-x-0'}`}
              aria-hidden="true"
            />
            {(['work', 'rest'] as Mode[]).map((item) => (
              <button
                key={item}
                className={`relative z-10 rounded-[4px] px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                  mode === item ? 'text-white dark:text-black' : 'text-[#1a1a1a]/55 dark:text-white/55'
                }`}
                onClick={() => chooseMode(item)}
                aria-pressed={mode === item}
              >
                {item === 'work' ? 'Работа' : 'Отдых'} · {DURATIONS[item] / 60} мин
              </button>
            ))}
          </div>

          <div className="py-6 text-center sm:py-8">
            <p className="timer-digits text-[clamp(4rem,20vw,5.5rem)] leading-none font-medium tracking-tight text-[#1a1a1a] tabular-nums dark:text-white">
              {time}
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <button
              className="primary-button inline-flex items-center justify-center gap-2.5"
              onClick={() => setRunning((value) => !value)}
            >
              {running ? <PauseIcon /> : <PlayIcon />}
              {running ? 'Пауза' : 'Старт'}
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setRunning(false)
                setSeconds(DURATIONS[mode])
              }}
            >
              Сброс
            </button>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="streak-heading">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FlameIcon lit={goalReached} />
              <div>
                <h2 id="streak-heading" className="text-sm font-semibold text-[#1a1a1a] dark:text-white">
                  Серия дней
                </h2>
                <p className="mt-0.5 text-sm text-[#1a1a1a]/70 dark:text-white/70">
                  <strong className="text-[#1a1a1a] dark:text-white">{streak.current}</strong>{' '}
                  {daysLabel(streak.current)} подряд
                </p>
              </div>
            </div>
            <p className="text-sm text-[#1a1a1a]/55 dark:text-white/55">
              Рекорд: <strong className="text-[#1a1a1a] dark:text-white">{streak.best}</strong>
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[#1a1a1a]/70 dark:text-white/70">
            <span>{goalReached ? 'Цель дня достигнута' : 'Концентрация сегодня'}</span>
            <strong className="tabular-nums text-[#1a1a1a] dark:text-white">
              {stats.focusMinutes} / {FOCUS_GOAL_MINUTES} мин
            </strong>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-[2px] bg-[#1a1a1a]/10 dark:bg-white/15"
            role="progressbar"
            aria-label="Прогресс дня"
            aria-valuemin={0}
            aria-valuemax={FOCUS_GOAL_MINUTES}
            aria-valuenow={Math.min(stats.focusMinutes, FOCUS_GOAL_MINUTES)}
          >
            <div
              className={`h-full rounded-[2px] transition-all duration-300 ${
                goalReached ? 'bg-[#1a1a1a] dark:bg-white' : 'bg-[#1a1a1a]/45 dark:bg-white/45'
              }`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="tasks-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="tasks-heading" className="text-base font-semibold text-[#1a1a1a] dark:text-white">Задачи</h2>
            {tasks.length > 0 && <span className="text-sm text-[#1a1a1a]/55 dark:text-white/55">{tasks.length}</span>}
          </div>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="new-task">Новая задача</label>
            <input
              ref={inputRef}
              id="new-task"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addTask()}
              placeholder="Новая задача"
              className="task-input"
            />
            <button className="add-button" onClick={addTask} disabled={!input.trim()}>
              Добавить
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#1a1a1a]/55 dark:text-white/55">
              Пока нет задач. Добавь первую!
            </p>
          ) : (
            <ul className="mt-4 space-y-1">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className={`task-row ${newTaskId === task.id ? 'animate-task-in' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="task-checkbox"
                    aria-label={`Отметить задачу «${task.text}»`}
                  />
                  <span className={`min-w-0 flex-1 text-sm transition-all duration-200 ${
                    task.completed ? 'text-[#1a1a1a]/40 line-through dark:text-white/40' : 'text-[#1a1a1a] dark:text-white'
                  }`}>
                    {task.text}
                  </span>
                  <button
                    className="delete-button"
                    onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}
                    aria-label={`Удалить задачу «${task.text}»`}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5" aria-labelledby="progress-heading">
          <h2 id="progress-heading" className="mb-3 text-sm font-semibold text-[#1a1a1a] dark:text-white">
            Прогресс за сегодня
          </h2>
          <div className="space-y-1.5 text-sm text-[#1a1a1a]/70 dark:text-white/70">
            <p>Выполнено сегодня: <strong className="text-[#1a1a1a] dark:text-white">{completed} из {todayTasks.length} задач</strong></p>
            <p>Время фокуса сегодня: <strong className="text-[#1a1a1a] dark:text-white">{stats.focusMinutes} мин</strong></p>
          </div>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-[2px] bg-[#1a1a1a]/10 dark:bg-white/15"
            role="progressbar"
            aria-label="Выполненные задачи"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-[2px] bg-[#1a1a1a] transition-all duration-300 dark:bg-white" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="card p-5" aria-labelledby="heatmap-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="heatmap-heading" className="text-sm font-semibold text-[#1a1a1a] dark:text-white">
              Активность за год
            </h2>
            <div className="flex items-center gap-1.5 text-[0.68rem] text-[#1a1a1a]/55 dark:text-white/55">
              <span>Меньше</span>
              <div className="flex gap-[3px]" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((level) => (
                  <div key={level} className={`heat-cell ${level ? `heat-cell--l${level}` : ''}`} />
                ))}
              </div>
              <span>Больше</span>
            </div>
          </div>
          <div
            className="heatmap"
            role="img"
            aria-label="Тепловая карта концентрации за последний год: 52 недели, яркость клетки — минуты фокуса за день"
          >
            {heatWeeks.map((week, index) => (
              <div key={index} className="heat-column">
                {week.map(({ day, minutes }) => (
                  <div
                    key={day}
                    className={`heat-cell ${heatLevel(minutes) ? `heat-cell--l${heatLevel(minutes)}` : ''}`}
                    title={heatDayLabel(day, minutes)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5" aria-labelledby="achievements-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="achievements-heading" className="text-sm font-semibold text-[#1a1a1a] dark:text-white">
              Достижения
            </h2>
            <span className="text-sm text-[#1a1a1a]/55 dark:text-white/55">
              {milestones.filter((day) => day <= streak.best).length} из {milestones.length}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {milestones.map((day) => {
              const earned = day <= streak.best
              return (
                <li key={day} className={`achievement-badge ${earned ? '' : 'achievement-badge--locked'}`}>
                  <span className="achievement-icon">
                    <RewardIcon day={day} />
                  </span>
                  <span className="text-xs font-semibold text-[#1a1a1a] dark:text-white">{day}</span>
                  <span className="text-[0.68rem] leading-tight text-[#1a1a1a]/60 dark:text-white/60">
                    {earned
                      ? rewardName(day)
                      : `осталось ${day - streak.current} ${daysLabel(day - streak.current)}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {reward !== undefined && (
        <div className="reward-toast" role="status" aria-live="polite">
          <span className="achievement-icon">
            <RewardIcon day={reward} />
          </span>
          <span>
            <strong className="block text-sm">Награда: {rewardName(reward)}</strong>
            <span className="text-xs opacity-70">
              Серия {reward} {daysLabel(reward)} подряд
            </span>
          </span>
        </div>
      )}
    </main>
  )
}
