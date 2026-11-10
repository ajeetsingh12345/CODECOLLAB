# CodeCollab

A full-stack collaborative code snippet sharing and review platform.

## Stack
- Frontend: Next.js App Router, JavaScript, Tailwind CSS, Redux Toolkit, Monaco Editor
- Backend: Express, Socket.IO, JWT access/refresh tokens, Zod, Prisma
- Database: PostgreSQL
- Collaborative editing foundation: Yjs-compatible room architecture (Socket.IO presence/events included)
- Tests: Jest + Supertest
- Deployment: Docker Compose

## Quick start (Docker)
1. Copy `backend/.env.example` to `backend/.env`.
2. Replace both JWT secrets with long random values.
3. From the project root run:
   ```bash
   docker compose up --build
   ```
4. The backend applies checked-in database migrations during startup. To watch startup:
   ```bash
   docker compose logs -f backend
   ```
5. Open http://localhost:3000. API health: http://localhost:5000/api/health

To enable Google login, configure an OAuth 2.0 Web application in Google Cloud
Console with authorized redirect URI
`http://localhost:5000/api/auth/google/callback`, then set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `backend/.env`. Without
these settings, email/password login remains available and Google login reports
that it is not configured.

## Local development
Requirements: Node.js 22+, npm, PostgreSQL 15+.

Backend:
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

If upgrading a database created before migrations were checked in, first verify its schema matches `backend/prisma/schema.prisma`, then baseline it once with `npx prisma migrate resolve --applied 20261109173000_init`. Do not baseline a database whose schema differs from the migration.
The OAuth accounts migration is additive and can be applied to an existing database
with `npx prisma migrate deploy`.

Frontend (new terminal):
```bash
cd frontend
cp .env.local.example .env.local 
npm install
npm run dev
```

For production-like local performance, run `npm run build` once and then `npm run start`. The development server compiles routes on demand, so its first page visits can take longer.

## Important configuration
- Set `DATABASE_URL` in `backend/.env`.
- Set `CLIENT_URL=http://localhost:3000`.
- Set `NEXT_PUBLIC_API_URL=http://localhost:5000/api`.
- Set `NEXT_PUBLIC_SOCKET_URL=http://localhost:5000`.
- For production, use HTTPS, secure cookies, managed secrets, a persistent database, and a proper Yjs provider (e.g. y-websocket or a dedicated collaboration service). The included Socket.IO implementation provides room presence and change broadcasting; it is a starter collaboration transport, not a full CRDT merge engine.

## Implemented
- Registration, login, refresh, logout, self-service profile updates, and optional Google OAuth
- Role-based snippet access (owner/editor/viewer); invited snippets appear in a dedicated "Shared with you" dashboard section
- Snippet CRUD, tags, public/private visibility
- Version snapshots and restore
- Threaded comments, resolve/reopen
- Search/filter/pagination
- Activity and in-app notifications
- Socket.IO snippet rooms, presence, and live content broadcasts (last-write-wins; save to persist)
- Monaco editor UI
- Swagger/OpenAPI JSON endpoint
- Docker Compose, health checks, Jest/Supertest test scaffold

## Notes
Email notifications are represented as persisted in-app notifications and a mock email service that logs delivery. Production email provider integration, granular line-diff review UI, and true Yjs CRDT synchronization are extension points.
