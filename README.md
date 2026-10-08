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
git clone <repository-url>
cd jobtrack
nvm use
npm install
npm run dev:api
```

The API listens on `http://localhost:3000` (override with the `PORT` environment variable). Every route is served under `/api`. No route exists yet.

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
