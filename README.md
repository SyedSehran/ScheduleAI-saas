# ScheduleAI — Multi-Tenant Academic Scheduling SaaS

**ScheduleAI** is a multi-tenant academic timetable SaaS platform built for educational institutions. Colleges sign up as isolated tenants to manage faculty, room capacity, sections, and automated timetable generation with strict data isolation, role-based access control (RBAC), and monthly usage metering.

---

## 🏗️ Architecture & Request Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend (React/Vite)
    participant RateLimiter as Rate Limiter (express-rate-limit)
    participant AuthMiddleware as Auth Middleware (JWT)
    participant ScopingPlugin as Tenant Scoper (tenantId)
    participant Controller as Express Controller
    participant DB as MongoDB (Mongoose)

    Client->>RateLimiter: HTTP Request (POST /api/auth/login or /api/timetables)
    RateLimiter->>AuthMiddleware: Verify Rate Limits
    AuthMiddleware->>AuthMiddleware: Validate JWT & Extract tenantId, userId, role
    AuthMiddleware->>ScopingPlugin: Pass Request Context (req.tenantId)
    ScopingPlugin->>Controller: Enforce Tenant-Scoped Filter ({ tenantId, ...query })
    Controller->>DB: Query Database (Guaranteed Isolated Tenant Context)
    DB-->>Controller: Return Tenant Data Only
    Controller-->>Client: 200 OK Response (JSON Data)
```

---

## Key Features

- **End-to-End JWT Authentication**: The React frontend signs users in against the API (`/auth/login`, `/auth/signup`), persists the session, attaches the token via an axios interceptor, and renders role-aware navigation — the same RBAC rules are enforced on both client and server.
- **Strict Multi-Tenant Isolation**: Compound database indexing and query-scoping middleware enforce `tenantId` boundaries on all Mongoose models (`User`, `Faculty`, `Room`, `Section`, `Timetable`, `UsageLog`, `Invitation`).
- **Role-Based Access Control (RBAC)**: JWT tokens carry `{ userId, tenantId, role }`. Owners/admins generate and publish timetables; faculty/students get read-only views of published schedules.
- **Institution Onboarding & Email Invitations**: Institution signup creates a new isolated `Tenant` and makes the signer-up its `owner`. Owners/admins can invite team members with expiring invitation tokens and role assignment — directly from the dashboard UI.
- **Publish Workflow**: Admins generate a schedule with the solver, then "Publish to institution" stores it as a tenant `Timetable` document that faculty and students see instantly on login.
- **Monthly Usage Metering**: Monthly timetable generation limits (Free: 3/mo, Pro: 100/mo, Enterprise: 1000/mo) tracked via a `UsageLog` collection. Returns clean HTTP 403 Forbidden payloads (`canUpgrade: true`) when limits are reached.
- **Hybrid Constraint Solver**: Backtracking (with MRV/LCV ordering) + simulated-annealing improver handling room capacity, section overlaps, teacher availability, lab sessions, and lunch-break protection.
- **Teacher Absence Auto-Cover**: Mark one teacher absent for one day; the system assigns qualified free substitutes period-by-period based on subject similarity.
- **Security & Rate Limiting**: bcrypt password hashing (12 rounds), express-rate-limit on auth endpoints, security headers, JSON body limits, and graceful shutdown.
- **Automated Testing & CI/CD**: Self-contained test suite (Node Test Runner + Supertest + in-memory MongoDB — zero local setup), tenant-isolation tests, a 30-request concurrent load benchmark with structured metrics, RBAC and usage-metering regression tests, plus GitHub Actions CI running backend tests and a frontend lint+build job.

---

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Axios, Lucide Icons, jsPDF, XLSX
- **Backend**: Node.js, Express 5, MongoDB, Mongoose 9, JWT, bcryptjs, express-rate-limit
- **Testing**: Node Test Runner, Supertest, MongoDB Memory Server
- **DevOps**: Docker, Docker Compose, GitHub Actions

---

## Data Model & Tenant Isolation Architecture

Every tenant-owned document inherits the `tenantId` field via a reusable Mongoose plugin:

```text
               ┌────────────────────────┐
               │    Tenant Document     │
               │ (id, name, slug, plan) │
               └───────────┬────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌─────────────────┐
│ User Schema  │   │ Room Schema  │   │ Timetable Model │
│ (tenantId,   │   │ (tenantId,   │   │ (tenantId,      │
│  email, role)│   │  name, cap)  │   │  assignments)   │
└──────────────┘   └──────────────┘   └─────────────────┘
```

### RBAC Matrix

| Role | Manage Institution | Invite Users | Create/Edit Resources | Generate Timetables | View Timetables |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **admin** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **faculty** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **student** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Getting Started

### Option 1: Docker Compose (Recommended 1-Command Startup)

Run the full stack (MongoDB + Backend + Frontend) using Docker:

```bash
docker compose up --build
```
- Frontend (nginx-served production build): `http://localhost:5173`
- Backend API: `http://localhost:4000/api/health`

Set a strong `JWT_SECRET` env var (or a `.env` file next to `docker-compose.yml`) before any real deployment.

---

### Option 2: Manual Local Setup

#### Prerequisites
- Node.js (v18+)
- MongoDB (running locally on `mongodb://127.0.0.1:27017` or via an Atlas URI)

#### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SyedSehran/ScheduleAI-saas.git
   cd ScheduleAI-saas
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   cp .env.example .env   # then set MONGODB_URI and a strong JWT_SECRET
   npm install
   npm run dev
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Sign up** from the app's "New institution" tab (or click *Instant demo institution*). You become the tenant **owner** and can invite faculty/students from the dashboard.

---

## API Documentation

A Postman API Collection is included under `docs/postman_collection.json`. Import this file into Postman to test auth, onboarding, invitation, dashboard, and timetable endpoints.

---

## Running Automated Tests & Concurrency Benchmarks

The test suite is fully self-contained — it spins up an in-memory MongoDB via `mongodb-memory-server`, so no local database is needed:

```bash
cd backend
npm test
```

Covered: cross-tenant isolation, a 30-request concurrent isolation/load benchmark with structured metrics, RBAC enforcement (401/403 rules, owner-can-generate regression), and monthly usage-metering cutoffs.

### Sample Concurrency & Isolation Benchmark Output

```text
==================================================
 CONCURRENCY & TENANT ISOLATION BENCHMARK RESULTS 
==================================================
  Total Concurrent Requests : 30
  Total Execution Time      : 184 ms
  Average Latency / Request : 6.13 ms
  Zero-Leak Isolation Pass  : 30 / 30 (100.0%)
  HTTP Status Distribution  : {"200":15,"404":15}
==================================================

✔ Concurrent cross-tenant isolation and load benchmark (30 simultaneous requests)
✔ Tenant A cannot fetch Tenant B timetable with Tenant A token
```

---

## CI/CD Workflow

A GitHub Actions workflow lives at `.github/workflows/test.yml` with two jobs: one runs the backend test suite (no MongoDB container required thanks to the in-memory server), the other lints and production-builds the frontend. Both run on every `push` and `pull_request` to `main`.

---

## License

MIT License
