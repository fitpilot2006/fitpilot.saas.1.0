# GymFlow HQ

A multi-tenant SaaS gym management platform with a hidden platform admin dashboard for managing gyms, subscriptions, and access codes.

## Run & Operate

- `pnpm run dev` — run the full stack (Vite frontend port 5000, API port 8080)
- `pnpm --filter @workspace/api-server run build` — rebuild the API server (esbuild)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Wouter + TanStack Query + Tailwind CSS v4 + Radix UI
- API: Express 5 (`artifacts/api-server`, port 8080)
- DB: PostgreSQL + Drizzle ORM (`lib/db/src/schema/`)
- Auth: JWT (jsonwebtoken) stored in localStorage
- Build: esbuild (produces `artifacts/api-server/dist/index.mjs`)

## Where things live

- DB schema: `lib/db/src/schema/` (gyms, users, members, attendance, payments, workout-plans, branding, access-codes, platform-admins, gym-subscriptions)
- API routes: `artifacts/api-server/src/routes/`
- Frontend pages: `artifacts/gym-app/src/pages/`
- Auth middleware: `artifacts/api-server/src/middlewares/auth.ts`
- JWT utils: `artifacts/api-server/src/lib/jwt.ts`
- API client (frontend): `artifacts/gym-app/src/lib/api-client.ts`

## Architecture decisions

- **Multi-tenant isolation**: All tables include a `gymId` column. Every query in gym routes filters by `req.gymId` extracted from JWT.
- **Platform admin is fully isolated**: Platform admin has `role: "platform_admin"` in JWT with `gymId: 0`. Gym routes block platform_admin tokens (403). Platform admin routes block gym user tokens.
- **Platform admin route protection**: `router.use("/platform-admin", requirePlatformAdmin)` — path-scoped middleware so gym routes are unaffected.
- **Member join codes**: Each gym gets an 8-char alphanumeric `memberJoinCode` generated at creation. Members use this to self-register via `/signup/member`.
- **Access codes**: Gym owners need a one-time access code (managed by platform admin) to create a gym account. Stored and validated via Drizzle/Postgres.
- **Gym suspension**: Suspended gyms (`status: "suspended"`) are blocked at login — users see a clear error message.

## Product

- **Gym owners/staff**: Full gym management dashboard — members, attendance, payments, workout plans, branding, QR check-in scanner, renewal alerts.
- **Gym members**: Member portal with QR code, membership status, workout plans.
- **Platform admin** (hidden at `/platform-admin`): Manage all gyms, generate access codes, assign subscription plans, view platform-wide analytics. No link to this page from gym UI.

## User preferences

- Keep platform admin completely hidden — no links from gym navigation.
- Member join codes are 8-character uppercase alphanumeric (no ambiguous chars like O, 0, I, 1).
- Access codes use XXXX-XXXX format with dashes.

## Gotchas

- After any API route change: `cd artifacts/api-server && pnpm run build`, then restart "API Server" workflow.
- DB schema changes: Apply via SQL directly (`psql "$DATABASE_URL"`) rather than `drizzle-kit push` (which prompts interactively).
- Platform admin bootstrap: `POST /api/platform-admin/auth/bootstrap` — only works when `platform_admins` table is empty (one-time setup).
- The `pa_token` localStorage key stores the platform admin JWT separately from the gym user `gymflow_token`.
- Stale duplicate workflows (gym2.1/finalzip/...) can be ignored — only "API Server" and "Start application" matter.
