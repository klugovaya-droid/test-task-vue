# Notes SPA

SPA для заметок с задачами (Todo) на Nuxt 4, Vue 3 и TypeScript. Приложение работает полностью в браузере, хранит данные в `localStorage`, поддерживает undo/redo на дельтах, черновики, синхронизацию между вкладками и адаптивный интерфейс без UI-библиотек.

## Возможности

- Две страницы: список заметок `/` и редактор `/notes/[id]` (включая `/notes/new`).
- Создание, редактирование и удаление заметок с подтверждением в собственных модальных окнах.
- Todo: добавление, удаление, изменение текста и переключение выполнения.
- Undo/redo на командах-дельтах, лимит 50 шагов, группировка непрерывного ввода.
- Глобальные `Ctrl/Cmd+Z` и `Ctrl/Cmd+Shift+Z` без конфликта с нативным undo в полях.
- Версионированное хранилище со схемой v1, debounce записи, flush при скрытии вкладки и backup повреждённых данных.
- Безопасные уведомления при повреждённых данных и ошибках записи в `localStorage`.
- Черновики с восстановлением после перезагрузки, отказом от восстановления и безопасным Escape.
- Обнаружение удаления заметки в другой вкладке, блокировка Save и сохранение рабочей копии как новой.
- Empty state, состояние «Заметка не найдена», inline-валидация пустых полей.
- Доступные модальные окна, focus-trap, возврат фокуса, `aria-live`, `aria-invalid`, focus-visible и `prefers-reduced-motion`.
- Адаптивная вёрстка для мобильных, планшетов и десктопа.
- Docker-образ на Node 22 с non-root runtime и healthcheck.

## Стек

- Nuxt 4 (`ssr: false`), Vue 3 Composition API, `<script setup lang="ts">`.
- TypeScript strict, `nuxt typecheck`.
- Pinia.
- SCSS: собственные компоненты, модалки и дизайн-токены.
- Vitest для unit-тестов.
- Vitest как runner и Playwright как драйвер браузера для e2e.
- Docker и Docker Compose.

## Требования

- Node.js 22 или новее.
- npm.
- Для e2e: браузеры Playwright.
- Для Docker-проверки: Docker с Compose.

## Локальный запуск

```bash
npm ci
npm run dev
```

Приложение откроется на `http://localhost:3000`.

Production-сборка:

```bash
npm run build
npm run preview
```

## Скрипты

| Команда | Описание |
| --- | --- |
| `npm run dev` | Dev-сервер Nuxt |
| `npm run build` | Production-сборка в `.output` |
| `npm run preview` | Запуск production-сборки |
| `npm run typecheck` | Проверка типов через `nuxt typecheck` |
| `npm run test:unit` | Unit-тесты Vitest |
| `npm run test:e2e` | E2E: Vitest + Playwright |
| `npm run validate` | typecheck + unit + e2e |

## Тесты

Unit-тесты покрывают:

- историю: все команды, undo/redo, лимит 50, redo-ветку, группировку текста, отсутствие снимков заметки;
- stores: CRUD заметок, debounce, flush, схему и миграции, повреждённые данные, draft, external delete, save as new;
- валидацию, усечение Todo, keyboard guards, focus-trap и helper-функции.

E2E сценарии покрывают:

- главную: empty state, сортировку, карточки, усечение Todo, навигацию, удаление с модалкой;
- редактор: создание, редактирование, Todo CRUD/toggle, save + reload, cancel/delete, 404, пустые поля;
- undo/redo: кнопки, shortcuts, redo clear, native undo в полях, guard при открытой модалке;
- черновики: reload → recovery, discard, Escape = restore;
- две вкладки: удаление заметки, открытой в редакторе, и save as new;
- доступность и адаптивность: viewport 375/768/1280, touch-target, keyboard-only, focus-visible, aria, reduced motion;
- кросс-браузерность: Chromium, Firefox и WebKit.

Перед e2e установите браузеры:

```bash
npx playwright install chromium firefox webkit
```

E2E-конфиг сам собирает приложение и поднимает `.output/server/index.mjs` на свободном порту. На macOS 27 кросс-браузерный тест автоматически задаёт `CFFIXED_USER_HOME` для Firefox, чтобы обойти ограничение доступа к системному профилю.

Полная проверка:

```bash
npm run validate
```

## Docker

```bash
docker compose up --build -d
curl -f http://localhost:3000
docker compose down
```

- `Dockerfile` multi-stage: зависимости → сборка → runtime только с `.output`.
- Runtime работает от non-root пользователя `nuxt`.
- `docker-compose.yaml` публикует порт `3000`, содержит healthcheck и `restart: unless-stopped`.
- Серверная БД не используется: заметки и черновики хранятся в `localStorage` браузера.

## Архитектура

