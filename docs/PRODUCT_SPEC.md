# JobTrack — Product Specification

**Version:** 3.1  
**Status:** Consolidated source of truth  
**Project:** JobTrack

> This document replaces the previous Product Specification versions. It consolidates the functional detail of the original specification with the roles, administration, security boundaries and roadmap introduced later.
>
> **Revision 3.1:** integrates the product decisions locked during Step 0 (specification lock). The complete decision log is in `JOBTRACK_MASTER_SPEC.md`, Appendix A. Sections that changed in this revision: 4.2, 6, 8, 9.7, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 26, 28.

---

# 1. Product overview

## 1.1 Definition

JobTrack is a web application that allows job seekers to centralize, organize and track their job applications from one interface.

## 1.2 Problem

A job search usually involves LinkedIn, job boards, company career pages, emails, notes and spreadsheets. As the number of applications grows, candidates can lose track of:

- where they applied;
- which position they applied for;
- when they applied;
- the current status;
- interview dates;
- companies that responded;
- follow-ups that need to be made;
- applications that were rejected or resulted in an offer.

## 1.3 Value proposition

> JobTrack gives candidates a single source of truth for their job search.

## 1.4 Target users

Initial target:

- developers;
- students and recent graduates;
- professionals looking for a new position;
- people changing companies or careers;
- candidates managing many applications simultaneously.

The product remains generic enough for any job seeker.

## 1.5 What JobTrack is not

JobTrack is not:

- a job board;
- a LinkedIn clone;
- a recruiter ATS;
- a recruitment marketplace;
- an automatic application bot;
- a scraping platform;
- a collaboration platform;
- an AI agent that applies to jobs automatically.

---

# 2. Product principles

## 2.1 Simplicity

V1 must solve the central problem without unnecessary complexity.

## 2.2 Clarity

The user must understand what each action does without training.

## 2.3 Reliability

Displayed information must correspond to persisted data.

## 2.4 Security

A user must never access another user's private data.

## 2.5 Evolvability

The V1 domain model must allow future features without a complete rewrite.

## 2.6 No over-engineering

A technology or feature is introduced only when a real product or technical need exists.

## 2.7 Low initial operating cost

The first production version is designed around the selected free/low-cost services.

---

# 3. Long-term vision

JobTrack should progressively evolve from an application tracker into a personal job-search assistant.

```text
Applications
     ↓
Companies
     ↓
Interviews
     ↓
Notes / Follow-ups
     ↓
Documents
     ↓
Analytics
     ↓
Import / Export
     ↓
Calendar / Email integrations
     ↓
Automation
     ↓
AI assistance
```

The roadmap is progressive. Future features must not unnecessarily complicate V1.

---

# 4. Roles and access model

## 4.1 USER

A normal candidate can:

- manage their own account;
- manage their own companies;
- create applications;
- view their applications;
- edit their applications;
- delete their applications;
- change application status;
- search/filter/sort their applications;
- use the dashboard;
- use the Kanban view.

A USER cannot:

- access another user's applications;
- access another user's companies;
- access admin endpoints;
- manage platform users;
- access audit logs.

## 4.2 ADMIN

An administrator manages the platform within explicitly defined permissions.

V1 admin capabilities:

- view platform-level statistics;
- search users by email or display name;
- view basic user/account information;
- change user role when authorized;
- suspend/reactivate accounts;
- inspect audit information.

### Important privacy rule

An ADMIN does not automatically receive unrestricted access to candidate content.

If a future support feature requires access to private application data, that access must be:

1. explicitly authorized;
2. limited to the required resource;
3. auditable;
4. documented in the privacy/security rules.

### Administrative safeguards

- An admin cannot change their own role or their own account status.
- The platform can never be left without an active ADMIN: a demotion or a suspension that would remove the last active admin is refused.
- The first admin is promoted manually, outside the application, through a documented procedure.

---

# 5. V1 functional scope

V1 is the first complete, usable and deployable product.

It contains:

1. authentication;
2. user account/profile foundation;
3. companies;
4. applications;
5. statuses;
6. search;
7. filters;
8. sorting;
9. pagination;
10. Kanban;
11. dashboard;
12. admin area;
13. authorization and ownership;
14. audit foundation;
15. responsive UI;
16. API documentation;
17. automated tests;
18. CI/CD and deployment.

---

# 6. Authentication

Authentication is provided by Supabase Auth.

## 6.1 User actions

