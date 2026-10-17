import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'work' | 'rest'
type Task = { id: string; text: string; completed: boolean; completedDate?: string }
type DailyStats = { date: string; focusMinutes: number }

const DURATIONS: Record<Mode, number> = { work: 25 * 60, rest: 5 * 60 }

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

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(readTasks)
  const [stats, setStats] = useState<DailyStats>(readStats)
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
    const id = window.setInterval(() => {
      setSeconds((value) => (value > 0 ? value - 1 : 0))
      if (mode === 'work') {
        workSecondsRef.current += 1
        if (workSecondsRef.current % 60 === 0) {
          setStats((current) => ({ ...current, focusMinutes: current.focusMinutes + 1 }))
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

  const todayTasks = useMemo(
    () => tasks.filter((task) => !task.completed || task.completedDate === today),
    [tasks, today],
  )
  const completed = useMemo(
    () => todayTasks.filter((task) => task.completed).length,
    [todayTasks],
  )
  const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
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
            <p className="mt-0.5 capitalize text-sm text-[#1a1a1a]/55 dark:text-white/55">{displayDate}</p>
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
          <h2 id="timer-heading" className="sr-only">Таймер</h2>
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
      </div>
    </main>
  )
}
