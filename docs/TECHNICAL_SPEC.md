# JobTrack — Technical Specification

**Version:** 3.1  
**Status:** Consolidated technical source of truth

> This document replaces previous Technical Specification versions and consolidates the technical architecture, security, database, API, frontend, backend, testing and deployment decisions.
>
> **Revision 3.1:** integrates the technical decisions locked during Step 0 (specification lock). The complete decision log is in `JOBTRACK_MASTER_SPEC.md`, Appendix A. Sections that changed in this revision: 4, 6, 7, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 33, 35, 37, 39, 41, 42, 43, 47, 48, 49, 51, 52, 53.

---

# 1. Technical objectives

JobTrack must be:

- fullstack;
- secure;
- testable;
- maintainable;
- inexpensive to run;
- suitable for a professional portfolio;
- simple enough to develop incrementally;
- extensible without premature architecture.

The system must avoid technologies that solve problems JobTrack does not currently have.

---

# 2. Technology stack

## 2.1 Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query

## 2.2 Backend

- Node.js
- NestJS
- TypeScript
- REST API
- class-validator
- Swagger/OpenAPI

## 2.3 Database

- PostgreSQL provided by Supabase
- Prisma as ORM/data-access layer

## 2.4 Authentication

- Supabase Auth
- JWT access token
- NestJS authentication guard
- role/authorization guard
- ownership checks

## 2.5 Testing

Backend:

- Jest
- Supertest where useful

Frontend:

- Vitest
- React Testing Library

## 2.6 Quality

- TypeScript strict mode
- ESLint
- Prettier

## 2.7 Delivery

- Git
- GitHub
- GitHub Actions
- Render for frontend
- Render for backend
- Supabase for PostgreSQL/Auth
- Supabase Storage later for documents

Docker is not required for V1.

---

# 3. High-level architecture

```text
Browser
   ↓
React + TypeScript
   ↓ HTTPS / REST
NestJS API
   ├── Authentication
   ├── Authorization
   ├── Business rules
   ├── Validation
   └── Data access
          ↓
       Prisma
          ↓
Supabase PostgreSQL

Supabase Auth
   └── Identity + JWT
```

The frontend is never the security boundary.

The backend is responsible for:

- authentication verification;
- authorization;
- ownership;
- validation;
- business rules;
- database access.

---

# 4. Authentication and authorization

## 4.1 Authentication

Supabase Auth is the identity provider.

The frontend:

1. registers/logs in through Supabase Auth;
2. obtains the authenticated session/token;
3. sends the access token to the NestJS API (`Authorization: Bearer <access-token>`).

The backend:

1. receives the token;
2. verifies it locally (section 4.2);
3. identifies the authenticated user;
4. provisions the application user on first use (section 4.3);
5. reads the user's role and account status from the application database;
6. continues only if access is allowed.

## 4.2 JWT verification

- The signature is verified locally in the NestJS API with the public signing keys (JWKS) published by the Supabase project and derived from `SUPABASE_URL`.
- No shared secret is stored in the backend and no call to Supabase is made on each request.
- The API also validates the token's expiration, issuer and audience.
- Fallback: if the Supabase project still uses a legacy shared-secret signing key (HS256), the backend verifies the signature with a `SUPABASE_JWT_SECRET` variable instead. The signing-key type is confirmed in Phase 2 (infrastructure). The rest of the design is identical in both cases.
- The role and the account status are never read from the token. They are read from the application database.
- Verified in Phase 2: the project signs tokens with an asymmetric ES256 key, published at `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`. `SUPABASE_JWT_SECRET` is therefore not needed.
- Library: `jose` version 5, the last line that is both CommonJS and ESM. It keeps the verification code testable with real signed tokens under Jest. It moves to version 6 with the NestJS 12 migration.

## 4.3 Application user provisioning

The application `User` record is created lazily by the authentication guard, on the first authenticated API call:

- `id` is the Supabase Auth user id;
- `email` is copied from the verified token and is read-only in JobTrack;
- `role` is `USER` and `account_status` is `ACTIVE`;
- the user is read first and created only if missing (no upsert, which would write on every request and change `updated_at` each time). When two first requests arrive together, the one that loses the race reads the row created by the winner;
- `ADMIN` is never granted automatically.

No SQL trigger on `auth.users` and no dedicated post-registration endpoint is used in V1.

## 4.4 Email confirmation and password reset

- Email confirmation is disabled in development. For production it is enabled only once an email delivery provider is configured (decision in Phase 9).
- After confirming their email, the user is redirected to `/login` with an explanatory message. No additional route is introduced.
- Password reset is not part of V1 (no route, no UI). It is documented as a known limitation.
- Supabase's default email delivery is limited to 2 emails per hour for the whole project and only reaches members of the project's team. Before production, either a custom SMTP provider is configured, or the decision to run without email confirmation is documented.

## 4.5 Authorization

Authentication answers:

> Who is making the request?

Authorization answers:

> What is this user allowed to do?

Request pipeline:

```text
HTTP request
   ↓
JWT validation (local, JWKS)
   ↓
Authenticated identity
   ↓
Application user lookup / lazy provisioning
   ↓
Account status check (database)
   ↓
Role check (database)
   ↓
Ownership check
   ↓
Business rules
   ↓
Database
```

Not every endpoint needs every step, but private resources must always be authorized.

---

# 5. Roles

Initial roles:

```text
USER
ADMIN
```

## USER

Can manage only their own job-search data.

## ADMIN

Can access explicit platform-management capabilities.

Admin rights must be enforced server-side.

The frontend may hide or show UI, but it cannot grant permission.

---

# 6. Account status

Initial statuses:

```text
ACTIVE
SUSPENDED
```

The account status belongs to the application's authorization model (the application database). Supabase Auth remains the identity source.

Enforcement in V1:

