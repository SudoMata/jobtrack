# JobTrack — Master Specification

**Version:** 3.1  
**Status:** Definitive project source of truth

> This document is the operational contract between the Product Specification and the Technical Specification. It summarizes the complete system, the implementation order, the rules that must not be contradicted, and the definition of done.
>
> **Revision 3.1:** integrates the decisions locked during Step 0 (specification lock). The complete decision log is in Appendix A and the known V1 limitations are in Appendix B. The three documents are all at version 3.1.

---

# 1. Project identity

**Name:** JobTrack

**Purpose:** Centralize and track a candidate's job applications.

**Primary value:** Give the candidate one reliable place to understand the state of their job search.

---

# 2. Source-of-truth documents

The project uses exactly three specification documents:

```text
docs/
├── PRODUCT_SPEC.md
├── TECHNICAL_SPEC.md
└── JOBTRACK_MASTER_SPEC.md
```

They are the current consolidated versions.

The previous 1.0 and 2.0 documents are historical material and should not be used as active specifications.

## Responsibility of each document

### PRODUCT_SPEC.md

Defines:

- what JobTrack does;
- who uses it;
- functional requirements;
- UX expectations;
- V1 scope;
- V2/V3/V4 roadmap;
- acceptance criteria.

### TECHNICAL_SPEC.md

Defines:

- technologies;
- architecture;
- database;
- authentication;
- authorization;
- API;
- security;
- tests;
- deployment;
- technical constraints.

### JOBTRACK_MASTER_SPEC.md

Defines:

- how product and technical rules fit together;
- implementation order;
- locked decisions;
- project invariants;
- Definition of Done;
- rules for changing the specification.

---

# 3. System vision

```text
                   JOBTRACK
                      |
        +-------------+-------------+
        |                           |
   Job tracking                Job-search insight
        |                           |
 Applications                  Analytics
 Companies                     Reports
 Interviews                    Metrics
 Documents                     Insights
 Follow-ups
        |
 Notifications
        |
 Integrations
        |
 Automation
        |
 AI assistance
```

The product evolves progressively.

V1 must not attempt to implement the entire vision.

---

# 4. V1 system scope

```text
Authentication
      ↓
User profile / roles
      ↓
Companies
      ↓
Applications
      ↓
Status
      ↓
Search / Filters / Sort / Pagination
      ↓
Dashboard
      ↓
Kanban
      ↓
Admin
      ↓
Audit
      ↓
Tests / Swagger / CI / Deployment
```

---

# 5. V1 user journey

```text
Register
   ↓
Login
   ↓
Dashboard
   ↓
Add application
   ↓
Select/create company
   ↓
Enter job information
   ↓
Save
   ↓
Applications list
   ↓
Search / Filter / Sort
   ↓
Open detail
   ↓
Edit / change status
   ↓
Kanban
```

The workflow is intentionally manual.

The user applies to the job externally and then records it in JobTrack.

---

# 6. V1 admin journey

```text
Admin login
     ↓
Admin dashboard
     ↓
Platform statistics
     ↓
Users
     ↓
Search / inspect account
     ↓
Authorized role/status action
     ↓
Audit event
```

Admin functionality is platform management, not unrestricted candidate-data access.

---

# 7. Core entities

```text
User
 ├── Company
 │
 └── Application
       └── ApplicationStatusHistory
```

Future:

```text
Application
 ├── Interview
 ├── Note
 ├── Document
 ├── FollowUp
 └── Contact
```

Platform:

```text
AuditLog
Notification
ImportJob
Integration
FeatureFlag
```

Only entities required by an implemented feature should be added to the database.

---

# 8. Core business rules

## Rule 1 — Ownership

Every private user resource belongs to one user.

```text
Authenticated user ≠ resource owner
→ access denied
```

## Rule 2 — Backend authorization

Frontend restrictions are UX only.

The NestJS backend is the authority.

## Rule 3 — Valid enums