- register;
- confirm their email address (required in production);
- login;
- logout;
- maintain a session;
- access protected pages.

After confirming their email, the user is redirected to `/login` with an explanatory message.

Password reset is not part of V1 (see section 26). It is documented as a known limitation.

## 6.2 Authentication principle

Supabase Auth is the identity source.

JobTrack's backend uses the authenticated identity to determine:

- who is making the request;
- which user owns the data;
- whether the user has the ADMIN role;
- whether the account is active or suspended.

The application user record is created automatically on the user's first authenticated request. It stores the user's email, copied from the verified identity. The email is not editable in JobTrack.

The frontend must never be treated as the security boundary.

---

# 7. Dashboard

The dashboard is the main authenticated landing page.

## 7.1 Required information

At minimum:

- total applications;
- count of `APPLIED`;
- count of `SCREENING`;
- count of `INTERVIEW`;
- count of `OFFER`;
- count of `REJECTED`.

Recommended V1 convenience information:

- recent applications;
- quick link to applications;
- quick action to create an application.

## 7.2 Data rule

All statistics must come from real persisted data.

No hard-coded statistics are allowed.

## 7.3 UI states

The dashboard must support:

- loading;
- success;
- empty;
- error.

---

# 8. Company management

Companies are reusable user-owned entities.

A user can associate multiple applications with the same company.

## 8.1 V1 company fields

- ID;
- user ID;
- name;
- website;
- location;
- creation timestamp;
- update timestamp.

## 8.2 User capabilities

A USER can:

- create a company;
- list their companies;
- view a company;
- edit a company;
- delete a company, only when no application references it. Otherwise the deletion is refused with a clear message.

## 8.3 Ownership

A company belongs to one user in V1.

The same company name may exist independently for different users.

Within one user, company names are unique, compared case-insensitively. Creating a duplicate is refused with a message that suggests reusing the existing company.

A future global company directory may be introduced without changing the personal ownership model.

---

# 9. Application management

The application is the central business entity.

## 9.1 User workflow

V1 is intentionally manual:

```text
Find job externally
      ↓
Apply externally
      ↓
Open JobTrack
      ↓
Add application
      ↓
Fill form
      ↓
Save
      ↓
Application appears in dashboard/list/Kanban
```

JobTrack does not automatically apply to jobs.

## 9.2 Application fields

### Required/core

- company;
- position;
- contract type;
- application date;
- status.

### Optional

- location;
- work mode;
- job URL;
- salary amount;
- salary currency;
- notes;
- priority;
- next follow-up date;
- other fields explicitly marked optional by the final UI.

### System fields

- ID;
- user ID;
- company ID;
- source;
- created timestamp;
- updated timestamp.

## 9.3 Contract types

```text
FULL_TIME
PART_TIME
CONTRACT
INTERNSHIP
FREELANCE
OTHER
```

## 9.4 Work modes

```text
REMOTE
HYBRID
ONSITE
OTHER
```

## 9.5 Priority

```text
LOW
NORMAL
HIGH
```

## 9.6 Source

V1:

```text
MANUAL
```

Future sources:

```text
CSV_IMPORT
URL_CAPTURE
EMAIL
BROWSER_EXTENSION
API
```

The source field exists so future imports do not require redesigning the application model.

## 9.7 Field rules

- **Application date:** a date without time. It cannot be in the future.
- **Next follow-up date:** optional, a date. It cannot be earlier than the application date.
- **Salary:** an optional amount (never negative) together with a currency code of 3 uppercase letters. Both are provided or both are empty. The salary period (monthly or annual) is not modeled in V1: the user can mention it in the notes.
- **Priority:** always has a value, `NORMAL` by default.
- **URLs** (job URL, company website): only `http` and `https` addresses are accepted.
- **Notes:** plain text, displayed as is.
- **Maximum lengths:**

| Field | Maximum |
|---|---|
| Display name | 100 |
| Company name | 150 |
| Position | 150 |
| Location (company and application) | 150 |
| Job URL, company website | 2048 |
| Notes | 5000 |
| Search text | 100 |

---

# 10. Application CRUD

## 10.1 Create

A USER can create an application belonging to their account.

Validation must reject:

- missing required fields;
- invalid enum values;
- invalid URLs;
- invalid dates;
- values exceeding defined length limits.

## 10.2 Read

A USER can:

- view their application list;
- view one application;
- see its company and core details.