- The authentication guard reads the user's account status from the database on every authenticated request. A JWT stays valid until it expires, so only the database check takes effect immediately.
- A `SUSPENDED` account receives `403 Forbidden` on every protected route, user and admin routes alike, with the machine-readable `code` `ACCOUNT_SUSPENDED` (see section 27).
- No ban is applied in Supabase Auth in V1. It may be added later if a real need appears.
- The frontend reacts to `ACCOUNT_SUSPENDED` by signing the user out and displaying an explicit message.

---

# 7. Repository architecture

Monorepo managed with npm workspaces:

```text
jobtrack/
├── apps/
│   ├── api/
│   │   ├── certs/               Supabase CA certificate (public)
│   │   ├── prisma/              schema.prisma and migrations
│   │   │   │   ├── src/
│   │   │   ├── audit/           AuditService (writes events inside the caller's transaction)
│   │   │   ├── auth/            JWT verification, AuthGuard, RolesGuard, decorators
│   │   │   ├── common/          error filter, validation pipe, rate limiting
│   │   │   ├── config/          validated environment variables
│   │   │   ├── generated/       Prisma client (not committed)
│   │   │   ├── health/          GET /api/health
│   │   │   ├── prisma/          PrismaModule and PrismaService
│   │   │   └── users/           UsersService and GET /api/me
│   └── web/                     (added in Phase 3b)
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── TECHNICAL_SPEC.md
│   └── JOBTRACK_MASTER_SPEC.md
├── .github/
│   └── workflows/
├── .nvmrc
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── .gitignore
```

Tooling rules:

- npm workspaces, with a single `package-lock.json` at the root;
- no Turborepo, no Nx, no shared types package: the API contract is described by Swagger and frontend types stay in `apps/web/src/types`;
- a base TypeScript configuration at the root, extended by each application;
- ESLint and Prettier configured once at the root;
- the Node.js LTS version is pinned through `engines` in `package.json` and through `.nvmrc`;
- root scripts to run, check and build both applications.

---

# 8. Frontend structure

```text
apps/web/src/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── applications/
│   ├── companies/
│   ├── settings/
│   └── admin/
├── hooks/
├── lib/
├── routes/
├── services/
├── types/
├── utils/
├── main.tsx
└── ...
```

## Frontend responsibilities

### features

Business-facing UI grouped by domain.

### services

API clients and request functions.

### hooks

Reusable React/TanStack Query behavior.

### routes

Route configuration and protection.

### types

Shared frontend-facing TypeScript models.

### lib

Infrastructure such as Supabase client and API configuration.

---

# 9. Backend structure

```text
apps/api/src/
├── auth/
├── users/
├── companies/
├── applications/
├── dashboard/
├── admin/
├── audit/
├── health/
├── database/
├── config/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── helpers/
├── app.module.ts
└── main.ts
```

## Backend modules

### AuthModule

JWT validation and authenticated identity.

### UsersModule

Application-level user profile and role/status data.

### CompaniesModule

User-owned company CRUD.

### ApplicationsModule

Application CRUD, status changes, filtering and pagination.

### DashboardModule

User dashboard aggregations.

### AdminModule

Platform statistics and user management.

### AuditModule

Sensitive administrative event recording.

### HealthModule

Unauthenticated technical health endpoint (`GET /api/health`).

---

# 10. Database ownership model

## 10.1 User identity

Supabase Auth owns authentication identity.

The application database stores a corresponding application-level user record with the same id. It is created lazily on the user's first authenticated request (section 4.3).

```text
Supabase Auth User
        │
        └── Application User (same id)
```

## 10.2 Company ownership

V1:

```text
User 1 ─── N Company
```

Each company has a `user_id`.

Within one user, company names are unique, compared case-insensitively.

## 10.3 Application ownership

V1:

```text
User 1 ─── N Application
Company 1 ─── N Application
```

Each application has:

- `user_id`;
- `company_id`.

The application owner must match the company owner.

## 10.4 Status history ownership

```text
Application 1 ─── N ApplicationStatusHistory
```

A history entry has no owner of its own: it is reachable only through its application, and it is deleted with it.

---

# 11. Core data model

## 11.0 Naming conventions

- Tables are plural `snake_case` (`users`, `companies`, `applications`). Columns are `snake_case` in the database and `camelCase` in TypeScript (Prisma `@map` and `@@map`). Enum types are `snake_case`.
- Primary keys of the application's own tables are UUIDs generated by PostgreSQL (`gen_random_uuid()`). `users.id` is the exception: it is the Supabase Auth user id.

## 11.1 User

| Field | Type / rules |
|---|---|
| `id` | UUID, equal to the Supabase Auth user id |
| `email` | required, unique, max 254. Copied from the verified token at creation. Read-only in JobTrack |
| `role` | `Role` enum, default `USER` |
| `account_status` | `AccountStatus` enum, default `ACTIVE` |
| `display_name` | optional, max 100. The UI falls back to the email when empty |
| `created_at`, `updated_at` | timestamps |

The Auth provider remains the source of authentication identity.

## 11.2 Company

| Field | Type / rules |
|---|---|
| `id` | UUID |
| `user_id` | owner, foreign key to `User` |
| `name` | required, max 150. Unique per user, case-insensitive |
| `website` | optional, `http`/`https` URL, max 2048 |
| `location` | optional, max 150 |
| `created_at`, `updated_at` | timestamps |

## 11.3 Application

| Field | Type / rules |
|---|---|
| `id` | UUID |
| `user_id` | owner, foreign key to `User` |
| `company_id` | required, foreign key to `Company`, must belong to the same user |
| `position` | required, max 150 |
| `contract_type` | required, `ContractType` enum |
| `location` | optional, max 150 |
| `work_mode` | optional, `WorkMode` enum |
| `job_url` | optional, `http`/`https` URL, max 2048 |
| `applied_at` | required, **date** (no time), may not be in the future |
| `status` | required, `ApplicationStatus` enum. Current status, source of truth |
| `salary_amount` | optional, `NUMERIC` (never floating point), greater than or equal to 0. Precision is fixed in the Applications migration |
| `salary_currency` | optional, 3 uppercase letters (ISO 4217 format, validated on format only) |
| `notes` | optional, plain text, max 5000 |
| `source` | `Source` enum, default `MANUAL`. Set by the server |
| `priority` | `Priority` enum, `NOT NULL`, default `NORMAL` |
| `next_follow_up_at` | optional, **date**, may not be earlier than `applied_at` |
| `created_at`, `updated_at` | timestamps |