Statuses, roles, contract types, work modes, priorities and sources are controlled values.

## Rule 4 — Real data

Dashboard and analytics must use persisted data.

## Rule 5 — No hidden automation

V1 manual entry must remain manual.

## Rule 6 — Admin privacy

Admin does not automatically equal unrestricted candidate-data access.

## Rule 7 — Audit sensitive administration

Sensitive admin actions create audit events.

## Rule 8 — Documentation follows architecture

If an implementation decision changes, the specifications must be updated.

## Rule 9 — Single status path

An application status changes only through the dedicated status endpoint, and every change (and the initial status) is recorded in the status history in the same transaction.

## Rule 10 — Administrative continuity

No operation may leave the platform without an active ADMIN, and an admin cannot change their own role or status.

## Rule 11 — Opaque access denial

A resource that does not exist and a resource owned by another user are reported identically (`404`).

---

# 9. V1 data model summary

## User

```text
id (same as the Supabase Auth user id)
email (unique, copied from the token, read-only)
role
account_status
display_name (optional)
created_at
updated_at
```

## Company

```text
id
user_id
name (unique per user, case-insensitive)
website
location
created_at
updated_at
```

## Application

```text
id
user_id
company_id
position
contract_type
location
work_mode
job_url
applied_at (date, not in the future)
status
salary_amount (NUMERIC)
salary_currency
notes
source
priority (default NORMAL)
next_follow_up_at (date)
created_at
updated_at
```

## Status history

```text
id
application_id
from_status (NULL for the initial entry)
to_status
changed_by_user_id
changed_at
```

## Audit

```text
id
actor_user_id
action (ROLE_CHANGED | USER_SUSPENDED | USER_REACTIVATED)
resource_type (USER)
resource_id
metadata (previous and new value only)
created_at
```

Field types, lengths and constraints are defined in `TECHNICAL_SPEC.md`, sections 11 and 14.

---

# 10. V1 enums

```text
Role:
USER
ADMIN

Account status:
ACTIVE
SUSPENDED

Application status:
APPLIED
SCREENING
INTERVIEW
OFFER
REJECTED

Contract:
FULL_TIME
PART_TIME
CONTRACT
INTERNSHIP
FREELANCE
OTHER

Work mode:
REMOTE
HYBRID
ONSITE
OTHER

Priority:
LOW
NORMAL
HIGH

Source:
MANUAL
CSV_IMPORT
URL_CAPTURE
EMAIL
BROWSER_EXTENSION
API
```

Only `MANUAL` is active as an input source in V1.

```text
Audit action (V1):
ROLE_CHANGED
USER_SUSPENDED
USER_REACTIVATED

Audit resource type (V1):
USER
```

---

# 11. V1 API map

## Technical

```text
GET    /api/health
```

Unauthenticated, returns only a static status.

## User-facing

```text
GET    /api/applications
POST   /api/applications
GET    /api/applications/:id
PATCH  /api/applications/:id
DELETE /api/applications/:id
PATCH  /api/applications/:id/status

GET    /api/companies
POST   /api/companies
GET    /api/companies/:id
PATCH  /api/companies/:id
DELETE /api/companies/:id

GET    /api/dashboard/stats
```

## Admin

```text
GET   /api/admin/stats?period=7d|30d|90d
GET   /api/admin/users
GET   /api/admin/users/:id
PATCH /api/admin/users/:id/role
PATCH /api/admin/users/:id/status
GET   /api/admin/audit-logs
```

There is no dedicated Kanban endpoint: the Kanban uses `GET /api/applications` with one request per status.

---

# 12. V1 frontend routes

Public:

```text
/login
/register
```

User:

```text
/dashboard
/applications
/applications/new
/applications/:id
/applications/:id/edit
/settings
```

Admin:

```text
/admin
/admin/users
/admin/users/:id
/admin/audit-logs
```

---

# 13. Search/filter contract

Application search:

```text
company
position
```