## 10.3 Update

A USER can modify:

- application information;
- priority;
- notes;
- status;
- other editable fields.

The status is changed through the dedicated status change described in section 12, not through the general update.

## 10.4 Delete

A USER can delete an application they own.

Deletion must never affect another user's data.

---

# 11. Application statuses

V1 statuses:

```text
APPLIED
SCREENING
INTERVIEW
OFFER
REJECTED
```

## 11.1 APPLIED

The candidate has submitted the application.

## 11.2 SCREENING

The company has acknowledged, contacted or initially screened the candidate.

## 11.3 INTERVIEW

An interview has been scheduled or the interview process is active.

## 11.4 OFFER

The candidate has received an offer.

## 11.5 REJECTED

The application was rejected or closed negatively.

Only defined enum values may be stored.

---

# 12. Status changes

Status can be changed:

- from the application detail/edit experience;
- from the Kanban interface.

Both use the dedicated backend status endpoint. When the status field is changed in the edit form, the form saves the other fields and calls the status endpoint for the status. The general application update does not accept a status value.

Rules:

- the backend validates the new status;
- any status can be changed to any other status. There is no mandatory order, because real job searches are not linear (an offer can arrive without an interview, a rejected application can be reopened);
- requesting the status the application already has is rejected with a conflict (`409`) and nothing is recorded;
- the current status remains the source of truth on the application;
- every status change is recorded in a status history, as is the initial status at creation. The record is written in the same transaction as the change, so the two can never disagree;
- the history is recorded from V1. Its display is planned for V2, and it supports future analytics.

---

# 13. Kanban

The V1 Kanban contains:

```text
APPLIED | SCREENING | INTERVIEW | OFFER | REJECTED
```

Each application appears in the column corresponding to its current status.

Data loading:

- the Kanban reuses the applications list endpoint, with one request per column;
- each column displays its own total, as returned by the server;
- when a column holds more applications than were loaded, it offers a "load more" action;
- the search and filters of the list can apply to the Kanban as well, since they are the same parameters.

V1 may implement:

- explicit status-change actions;
- drag-and-drop if it can be implemented without delaying the MVP.

Drag-and-drop is an interaction mechanism, not a separate business rule. Dropping a card into its own column does nothing.

---

# 14. Search

The application list must provide search.

Minimum search fields:

- company name;
- position/title.

Behavior:

- partial match, case-insensitive;
- the text is trimmed and limited to 100 characters;
- an empty search is ignored.

Search is performed server-side so that the design remains usable as data grows.

---

# 15. Filters

V1 filters:

- status;
- contract type;
- location;
- work mode;
- priority.

Filters can be combined.

The location filter is a partial, case-insensitive match, because location is free text (for example "Kinshasa" also finds "Kinshasa, DRC").

Example:

```text
Status = INTERVIEW
Contract = FULL_TIME
Work mode = REMOTE
Priority = HIGH
```

---

# 16. Sorting

V1 sorting, with a controlled list of two values:

- application date descending (default);
- application date ascending.

Applications with the same date keep a stable order across pages.

The API may later support:

- company;
- position;
- status;
- priority;
- created date;
- updated date.

Sorting must be implemented through controlled server-side values rather than arbitrary database expressions.

---

# 17. Pagination

Application lists use server-side pagination.

Values:

```text
page = 1 (default, minimum 1)
limit = 20 (default, maximum 100)
```

The API returns:

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

Invalid values are rejected rather than silently corrected. Asking for a page beyond the last one returns an empty list.

The frontend must provide a usable pagination experience when the result set requires it.

---

# 18. Application routes/pages

Public:

```text
/login
/register
```

USER:

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

Settings remain minimal in V1 and should only contain functionality that is actually implemented.

---

# 19. Application UI requirements

The interface should be:

- modern;
- clear;
- responsive;
- coherent;
- accessible as far as reasonably possible;
- consistent in actions, forms, tables/cards and feedback.

Every asynchronous page must support:

### Loading

Show that data is being retrieved.

### Empty

Explain that there is no data and provide an appropriate next action.

Example:

> You don't have any applications yet. Add your first application.

### Error

Display a comprehensible message and allow retry where appropriate.

### Success

Show the real persisted result and clear feedback after important actions.

### Slow first response

The first request after a period of inactivity can be slow, because free hosting services go to sleep. The interface shows a clear loading state and retries before displaying an error.

---

# 20. Admin area