Rules:

- `salary_amount` and `salary_currency` go together: both set or both empty;
- the salary period (monthly/annual) is not modeled in V1. Users may mention it in the notes;
- notes are displayed as plain text, never interpreted as HTML.

## 11.4 ApplicationStatusHistory

| Field | Type / rules |
|---|---|
| `id` | UUID |
| `application_id` | foreign key to `Application`. Entries are deleted with the application |
| `from_status` | **nullable**. `NULL` for the initial entry written at creation |
| `to_status` | required, `ApplicationStatus` enum |
| `changed_by_user_id` | foreign key to `User` |
| `changed_at` | timestamp |

Behavior in V1:

- history is written from V1 (it cannot be reconstructed later);
- creating an application writes an initial entry (`from_status = NULL`);
- every status change writes one entry, in the same database transaction as the update of `Application.status`;
- there is no history UI in V1 (planned for V2).

The current application status remains on `Application`. History records events and does not replace the current-state field.

## 11.5 AuditLog

| Field | Type / rules |
|---|---|
| `id` | UUID |
| `actor_user_id` | foreign key to `User` |
| `action` | `AuditAction` enum |
| `resource_type` | `AuditResourceType` enum |
| `resource_id` | id of the targeted resource |
| `metadata` | optional `JSONB`, `{ from, to }` only (see section 42) |
| `created_at` | timestamp |

V1 actions:

```text
ROLE_CHANGED
USER_SUSPENDED
USER_REACTIVATED
```

The audit log is append-only.

---

# 12. Future database entities

## Interview

```text
id
application_id
scheduled_at
timezone
type
meeting_url
location
interviewer_name
notes
result
created_at
updated_at
```

## Contact

```text
id
user_id
company_id
name
role
email
phone
linkedin_url
notes
created_at
updated_at
```

## Note

Potentially:

```text
id
user_id
application_id
type
content
created_at
updated_at
```

## Document

```text
id
user_id
application_id
type
name
storage_path
mime_type
size
created_at
updated_at
```

Files are expected to use Supabase Storage.

## FollowUp

Potentially:

```text
id
user_id
application_id
due_at
completed_at
note
created_at
updated_at
```

## Future platform entities

Possible later entities:

- Notification;
- Integration;
- ImportJob;
- FeatureFlag;
- additional security events.

These should only be introduced when their features are implemented.

---

# 13. Enums

Application status:

```text
APPLIED
SCREENING
INTERVIEW
OFFER
REJECTED
```

Contract type:

```text
FULL_TIME
PART_TIME
CONTRACT
INTERNSHIP
FREELANCE
OTHER
```

Work mode:

```text
REMOTE
HYBRID
ONSITE
OTHER
```

Priority:

```text
LOW
NORMAL
HIGH
```

Source:

```text
MANUAL
CSV_IMPORT
URL_CAPTURE
EMAIL
BROWSER_EXTENSION
API
```

Only `MANUAL` is exposed as a real creation source in V1. The server sets it; clients cannot supply it.

Role:

```text
USER
ADMIN
```

Account status:

```text
ACTIVE
SUSPENDED
```

Audit action (V1):

```text
ROLE_CHANGED
USER_SUSPENDED
USER_REACTIVATED
```

Audit resource type (V1):

```text
USER
```

New audit actions and resource types are added, with a migration, together with the feature that produces them.

---

# 14. Database constraints and indexes

The implementation enforces:

- non-null constraints for required fields;
- enum constraints;
- foreign keys with explicit delete behavior (table below);
- ownership relationships;
- the length limits defined in section 11;
- unique constraints: `User.email` and `Company (user_id, lower(name))`;
- CHECK constraints where expressible: `salary_amount >= 0`, `salary_amount` and `salary_currency` both set or both null, `next_follow_up_at >= applied_at`.

"`applied_at` is not in the future" depends on the current date and is validated in the application layer.

Prisma does not express CHECK constraints or functional unique indexes natively: they are added in the migration SQL.

Foreign-key delete behavior:

| Relation | On delete |
|---|---|
| `Company.user_id` → `User` | RESTRICT |
| `Application.user_id` → `User` | RESTRICT |
| `Application.company_id` → `Company` | RESTRICT |
| `ApplicationStatusHistory.application_id` → `Application` | CASCADE (explicit and documented) |
| `ApplicationStatusHistory.changed_by_user_id` → `User` | RESTRICT |
| `AuditLog.actor_user_id` → `User` | RESTRICT |

Useful indexes include:

- application by `user_id`;
- application by `user_id + status`;
- application by `user_id + applied_at`;
- application by `company_id`;
- status history by `application_id`;
- company by `user_id`;
- audit log by `created_at`;
- audit log by `actor_user_id`.

Search indexing can be improved later if real data volume requires it.

---

# 15. Ownership security

For every private resource, the backend must verify ownership.

Incorrect:

```text
GET /applications/:id
→ find by id only
```

Correct concept:

```text
find application
WHERE id = requestedId
AND user_id = authenticatedUserId
```

Equivalent ownership constraints apply to:

- companies;
- applications;
- future interviews;
- documents;
- contacts;
- notes;
- follow-ups.

A user knowing another resource's ID must not be enough to access it.

A resource that does not exist and a resource owned by another user produce the same `404 Not Found` response, so that identifiers cannot be probed.

---

# 16. Admin authorization

Admin endpoints require:

1. valid authentication;
2. active account;
3. ADMIN role;
4. endpoint-specific authorization;
5. validation;
6. audit for sensitive operations.

