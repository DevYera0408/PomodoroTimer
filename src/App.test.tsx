import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

type StoredTask = { id: string; text: string; completed: boolean; completedDate?: string }

// Same local-date logic as dateKey() in App.tsx.
const dateKey = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const stored = <T,>(key: string) => JSON.parse(localStorage.getItem(key) ?? 'null') as T | null

const passSeconds = (total: number) => {
  for (let left = total; left > 0; left -= 60) {
    const step = Math.min(60, left)
    act(() => {
      vi.advanceTimersByTime(step * 1000)
    })
  }
}

const sessionCount = () => {
  const text = screen.getByText(/Сделано \d+ из 4 сессий/).textContent ?? ''
  return Number(text.match(/Сделано (\d+)/)?.[1])
}

const clickButton = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  vi.useFakeTimers()
  // Noon, so advancing the clock never crosses midnight and dateKey() stays stable.
  vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('пресеты темпа', () => {
  it('переключает на 50/10: подписи, таймер, пауза, сохранение в localStorage', () => {
    render(<App />)

    clickButton('50/10')

    expect(screen.getByRole('button', { name: /Работа · 50 мин/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Отдых · 10 мин/ })).toBeInTheDocument()
    expect(screen.getByText('50:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Старт' })).toBeInTheDocument()
    expect(sessionCount()).toBe(0)
    expect(stored<{ work: number; rest: number }>('focus-settings')).toEqual({
      work: 50,
      rest: 10,
    })
  })

  it('возвращает 25/5 и перезаписывает focus-settings', () => {
    render(<App />)

    clickButton('50/10')
    clickButton('25/5')

    expect(screen.getByRole('button', { name: /Работа · 25 мин/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('25:00')).toBeInTheDocument()
    expect(stored<{ work: number; rest: number }>('focus-settings')).toEqual({
      work: 25,
      rest: 5,
    })
  })
})

describe('счётчик сессий', () => {
  it('не засчитывает незавершённую рабочую сессию', () => {
    render(<App />)

    clickButton('Старт')
    passSeconds(20 * 60)

    expect(stored<{ count: number }>('focus-sessions')?.count).toBe(0)

    clickButton('Пауза')
    clickButton(/Отдых · 5 мин/)

    expect(sessionCount()).toBe(0)
    expect(stored<{ count: number }>('focus-sessions')?.count).toBe(0)
    expect(screen.getByText('05:00')).toBeInTheDocument()
  })

  it('после 4-й сессии включает длинный перерыв', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 3 }))
    render(<App />)
    expect(sessionCount()).toBe(3)

    clickButton('Старт')
    passSeconds(25 * 60)

    expect(screen.getByText('Длинный перерыв · 15 мин')).toBeInTheDocument()
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Работа · 25 мин/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Отдых · 5 мин/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '25/5' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '50/10' })).toBeDisabled()
    expect(stored<{ date: string; count: number }>('focus-sessions')).toEqual({
      date: dateKey(),
      count: 4,
    })
  })

  it('завершает длинный перерыв, обнуляя счётчик', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)

    clickButton('Начать перерыв')
    expect(screen.getByText('15:00')).toBeInTheDocument()

    passSeconds(15 * 60)

    expect(screen.getByRole('button', { name: /Работа · 25 мин/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('25:00')).toBeInTheDocument()
    expect(sessionCount()).toBe(0)
    expect(stored<{ date: string; count: number }>('focus-sessions')).toEqual({
      date: dateKey(),
      count: 0,
    })
    expect(screen.queryByText('Длинный перерыв · 15 мин')).not.toBeInTheDocument()
  })

  it('пропускает перерыв только после подтверждения', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)
    clickButton('Начать перерыв')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    clickButton('Пропустить перерыв')

    expect(confirm).toHaveBeenCalled()
    expect(screen.getByText('Длинный перерыв · 15 мин')).toBeInTheDocument()
    expect(sessionCount()).toBe(4)

    confirm.mockReturnValue(true)
    clickButton('Пропустить перерыв')

    expect(screen.getByRole('button', { name: /Работа · 25 мин/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('25:00')).toBeInTheDocument()
    expect(sessionCount()).toBe(0)
  })

  it('после перезагрузки с count = 4 показывает баннер и запускает перерыв', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)

    expect(screen.getByText(/Нужен длинный перерыв/)).toBeInTheDocument()

    clickButton('Начать перерыв')

    expect(screen.getByText('Длинный перерыв · 15 мин')).toBeInTheDocument()
    expect(screen.getByText('15:00')).toBeInTheDocument()
  })

  it('стартует работу после подтверждения при count = 4', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    clickButton('Старт')

    expect(sessionCount()).toBe(0)
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument()
    expect(stored<{ date: string; count: number }>('focus-sessions')).toEqual({
      date: dateKey(),
      count: 0,
    })
  })

  it('не стартует работу без подтверждения при count = 4', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    clickButton('Старт')

    expect(sessionCount()).toBe(4)
    expect(screen.getByRole('button', { name: 'Старт' })).toBeInTheDocument()
    expect(stored<{ date: string; count: number }>('focus-sessions')?.count).toBe(4)
  })

  it('«Сброс» в длинном перерыве возвращает 15:00 и не трогает счётчик', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)

    clickButton('Начать перерыв')
    passSeconds(5 * 60)
    expect(screen.getByText('10:00')).toBeInTheDocument()

    clickButton('Сброс')

    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(sessionCount()).toBe(4)
    expect(stored<{ date: string; count: number }>('focus-sessions')?.count).toBe(4)
  })
})

