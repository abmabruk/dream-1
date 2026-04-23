# Dream 1

Dream 1 is a factory operations platform rebuilt on a real application foundation:

- Next.js App Router
- Prisma + PostgreSQL
- server-side auth and sessions
- role-based permissions
- modular services and repositories
- versioned API routes under `/api/v1`

The goal of this rebuild is to replace demo-style pages with a production-ready base that can grow cleanly.

## Current Modules

- authentication and session handling
- users and role permissions
- customers
- orders
- dashboard metrics
- production assignments
- worker workspace and attendance
- customer portal access and approval flow
- CRM inquiries

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Start PostgreSQL.

If Docker is available on your machine:

```bash
docker compose up -d
```

If you use a local PostgreSQL installation instead, make sure it matches the connection string in `.env`.

4. Apply the Prisma schema:

```bash
npm run db:push
```

5. Seed the first workspace and users:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

Open [http://localhost:2500](http://localhost:2500).

## Seed Login

After seeding, the default owner login is:

- email: `owner@dream1.local`
- password: `dream12345`

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Database Notes

- `.env.example` includes the default local PostgreSQL connection for `dream_1`
- `docker-compose.yml` provides a ready local Postgres service
- the app will not function correctly until PostgreSQL is running and the Prisma schema has been applied

## Architecture

Architecture notes live in [docs/architecture.md](./docs/architecture.md).