The backend must never rely on a client-supplied `role` field.

## 16.1 Safeguards on role and status changes

- **No self-modification.** An admin cannot change their own role or their own account status (`403`).
- **Never zero active admins.** No operation may leave the platform without an active ADMIN. This covers changing an ADMIN to USER and suspending an ADMIN. Inside one database transaction, the rows of the active admins are locked, they are counted, and the operation is refused with `409 Conflict` if it would leave none. Locking prevents two concurrent operations from both succeeding on stale counts.
- **No-op changes are conflicts.** Applying a role or a status the user already has returns `409`.
- **Atomicity.** The change and its audit event are written in the same transaction. A change cannot exist without its trace.

## 16.2 First administrator

The first admin is promoted manually, outside the API, through a documented SQL statement or script (README). The account must already exist (lazy provisioning).

- No environment variable automatically promotes an email to ADMIN.
- This initial promotion is not audited, because it does not go through the API. Every later change goes through the API and is audited.

---

# 17. Admin privacy model

Default:

```text
Candidate data → private
Platform metrics → admin
Account management → admin
Audit logs → admin
```

An admin should not receive all application contents simply because they are an admin.

If a future support operation requires candidate-data access:

```text
Explicit authorization
        ↓
Limited scope
        ↓
Audited access
        ↓
Minimal returned data
```

---

# 18. RLS strategy and database connection

## 18.1 Row Level Security

Supabase Row Level Security is enabled as defense in depth, and only for that purpose.

- RLS is enabled on every application table (`User`, `Company`, `Application`, `ApplicationStatusHistory`, `AuditLog`, and every future table).
- No policies are defined in V1. With RLS enabled and no policy, the `publishable key` and `authenticated` roles are denied by default: the public `publishable key` key shipped in the frontend cannot read or write application data through Supabase's data API.
- The NestJS API connects with server-side database credentials and remains the only authorization layer. Ownership and role rules are not duplicated as RLS policies.
- Prisma does not manage RLS. Every migration that creates a table includes the SQL statement enabling RLS.
- Verification: once a table exists (from Phase 3), a request on its `/rest/v1/<table>` endpoint with the publishable key confirms that no data can be read or written. The root endpoint alone proves nothing, because it is reserved to secret keys anyway.

> RLS does not replace NestJS authorization.

## 18.2 Prisma / Supabase connection strategy

- `DATABASE_URL`: pooled connection (Supabase pooler, transaction mode), used by the API at runtime. Prisma interactive transactions are used in this mode: they stay on one connection for the duration of the transaction.
- `DIRECT_URL`: direct connection, used only by the Prisma migration CLI. If a direct connection is not reachable from the development machine or from CI, the pooler in session mode is used instead.
- Migrations never go through the transaction-mode pooler.
- Both connections were verified in Phase 2.

The service-role key is not used in V1 and must never be exposed to the browser.

---

## 18.3 Prisma 7 and TLS
- Supabase project (Data API disabled);
- PostgreSQL;
- Supabase Auth (email confirmation disabled in development, decided for production in Phase 9);
- JWT signing keys confirmed asymmetric (ES256, verified through JWKS);
- Supabase's default email delivery limits checked;
- validated environment configuration (the API refuses to start if it is invalid);
- Prisma 7 (major version pinned) with the pooled `DATABASE_URL` and the direct `DIRECT_URL`;
- TLS connection verified against Supabase's CA certificate;
- `PrismaModule` and `PrismaService`;
- database migration process, including RLS in every migration. The publishable-key check on a table endpoint is done once the first table exists (Phase 3).

# 19. API conventions

Base prefix:

```text
/api
```

JSON is the default API representation.

Technical endpoint:

Identity endpoint:

```text
GET /api/me
```

It returns `{ id, email, role, accountStatus }` for the authenticated user, so that the frontend knows the role and the account status. `displayName` is added with the feature that lets users edit it.

It requires no authentication and returns only a static status (for example `{ "status": "ok" }`), never application data. It is used for deployment health checks.

Every other endpoint requires authentication.

---

# 20. Application API

```text
GET    /api/applications
POST   /api/applications
GET    /api/applications/:id
PATCH  /api/applications/:id
DELETE /api/applications/:id
PATCH  /api/applications/:id/status
```

## Query parameters

```text
search
status
contractType
location
workMode
priority
sort
page
limit
```

Rules:

- `search`: trimmed, maximum 100 characters, case-insensitive partial match on the company name and on the position. An empty value is ignored.
- `status`, `contractType`, `workMode`, `priority`: valid enum values.
- `location`: case-insensitive partial match.
- Filters combine with AND.
- `sort`: whitelist of two values, `appliedAt_desc` (default) and `appliedAt_asc`. Ties are broken by `created_at`, then `id`, in the same direction as the main sort, so the order is stable across pages.
- `page` and `limit`: see section 25.

Example:

```text
GET /api/applications?status=INTERVIEW&workMode=REMOTE&page=1&limit=20
```

## Creation and update

- `POST` carries the initial `status` and the other fields of section 11.3. `source` is set by the server.
- `PATCH /api/applications/:id` does **not** accept `status`. The validation rejects it with `400`.

## Status endpoint

```text
PATCH /api/applications/:id/status
```

Body: `{ "status": "INTERVIEW" }`.

It is the only way to change the status of an application. Any status may be changed to any other status. Requesting the current status returns `409 Conflict`. See section 28.

## Kanban

There is no dedicated Kanban endpoint. The Kanban uses `GET /api/applications` with one request per status column (`status=…`), a `limit` up to the maximum, and the `meta.total` of each response for the column count and the "load more" behavior.

---

# 21. Company API

```text
GET    /api/companies
POST   /api/companies
GET    /api/companies/:id
PATCH  /api/companies/:id
DELETE /api/companies/:id
```

All operations are scoped to the authenticated user: the owner always comes from the verified token, never from the request. No endpoint accepts a `userId`.

