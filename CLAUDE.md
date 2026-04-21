# CLAUDE.md

This file provides context for Claude Code sessions working on this project.

## Project Overview

**Name**: (TBD — working names: Backlog, Shelf, Queue. Pick during setup.)

**What it is**: A self-hosted, single-user hobby backlog manager for tracking games, anime, books, and gunpla builds. The killer feature is a "what should I do tonight?" query that scores items by fit against your current state (time available, energy, mood) — not a social tracker, a _decision_ tracker.

**Why it exists**: Existing tools (MyAnimeList, Backloggd, Goodreads) are single-domain and social-first. This one is multi-domain and decision-first. Target user is the owner (Dio) — someone juggling multiple active hobbies who wants to cut through backlog indecision.

**Positioning**: Self-hosted personal tool, in the spirit of Trilium Notes. Single password auth, one user, runs on personal VPS.

---

## Tech Stack

### Frontend

- **Vite + React + TypeScript** (SPA, no SSR — we don't need SEO behind auth)
- **TanStack Router** for type-safe client-side routing
- **TanStack Query** for server state management
- **shadcn/ui** + **Tailwind CSS** for UI
- **React Hook Form** + **Zod** for forms and validation

### Backend

- **Fastify** + **TypeScript** (separate Node service)
- **Drizzle ORM** + **Postgres** (native install, not Docker)
- **Zod** for request/response validation (via `fastify-type-provider-zod`)
- **JWT** in httpOnly cookies for auth
- **sharp** for image resizing
- **@fastify/static** for serving the Vite build and uploaded images

### Deployment

- **VPS**: Contabo (Ubuntu 24.04, existing)
- **Process manager**: PM2
- **Database**: Native Postgres (apt install), local socket only
- **Reverse access**: Cloudflare Tunnel (existing setup — add new hostname)
- **Image storage**: Local filesystem `/uploads` directory (swap to S3/R2 later if needed)

### Architecture notes

- Single Fastify process serves both the API (`/api/*`) and the static Vite build (everything else, SPA fallback to `index.html`)
- One PM2 process, one Cloudflare Tunnel hostname — keep it simple
- Postgres runs as a system service, connection via local socket or `localhost:5432`

---

## Key Design Decisions

### Media types (v1)

Four types: `game`, `anime`, `book`, `gunpla`. Distinct enough to warrant different metadata but unified under one `items` table with a discriminator column.

### Progress tracking

Free-form text field (`current_progress`). Examples: "Chapter 5", "Gongaga Region", "Episode 12", "Waist assembly done". Keeps friction low. Structured progress (episode N of M) can be layered on later for types that benefit.

### External metadata sources

- **Games**: RAWG API (free, simple, no OAuth)
- **Anime**: Jikan (free MyAnimeList wrapper, no auth)
- **Books**: Google Books API (free, no auth for search)
- **Gunpla**: Manual entry only — no good API exists

User searches by keyword → picks a result → metadata auto-fills (title, cover URL, release year, description, etc.). User can still edit everything after.

### Recommendation logic ("what should I do tonight?")

**Not AI.** A deterministic scoring function. Inputs per item:

- `time_commitment`: rough session length (5min / 30min / 1hr / 2hr+)
- `mental_load`: light / medium / heavy
- `priority`: 1-5 user ranking
- `last_touched_at`: auto-tracked, feeds a decay function so stale-but-not-abandoned items surface
- `mood_tags`: optional array (cozy, intense, story, hands-on, etc.)

User query inputs: available time, energy level, mood. Scoring function ranks active items by fit. Results shown with explanation ("matched because: short session + light + cozy").

AI layer comes LATER as an optional "just pick for me" button — reads user state, picks one, explains reasoning. **Not in v1.**

### Auth

Single password, set via environment variable (`APP_PASSWORD`). Login returns a JWT in an httpOnly, secure, sameSite=strict cookie. Middleware validates on protected routes. No signup, no user table (yet — schema-ready for future multi-user).

### Active limits

Configurable per-type soft limits (default: 3 games, 3 anime, 2 books, 5 gunpla). Stored in a `settings` table (single row). When user tries to activate an item over limit, show a warning dialog: "You already have 3 active games. Pause one first?" — warning, not a hard block.

### Styling direction

Clean but eye-catching. shadcn defaults are too generic. Plan:

- Warm neutral base (stone or zinc, not default slate)
- Single saturated accent color (pick during UI phase — amber, violet, or teal are candidates)
- Cover art is the visual hero — prominent in list and detail views
- Typography: one display font for titles, one readable sans for body
- Subtle micro-interactions: hover scale on cards, smooth transitions, progress bar animations
- Reference apps for inspiration: Backloggd, AniList, Letterboxd

---

## Data Model (Draft)

```ts
// items table — unified across all types
items {
  id: uuid (pk)
  type: enum('game', 'anime', 'book', 'gunpla')
  title: text (not null)
  status: enum('wishlist', 'active', 'paused', 'completed', 'dropped')
  current_progress: text (nullable)        // free-form
  priority: int (1-5, default 3)
  time_commitment: enum('short', 'medium', 'long', 'very_long') (nullable)
  mental_load: enum('light', 'medium', 'heavy') (nullable)
  mood_tags: text[] (nullable)             // array of strings

  cover_url: text (nullable)               // remote URL for API-sourced, or /uploads/... path for gunpla
  external_id: text (nullable)             // id from RAWG/Jikan/Google Books
  external_source: text (nullable)         // 'rawg' | 'jikan' | 'gbooks' | null
  metadata: jsonb (nullable)               // type-specific blob: release_date, episodes_total, pages, grade, scale, etc.

  notes: text (nullable)                   // personal notes
  rating: int (nullable, 1-10)             // post-completion rating

  last_touched_at: timestamp (nullable)    // auto-updated on progress edit
  started_at: timestamp (nullable)
  completed_at: timestamp (nullable)
  created_at: timestamp (default now)
  updated_at: timestamp (default now)
}

// settings table — single row
settings {
  id: int (pk, always 1)
  active_limit_game: int (default 3)
  active_limit_anime: int (default 3)
  active_limit_book: int (default 2)
  active_limit_gunpla: int (default 5)
  theme: text (default 'system')           // 'light' | 'dark' | 'system'
  updated_at: timestamp
}
```

Indexes: `items(type, status)`, `items(last_touched_at)`, `items(priority desc)`.

---

## API Surface (Draft)

```
POST   /api/auth/login              { password } → sets cookie
POST   /api/auth/logout             → clears cookie
GET    /api/auth/me                 → { authenticated: bool }

GET    /api/items                   ?type=&status=&sort=&search=  → paginated list
POST   /api/items                   { ...item } → creates
GET    /api/items/:id               → single item
PATCH  /api/items/:id               { ...partial } → updates (auto-touches last_touched_at on progress change)
DELETE /api/items/:id               → deletes

POST   /api/items/:id/cover         multipart/form-data → uploads custom cover (gunpla)

GET    /api/search/games            ?q=  → RAWG proxy
GET    /api/search/anime            ?q=  → Jikan proxy
GET    /api/search/books            ?q=  → Google Books proxy

POST   /api/recommend               { time, energy, mood } → ranked active items with scores

GET    /api/settings                → settings row
PATCH  /api/settings                { ...partial } → updates

GET    /uploads/:filename           → serves uploaded images
```

All `/api/*` except `/api/auth/login` require auth middleware.

---

## Project Structure (Proposed)

Monorepo with pnpm workspaces (or npm workspaces if simpler):

```
backlog/
├── apps/
│   ├── web/                    # Vite + React frontend
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router file-based
│   │   │   ├── components/
│   │   │   ├── lib/            # query client, api client, utils
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── api/                    # Fastify backend
│       ├── src/
│       │   ├── routes/         # route handlers by domain
│       │   ├── db/             # drizzle schema + migrations
│       │   ├── services/       # business logic (recommend, external APIs)
│       │   ├── plugins/        # fastify plugins (auth, static, etc.)
│       │   └── server.ts
│       ├── drizzle.config.ts
│       └── tsconfig.json
├── packages/
│   └── shared/                 # shared Zod schemas and types
│       └── src/schemas/
├── uploads/                    # local image storage (gitignored)
├── .env.example
├── ecosystem.config.js         # PM2 config
├── package.json
├── pnpm-workspace.yaml
└── CLAUDE.md                   # this file
```

Build flow: `pnpm build` in `web` outputs to `apps/web/dist`, Fastify serves from there.

---

## Environment Variables

```
DATABASE_URL=postgres://user:pass@localhost:5432/backlog
APP_PASSWORD=<your chosen password>
JWT_SECRET=<long random string>
NODE_ENV=production
PORT=3000

# External APIs
RAWG_API_KEY=<from rawg.io>
# Jikan: no key needed
# Google Books: no key needed for basic search, optional for higher quotas
GOOGLE_BOOKS_API_KEY=<optional>
```

---

## Build Plan — Phased Todo

### Phase 0: Project setup ✅

- [x] Init pnpm monorepo with `apps/web`, `apps/api`, `packages/shared` (+ Turborepo for task orchestration)
- [x] Set up TypeScript strict mode across all packages (shared `tsconfig.base.json`)
- [x] Configure shared ESLint + Prettier (ESLint 9 flat config, `strictTypeChecked` + `stylisticTypeChecked`)
- [x] Add `.env.example` and `.gitignore` (covers `uploads/`, `.env`, `node_modules`, `dist`, `.turbo`)
- [x] Init git repo (renamed `master` → `main`)

### Phase 1: Backend foundation ✅

- [x] Scaffold Fastify server with TypeScript (`tsx` for dev, `pino-pretty` logs)
- [x] Install Drizzle + `pg` driver, configure `drizzle.config.ts`
- [x] Write schema for `items` and `settings` tables (indexes per spec)
- [x] Generate and run initial migration (`drizzle/0000_daily_speed.sql`)
- [x] Seed `settings` table with default row
- [x] Set up `fastify-type-provider-zod` for typed validation
- [x] Add `@fastify/cookie` and `@fastify/jwt` plugins
- [x] Implement auth routes (`/api/auth/login`, `/logout`, `/me`)
- [x] Write auth preHandler hook to protect other routes (`app.authenticate`)
- [x] Test login flow with curl/Postman (all 5 scenarios pass: wrong pw → 401, unauth /me → 401, login → 200 + cookie, /me with cookie → 200, logout + /me → 401)

### Phase 2: Core CRUD ✅

- [x] Shared Zod schemas for `Item`, `ItemCreate`, `ItemUpdate` in `packages/shared` (`itemSchema`, `itemCreateSchema`, `itemUpdateSchema`, `itemListQuerySchema`, `forceQuerySchema`, `activeLimitErrorSchema`; uses `.nullish()` for optional create/update fields, pure `.nullable()` for output)
- [x] `GET /api/items` with query filters (type, status, search via `ilike`, sort: recent|priority|title|last_touched, pagination via limit/offset, `z.coerce.number()` for query strings)
- [x] `POST /api/items` (validates active limit per type — returns 409 with `ACTIVE_LIMIT_EXCEEDED` + `{type, currentActiveCount, limit}`; client can override with `?force=true`)
- [x] `GET /api/items/:id`
- [x] `PATCH /api/items/:id` (auto-updates `last_touched_at` on progress change, `started_at` on first transition to `active`, `completed_at` on first transition to `completed`; same active-limit guard with `?force=true` override on activation)
- [x] `DELETE /api/items/:id`
- [x] Settings routes (`GET`, `PATCH` — no-op if patch body is empty)
- [x] Discriminated-union service results (`{kind: 'ok' | 'not_found' | 'active_limit_exceeded'}`) so route handlers stay HTTP-thin
- [x] Date serialization helpers (`serializeItem`, `serializeSettings`) bridging Drizzle `Date` → Zod `z.iso.datetime()` strings
- [x] DEV-only reset script (`pnpm db:reset-dev`) to wipe items + reset settings before Postman runs
- [x] Postman collection at `postman/hobby-track.postman_collection.json` covering auth, CRUD, filters, side effects, active limits, settings, delete, and auth enforcement

### Phase 3: External API integrations ✅

- [x] RAWG client — search endpoint, mapped to normalized `SearchResult` (returns 503 `UPSTREAM_NOT_CONFIGURED` if `RAWG_API_KEY` is unset so failures are obvious during setup)
- [x] Jikan client — no auth, prefers `title_english`, includes synopsis + episode count + score in metadata
- [x] Google Books client — no auth required, optional `GOOGLE_BOOKS_API_KEY` for higher quotas, upgrades `http://` thumbnails to `https://`
- [x] Routes at `/api/search/{games,anime,books}` (auth-gated, validate `?q` 1-200 chars + `?limit` 1-20, return `{ results, cached }`)
- [x] Shared `searchResultSchema` in `packages/shared` — single normalized shape across all three sources so the frontend has one consumer
- [x] In-memory LRU cache (`apps/api/src/lib/cache.ts`) — Map-based with insertion-order eviction, 1h TTL, per-source instance
- [x] Rate limiter (`apps/api/src/lib/rate-limiter.ts`) — `IntervalLimiter` chains `await` so concurrent callers serialize instead of all bursting (350ms gate for Jikan = ~2.85 req/sec, under their 3 req/sec ceiling)
- [x] Shared `fetchJson` helper (`apps/api/src/lib/http.ts`) — 10s AbortController timeout, normalizes upstream non-2xx → `AppError('UPSTREAM_ERROR', …, 502)`
- [x] Global error handler now special-cases `AppError` so service-thrown errors expose `code`/`message` verbatim (was being swallowed by the generic 5xx → INTERNAL_ERROR branch)

### Phase 4: Image uploads (for gunpla) ✅

- [x] `@fastify/multipart` for file upload (registered as a global plugin with 5MB / 1 file limits)
- [x] `sharp` to resize to max 1200px wide (`withoutEnlargement: true`), convert to webp quality 85; `sharp` native bindings approved via `pnpm.onlyBuiltDependencies`
- [x] Store in `uploads/` (monorepo root) with UUID filename (`<uuid>.webp`); path resolved via `import.meta.url` so it works in both `tsx` dev and compiled `dist/`
- [x] `POST /api/items/:id/cover` endpoint — validates MIME (jpeg/png/webp), processes image, writes file, updates `cover_url` in DB, deletes previous local cover (best-effort)
- [x] `@fastify/static` serves `GET /uploads/:filename` → `image/webp`
- [x] File size limit (5MB enforced by multipart plugin), MIME type validation (jpeg, png, webp → 400 `INVALID_FILE_TYPE` otherwise)
- [x] `uploads/` gitignored (`uploads/*`), `uploads/.gitkeep` tracked so the directory exists on fresh clones

### Phase 5: Frontend scaffold ✅

- [x] Vite 6 + React 19 + TypeScript — manually scaffolded (no `create-vite`, workspace already existed)
- [x] TanStack Router v1 (file-based, `tanstackRouter` Vite plugin), TanStack Query v5, react-hook-form v7 + Zod
- [x] Tailwind v4 (`@tailwindcss/vite`) with CSS-first config; stone base + amber primary; Inter (body) + Sora (display) fonts
- [x] shadcn/ui components manually set up: Button, Input, Label, Card (no CLI — written directly to match Tailwind v4 CSS var format)
- [x] Vite dev proxy: `/api/*` + `/uploads/*` → `localhost:3000` (Fastify backend)
- [x] TanStack Router file-based routes: `__root.tsx` (shell), `_app.tsx` (auth guard + sidebar layout), `_app.index.tsx` (→ /items), `_app.items.index.tsx` (placeholder), `_app.settings.index.tsx` (placeholder), `login.tsx`
- [x] Sidebar with logo, type-filter nav links (all/game/anime/book/gunpla), settings + logout
- [x] Login page: centered card, password field with react-hook-form + Zod, loading state, error messages
- [x] Auth guard in `_app.tsx` `beforeLoad` — fetches `/api/auth/me`, redirects to `/login` if unauthenticated or request fails
- [x] Login page `beforeLoad` — redirects already-authenticated users straight to `/items`
- [x] `routeTree.gen.ts` auto-generated by plugin on `vite build`; committed so typecheck works without running Vite first
- [x] Typecheck + ESLint clean across all 3 packages

### Phase 6: Frontend core views ✅

- [x] Item list view: type tabs (All/Games/Anime/Books/Gunpla), status filter, sort, debounced search — all URL-driven via TanStack Router `validateSearch`
- [x] Item card: cover image (aspect-ratio 2/3, hover scale), status badge overlay, priority indicator, progress/last-touched footer
- [x] Item detail sheet: slide-over panel (Radix Dialog), editable form for all fields, cover upload (gunpla), inline delete confirm, active-limit guard on status change
- [x] "Add item" dialog: multi-step — type picker → external search (RAWG/Jikan/GBooks with debounce + skeletons) → details form; gunpla skips search step
- [x] Active limit warning: inline amber alert within the form, "Add anyway" forces with `?force=true`
- [x] Settings page: active limits per type (number inputs), theme selector, form with save + dirty tracking
- [x] Toast notifications via `sonner` (success / error)
- [x] Loading skeletons (grid + settings)
- [x] Empty states: "no items" + "no matches" variants
- [x] Build + typecheck + ESLint clean

### Phase 7: The tonight feature ✅

- [x] `POST /api/recommend` — deterministic scoring across all active items, returns top 5
  - `priority` 0–40: `(priority-1) * 10`
  - `timeFit` 0–30: diff between item time_commitment and requested time (exact=30, ±1=15, ±2=5)
  - `loadFit` 0–20: diff between item mental_load and requested energy (exact=20, ±1=10)
  - `moodFit` 0–15: 5 pts per matching mood tag (capped); 10/7 neutral if field missing
  - `staleness` 0–20: 15 for never started, 20 for >30 days untouched
  - Human-readable `reasons[]` per result ("Fits your time window", "Mood match: cozy" etc.)
- [x] Shared Zod schemas: `recommendRequestSchema`, `scoreBreakdownSchema`, `recommendResultSchema`, `recommendResponseSchema`
- [x] Frontend "Tonight" page (`/tonight`): chip-group pickers for time/energy, mood tag toggles
- [x] Score bar (visual) + reasons chips per result card
- [x] "Start tonight" → activates item if not already active (with active-limit handling), then opens ItemDetailSheet inline
- [x] "Tonight" nav link (Sparkles icon) at top of sidebar
- [x] Build + typecheck + ESLint clean across all 3 packages

### Phase 8: Polish ✅

- [x] Dark mode — `hooks/use-theme.ts` reads `settings.theme`, applies `.dark` class to `<html>`; 'system' follows OS via `matchMedia` with live listener; called from `_app.tsx` so it's always active
- [x] Keyboard shortcut — Cmd+K / Ctrl+K focuses the search input on the items page; placeholder reads "Search… ⌘K" as a hint
- [x] Responsive mobile layout — sidebar becomes a fixed slide-in drawer on `< lg` screens; hamburger button + top bar on mobile; type tabs scroll horizontally; filter bar wraps; padding adapts via `sm:` breakpoints; tonight page padding adjusted
- [x] Error boundary — `components/error-boundary.tsx` React class component wraps `<Outlet />` in `_app.tsx`; shows "Something went wrong / Try again" card; accepts optional custom `fallback` prop
- [x] Confirm dialogs on destructive actions — inline delete confirm already implemented in `item-detail-sheet.tsx` (Phase 6); active-limit warnings inline in add/edit forms
- [x] Build + typecheck + ESLint clean across all 3 packages

### Phase 9: Deployment

#### Automated (CI/CD)
- [x] `ecosystem.config.cjs` — PM2 config at repo root; app runs on **port 3002**; `NODE_ENV=production` and `PORT=3002` set via `env_production` (takes precedence over `.env`); secrets loaded from `apps/api/.env` via `node --env-file=.env`
- [x] `.github/workflows/deploy.yml` — GitHub Actions deploys on push to `main`: SSH → `git pull` → `pnpm install` → build web + api → `db:migrate` → `pm2 reload`
- [x] `apps/api/src/server.ts` — production SPA serving added: registers `@fastify/static` on `apps/web/dist` in production, plus `setNotFoundHandler` returning `index.html` for client-side routing fallback
- [x] `logs/` directory tracked via `.gitkeep`; log files gitignored

#### GitHub Secrets required (Settings → Secrets → Actions)
| Secret | Value |
|---|---|
| `SSH_HOST` | VPS IP or hostname |
| `SSH_USER` | SSH username (e.g. `dio`) |
| `SSH_KEY` | Private SSH key (corresponding public key must be in `~/.ssh/authorized_keys` on VPS) |
| `DEPLOY_PATH` | Absolute path to repo on VPS (e.g. `/home/dio/hobby-tracker`) |

#### Manual steps (one-time VPS setup)
- [ ] Postgres: `createdb hobby_track`, create role, grant privileges
- [ ] Clone repo to `$DEPLOY_PATH`
- [ ] Create `apps/api/.env` on VPS from `.env.example` (set real secrets; omit PORT/NODE_ENV — managed by PM2)
- [ ] Run initial migration: `source apps/api/.env && pnpm --filter @hobby-track/api db:migrate`
- [ ] First start: `pm2 start ecosystem.config.cjs --env production`
- [ ] Persist across reboots: `pm2 save && pm2 startup` (follow printed instructions)
- [ ] Add to Cloudflare Tunnel config (`~/.cloudflared/config.yml` or dashboard):
  ```yaml
  - hostname: hobby.diosyahrizal.me
    service: http://localhost:3002
  ```
  Then `cloudflared tunnel reload` (or restart the tunnel service)
- [ ] Set up pg_dump cron for daily backup to `/var/backups/hobby_track`
- [ ] Smoke test: login, add item from each source, mark progress, run recommendation

### Phase 10 (future, not v1)

- [ ] AI "just pick for me" button (Anthropic API)
- [ ] Stats dashboard (time spent per type, completion rates, genre breakdowns)
- [ ] Export to JSON
- [ ] Tags/custom categories
- [ ] Structured progress for types that support it (episode N/M bars)
- [ ] Self-hosted image bucket (MinIO) migration

---

## Conventions

- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- **Branches**: `main` for stable, feature branches as needed (personal project, so can push to main freely)
- **Types**: Strict TypeScript everywhere. No `any` without comment justifying it.
- **API errors**: Consistent shape `{ error: { code, message, details? } }`
- **DB**: All migrations via Drizzle Kit, never manual SQL on prod
- **Secrets**: Never commit `.env`. Document new vars in `.env.example`.

---

## Open Questions (answer as they come up)

- [ ] Final name for the app
- [ ] Final accent color for UI
- [ ] Display font choice
- [ ] Whether to add a "journal" / per-item note history (append-only log) in v2
- [ ] Whether to track completion dates for stats (probably yes, already in schema)

---

## Context for Future Claude

Owner is Dio, frontend dev (TypeScript/React/Next.js Pages Router) expanding into backend and DevOps. Prefers practical, maintainable solutions. Has a Contabo VPS with Cloudflare Tunnel already set up, running other self-hosted services. This project is both a personal tool and a learning exercise for Fastify, Drizzle, TanStack Router, and end-to-end self-hosted deployment.

When Dio asks for explanations, lean toward connecting new concepts to familiar ones (Sequelize/TypeORM for ORMs, Next.js patterns for routing, etc.) and prefer sequential, concrete examples.