Partial, case-insensitive, trimmed, maximum 100 characters, empty ignored.

Filters (combined with AND):

```text
status
contractType
location (partial, case-insensitive)
workMode
priority
```

Sorting (whitelist, stable order across pages):

```text
appliedAt_desc (default)
appliedAt_asc
```

Pagination:

```text
page  (default 1, minimum 1)
limit (default 20, maximum 100)
```

Response: `{ data, meta: { page, limit, total, totalPages } }`.

Invalid values are rejected with `400`. A page beyond `totalPages` returns `200` with an empty list.

The server remains responsible for validation and controlled query construction.

---

# 14. Security model

Every private request follows the conceptual chain:

```text
Request
  ↓
JWT (verified locally)
  ↓
Authentication
  ↓
Application user (created on first use)
  ↓
Account status (database)
  ↓
Role (database)
  ↓
Ownership
  ↓
Validation
  ↓
Business rules
  ↓
Database
```

Admin:

```text
Request
  ↓
JWT
  ↓
Authentication
  ↓
Active account (database)
  ↓
ADMIN role (database)
  ↓
Specific permission
  ↓
Validation
  ↓
Safeguards (no self-modification, never zero active ADMIN)
  ↓
Business action + Audit (one transaction)
```

Additional rules:

- the role and the account status are never read from the token;
- a suspended account receives `403` with the code `ACCOUNT_SUSPENDED` on every protected route;
- a resource that does not exist or belongs to another user returns `404`;
- RLS is enabled on every table with no policies (defense in depth). NestJS remains the authorization layer;
- the only public endpoint is `GET /api/health`.

---

# 15. Privacy model

Default permissions:

| Resource | USER | ADMIN |
|---|---|---|
| Own profile | Yes | Platform account management |
| Own companies | Yes | No unrestricted access |
| Own applications | Yes | No unrestricted access |
| Platform statistics | No | Yes |
| User account metadata | Own | Authorized support view |
| Audit logs | No | Yes |

If candidate-content access is introduced later, it must be explicit, limited and audited.

---

# 16. Architecture

```text
                    Browser
                       |
                       v
             React + TypeScript
                       |
                    HTTPS
                       |
                       v
                 NestJS REST
             /       |        \
            /        |         \
       AuthGuard   Business   Admin
            \        |         /
             \       |        /
                  Prisma
                     |
                     v
              Supabase/Postgres

Supabase Auth
      |
      └── JWT identity
```

Deployment:

```text
GitHub
  ↓
GitHub Actions
  ↓
Render
 ├── Frontend
 └── Backend

Supabase
 ├── Auth
 ├── PostgreSQL
 └── Storage later
```

---

# 17. Project constraints

V1 intentionally does not require:

- Docker;
- Kubernetes;
- Redis;
- GraphQL;
- WebSockets;
- microservices;
- native mobile application;
- Turborepo, Nx or a shared types package;
- the Supabase service-role key in the backend.

The architecture is allowed to evolve later if real requirements justify it.

---

# 18. Development phases

Each phase ends with a validation before the next one starts. Tests and Swagger annotations are written during each phase, not postponed. Phase 8 completes them.

## Phase 0 — Specification lock

Completed. The product scope, database model, roles, admin privacy, Prisma/Supabase strategy, RLS strategy, deletion behavior, status history and pagination/API contracts were validated.

Deliverable:

> Approved V3.1 specifications and the locked-decision log (Appendix A).

---

## Phase 1 — Repository

Create:

```text
jobtrack/
├── apps/web
├── apps/api
├── docs
└── .github
```

Configure:

- npm workspaces;
- TypeScript (strict, base configuration);
- linting;
- formatting;
- Git;
- Node LTS pinning;
- base scripts;
- minimal CI (install, lint, type check, build).

---

## Phase 2 — Infrastructure

Configure:

- Supabase project;
- PostgreSQL;
- Supabase Auth (email confirmation for production);
- confirm the JWT signing-key type (JWKS or legacy secret);
- check Supabase's default email delivery limits;
- environment variables;
- Prisma with the pooled `DATABASE_URL` and the direct `DIRECT_URL`;
- database migration process, including RLS enablement and the `anon`-key verification.

Do not implement business CRUD before this foundation is stable.

---

## Phase 3 — Security foundation (backend)

Implement:

- application User model (with `email`);
- local JWT verification;
- AuthGuard with lazy, idempotent user provisioning;
- account status check from the database;
- RolesGuard;
- role decorator;
- ownership helpers;
- error contract and single exception filter;
- AuditLog and base audit service;
- rate limiting;
- `GET /api/health`.

Security must exist before application endpoints.

---

## Phase 3b — Authentication frontend

Implement:

- login and register pages;
- email-confirmation message and redirect;
- session handling;
- protected routes;
- API client sending the token;
- base layout;
- suspended-account handling.

---

## Phase 4 — Companies

Implement:

- Company entity;
- migration (RLS, unique name per user, RESTRICT foreign keys);
- DTOs;
- service;
- controller;
- ownership;
- tests;
- frontend company selection/management.

---

## Phase 5 — Applications

Implement:

- Application and status-history entities;
- enums;
- migrations;
- DTOs;
- CRUD;
- status endpoint with transactional history;
- ownership;
- search;
- filters;
- sort;
- pagination;
- tests.

---

## Phase 6a — Applications UX

Implement:

- application list;
- detail;
- create;
- edit;
- delete confirmation;
- loading states;
- empty states;
- error states;
- success feedback.

---

## Phase 6b — Dashboard and Kanban

Implement:

- dashboard endpoint and page;
- Kanban with per-column totals and "load more";
- responsive layout.

---

## Phase 7 — Admin

Implement:

- admin dashboard;
- platform metrics with the `period` choice;
- user list and search;
- user detail;
- role change;
- account status change;
- safeguards (no self-modification, never zero active ADMIN, with row locking);
- confirmation dialogs;
- audit logs;
- admin route protection;
- authorization and concurrency tests.

---

## Phase 8 — Quality and documentation

Implement:

- completion of unit, integration and frontend tests;
- Swagger review;
- complete CI (adds the test step);
- README (setup, first-admin procedure, known limitations, cold starts, environment variables);
- environment documentation.

---

## Phase 9 — Deployment

Deploy:

```text
Supabase
Render API
Render Web
```

Check the current free-plan conditions first. Then verify:

- authentication;
- CORS;
- database connection;
- protected routes;
- user isolation;
- admin access;
- production errors;
- frontend/backend communication;
- the health check;
- behavior after a cold start.

---

# 19. Definition of Done — complete V1

## Product

- [ ] authentication works;
- [ ] user can manage companies;
- [ ] user can manage applications;
- [ ] status works;
- [ ] search works;
- [ ] filters work;
- [ ] sorting works;
- [ ] pagination works;
- [ ] Kanban works, with correct per-column totals and "load more";
- [ ] dashboard works;
- [ ] admin dashboard works;
- [ ] admin user management works;
- [ ] sensitive admin actions are audited;
- [ ] responsive UX works.

## Security

- [ ] JWT validation works;
- [ ] role authorization works;
- [ ] ownership checks work;
- [ ] cross-user access is rejected;
- [ ] normal users cannot access admin routes;
- [ ] suspended accounts are handled correctly;
- [ ] the platform cannot be left without an active ADMIN;
- [ ] RLS is enabled on every table and verified with the `anon` key;
- [ ] no service-role key is used in V1, and no server secret reaches the frontend;
- [ ] production errors are safe.

## Backend

- [ ] NestJS API works;
- [ ] Prisma migrations work;
- [ ] validation works;
- [ ] database constraints exist;
- [ ] Swagger is available;
- [ ] status changes and their history are written transactionally;
- [ ] the health endpoint is available;
- [ ] critical tests pass.