```text
app/
  assets/scss/main.scss
  components/
    notes/NoteCard.vue
    notes/TodoItem.vue
    ui/AppButton.vue
    ui/AppInput.vue
    ui/AppCheckbox.vue
    ui/AppToast.vue
    ui/BaseModal.vue
    ui/ConfirmDialog.vue
    ui/EmptyState.vue
  layouts/default.vue
  pages/index.vue
  pages/notes/[id].vue
  plugins/notes.client.ts
  stores/editor.ts
  stores/notes.ts
  stores/toast.ts
  types/notes.ts
  utils/draft.ts
  utils/focus-trap.ts
  utils/history.ts
  utils/ids.ts
  utils/keyboard.ts
  utils/schema.ts
  utils/validation.ts
```

- `pages/index.vue` — карточки заметок, empty state, удаление с подтверждением.
- `pages/notes/[id].vue` — режимы создания и редактирования, валидация, save/cancel/delete, recovery и external delete.
- `stores/notes.ts` — источник заметок, сортировка, debounce и синхронизация хранилища.
- `stores/editor.ts` — рабочая копия, delta-история, черновик и внешнее удаление.
- `stores/toast.ts` — общий toast, который переживает навигацию.
- `utils/history.ts` — команды-дельты и лимит истории.
- `utils/schema.ts` — версия схемы, парсинг и backup повреждённых payload.
- `utils/draft.ts` — версионированные ключи и операции с черновиками.
- `utils/focus-trap.ts`, `utils/keyboard.ts` — доступность и keyboard guards.

## Хранение

Ключи:

- `notes-app:data` — `{ version: 1, notes }`.
- `notes-app:draft:v1:<noteId | "new">` — черновик.
- `notes-app:backup` — последние повреждённые или несовместимые данные (best effort).

Правила:

- Все payload содержат `version`, текущая версия — `1`.
- Запись заметок — debounce 300 мс; draft — 500 мс.
- Явное сохранение и удаление пишутся сразу.
- `pagehide` и `visibilitychange === hidden` вызывают flush заметок и черновика.
- `storage` event синхронизирует заметки между вкладками.
- Ошибки `localStorage` перехватываются, приложение продолжает работать.
- Повреждённый JSON или неизвестная версия не ломают приложение: данные уходят в backup, список открывается пустым с предупреждением.

## История и undo/redo

История хранится только в памяти Pinia и сбрасывается при перезагрузке, save, cancel и delete.

Команды:

- `set-title`;
- `add-todo`;
- `remove-todo`;
- `set-todo-text`;
- `toggle-todo`.

Одна команда хранит только изменённые поля или один Todo, без полных копий заметки. Лимит — 50 команд. Новое изменение после undo очищает redo-ветку. Непрерывный ввод группируется через focus/blur (`beginTextEdit`/`commitTextEdit`).

Глобальные shortcuts игнорируются в текстовых полях, при IME-композиции и при открытой модалке. В полях остаётся нативный undo браузера.

## Черновики и внешние изменения

- Черновик создаётся при изменении рабочей копии и восстанавливается после reload.
- Если черновик отличается от сохранённой заметки, показывается модалка восстановления.
- Восстановление заменяет рабочую копию, помечает её dirty и сбрасывает историю.
- Отказ удаляет черновик и оставляет сохранённую версию.
- Escape в модалке восстановления выбирает восстановление, а не удаление.
- При удалении заметки в другой вкладке редактор показывает баннер, блокирует Save и предлагает вернуться на главную или сохранить рабочую копию как новую.

## Матрица требований

| Требование | Реализация | Проверка |
| --- | --- | --- |
| Две страницы | `pages/index.vue`, `pages/notes/[id].vue` | home/editor e2e |
| CRUD заметок и подтверждения | notes/editor stores, `ConfirmDialog` | home/editor e2e |
| Todo: add/remove/edit/toggle | `TodoItem.vue`, editor store | editor e2e |
| Undo/redo, 50 шагов, дельты | `utils/history.ts`, editor store | unit/e2e undo-redo |
| Shortcuts и native undo | `utils/keyboard.ts`, editor page | unit/e2e undo-redo |
| Версионированное хранилище, debounce | `utils/schema.ts`, `stores/notes.ts` | unit schema/notes |
| Черновики и восстановление | `utils/draft.ts`, editor store | unit/e2e drafts |
| 404, пустые поля, две вкладки | editor page, guards | editor/drafts e2e |
| Доступные модалки | `BaseModal.vue`, `utils/focus-trap.ts` | unit/e2e a11y |
| Адаптивность и браузеры | SCSS + breakpoints | responsive/browsers e2e |
| Docker и README | `Dockerfile`, `docker-compose.yaml`, README | docker smoke |
| Без UI/undo/persistence-библиотек и native alerts | собственные компоненты и логика | code review |

## Принятые решения

- Никаких UI-библиотек: все компоненты и модалки собственные на SCSS.
- Никаких библиотек undo/redo: история реализована командами-дельтами.
- Никаких плагинов автосинхронизации Pinia с `localStorage`: запись контролируется store-слоем.
- Все подтверждения — собственные модальные окна, без `alert`, `confirm`, `prompt` и beforeunload.
- История сессионная и не сохраняется между перезагрузками.
- Данные привязаны к браузеру и устройству, серверной БД нет.
- Приложение работает как SPA (`ssr: false`).