The admin area is part of V1.

## 20.1 Admin dashboard

Required platform-level information:

- total registered users;
- active users;
- suspended users;
- new users during a selected period (7, 30 or 90 days, 30 by default);
- total applications;
- applications created during a selected period (same choices);
- application distribution by status.

These metrics are platform aggregates and must not expose candidate content unnecessarily.

## 20.2 User management

Admin can, according to authorization:

- search users by email or display name;
- filter users where useful;
- view basic account information;
- view account status;
- view role;
- change role;
- suspend an account;
- reactivate an account.

Every sensitive action must have confirmation and must be audited.

The safeguards of section 4.2 apply: an admin cannot act on their own role or status, and the last active admin cannot be demoted or suspended. Applying a role or a status the user already has is refused as a conflict.

## 20.3 Admin user detail

The initial admin user detail page should focus on account/support metadata, not unrestricted access to private candidate data.

---

# 21. Roles and account status

Roles:

```text
USER
ADMIN
```

Account status:

```text
ACTIVE
SUSPENDED
```

A suspended account cannot use any protected functionality, user or admin. The account status is checked in the application database on every request, so a suspension takes effect immediately, even if the person is still signed in.

When a signed-in person is suspended, the interface signs them out and displays an explicit message. The technical mechanism is defined in `TECHNICAL_SPEC.md`, section 6.

---

# 22. Audit

Sensitive administrative events must be auditable.

Minimum event information:

- actor;
- action;
- resource type;
- resource ID;
- timestamp;
- limited contextual metadata.

V1 events (a controlled list):

```text
ROLE_CHANGED
USER_SUSPENDED
USER_REACTIVATED
```

Other events (for example `ADMIN_DATA_ACCESS`, `USER_DELETED`) are added together with the feature that produces them.

Rules:

- the audit log is append-only: no edit, no deletion;
- the event is recorded in the same transaction as the action it describes;
- metadata is limited to the previous and the new value (for example role `USER` → `ADMIN`). It never contains emails or candidate content;
- admins can browse the log, newest first, filtered by action or by actor.

Normal users cannot access audit logs.

Audit metadata must not contain unnecessary private candidate information.

---

# 23. V2 — Productivity

V2 expands JobTrack from a tracker into a more complete job-search workspace.

## 23.1 Interviews

An interview belongs to an application.

Capabilities:

- create interview;
- edit interview;
- delete interview;
- date and time;
- timezone;
- interview type;
- meeting URL;
- physical location;
- interviewer name;
- preparation notes;
- result.

Potential interview types:

```text
PHONE
VIDEO
ONSITE
TECHNICAL
HR
OTHER
```

The exact enum can be finalized when V2 is implemented.

## 23.2 Rich notes

Notes can support:

- preparation;
- interview notes;
- company research;
- follow-up notes;
- structured history.

Notes should remain associated with the correct user/application.

## 23.3 Status history UI

The backend model can record transitions.

The UI can display:

```text
Applied
  ↓
Screening
  ↓
Interview
  ↓
Offer
```

with dates for each transition.

## 23.4 Documents

Potential documents:

- CV;
- cover letter;
- portfolio document;
- supporting documents.

Storage is expected to use Supabase Storage.

Documents must remain protected by user/application ownership.

## 23.5 Import

Supported future inputs may include:

- CSV;
- Excel;
- other structured files when justified.

Import must never immediately write untrusted external data.

Required flow:

```text
Input
 ↓
Parse
 ↓
Normalize
 ↓
Validate
 ↓
Detect duplicates
 ↓
Preview
 ↓
User confirmation
 ↓
Persistence
```

## 23.6 Export

Potential exports:

- CSV;
- JSON;
- other formats only when justified.

Export must respect ownership and must never expose another user's data.

## 23.7 Analytics

Examples:

- total applications;
- response rate;
- screening rate;
- interview rate;
- offer rate;
- rejection rate;
- applications over time;
- average response time;
- status distribution;
- performance by source;
- performance by contract type;
- performance by work mode.

Analytics must be derived from persisted facts.

Important distinction:

```text
Current status = current state
Status history = events
Analytics = derived metrics
```

## 23.8 Follow-ups

A future follow-up can contain:

- due date;
- reminder state;
- related application;
- note;
- completion state.

V2 can expose the follow-up date already supported by the application model.

---

# 24. V3 — Automation and integrations

V3 focuses on reducing manual work.