- `GET /api/companies` is paginated (section 25), with an optional `search` (case-insensitive partial match on the name, trimmed, 100 characters maximum, a blank search is ignored). The order is by name, then by id.
- `POST` and `PATCH` trim the texts. For `website` and `location`, a blank text is stored as no value.
- In `PATCH`, a field that is not sent is left unchanged. `website` and `location` are cleared with `null` or a blank text. `name` can never be cleared (`400`).
- Identifiers in URLs must be UUIDs, otherwise `400`.
- A company that does not exist and a company owned by someone else both answer `404 Company not found`.
- Creating or renaming a company to a name the user already has (case-insensitive) returns `409 Conflict`.
- Deleting a company referenced by at least one application returns `409 Conflict`. Until applications exist the message is "This company is linked to applications and cannot be deleted". The count ("linked to N applications") is added in Phase 5.
- `DELETE` answers `204 No Content`.

---

# 22. Dashboard API

```text
GET /api/dashboard/stats
```

Example:

```json
{
  "total": 24,
  "byStatus": {
    "APPLIED": 10,
    "SCREENING": 4,
    "INTERVIEW": 6,
    "OFFER": 2,
    "REJECTED": 2
  }
}
```

Optional later additions can include recent applications and other user-level aggregates.

---

# 23. Admin API

```text
GET   /api/admin/stats
GET   /api/admin/users
GET   /api/admin/users/:id
PATCH /api/admin/users/:id/role
PATCH /api/admin/users/:id/status
GET   /api/admin/audit-logs
```

- `GET /api/admin/stats` accepts `period=7d|30d|90d` (section 24).
- `GET /api/admin/users` uses the pagination contract (section 25), a controlled `search` parameter on email and display name, and is sorted by `created_at` descending by default.
- `GET /api/admin/users/:id` returns account and support metadata only (id, email, display name, role, account status, timestamps). It never returns candidate content.
- `PATCH /api/admin/users/:id/role` has the body `{ "role": "USER" | "ADMIN" }`.
- `PATCH /api/admin/users/:id/status` has the body `{ "status": "ACTIVE" | "SUSPENDED" }`.
- Both PATCH endpoints apply the safeguards of section 16.1 and write an audit event in the same transaction.
- `GET /api/admin/audit-logs` uses the pagination contract, is sorted by `created_at` descending, and supports two controlled filters: `action` and `actorUserId`. There is no date-range filter in V1.

---

# 24. Admin statistics

```text
GET /api/admin/stats?period=7d|30d|90d
```

`period` is a whitelist of three values, default `30d`. Any other value returns `400`. The window is a rolling window computed in UTC.

Example:

```json
{
  "period": "30d",
  "users": {
    "total": 120,
    "active": 114,
    "suspended": 6,
    "newUsers": 18
  },
  "applications": {
    "total": 1240,
    "applicationsCreated": 210,
    "byStatus": {
      "APPLIED": 500,
      "SCREENING": 300,
      "INTERVIEW": 250,
      "OFFER": 90,
      "REJECTED": 100
    }
  }
}
```

Rules:

- `period` applies only to `newUsers` and `applicationsCreated`. The totals and `byStatus` do not depend on it;
- every value is calculated from the database;
- the response contains aggregates only, never candidate content.

---

# 25. Pagination contract

Standard response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

Parameters:

- `page`: integer greater than or equal to 1, default `1`;
- `limit`: integer between 1 and 100, default `20`, maximum `100`.

Rules:

- an invalid value (less than 1, above the maximum, not a number) is rejected with `400`. Values are never silently normalized;
- `page`: integer between 1 and 1,000,000 (the upper bound prevents absurd offsets, because invalid input must never produce a 500), default `1`;
- the same contract applies to every paginated endpoint, including the admin lists.

---

# 26. Validation

All external input must be validated server-side.

Validate:

- required fields;
- string lengths (section 11);
- enums;
- URL format (`http` and `https` only);
- dates (`applied_at` not in the future, `next_follow_up_at` not before `applied_at`);
- numeric salary (non-negative, with its currency);
- pagination;
- sort values (whitelist);
- search parameters;
- role changes;
- account status changes.
- optional texts are trimmed, and a blank optional text is stored as no value (`null`);

DTOs reject unknown properties, so a client cannot send fields it is not allowed to set (for example `status` on the generic update, `source`, `role`, `user_id`).

Client-side validation improves UX but does not replace backend validation.

---

# 27. Error contract

Recommended shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "position": [
      "Position is required"
    ]
  }
}
```

An optional `code` field carries a stable machine-readable identifier where the client must tell two errors of the same HTTP status apart. In V1:

```json
{
  "statusCode": 403,
  "message": "Account suspended",
  "code": "ACCOUNT_SUSPENDED"
}
```

HTTP statuses:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
429 Too Many Requests
500 Internal Server Error
```

Usage:

- `400`: every validation error (`422` is not used);
- `401`: missing, invalid or expired token;
- `403`: insufficient role, suspended account, forbidden self-modification;
- `404`: the resource does not exist **or belongs to another user**;
- `409`: business conflicts (same status requested, company deletion blocked, duplicate company name, role or status already applied, last active admin);
- `429`: rate limit exceeded.

All errors are produced by a single exception filter.

Production errors must not expose:

- stack traces;
- secrets;
- database credentials;
- internal implementation details.


Standard messages produced in V1:

- `401`: `Authentication required` (no usable `Authorization` header) and `Invalid or expired token`;
- `403`: `Account suspended` (code `ACCOUNT_SUSPENDED`) and `Insufficient permissions`;
- `429`: `Too many requests`, with a `Retry-After` header;
- `500`: always `Internal server error`. The detail of an unexpected failure is only written in the server logs.
---


# 28. REST business rules

## Application creation

- authenticated USER required;
- company must exist;
- company must belong to the current user;
- required fields valid;
- `source` set by the server (`MANUAL`);
- initial `status` validated against the enum;
- the application and its initial history entry (`from_status = NULL`) are written in one transaction.