describe('регрессия: таймер и статистика', () => {
  it('начисляет по минуте за каждые 60 секунд и переключает на отдых', () => {
    render(<App />)

    clickButton('Старт')

    passSeconds(60)
    expect(stored<{ date: string; focusMinutes: number }>('focus-stats')).toEqual({
      date: dateKey(),
      focusMinutes: 1,
    })

    passSeconds(24 * 60)
    expect(stored<{ focusMinutes: number }>('focus-stats')?.focusMinutes).toBe(25)
    expect(screen.getByRole('button', { name: /Отдых · 5 мин/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(sessionCount()).toBe(1)

    passSeconds(5 * 60)
    expect(screen.getByRole('button', { name: /Работа · 25 мин/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(stored<{ focusMinutes: number }>('focus-stats')?.focusMinutes).toBe(25)
  })

  it('не начисляет минуты в длинном перерыве', () => {
    localStorage.setItem('focus-sessions', JSON.stringify({ date: dateKey(), count: 4 }))
    render(<App />)

    clickButton('Начать перерыв')
    passSeconds(15 * 60)

    expect(stored<{ focusMinutes: number }>('focus-stats')?.focusMinutes).toBe(0)
    expect(sessionCount()).toBe(0)
  })

  it('сохраняет focus-stats и focus-days', () => {
    render(<App />)

    expect(stored<{ date: string; focusMinutes: number }>('focus-stats')).toEqual({
      date: dateKey(),
      focusMinutes: 0,
    })

    clickButton('Старт')
    passSeconds(2 * 60)

    expect(stored<Record<string, number>>('focus-days')).toEqual({ [dateKey()]: 2 })
    expect(stored<{ focusMinutes: number }>('focus-stats')?.focusMinutes).toBe(2)
  })
})

describe('регрессия: задачи', () => {
  it('добавляет, выполняет и удаляет задачу, сохраняя focus-tasks', () => {
    render(<App />)

    const input = screen.getByLabelText('Новая задача')
    fireEvent.change(input, { target: { value: 'Купить хлеб' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Купить хлеб')).toBeInTheDocument()
    expect(stored<StoredTask[]>('focus-tasks')).toHaveLength(1)

    const progress = screen.getByRole('progressbar', { name: 'Выполненные задачи' })
    expect(progress).toHaveAttribute('aria-valuenow', '0')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Отметить задачу «Купить хлеб»' }))

    expect(progress).toHaveAttribute('aria-valuenow', '100')
    expect(stored<StoredTask[]>('focus-tasks')?.[0]?.completed).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Удалить задачу «Купить хлеб»' }))

    expect(screen.queryByText('Купить хлеб')).not.toBeInTheDocument()
    expect(stored<StoredTask[]>('focus-tasks')).toEqual([])
  })
})

describe('регрессия: тема', () => {
  it('включает тёмную тему и пишет focus-theme', () => {
    render(<App />)

    expect(document.documentElement).not.toHaveClass('dark')

    fireEvent.click(screen.getByRole('button', { name: 'Включить тёмную тему' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('focus-theme')).toBe('dark')
  })
})

describe('регрессия: серия дней', () => {
  it('рендерит банер серии и цели дня', () => {
    localStorage.setItem('focus-days', JSON.stringify({ [dateKey()]: 60 }))
    render(<App />)

    const card = screen.getByRole('region', { name: 'Серия дней' })

    expect(within(card).getByText(/Рекорд:/)).toBeInTheDocument()
    expect(card).toHaveTextContent('1 день подряд')
    expect(card).toHaveTextContent('Рекорд: 1')
    expect(card).toHaveTextContent('Концентрация сегодня')
    expect(within(card).getByRole('progressbar', { name: 'Прогресс дня' })).toBeInTheDocument()
  })
})
