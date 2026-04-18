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

### Phase 0: Project setup

- [ ] Init pnpm monorepo with `apps/web`, `apps/api`, `packages/shared`
- [ ] Set up TypeScript strict mode across all packages
- [ ] Configure shared ESLint + Prettier
- [ ] Add `.env.example` and `.gitignore` (cover `uploads/`, `.env`, `node_modules`, `dist`)
- [ ] Init git repo

### Phase 1: Backend foundation

- [ ] Scaffold Fastify server with TypeScript
- [ ] Install Drizzle + `pg` driver, configure `drizzle.config.ts`
- [ ] Write schema for `items` and `settings` tables
- [ ] Generate and run initial migration
- [ ] Seed `settings` table with default row
- [ ] Set up `fastify-type-provider-zod` for typed validation
- [ ] Add `@fastify/cookie` and `@fastify/jwt` plugins
- [ ] Implement auth routes (`/api/auth/login`, `/logout`, `/me`)
- [ ] Write auth preHandler hook to protect other routes
- [ ] Test login flow with curl/Postman

### Phase 2: Core CRUD

- [ ] Shared Zod schemas for `Item`, `ItemCreate`, `ItemUpdate` in `packages/shared`
- [ ] `GET /api/items` with query filters (type, status, search, sort)
- [ ] `POST /api/items` (validates active limit per type — return 409 with details on breach, let client decide to proceed with `?force=true`)
- [ ] `GET /api/items/:id`
- [ ] `PATCH /api/items/:id` (auto-update `last_touched_at` on progress change, `started_at` on first `active`, `completed_at` on `completed`)
- [ ] `DELETE /api/items/:id`
- [ ] Settings routes (`GET`, `PATCH`)

### Phase 3: External API integrations

- [ ] RAWG client — search endpoint, map response to our item shape
- [ ] Jikan client — search endpoint, map response
- [ ] Google Books client — search endpoint, map response
- [ ] Expose `/api/search/{games,anime,books}` routes
- [ ] Cache layer (in-memory LRU) to avoid hammering APIs on repeated searches
- [ ] Handle rate limits gracefully (Jikan has 3 req/sec limit)

### Phase 4: Image uploads (for gunpla)

- [ ] `@fastify/multipart` for file upload
- [ ] `sharp` to resize to max 1200px wide, convert to webp
- [ ] Store in `/uploads` with UUID filename
- [ ] `POST /api/items/:id/cover` endpoint
- [ ] `@fastify/static` serves `/uploads/:filename`
- [ ] File size limit (5MB), type validation (jpeg, png, webp only)

### Phase 5: Frontend scaffold

- [ ] `pnpm create vite` with React + TypeScript
- [ ] Install TanStack Router, TanStack Query, shadcn/ui, Tailwind
- [ ] Set up `shadcn init` with custom theme (stone base + accent)
- [ ] Configure Vite proxy for `/api/*` and `/uploads/*` → backend in dev
- [ ] Set up TanStack Router file-based routing
- [ ] Create layout with sidebar/nav
- [ ] Login page
- [ ] Auth context using `/api/auth/me` on mount, redirect to `/login` if unauthed

### Phase 6: Frontend core views

- [ ] Item list view with filters (type tabs, status filter, search input)
- [ ] Item card component (cover, title, status badge, progress, priority)
- [ ] Item detail view with edit form
- [ ] "Add item" flow:
  - Choose type → search external API (except gunpla) → pick result → edit and save
  - Gunpla: direct manual entry form with image upload
- [ ] Active limit warning dialog
- [ ] Settings page (edit active limits, theme)
- [ ] Empty states and loading skeletons

### Phase 7: The tonight feature

- [ ] Backend: `POST /api/recommend` — scoring function
  - Score = priority_weight + time_fit + load_fit + mood_fit + staleness_bonus
  - Return top 5 with score breakdown
- [ ] Frontend: "Tonight" page with input form (time, energy, mood)
- [ ] Results list with score explanation
- [ ] "Start this" button → sets status to active, navigates to detail

### Phase 8: Polish

- [ ] Dark mode toggle (respects system by default)
- [ ] Keyboard shortcuts (cmd+k for search, etc.) — maybe
- [ ] Responsive layout tuning for mobile
- [ ] Error boundaries and toast notifications
- [ ] Confirm dialogs on destructive actions

### Phase 9: Deployment

- [ ] Write `ecosystem.config.js` for PM2
- [ ] Postgres setup on Contabo: create DB, user, grant privileges
- [ ] Run migrations against prod DB
- [ ] Build web, deploy to VPS
- [ ] Configure Cloudflare Tunnel for new hostname
- [ ] Set up pg_dump cron for daily backup to `/var/backups/backlog`
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