## Application update

- application must belong to current user;
- submitted fields validated;
- `status` is rejected (use the status endpoint);
- company changes must preserve ownership.

## Status update

- application ownership verified;
- target status must be a valid enum;
- any status may be changed to any other status;
- requesting the current status returns `409 Conflict` and records nothing;
- the update of `Application.status` and the creation of the history entry happen in one transaction.

## Application deletion

- ownership verified;
- deletion scoped to the current user;
- the status history is deleted with the application.

## Company creation and update

- the name must be unique for the user, case-insensitive (`409` otherwise).

## Company deletion

- ownership verified;
- refused with `409 Conflict` while at least one application references the company;
- no cascade.

---

# 29. Authentication guard

Conceptual NestJS flow:

```text
Authorization: Bearer <access-token>
              ↓
AuthGuard
              ↓
Verify the JWT locally (JWKS; expiration, issuer, audience)
              ↓
Normalize the identity (id, email)
              ↓
Find or create the application user (idempotent)
              ↓
Check the account status (database)
              ↓
Attach the authenticated user context (id, email, role, status)
              ↓
Continue
```

The authenticated identity is normalized into a request context. The role and the account status in that context come from the database, never from the token.

Guards are global and run in this order: the rate limiter, `AuthGuard`, then `RolesGuard`. A route is private unless it is marked `@Public()`. A role requirement is declared with `@Roles(...)`. `GET /api/health` is the only public route.

---

# 30. Role guard

Conceptual:

```text
@Roles('ADMIN')
```

The role is read from trusted application data, not from arbitrary client input.

---

# 31. Ownership helper

Use a reusable ownership pattern/helper rather than repeating unsafe logic throughout controllers.

Concept:

```text
Ownership is part of the query, never a check made afterwards: every read, update and delete of an owned resource filters by owner (`where: { id, userId }`). `orNotFound` (in `common/errors`) turns Prisma's "record not found" into the same `404` whether the resource does not exist or belongs to someone else, so identifiers cannot be probed. The owner id always comes from the authenticated user, never from the request. Lists are filtered by owner too, including their search and their total.
```

The helper/service should return the resource only if it belongs to the user.

This reduces accidental ID-only access.

---

# 32. Frontend route protection

Public routes:

```text
/login
/register
```

Authenticated routes:

```text
/dashboard
/applications
/applications/new
/applications/:id
/applications/:id/edit
/settings
```

Admin routes:

```text
/admin
/admin/users
/admin/users/:id
/admin/audit-logs
```

The frontend can redirect unauthorized users for UX, but the backend must enforce the actual authorization.

---

# 33. TanStack Query usage

Use TanStack Query for server state:

- application lists;
- application detail;
- dashboard stats;
- company lists;
- admin data.

Mutations should invalidate/update relevant cached queries after:

- create;
- update;
- delete;
- status change;
- admin role/status changes.

Specific behaviors:

- **Kanban:** one paginated query per status column, using `meta.total` for the column count and a "load more" action.
- **Slow first response:** free-tier services can take time to wake up. Queries use a generous timeout and automatic retries before displaying an error state, and show a clear loading state meanwhile.
- **Suspended account:** a `403` with `code = ACCOUNT_SUSPENDED` signs the user out and displays an explicit message.

---

# 34. Forms

Application forms should:

- validate user input;
- clearly distinguish required and optional fields;
- display server validation errors;
- prevent duplicate submissions;
- show success feedback;
- handle loading state.

The frontend should not invent business rules that differ from the backend.

---

# 35. UI states

For every asynchronous feature:

```text
Loading
Empty
Success
Error
```

Mutating actions should also expose an appropriate pending state.

A slow first response (a sleeping service) is shown as a loading state, with retries, before it becomes an error state.

---

# 36. API documentation

Swagger/OpenAPI must document:

- endpoints;
- DTOs;
- request parameters;
- authentication;
- roles;
- response structures;
- errors;
- examples where useful.

Swagger should remain synchronized with the implementation.

---

# 37. Testing strategy

Tests are written during each implementation phase, not postponed. Phase 8 completes coverage.

## 37.1 Backend unit tests

Test:

- application service;
- company ownership;
- status changes (any transition, `409` on the same status);
- validation;
- dashboard aggregation;
- role checks;
- account status checks;
- lazy user provisioning (idempotent).

## 37.2 Integration/API tests

Test:

- authenticated application CRUD;
- cross-user access denied (with `404`);
- normal USER denied admin routes;
- ADMIN allowed authorized routes;
- invalid input rejected, including `status` on the generic update;
- status updates and their history entries, including the transactional behavior;
- company deletion blocked while applications reference it, and duplicate company names;
- pagination limits and invalid values;
- dashboard aggregation;
- suspended account rejected with `ACCOUNT_SUSPENDED`;
- admin safeguards: no self-modification, no operation leaving zero active ADMIN, including a concurrent test where two admins demote or suspend each other at the same time;
- audit event written with each sensitive admin action, in the same transaction.



## 37.3 Frontend tests

Test:

- login/auth states;
- application form;
- application list;
- search/filter;
- status changes;
- Kanban column totals and "load more";
- dashboard;
- admin route protection;
- suspended-account handling;
- loading state;
- empty state;
- error state.

## 37.4 Manual verification

- RLS: after each migration creating a table, confirm with the `publishable key` key that no data is accessible (section 18.1).

## 37.5 End-to-end tests

End-to-end tests (`apps/api/test`) run in CI without any secret or database: the JWKS source and `PrismaService` are replaced by test doubles, while the guards, the validation pipe, the exception filter and the rate limiter are the real ones. Test-only controllers are declared inside the test files.

The fake database (`test/support/fake-prisma.ts`) honors the `id`, `userId` and `name` filters and reproduces the database rules (one company name per user ignoring case, companies still in use). A service that forgets to filter by owner makes the isolation tests fail.