## 24.1 Notifications

Potential notifications:

- follow-up reminder;
- interview reminder;
- application inactivity reminder;
- important status change.

Channels may include:

- in-app;
- email;
- push, if later justified.

## 24.2 Calendar

Potential integrations:

- Google Calendar;
- Outlook Calendar.

Possible actions:

- create calendar event from interview;
- update event;
- synchronize changes;
- link the calendar event to the JobTrack interview.

## 24.3 Email integration

Potential capability:

- detect application-related emails;
- identify companies/applications;
- propose updates;
- record events.

Automation must remain controllable by the user.

Example:

```text
Email received
      ↓
Detection
      ↓
Candidate/application match
      ↓
Suggested update
      ↓
User confirmation
      ↓
Persistence
```

## 24.4 URL capture

A future user can paste a job URL.

The system may extract:

- company;
- position;
- location;
- job URL;
- description metadata.

The user sees a preview before persistence.

## 24.5 Browser extension

A future browser extension may send job information to JobTrack.

The extension must use authenticated, authorized API access.

## 24.6 External APIs

Integrations should be isolated behind explicit integration modules.

---

# 25. V4 — AI assistance

AI is intentionally delayed until the core product is stable.

Potential capabilities:

- summarize job descriptions;
- analyze job requirements;
- compare CV and job description;
- suggest CV improvements;
- generate cover-letter drafts;
- prepare interview questions;
- generate interview preparation plans;
- provide personalized job-search insights;
- extract structured information from job descriptions.

AI is an assistant.

It must not silently modify important user data or send consequential external actions without explicit user confirmation.

---

# 26. Explicit V1 non-goals

The following are not V1 requirements:

- Gmail integration;
- Google Calendar integration;
- Outlook Calendar integration;
- automatic job capture;
- LinkedIn import;
- automatic job-board scraping;
- AI;
- automatic cover-letter generation;
- CV analysis;
- advanced document management;
- automatic notifications;
- recruiter workspace;
- collaboration;
- marketplace;
- payments;
- subscriptions;
- native mobile application;
- microservices;
- Redis;
- GraphQL;
- WebSockets;
- Kubernetes;
- mandatory Docker;
- password reset flow (documented known limitation);
- user account deletion.

These may be future features, not forgotten features.

---

# 27. Product roadmap

```text
V1 — Foundation
├── Auth
├── Users / roles
├── Companies
├── Applications CRUD
├── Status
├── Search
├── Filters
├── Sort
├── Pagination
├── Kanban
├── Dashboard
├── Admin
├── Audit foundation
├── Tests
├── Swagger
└── Deployment

        ↓

V2 — Productivity
├── Interviews
├── Notes
├── Status history UI
├── Documents
├── Import
├── Export
├── Analytics
└── Follow-ups

        ↓

V3 — Automation
├── Notifications
├── Calendar
├── Email
├── URL capture
├── Browser extension
├── External integrations
└── Automated import pipeline

        ↓

V4 — Intelligence
├── Job analysis
├── CV/job matching
├── Cover-letter assistance
├── Interview preparation
└── Personalized insights
```

---

# 28. V1 acceptance criteria

V1 is complete when:

- a user can register;
- a user can log in and maintain a session;
- protected routes are protected;
- a user can create a company;
- a user can create an application;
- a user can view their applications;
- a user can view an application detail;
- a user can edit an application;
- a user can delete an application;
- a user can change status;
- a user can search;
- a user can filter;
- a user can sort;
- pagination works;
- Kanban works;
- dashboard statistics reflect real data;
- user data is isolated;
- admin routes are protected;
- admin platform metrics work;
- authorized admin role/status actions work;
- sensitive admin actions are audited;
- a suspended account is blocked on every protected route and the person is informed;
- the platform can never be left without an active administrator;
- the initial status and every status change are recorded in the status history;
- Kanban columns display correct totals and can load more applications;
- loading/empty/error/success states exist;
- responsive behavior is acceptable;
- backend validation exists;
- critical tests exist;
- Swagger documents the API;
- CI passes;
- frontend and backend are deployed;
- documentation matches the implementation.

---

# 29. Priority rule

When a new idea conflicts with V1 scope, prioritize:

1. security;
2. core functionality;
3. data integrity;
4. reliability;
5. user experience;
6. tests;
7. documentation;
8. secondary features.

A feature must not be added to V1 if it threatens delivery of the core product.