## Frontend

- [ ] React app builds;
- [ ] protected routes work;
- [ ] forms work;
- [ ] API state is handled;
- [ ] loading/empty/error/success states exist;
- [ ] admin UI is protected.

## Delivery

- [ ] GitHub repository is clean;
- [ ] CI passes;
- [ ] frontend deployed;
- [ ] backend deployed;
- [ ] Supabase configured;
- [ ] production environment documented.

---

# 20. V2 implementation contract

When V1 is stable, V2 may add:

```text
Interviews
Notes
Status history UI
Documents
Import
Export
Analytics
Follow-ups
```

No V2 feature should bypass the same ownership and security model.

---

# 21. V3 implementation contract

V3 may add:

```text
Notifications
Calendar
Email
URL capture
Browser extension
External integrations
Import automation
```

External events should normally produce proposed or controlled changes rather than silently changing important candidate data.

---

# 22. V4 implementation contract

V4 may add:

```text
Job analysis
CV/job matching
Cover-letter assistance
Interview preparation
Personalized insights
AI extraction
```

AI actions must be:

- explainable enough for the user;
- reviewable;
- controlled;
- unable to silently perform consequential external actions.

---

# 23. Import contract

Every future import follows:

```text
INPUT
  ↓
PARSE
  ↓
NORMALIZE
  ↓
VALIDATE
  ↓
DUPLICATE DETECTION
  ↓
PREVIEW
  ↓
USER CONFIRMATION
  ↓
PERSIST
```

This applies to:

- CSV;
- Excel;
- URL;
- email;
- browser extension;
- API integrations.

---

# 24. Analytics contract

Analytics must be reproducible from persisted facts.

```text
Current state
    +
Historical events
    +
Dates
    ↓
Derived metrics
```

Do not hard-code statistics.

Do not invent metrics whose underlying data does not exist.

---

# 25. Change-management rule

If a new feature is proposed, evaluate:

1. product value;
2. V1/V2/V3/V4 placement;
3. data model impact;
4. API impact;
5. frontend impact;
6. security impact;
7. testing impact;
8. deployment impact;
9. maintenance cost.

Then update the appropriate specification before implementing a major feature.

---

# 26. Final project rule

The three V3.1 documents are the definitive reference.

If code contradicts the specification:

- determine whether the code or specification is wrong;
- make an explicit decision;
- update the documentation;
- then continue implementation.

Never allow the documentation and implementation to silently diverge.

---

# 27. First implementation milestone

Do not start with application CRUD.

Start with:

```text
Specifications approved
       ↓
Monorepo
       ↓
React + NestJS
       ↓
Supabase
       ↓
Prisma + PostgreSQL
       ↓
Supabase Auth
       ↓
User model
       ↓
Roles / account status
       ↓
AuthGuard
       ↓
Ownership
       ↓
Companies
       ↓
Applications
```

Only after this foundation is validated should the main CRUD workflow be considered complete.

---

# Appendix A — Locked decisions (Step 0)

These decisions were validated during Step 0. They are implementation rules.

## Identity and access

| # | Decision | Reference |
|---|---|---|
| D1 | `User` has a unique `email`, copied from the token and read-only. Enables admin search without the service-role key | Tech 4.3, 11.1 |
| D2 | The application user is created lazily and idempotently in the AuthGuard on the first authenticated call. `ADMIN` is never automatic | Tech 4.3 |
| D3 | Account status is checked in the database on every request. `SUSPENDED` gives `403` with `ACCOUNT_SUSPENDED`. No Supabase ban in V1. The frontend signs the user out | Tech 6 |
| D14 | JWT verified locally with JWKS (expiration, issuer, audience). Legacy HS256 secret only if the project requires it | Tech 4.2 |
| D16 | Email confirmation on in production. Redirect to `/login`. Password reset out of V1 | Tech 4.4, Product 6 |

## Data and API