---

# 38. Quality rules

Use:

- TypeScript strict mode;
- ESLint;
- Prettier;
- consistent naming;
- small focused modules;
- DTO validation;
- reusable authorization logic;
- no secrets in source control.

Avoid:

- `any` without justification;
- duplicated authorization rules;
- database access directly from React;
- hard-coded business data;
- unnecessary global state;
- premature abstractions.

---

# 39. Environment variables

Frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_API_URL
```

Backend:

```text
DATABASE_URL
DIRECT_URL
DATABASE_SSL_CA_PATH
SUPABASE_URL
PORT
CORS_ORIGIN
- `RATE_LIMIT_PER_MINUTE` defaults to 120 and `TRUST_PROXY_HOPS` defaults to 0.
- `TRUST_PROXY_HOPS` is the exact number of reverse proxies in front of the API. Too high lets clients forge their IP address, too low makes every client share the proxy's address. It is verified against what Render actually sends (Phase 9).
```

Conditional (only if the Supabase project uses legacy HS256 signing keys, section 4.2):

```text
SUPABASE_JWT_SECRET
```

Not used in V1:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_publishable key_KEY (backend)
```

Only variables actually required by the implementation should remain.

Never expose:

```text
DATABASE_URL
DIRECT_URL
SUPABASE_JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY (if it is ever introduced)
```

to the frontend.

Notes:

- Environment variables are validated at startup (`apps/api/src/config`, class-validator through `@nestjs/config` 4, the CommonJS line that matches NestJS 11). Error messages never include values.
- `DIRECT_URL` is read only by the Prisma CLI (`prisma.config.ts`) and is not validated by the API.
- `DATABASE_SSL_CA_PATH` is relative to `apps/api`.
- Supabase's publishable key replaces the legacy `anon` key. The secret key replaces the legacy `service_role` key and is not used in V1.
---

# 40. CORS

Production CORS must allow only the configured frontend origin(s).

Do not use unrestricted wildcard CORS for authenticated production traffic unless there is a documented reason.

---

# 41. Rate limiting

V1 uses the official NestJS throttling module with in-memory counters. No Redis.

- A generous global limit per client IP protects the whole API against simple abuse.
- A stricter limit applies to sensitive admin write actions (role and status changes).
- Exceeded limits return `429 Too Many Requests`.
- Authentication requests go directly from the frontend to Supabase Auth and do not pass through the API. JobTrack cannot limit them. V1 relies on the limits built into Supabase Auth, and this is documented.
- Behind Render's proxy, the API trusts exactly `TRUST_PROXY_HOPS` proxies, so that the real client IP is used. Without it, all users would share one counter.
- The rate limiter runs before authentication, so a flood is stopped before any token is verified or any query is made. An end-to-end test covers this order.
- `GET /api/health` is exempt from rate limiting, so that a burst cannot make the hosting platform think the API is down.
- In-memory counters are consistent only with a single API instance. If several instances are ever needed, this decision is reopened.
- The threshold is `RATE_LIMIT_PER_MINUTE` requests per client IP over a 60-second window, 120 by default. It can be adjusted without changing the API contract. The stricter limit for admin write actions is added with those endpoints (Phase 7).

---

# 42. Audit implementation

Audit is append-only.

- No endpoint modifies or deletes audit entries, and no cascade reaches them.
- `actor_user_id` references `User` with RESTRICT. Users are never deleted in V1.
- `action` and `resource_type` are database enums (section 13).
- The audit event is written in the same transaction as the action it describes.

Sensitive events include:

```text
actorUserId
action
resourceType
resourceId
createdAt
limited metadata
```

Metadata contains only the previous and the new value (for example role `USER` → `ADMIN`).

Do not put emails, passwords, tokens, full CVs, private notes or any candidate data into audit metadata.

`AuditService.record(tx, entry)` requires the transaction client of the action it describes. It never swallows a failure, so an action cannot be saved without its trace. Its metadata type only accepts `{ from, to }`.

---

# 43. Deletion strategy

| Resource | V1 behavior |
|---|---|
| Application | Hard delete by its owner. Its status history is deleted with it (explicit cascade) |
| Company | Refused with `409` while any application references it. Hard delete otherwise |
| User | Never deleted in V1 (no endpoint). Foreign keys use RESTRICT |
| Audit log | Never deleted. Append-only |

The only cascade in V1 is `ApplicationStatusHistory` → `Application`, documented in section 14.

Future account deletion requires a complete data-retention decision. Supabase Auth, application profile, applications, companies, documents, contacts and integrations must be considered together.

No destructive cascade should be introduced without explicit documentation.

---

# 44. Future storage

Supabase Storage is reserved for future document functionality.

Expected protections:

- authenticated access;
- ownership verification;
- controlled storage paths;
- file type validation;
- file size limits;
- no public bucket for private CVs/documents unless explicitly intended.

---

# 45. Import architecture

Future imports must follow:

```text
External input
      ↓
Parse
      ↓
Normalize
      ↓
Validate
      ↓
Duplicate detection
      ↓
Preview
      ↓
User confirmation
      ↓
Persistence
```

Potential sources:

- CSV;
- Excel;
- URL;
- email;
- browser extension;
- external API.

No future import feature should write arbitrary external input directly to production tables.

---

# 46. Analytics architecture

Analytics are derived from persisted facts.

Use:

```text
Application.current_status
ApplicationStatusHistory
Application.applied_at
Application.created_at
Application.updated_at
```

when calculating metrics.

Avoid storing redundant analytics values unless there is a measured performance reason.

---

# 47. Deployment architecture

```text
GitHub
  ↓
GitHub Actions
  ├── install
  ├── lint
  ├── type check
  ├── test
  └── build
        ↓
Render
  ├── Web
  └── API

Supabase
  ├── Auth
  ├── PostgreSQL
  └── Storage (future)
```

Health check: Render uses `GET /api/health`.

