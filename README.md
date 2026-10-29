# JobTrack

Centralize and track a candidate's job applications.

> **Status:** V1 in development. Phase 1 (repository and tooling) is complete. This README is completed in Phase 8 (first-admin procedure, environment variables, known limitations).

## Specifications

The project follows three specification documents in [`docs/`](docs):

- [`PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md): what JobTrack does
- [`TECHNICAL_SPEC.md`](docs/TECHNICAL_SPEC.md): how it is built
- [`JOBTRACK_MASTER_SPEC.md`](docs/JOBTRACK_MASTER_SPEC.md): how they fit together, phases and locked decisions

## Requirements

- Node.js 24 (LTS), pinned in `.nvmrc`
- npm (bundled with Node.js)
- Git

## Getting started

```bash
git clone https://github.com/SudoMata/jobtrack/
cd jobtrack
nvm use
npm install
cp apps/api/.env.example apps/api/.env   # then fill in the values
npm run prisma:generate --workspace apps/api
npm run dev:api
```

Fill in `apps/api/.env` with your own Supabase connection strings (see the comments in `.env.example`). The API listens on `http://localhost:2021` (override with the `PORT` environment variable). Every route is served under `/api`. No route exists yet.

## Repository layout

```text
jobtrack/
├── apps/
│   └── api/                NestJS REST API (apps/web is added in Phase 3b)
├── docs/                   specifications (source of truth)
├── .github/workflows/      continuous integration
├── eslint.config.mjs       ESLint, configured once for the whole repository
├── tsconfig.base.json      shared TypeScript settings (strict mode)
└── package.json            npm workspaces and root scripts
```

## Scripts

Run these from the repository root.

| Script                 | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `npm run dev:api`      | Start the API in watch mode             |
| `npm run lint`         | Run ESLint on the whole repository      |
| `npm run lint:fix`     | Run ESLint and apply safe fixes         |
| `npm run format`       | Format every file with Prettier         |
| `npm run format:check` | Check formatting without changing files |
| `npm run typecheck`    | Type-check every application            |
| `npm run build`        | Build every application                 |
| `npm run test`         | Run the tests of every application      |
| `npx prettier --write` | Run prettier                            |

## Database migrations

Prisma 7 manages the schema in `apps/api/prisma/schema.prisma`. Migrations are SQL files committed in `apps/api/prisma/migrations/`.

```bash
# 1. Edit schema.prisma, then generate the SQL without applying it
npm run prisma:migrate:create --workspace apps/api -- --name <migration_name>

# 2. Review the generated migration.sql and add the RLS statement (see rules below)

# 3. Apply it in development
npm run prisma:migrate:dev --workspace apps/api

# Production (and CI/CD): apply committed migrations only
npm run prisma:migrate:deploy --workspace apps/api
```

Rules:

- Every migration that creates a table also runs `ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;`. No policies are defined: only the API, which connects with server-side credentials, reads and writes data.
- Never edit a migration that has already been applied or committed: create a new one.
- Never use `prisma db push` or `prisma migrate reset` against anything other than a disposable development database.
- Migrations use `DIRECT_URL`; the running API uses `DATABASE_URL` (see `.env.example`).
- The generated client in `apps/api/src/generated` is not committed. Run `npm run prisma:generate --workspace apps/api` after changing the schema.

## Tooling decisions

- **Monorepo:** npm workspaces. No Turborepo, no Nx, no shared types package.
- **TypeScript:** strict mode, defined once in `tsconfig.base.json` and extended by each application. It stays below version 7 until the Nest CLI supports it.
- **Backend:** NestJS 11 (CommonJS) with Jest.
- **Code quality:** ESLint (flat configuration) and Prettier, both configured once at the root.
- **Line endings:** forced to LF by `.gitattributes`, so Windows and Linux agree.
- **Node.js:** version 24 LTS, shared by local development and CI through `.nvmrc`.

## Continuous integration

GitHub Actions runs on every push to `main` and on every pull request: install (`npm ci`), lint, format check, type check and build. The test step is added when the first tests exist (Phase 3).

## Commit convention

Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`.