| # | Decision | Reference |
|---|---|---|
| D4 | Kanban uses `GET /api/applications`, one request per status, `limit` maximum 100, `meta.total` and "load more" per column | Tech 20, Product 13 |
| D5 | Company deletion refused (`409`) while referenced. Foreign key RESTRICT. Company name unique per user, case-insensitive | Tech 14, 28 |
| D6 | Status history from V1. `from_status` NULL at creation. One transaction with the application. Status changes only via `/status`. Same status gives `409`. History deleted with the application | Tech 11.4, 28 |
| D7 | Free status transitions. Same status gives `409` | Product 12 |
| D8 | Pagination default 1/20, maximum 100, invalid values `400`, beyond last page gives an empty list. `sort` whitelist `appliedAt_desc`/`appliedAt_asc` with stable tie-breakers. `400` for validation (no `422`), `404` for missing or not owned, `409` for conflicts, `429` for rate limits | Tech 20, 25, 27 |
| D9 | `applied_at` and `next_follow_up_at` are dates. `applied_at` not in the future. `NUMERIC` salary with a currency (both or none, no period). Priority default `NORMAL`. Partial case-insensitive `location` filter. `http`/`https` URLs only. Plain-text notes. Maximum lengths defined | Tech 11, 26 |

## Administration and audit

| # | Decision | Reference |
|---|---|---|
| D10 | `GET /api/admin/stats` with `period` set to `7d`, `30d` or `90d`, default `30d`, rolling UTC window. The period applies only to new users and created applications | Tech 24 |
| D11 | First admin promoted manually, not audited, no automatic promotion. No self-modification (`403`). The platform can never reach zero active ADMIN: transactional check with row locking (`409`). Change and audit written in one transaction | Tech 16 |
| D12 | Three audit events in V1: `ROLE_CHANGED`, `USER_SUSPENDED`, `USER_REACTIVATED`. Enums for action and resource type. Append-only. Paginated log with `action` and `actorUserId` filters | Tech 13, 42 |

## Infrastructure and delivery

| # | Decision | Reference |
|---|---|---|
| D13 | RLS enabled on every table, no policies. Added in each migration. Manual `anon`-key verification | Tech 18.1 |
| D15 | Pooled `DATABASE_URL` (transaction mode) for the API, `DIRECT_URL` for migrations. No service-role key in V1 | Tech 18.2, 39 |
| D17 | npm workspaces. No Turborepo, no Nx, no shared types package. Base `tsconfig`, root ESLint and Prettier, Node LTS pinned | Tech 7 |
| D18 | NestJS throttling in memory, no Redis. Stricter on admin writes. Trust the proxy behind Render. Supabase Auth limits cover authentication | Tech 41 |
| D19 | Free-tier cold starts accepted and documented. Frontend loading state, timeout and retries. No keep-alive ping. `GET /api/health` added | Tech 19, 33, 47 |
| D20 | Deletion strategy: applications hard-deleted with their history, companies refused while referenced, users never deleted in V1, audit never deleted | Tech 43 |

## Plan adjustments

| # | Adjustment |
|---|---|
| P1 | Minimal CI from Phase 1 (lint, type check, build), tests added from Phase 3, complete in Phase 8 |
| P2 | Phase 3b added: authentication frontend |
| P3 | Phase 6 split into 6a (applications UX) and 6b (dashboard and Kanban) |
| P4 | Tests and Swagger annotations written during each phase |

---

# Appendix B — Known V1 limitations

- No password reset flow.
- No Supabase-side ban for suspended accounts. The database check is the enforcement.
- The first admin promotion is outside the API and not audited.
- Two admins acting at the very same time are protected by the transactional check. A platform left without an admin by an external manual change is fixed with the manual promotion procedure.
- The salary period (monthly or annual) is not modeled.
- Rate limiting is in memory and consistent only with a single API instance. Authentication requests are limited by Supabase Auth, not by JobTrack.
- Free-tier services can make the first request slow after inactivity.