Free-tier behavior:

- free services can go to sleep after inactivity (Render web services) or be paused (Supabase projects), which makes the first request slow;
- the frontend handles it with a clear loading state, a generous timeout and retries (section 33);
- the README documents this behavior and how to wake a paused Supabase project;
- no artificial keep-alive ping is used in V1;
- the current conditions of the free plans are verified before deployment (Phase 9).
- development and production use separate Supabase projects. The production project is created in Phase 9.

---

# 48. CI pipeline

The CI is introduced early and grows with the project:

- **From Phase 1:** install dependencies, lint, format check, type check, build. Since Phase 2, the Prisma client is generated right after the installation (it is not committed).
- **Since Phase 3:** the unit test step and the end-to-end test step run in CI and must pass.
- **Complete pipeline (Phase 8):**

```text
Install dependencies
       ↓
Generate Prisma client
       ↓
Lint
       ↓
Type check
       ↓
Tests
       ↓
Build
```

A pull request should not be considered ready if the required CI checks fail.

---

# 49. Database migration process

Before migration:

1. lock schema decisions;
2. lock enum values;
3. lock ownership model;
4. lock deletion behavior;
5. validate the Prisma/Supabase connection strategy (section 18.2);
6. configure environments;
7. create initial migration;
8. apply to development;
9. verify schema;
10. only then prepare production migration.

Every migration that creates a table also:

- enables RLS on it (no policies, section 18.1);
- includes the SQL for constraints Prisma cannot express (CHECK constraints, functional unique indexes);
- is followed by the manual `publishable-key`-key verification.

Migrations use `DIRECT_URL`. Never casually modify production schema manually without updating the migration history.

Migrations are incremental: only the entities required by the feature being implemented are added in each phase.

Scripts (run for `apps/api`): `prisma:migrate:create`, `prisma:migrate:dev`, `prisma:migrate:deploy`, `prisma:migrate:status`. A migration is always created first with `--create-only`, then its SQL is reviewed and the RLS statement is added, then it is applied. Migration creation was verified on Supabase in Phase 2 (shadow database).

---

# 50. Future technical evolution

## V2

- Supabase Storage;
- interviews;
- status history UI;
- imports;
- exports;
- analytics;
- follow-ups.

## V3

- scheduled jobs;
- notifications;
- email/calendar integrations;
- URL capture;
- browser extension;
- external APIs.

Queues/Redis may be introduced only if real asynchronous workloads justify them.

## V4

- AI services;
- advanced extraction;
- recommendation systems;
- external integrations.

AI infrastructure should remain isolated from the core transactional domain.

---

# 51. Locked technical decisions

The decisions required before the first migration were confirmed in Step 0. They are now implementation rules. The full log is in `JOBTRACK_MASTER_SPEC.md`, Appendix A.

| # | Decision | Outcome | Section |
|---|---|---|---|
| 1 | Monorepo | npm workspaces, no orchestrator, no shared package | 7 |
| 2 | Prisma/Supabase connection | pooled `DATABASE_URL` (transaction mode) + `DIRECT_URL` for migrations | 18.2 |
| 3 | Auth identity synchronization | lazy, idempotent creation in the AuthGuard | 4.3 |
| 4 | Company ownership | per user, unique name (case-insensitive) | 10.2, 11.2 |
| 5 | Roles | `USER`, `ADMIN`, read from the database | 5, 4.5 |
| 6 | Account statuses | `ACTIVE`, `SUSPENDED`, checked in the database on every request | 6 |
| 7 | Application statuses | 5 values, free transitions | 13, 28 |
| 8 | Contract types | 6 values | 13 |
| 9 | Work modes | 4 values | 13 |
| 10 | Priority | 3 values, default `NORMAL` | 13, 11.3 |
| 11 | Source enum | 6 values, only `MANUAL` active, set by the server | 13 |
| 12 | Pagination contract | defaults 1/20, max 100, invalid values rejected | 25 |
| 13 | API response contract | `data`/`meta` envelope, error contract with optional `code` | 25, 27 |
| 14 | Status-history timing | table and writes from V1, transactional | 11.4, 28 |
| 15 | RLS strategy | enabled on all tables, no policies | 18.1 |
| 16 | Deletion strategy | see the table in section 43 | 43 |
| 17 | Admin privacy rules | metadata and aggregates only | 17, 23 |
| 18 | Company deletion behavior | refused while referenced (`409`) | 28 |
| 19 | Environment variable set | see section 39 | 39 |

---

# 52. Technical definition of done

A V1 backend is ready when:

- NestJS starts successfully;
- database migrations work;
- authentication works;
- role checks work;
- ownership checks work;
- application/company CRUD works;
- validation works;
- status changes are recorded transactionally in the status history;
- dashboard aggregation works;
- admin endpoints are protected;
- admin safeguards work (no self-modification, never zero active ADMIN);
- audit events work for sensitive actions;
- RLS is enabled on all application tables and verified with the `publishable key` key;
- `GET /api/health` works;
- tests pass;
- Swagger is available;
- production configuration is documented.

A V1 frontend is ready when:

- authentication flow works;
- protected routes work;
- application CRUD works;
- company selection works;
- search/filter/sort/pagination work;
- Kanban works, with correct per-column totals and "load more";
- dashboard works;
- admin pages work;
- suspended accounts are handled;
- loading/empty/error states work;
- responsive layout works;
- build passes.

---

# 53. Forbidden shortcuts

Do not:

- connect React directly to PostgreSQL;
- expose service-role credentials;
- trust frontend roles;
- read the role or the account status from the token;
- query private records by ID alone;
- hard-code dashboard statistics;
- bypass DTO validation;
- change an application status outside the status endpoint;
- write a status change without its history entry in the same transaction;
- modify or delete audit entries;
- silently disable authorization;
- introduce microservices without a real need;
- introduce Redis without a real need;
- add Docker solely for appearance;
- add AI before the core product is stable.
