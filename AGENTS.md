# AGENTS.md — «Фокус» (Pomodoro + tasks + daily progress)

Small student web app. UI text is Russian. No backend, no accounts, no external APIs. Data lives in localStorage.
Exported from Figma Make; now developed locally. Ignore any older notes about a "running Figma dev server": run it yourself only if I ask.

## Stack (installed, do not add deps without asking)
React 19 · Vite 8 · TypeScript (strict) · Tailwind CSS v4 (`@tailwindcss/vite`, NO tailwind.config, NO postcss) · pnpm · Node 22.
Not installed: Zustand, Framer Motion, lucide-react, router. Icons are inline SVG in App.tsx. Animations are plain CSS.

## Files (start here, read nothing else unless needed)
- `src/App.tsx` — whole app (~310 lines): types, helpers (`dateKey`, `readTasks`, `readStats`, `playBeep`), icons, `App` component.
- `src/index.css` — Tailwind import, dark variant, custom classes: `.card .primary-button .secondary-button .icon-button .add-button .task-input .task-row .task-checkbox .delete-button .mode-indicator .animate-task-in` (+ `@keyframes task-in`). Reuse these before inventing new styles.
- `src/main.tsx`, `index.html` — entry/shell, rarely touched.
- DO NOT TOUCH: `.figma/`, `vite.config.ts` (Figma plugins; only the `@` alias and port 8443 matter), `pnpm-lock.yaml`, `.mise.toml`, `CLAUDE.md`.

## Commands (run only when I ask)
- dev: `pnpm dev` (port 8443) · build: `pnpm build` · typecheck: `npx tsc --noEmit`

## Data model
- `Task = { id, text, completed, completedDate? }` → localStorage `focus-tasks`
- `DailyStats = { date, focusMinutes }` → `focus-stats` (auto-resets when date changes; `dateKey()` = local YYYY-MM-DD)
- Theme → `focus-theme` ('dark' | 'light'), applied as `dark` class on `<html>`
- Timer: modes `work` 25 min / `rest` 5 min (`DURATIONS`). State is not persisted.
- Keep these keys and shapes backward compatible. If you change them, add a migration in the read helpers.

## Known issues (fix only when asked)
- Timer tick: `setStats` and `playBeep()` are called inside the `setSeconds` updater. React StrictMode runs updaters twice in dev → beep twice and focusMinutes +50 instead of +25. Fix: move side effects out of the updater.
- `setInterval` drifts / throttles in background tabs. Better: compute remaining time from an end timestamp.
- Progress shows completed-today vs ALL tasks, not today's tasks.

## Conventions
- Tailwind utilities in JSX + existing custom classes. Support light and dark (`dark:` variants) for every new element.
- Keep Russian UI strings; keep aria-labels and `sr-only` labels; keep keyboard support (Enter adds a task).
- Animate only transform/opacity, <= 300ms.
- When App.tsx grows past ~400 lines, suggest splitting into `src/components/` instead of doing it silently.
- Handle localStorage read/write in try/catch (already the pattern).

## Token and limit rules (highest priority)
1. Reply with code or a diff only. No explanations or summaries. Max 2 sentences of text unless asked.
2. Use targeted edits. Never rewrite or re-print whole files or unchanged code.
3. Don't read whole files: grep first, then read the needed lines. App.tsx is the only file that usually matters.
4. Never open node_modules, dist, lockfiles, `.git`, `.figma`.
5. Don't re-read a file you just edited or already have in context.
6. Don't run dev/build/tests/typecheck unless I ask. I check in the browser.
7. One task = one focused change. No refactors, renames, formatting passes, comments, docs, or new files I didn't request.
8. If the request is ambiguous, ask ONE short question.
9. If stuck or the same error repeats twice, STOP and say so in one line.
10. Keep reasoning short. Choose the simplest solution.

## Safety
Never read/print/commit `.env*` or secrets (none are needed now). Ask before deleting files, editing package.json, or running system-changing commands.

## Shared AI Project Memory

Before starting a non-trivial task:
1. Read docs/ai-memory/PROJECT.md.
2. Read docs/ai-memory/CURRENT_STATE.md.
3. Read relevant decisions from docs/ai-memory/DECISIONS.md.
4. Inspect the actual source code before trusting the memory.

During work:
- Keep the project memory consistent with the actual code.
- Do not claim changes or tests succeeded unless verified.
- Record important architectural decisions and their reasons.
- Do not store secrets, API keys, passwords or personal data.

Before finishing a non-trivial task:
1. Update CURRENT_STATE.md with completed work,
   remaining issues and the next recommended step.
2. Append a concise entry to SESSION_LOG.md.
3. Update PROJECT.md or DECISIONS.md if needed.
4. Mention which memory files were updated.
5. If something is uncertain, mark it as unverified.

Memory files are summaries, not a substitute for inspecting
the source code and running relevant tests.
