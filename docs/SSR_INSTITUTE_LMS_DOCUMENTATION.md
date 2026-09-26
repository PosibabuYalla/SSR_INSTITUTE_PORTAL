# SSR Institute LMS — Technical Documentation

| | |
|---|---|
| **Product** | SSR Institute Portal (LMS + institute management) |
| **Repository** | `SSR_INSTITUTE_PORTAL` (`backend/` + `frontend/`) |
| **Documented revision** | `main` @ `9005f02` ("frontend security issues") |
| **Documentation date** | 2026-09-26 |
| **Audience** | Developers taking over, maintaining, or deploying the system |
| **Source of truth** | The source code in this repository. Where the code and the existing `README.md` disagree, this document follows the code and flags the difference. |

> **How to read status markers in this document**
>
> - **Implemented** means the behaviour is in the source code and was read directly.
> - **Tested** means an automated test in `backend/tests/` asserts the behaviour.
> - **Not verified** means the claim cannot be confirmed from the repository (e.g. hosting settings).
> - **Requires manual verification** means someone must check it in a running environment.
> - Values shown as `YOUR_…_HERE` are placeholders. No real credential appears in this document.

### Verification status

| Check | Result | How it was established |
|---|---|---|
| Backend tests | **88 tests, all passing** (14 suites) | 88 tests in 14 suites after the payment-approved email change (83 from the security audit + 5 email tests). Every test passed; in the last two full runs on a heavily loaded machine, one suite (a different one each time) timed out starting the in-memory MongoDB and passed when re-run on its own. Node v20.20.2. The original 83 passed 83/83 in a clean full run. |
| Security tests (`securityRegression` 21 + `codingJudge` 6) | **27 / 27 passing** | Same run. These are the two security-specific suites. |
| Backend TypeScript (`tsc --noEmit`) | **Passing** (exit 0) | Re-run for this document |
| Backend lint (`npm run lint`) | **0 errors, 0 warnings** | Re-run for this document |
| Frontend TypeScript (`tsc --noEmit`) | **Passing** (exit 0) | Re-run for this document |
| Frontend lint (`npm run lint`) | **0 errors**, 10 warnings | Re-run for this document. The warnings are React Compiler `react-hooks/incompatible-library` notices (e.g. React Hook Form `watch()` in `task-form-sheet.tsx`). |
| Next.js production build (`npm run build`) | **Passing** — 43 routes generated | Re-run for this document (Next.js 16.3.5, Turbopack) |
| Security audit + second review | Completed | Reported by the project owner. Individual findings are traceable through the regression tests (see §25). |
| Tests before the audit fixes: 55 / 56 | Reported | Reported by the project owner; cannot be reproduced from the current repository state. |
| Browser / end-to-end testing | **Not performed** | No browser or E2E test suite exists in the repository, and none was run for this document. |

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [System architecture](#2-system-architecture)
3. [User roles and permissions](#3-user-roles-and-permissions)
4. [Student workflow](#4-student-workflow)
5. [Course and curriculum structure](#5-course-and-curriculum-structure)
6. [Quiz system](#6-quiz-system)
7. [Coding assessment / grader](#7-coding-assessment--grader)
8. [Authentication and session security](#8-authentication-and-session-security)
9. [Authorization and security](#9-authorization-and-security)
10. [Payment and fees system](#10-payment-and-fees-system)
11. [Payment receipts](#11-payment-receipts)
12. [WhatsApp functionality](#12-whatsapp-functionality)
13. [Notifications](#13-notifications)
14. [Certificates](#14-certificates)
15. [Jobs and interview features](#15-jobs-and-interview-features)
16. [File uploads](#16-file-uploads)
17. [Database](#17-database)
18. [API documentation](#18-api-documentation)
19. [Error handling](#19-error-handling)
20. [Frontend architecture](#20-frontend-architecture)
21. [Backend architecture](#21-backend-architecture)
22. [Environment variables](#22-environment-variables)
23. [Local development setup](#23-local-development-setup)
24. [Deployment](#24-deployment)
25. [Security audit](#25-security-audit)
26. [Testing](#26-testing)
27. [Known limitations](#27-known-limitations)
28. [Maintenance guide](#28-maintenance-guide)
29. [Production checklist](#29-production-checklist)
30. [Summary](#30-summary)

---

## 1. Project overview

### 1.1 What the system is

The SSR Institute Portal is a web-based **Learning Management System combined with training-institute administration**. It covers the full life of a student at SSR Institute: registration and approval, batch enrollment, a sequential self-paced curriculum (lessons, practice, quizzes, auto-graded coding questions, a final assessment), course completion, certificates, fee payment with admin verification, and placement support (jobs, mock interviews, interview resources).

It is built as two independently deployable applications that communicate only over a versioned REST API (`/api/v1`):

| App | Folder | Role |
|---|---|---|
| Backend API | `backend/` | Express 5 + TypeScript + Mongoose. Owns all business rules, authorization and data. |
| Frontend | `frontend/` | Next.js (App Router) + React + TypeScript. Presentation only; never talks to MongoDB. |

### 1.2 Purpose

- Deliver structured course content in a strictly enforced order, so a student cannot skip ahead.
- Assess learning with quizzes, auto-graded coding questions and a final assessment, all graded on the server.
- Run institute operations: users, courses, batches, schedules, attendance, tasks, fees, certificates, placements, announcements and reports.
- Let students pay fees by UPI QR code and have an admin verify the payment against an uploaded screenshot.

### 1.3 Main users

| Role | Who | How the account is created |
|---|---|---|
| `STUDENT` | Learners | Self-registration → email OTP → admin approval |
| `TRAINER` | Instructors | Self-registration → email OTP → admin approval |
| `ADMIN` | Institute staff | **Seed script only** (`npm run seed`). There is no API endpoint that creates an admin. |

### 1.4 Main workflows

1. **Onboarding:** register → verify email OTP → admin approves → login.
2. **Enrollment:** an admin enrolls an active student into a batch. A batch belongs to one course and optionally one trainer.
3. **Learning:** module → topic → lesson, in order. Each lesson can have a practice step, a quiz and a coding question.
4. **Assessment:** lesson quizzes (60% to pass), coding questions (all tests must pass), and an optional course final assessment (configurable pass mark).
5. **Completion and certification:** the course is complete when every lesson is complete *and* the published final assessment (if any) is passed. An admin then issues a certificate, which anyone can verify publicly.
6. **Fees:** the student pays by QR code, uploads a screenshot, an admin approves or rejects it, and an approved payment is written to the payment ledger. The student can download a receipt.
7. **Career:** job listings and interview resources unlock after course completion.
8. **Operations:** trainers manage schedules, materials, tasks, submissions, attendance and mock interviews for their own batches.

### 1.5 Technology stack

| Layer | Technology (from `package.json`) |
|---|---|
| Frontend framework | Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5 |
| Frontend UI | Tailwind CSS 4, shadcn/ui components (on `@base-ui/react`), Lucide icons, Framer Motion, Recharts, Sonner (toasts), next-themes |
| Frontend data/state | TanStack Query 5 (server state), Zustand 5 (auth/UI state), Axios (HTTP), React Hook Form + Zod 3 (forms) |
| Frontend documents | jsPDF 4 (browser-generated payment receipts) |
| Backend runtime | Node.js 20 (`engines`), Express 5.2, TypeScript 5.7.3 |
| Backend data | MongoDB via Mongoose 8. Transactions are used, so a **replica set is required**. |
| Backend security | jsonwebtoken (HS256), bcryptjs (12 rounds), Helmet, CORS, express-rate-limit, express-mongo-sanitize, Zod 4 validation |
| Backend files | Multer (memory storage), Cloudinary SDK 2 |
| Backend testing | Jest 30, ts-jest, Supertest, mongodb-memory-server (in-memory replica set, MongoDB 7.0.14) |
| Hosting (config in repo) | Railway (`railway.json`, backend), Vercel (`frontend/vercel.json`, frontend), MongoDB Atlas, Cloudinary |

### 1.6 Architecture at a glance

- **Frontend architecture:** Next.js App Router with route groups per role (`/admin/*`, `/trainer/*`, `/student/*`). Pages are client components that call typed service modules (`frontend/services/*`) through React Query hooks (`frontend/hooks/*`). A single Axios client attaches the in-memory access token and refreshes it transparently. See §20.
- **Backend architecture:** Routes → middleware (authenticate, authorize, validate, upload, rate-limit) → thin controllers → services (business rules) → Mongoose models. See §21.
- **Database:** MongoDB (Atlas in production), 33 Mongoose models. See §17.
- **Authentication:** short-lived JWT access token (in browser memory) plus a rotating, revocable refresh token in an `httpOnly` cookie backed by a server-side `Session` document. See §8.
- **File storage:** Cloudinary. General uploads (materials, task submissions) are public URLs. Payment screenshots and the payment QR code are stored as **authenticated (private)** Cloudinary assets and only served through authorized API routes. See §16.
- **Deployment:** backend on Railway (Nixpacks, health check `/health`), frontend on Vercel, database on MongoDB Atlas, files on Cloudinary. See §24.

---

## 2. System architecture

### 2.1 Layered architecture

```mermaid
flowchart TD
    U["Student / Trainer / Admin<br/>(browser)"] --> FE["Next.js frontend (Vercel)<br/>App Router pages · React Query hooks · Axios client<br/>RequireAuth = UX-only route gate"]
    FE -- "HTTPS JSON · Authorization: Bearer access token<br/>httpOnly refresh cookie (path /api/v1/auth only)" --> API["Express API (Railway)<br/>helmet · CORS · compression · JSON 10mb · cookie-parser<br/>mongo-sanitize · morgan · apiLimiter (300 / 15 min / IP)"]
    API --> AUTHN["authenticate<br/>verify JWT (HS256) → Session active? → User ACTIVE?"]
    AUTHN --> AUTHZ["authorize(...roles)<br/>+ service-level ownership / scope checks"]
    AUTHZ --> VAL["validateBody / validateQuery / validateParams (Zod)<br/>upload (Multer) · per-user rate limiters"]
    VAL --> CTRL["Controllers (thin)"]
    CTRL --> SVC["Business services<br/>progression · grading · fees · certificates · notifications · audit"]
    SVC --> DB[("MongoDB Atlas<br/>replica set")]
    SVC --> CLD[("Cloudinary<br/>public uploads + authenticated private images")]
    SVC --> JUDGE["Coding judge<br/>isolated child Node process per submission"]
    SVC -. "SMTP via nodemailer (best-effort)" .-> MAIL["email.service → SMTP server"]
```

### 2.2 Responsibilities per layer

| Layer | Responsibility | Must **not** do |
|---|---|---|
| **Browser / user** | Interacts with the UI. Holds the access token in memory (Zustand, not persisted) and the refresh token as an `httpOnly` cookie it cannot read. | Be trusted for role, ownership, scores, fee amounts or completion state. |
| **Next.js frontend** | Rendering, navigation, forms, client-side validation for fast feedback, caching of server data (React Query), and the transparent token refresh. `RequireAuth` redirects users away from other roles' dashboards. | Enforce security. Every decision is repeated on the backend. The frontend and API are on different origins, so the frontend cannot see the refresh cookie. |
| **Express API (global middleware)** | Security headers (Helmet), CORS restricted to `CLIENT_URL` with credentials, gzip, body parsing (10 MB limit), NoSQL-operator stripping, request logging, global IP rate limit. | — |
| **Authentication** (`middleware/authenticate.ts`) | Accepts **only** `Authorization: Bearer` (no cookie fallback, which closes the CSRF surface). Verifies the JWT with a pinned algorithm, checks that the session is still live, and re-reads the user's role and status from the database on **every request**. | Trust role or status claims inside the token. |
| **Authorization** (`middleware/authorize.ts` + services) | Route-level role allowlist. Services then apply ownership and scope rules: batch access, course-content access, enrollment, per-record ownership. | — |
| **Validation** (`middleware/validate.ts`) | Parses and replaces `req.body` / `req.query` with Zod output, rejects malformed input with 422. Payment write schemas are `.strict()`. | — |
| **Controllers** (`controllers/*`) | Extract the authenticated user, params and body, call a service, and send the standard response envelope. | Hold business logic. |
| **Services** (`services/*`, `utils/lessonAccess.ts`, `utils/progressState.ts`, `utils/codingJudge.ts`) | All business rules: lock state, grading, fee balances, payment state transitions, certificate eligibility, notifications, audit logging. | — |
| **MongoDB** | Durable state, unique and partial-unique indexes as the last line of defence against duplicates and races, TTL expiry for OTPs, reset tokens and sessions. | — |
| **Cloudinary** | Stores uploaded files. Private images use `type: "authenticated"` and are read server-side through 60-second signed URLs. | Be exposed directly for private files. |

### 2.3 Request lifecycle (authenticated request)

```mermaid
sequenceDiagram
    participant B as Browser (Axios)
    participant A as Express API
    participant S as Session / User (MongoDB)
    participant V as Service layer
    B->>A: GET /api/v1/... with Bearer access token
    A->>A: apiLimiter, sanitize, verify JWT (HS256)
    A->>S: Session active for (sid, sub)? User status ACTIVE?
    alt session revoked / token expired
        A-->>B: 401
        B->>A: POST /auth/refresh-token (httpOnly cookie)
        A-->>B: new access token (+ rotated cookie)
        B->>A: retry original request once
    else user blocked / suspended
        A-->>B: 403 "Account is blocked|suspended"
    end
    A->>A: authorize(roles) → validate (Zod)
    A->>V: controller → service (ownership + business rules)
    V-->>A: data or ApiError
    A-->>B: { success, message, data, meta? } or { success:false, message, errors }
```

---

## 3. User roles and permissions

All rules below come from backend route guards (`authorize(...)`) **and** service-level checks. The frontend navigation (`frontend/constants/nav.ts`) only mirrors these rules.

### 3.1 Scope helpers used throughout the backend

| Helper (`backend/src/utils/`) | Rule |
|---|---|
| `assertBatchAccess(batchId, user, role)` | Admin: any batch. Trainer: only if `Batch.trainer` is that trainer. Student: only if an `Enrollment` exists for that batch. Otherwise 403 (404 if the batch doesn't exist). |
| `assertCourseContentAccess(courseId, user)` | Admin: any course. Trainer: only if assigned as trainer on **at least one batch** of that course. Students: always 403. |
| `assertStudentEnrolledInCourse(courseId, student)` | Student must have an enrollment in any batch of that course. |
| `assertLessonUnlocked(student, lesson)` | Lesson must exist, be published, belong to an enrolled course, and not be `LOCKED` in the student's progression tree. |
| `assertCourseCompletedForUnlock(...)` | Enrolled + course completed (all lessons + passed final assessment if one is published). |

### 3.2 Student

| | Details |
|---|---|
| **Can access** | Own account and profile (`/auth/me`). Own enrollments and progress. Lesson content for **unlocked, published** lessons in enrolled courses (quiz answers and coding test cases stripped). Materials, class schedule and non-draft tasks for **enrolled batches only**. **Own** attendance only (other students' rows are filtered out even in batch summaries). Announcements addressed to them that are live. Own notifications. Own fee status, payments, payment requests and screenshots. The payment QR code. Own certificates. Career-resource status. Jobs and interview resources **only after completing a course**. Own mock interviews. Global search scoped to enrolled courses. Student dashboard. |
| **Can create** | Payment requests (screenshot + amount). Task submissions. Job applications (eligibility re-checked on the server). File uploads (always stored in the `submissions` folder, whatever folder the client asks for). Quiz, coding and final-assessment attempts. Lesson progress (practice complete, lesson complete). |
| **Can update** | Own `name`, `phone`, `avatarUrl`. Own student profile fields. Last-visited lesson. Own notifications (mark read). Own task submission (re-submitting overwrites it while the task is `PUBLISHED`). Withdraw own job application (unless already `SELECTED`, `REJECTED` or `WITHDRAWN`). Unmark own lesson completion (`DELETE /progress/lessons/:id/complete`). |
| **Can delete** | Nothing. No student-facing hard delete exists. |
| **Cannot access** | Any admin or trainer route (403). Other students' records (ownership filters return 404 or 403). Quiz answer keys before passing. Coding test inputs and expected outputs. Draft tasks and task quiz answer keys (`isCorrect` is stripped). Unpublished or locked lessons. Approving payments. Setting any fee, status or balance field (payment schemas reject unknown fields). Changing own role, email or status. |

### 3.3 Trainer

A trainer's reach is defined by **batch assignment** (`Batch.trainer`). Course-content access follows from being assigned to at least one batch of the course.

| | Details |
|---|---|
| **Can access** | Own batches (list, detail, roster). "My courses" (courses of assigned batches) and the course record for those. Full authoring view of the curriculum of assigned courses, **including answer keys and test cases**. Final assessment authoring for assigned courses. Materials, schedules, tasks, submissions (incl. pending queue) and attendance for own batches. Mock interviews where they are the interviewer. Interview resources of assigned courses. Progress of a student **who is in one of their batches** for an assigned course. Trainer dashboard. Search scoped to taught courses. Announcements addressed to trainers or to their batches and courses. Own notifications. |
| **Can create** | Modules, topics and lessons (assigned courses). A course's final assessment. Materials, class sessions, tasks and attendance (own batches, and only for students enrolled in that batch). Mock interviews (only for students in their own batches). Interview resources (assigned courses). File uploads (folder name sanitized to `[a-z0-9-]{1,40}`, otherwise `general`). |
| **Can update** | The items above. Reorder modules, topics and lessons. Publish, close or edit tasks (publishing notifies enrolled students). Evaluate submissions (marks capped at `maxMarks`). Record interview feedback. Own profile and trainer profile. |
| **Can delete** | Modules, topics and lessons **only if no student has progress in them** (otherwise only an admin can). Materials and class sessions of own batches. **Draft** tasks only. Own mock interviews. Interview resources of assigned courses. |
| **Cannot access** | User management. Creating, editing or changing the status of courses. Creating or editing batches and enrolling students. **All `/fees` routes** (they only allow `STUDENT`/`ADMIN`). Certificates. Job management. Reports. Audit logs. Creating announcements. Anything belonging to another trainer's batches or courses (tested in `trainerAuthorizationMatrix.test.ts`). |

### 3.4 Admin

| | Details |
|---|---|
| **Can access** | Every admin route: users and stats, all courses and curricula, all batches and rosters, all fee data (status, ledger, payment requests, screenshots), certificates, jobs and applications, reports, audit logs, announcements, all mock interviews (filterable), all interview resources, any student's progress. |
| **Can create** | Courses, batches, enrollments (active students only, capacity enforced, no duplicates), curriculum, final assessments, manual payments, certificates (only for students who completed the course), jobs, announcements, interview resources, mock interviews, tasks, materials, schedules, attendance. Replace the payment QR code. |
| **Can update** | Approve or reject **pending** users. Block, unblock, suspend and reactivate **non-admin** users (block and suspend revoke all their sessions). Course details and status (`DRAFT`/`PUBLISHED`/`ARCHIVED`). Batch details and status. Enrollment discount. Approve (optionally with a corrected amount) or reject payment requests. Revoke certificates. Job details and status. Application status. |
| **Can delete** | Remove a student from a batch (deletes the enrollment). Curriculum at any level, including content with student progress (cascades to `LessonProgress`). Announcements. Materials, class sessions, draft tasks, mock interviews, interview resources. Remove the payment QR code. |
| **Cannot** | Change another admin's status through block/suspend (`403 "Admin accounts cannot be modified this way"`). Approve or reject a user who is not `PENDING`. Hard-delete courses, users, jobs, certificates, payments or payment requests (no such endpoints). Issue a certificate before the student has completed the course. Approve more than the **current** outstanding balance, or approve a request that is no longer `PENDING`. Use student-only endpoints (quiz, fee self-service, etc.), which are restricted to `STUDENT`. |

### 3.5 Account status rules

| Status | Can log in? | Effect on existing sessions |
|---|---|---|
| `PENDING` | No ("awaiting admin approval") | — |
| `ACTIVE` | Yes (email must also be verified) | — |
| `REJECTED` | No | — |
| `BLOCKED` | No | All sessions revoked immediately. Any request with an old token fails. |
| `SUSPENDED` | No | All sessions revoked immediately. |

Unblocking or reactivating sets the user back to `ACTIVE`. The user must log in again.

---

## 4. Student workflow

### 4.1 End-to-end journey

```mermaid
flowchart TD
    R["Register (POST /auth/register/student)<br/>picks a PUBLISHED course as 'interested course'"] --> O["Verify email OTP (POST /auth/verify-otp)"]
    O --> AP["Admin approves (PATCH /users/:id/approve) → ACTIVE"]
    AP --> L["Login (POST /auth/login)"]
    L --> EN["Admin enrolls student in a batch<br/>(POST /batches/:id/students)"]
    EN --> C["My Courses (GET /enrollments/me)"]
    C --> M["Course → modules → topics → lessons<br/>(GET /progress/courses/:courseId)"]
    M --> LS["Lesson content (GET /lessons/:id)"]
    LS --> P["Practice (POST /lessons/:id/practice/complete)"]
    P --> Q["Quiz — pass ≥ 60% (/lessons/:id/quiz/*)"]
    Q --> CQ["Coding question — all tests pass (/lessons/:id/coding/submit)"]
    CQ --> LC["Lesson COMPLETED → next lesson unlocks"]
    LC -->|"all lessons complete"| FA["Final assessment (/final-assessments/courses/:id/*)<br/>only if one is published"]
    FA -->|"passed"| CC["Course completed"]
    FA -->|"failed"| RT["Retake (no limit) — course NOT completed"]
    RT --> FA
    CC --> CE["Admin issues certificate → public verification"]
    CC --> J["Jobs · Interview resources unlock"]
```

### 4.2 Step details

| Step | What actually happens (backend) |
|---|---|
| **Registration** | Creates `User` (`STUDENT`, `PENDING`, unverified) and `StudentProfile` in **one transaction**. The chosen course must be `PUBLISHED`. It is stored as `StudentProfile.interestedCourse`. **Registration does not enroll the student.** A 6-digit OTP is generated and handed to the email service. |
| **Email verification** | Newest OTP only, 10-minute expiry, 5 wrong attempts max. Responses don't reveal whether an email exists. OTPs are emailed through SMTP, so `SMTP_*` must be configured (§22). Without `SMTP_HOST` emails are only logged, and the OTP value itself is never logged. |
| **Approval** | Admin approves a `PENDING` user → `ACTIVE`, plus an in-app `ACCOUNT_APPROVED` notification. |
| **Login** | Requires correct password, verified email and `ACTIVE` status. |
| **Enrollment** | Admin-only. Student must be `ACTIVE`, not already in the batch, and the batch must be under capacity. Enrollment copies the batch's course. |
| **Course / module / topic** | `GET /progress/courses/:courseId` returns the full tree with a lock state per module, topic and lesson, and progress percentages. |
| **Lesson content** | `GET /lessons/:id` returns the teaching content (what it is, why it matters, analogy, simple example, technical explanation, code examples, real-world usage, common mistakes, practice, remember-this, key takeaways). Quiz questions come **without** `correctIndex` or explanations, and the coding question comes **without** test cases. Opening a lesson never marks anything complete. |
| **Practice** | Explicit `POST /lessons/:id/practice/complete`. |
| **Quiz** | Server-side session: one question at a time, no going back. Requires practice first (if the lesson has one). See §6. |
| **Coding question** | Requires practice and quiz first (if present). Graded in an isolated process. See §7. |
| **Lesson completion** | Automatic as soon as every stage the lesson has is cleared. A lesson with **no** stages (a reading lesson) is completed with `POST /progress/lessons/:id/complete`. |
| **Final assessment** | Unlocked only when every lesson in the course is complete. See §5.6. |
| **Course completion** | Computed, never stored: all lessons complete **and**, if a published final assessment exists, a `SUBMITTED` attempt with `passed === true`. |
| **Certificate** | Issued by an admin. The backend refuses if the course isn't completed. See §14. |
| **Jobs / interview resources** | Unlocked by completing a course. See §15. |

> **Fees do not gate learning.** No fee or payment check exists in the progression, assessment or certificate logic. A student with an outstanding balance can still study, complete the course and be issued a certificate. If that is not the intended policy, it has to be added on the server (see §28).

### 4.3 Progression and locking rules

Implemented in `backend/src/utils/progressState.ts` (pure function) and `utils/lessonAccess.ts` (loader and gates).

1. **One flat sequence per course:** modules sorted by `order`, topics within a module by `order`, lessons within a topic by `order`.
2. The **first lesson** of the course is always reachable.
3. A lesson is `COMPLETED` when its `LessonProgress.completed` is true **and** every stage it has is done.
4. Every later lesson is `LOCKED` until the lesson immediately before it in the flat sequence is `COMPLETED`. Module and topic boundaries unlock automatically as a result.
5. Otherwise a reachable lesson is `IN_PROGRESS` (some stage done or a quiz attempted) or `UNLOCKED`.
6. Topic and module states roll up from their children: all completed → `COMPLETED`; first child locked → `LOCKED`; any started → `IN_PROGRESS`; else `UNLOCKED`. Empty topics and modules roll up as `COMPLETED`.
7. **Unpublished lessons** (`published: false`) are excluded entirely. They neither gate progression nor count toward completion, and every student lesson endpoint returns 404 for them.
8. A course with **zero lessons** is never "completed" (this prevents unlocking certificates for empty courses).
9. Lock state is **recomputed from stored facts on every request**. It is never stored, so reordering or editing curriculum is reflected immediately.
10. Completed lessons stay open for revision.

---

## 5. Course and curriculum structure

### 5.1 Hierarchy

```mermaid
flowchart LR
    Course --> Batch["Batch (cohort, trainer, schedule)"]
    Course --> Module
    Module --> Topic
    Topic --> Lesson
    Lesson --> Practice["practice (optional)"]
    Lesson --> Quiz["quiz[] (optional, embedded)"]
    Lesson --> Coding["codingQuestion (optional, embedded)"]
    Course --> FA["FinalAssessment (0..1 per course)"]
    Batch --> Enrollment --> Student
```

| Entity | Model | Key facts |
|---|---|---|
| **Course** | `Course` | `name`, `shortDescription`, `fullDescription`, `category`, `duration`, `fee`, `thumbnailUrl`, `requirements[]`, `learningOutcomes[]`, `status` (`DRAFT` default / `PUBLISHED` / `ARCHIVED`). Never hard-deleted. `ARCHIVED` is the soft delete. |
| **Batch** | `Batch` | A cohort of a course: `trainer` (optional), dates, `classDays`, times, `mode`, `capacity`, `status` (`UPCOMING`/`ACTIVE`/`COMPLETED`/`CANCELLED`). |
| **Module** | `Module` | `course`, `name`, `description`, `estimatedDuration`, `order`. |
| **Topic** | `Topic` | `course`, `module`, `name`, `description`, `order`. |
| **Lesson** | `Lesson` | `course`, `module`, `topic`, `title`, `order`, `difficulty`, `estimatedMinutes`, **`published`** (default `true`), teaching-format fields, plus embedded `practice`, `quiz[]`, `codingQuestion`. |
| **Quiz** | embedded `Lesson.quiz[]` | Questions with 2–6 `options`, `correctIndex`, optional `explanation`. |
| **Coding question** | embedded `Lesson.codingQuestion` | `prompt`, `starterCode`, `functionName` (valid JS identifier), `testCases[]` (`args[]`, `expectedOutput`), at least one test case. |
| **Assessment (final)** | `FinalAssessment` | One per course (unique `course`). `title`, `questions[]` (≤100), `passingScore` (default 60), `published` (default `false`). |

> **Terminology:** there is no separate "Assessment" collection other than `FinalAssessment`. The "Quiz"-type `Task` (§15, operational tasks) is a different, manually evaluated feature and is not part of curriculum progression.

### 5.2 Authoring

- Admins can author any course. Trainers can author courses they are assigned to via a batch.
- New modules, topics and lessons are appended (`order = max + 1`). Reorder endpoints set `order` to the array index. Items that don't belong to the parent are ignored by the filter.
- Deleting a module cascades to its topics, lessons and all `LessonProgress` rows for those lessons. Deleting a topic cascades to its lessons and their progress. Trainers are blocked from deletes that would erase student progress.

### 5.3 Publishing and draft content

| Level | Draft mechanism | Effect on students |
|---|---|---|
| Course | `status: DRAFT` / `ARCHIVED` | Only `PUBLISHED` courses appear in the public course list and can be chosen at registration. **Enrollment and learning access are not checked against course status.** An enrolled student keeps access if a course is later set to draft or archived. |
| Lesson | `published: false` | Invisible to students (404), excluded from progression and completion, excluded from search. |
| Final assessment | `published: false` | Treated as "no final assessment". Course completion then only requires all lessons. |
| Task (operations) | `status: DRAFT` | Hidden from students in lists and by id. |
| Module / Topic | No draft flag | Always part of the structure. |

### 5.4 Progress tracking

`LessonProgress` (one row per student per lesson, unique) stores `practiceCompleted`, `quizPassed`, `codingCompleted` (each with a timestamp), `completed`/`completedAt`, `quizBestScore`, `quizAttempts`, `quizLastAttemptAt`. Percentages returned by `GET /progress/courses/:courseId` are computed from these rows:

- `overallProgress = round(completedLessons / totalLessons × 100)`
- The same ratio is computed per module and per topic.
- The response also includes `allModulesCompleted`, `finalAssessmentUnlocked`, `hasFinalAssessment`, `courseCompleted`, `certificateUnlocked` and `careerResourcesUnlocked`.

`Enrollment.lastVisitedLesson` / `lastVisitedAt` power "continue where you left off" (`PATCH /enrollments/last-visited`, which checks that the lesson belongs to the course and that the student is enrolled).

### 5.5 Completion rules

| Unit | Completed when |
|---|---|
| Lesson | Every stage it has is cleared (practice marked, quiz passed ≥ 60%, coding passed) **and** `completed` is set. Set automatically after the last stage, or by explicit completion for stage-less lessons. |
| Topic / Module | All child lessons / topics completed. |
| Course | All modules completed (with ≥ 1 lesson in the course) **and**, if a published final assessment exists, it is passed. |

A student can call `DELETE /progress/lessons/:lessonId/complete` to clear the `completed` flag. This re-locks later lessons until the lesson is completed again. The stage flags are kept, so `POST .../complete` restores it immediately.

### 5.6 Final assessment

| Rule | Behaviour |
|---|---|
| Availability | `GET /state` and `POST /start` require enrollment and **every lesson complete** (403 otherwise), plus a published assessment (404 otherwise). |
| Format | Same one-question-at-a-time state machine as lesson quizzes (§6). |
| Pass mark | `score ≥ passingScore` (0–100, default 60). |
| Attempts | One attempt record per student per course (unique index). |
| Retakes | After a **failed** or quit attempt, `start` resets and begins a new attempt. **No limit** on retakes. After a **passed** attempt, `start` returns the existing result and no retake is possible. |
| Answer key | Per-question results (correct index, explanation) are returned **only if passed**. |
| Completion | **Failing the final assessment does not complete the course.** Certificates and career resources stay locked (tested: `securityRegression` H1/H2). |

### 5.7 Retakes summary

| Item | Retakes | Limit | What counts |
|---|---|---|---|
| Lesson quiz | Yes. A new `start` resets the session. | None | `quizPassed` is sticky once true. `quizBestScore` keeps the maximum. |
| Coding question | Yes. Every submission is graded and stored. | 10 submissions/min per user (rate limit) | Passes once any submission passes all tests. |
| Final assessment | Only after a fail or quit | None | The latest attempt's `passed`. |

---

## 6. Quiz system

Source: `backend/src/services/quizAttempt.service.ts`, model `QuizAttempt`, routes in `lesson.routes.ts`.

### 6.1 Flow

```mermaid
stateDiagram-v2
    [*] --> NOT_STARTED
    NOT_STARTED --> IN_PROGRESS: POST /lessons/:id/quiz/start
    IN_PROGRESS --> IN_PROGRESS: POST /quiz/answer (selectedIndex) → currentIndex + 1
    IN_PROGRESS --> SUBMITTED: POST /quiz/submit → score, passed?
    IN_PROGRESS --> QUIT: POST /quiz/quit → score 0
    SUBMITTED --> IN_PROGRESS: POST /quiz/start (retake — resets answers)
    QUIT --> IN_PROGRESS: POST /quiz/start (retake)
```

| Endpoint (all `STUDENT`) | Behaviour |
|---|---|
| `GET /lessons/:id/quiz/state` | `NOT_STARTED` + `totalQuestions`, or the current session state. |
| `POST /lessons/:id/quiz/start` | Requires the lesson unlocked and practice done (if the lesson has practice). If an attempt is already `IN_PROGRESS` it is resumed (refresh-safe). Otherwise the single attempt row for (student, lesson) is reset: `currentIndex = 0`, `answers = []`. |
| `POST /lessons/:id/quiz/answer` `{ selectedIndex }` | Records the answer for **the current question only**, then advances. Returns the next question. |
| `POST /lessons/:id/quiz/submit` | Scores the attempt and updates `LessonProgress`. May complete the lesson. |
| `POST /lessons/:id/quiz/quit` | Ends the attempt with score 0. Counts as an attempt. |

### 6.2 Question handling

- The client only ever receives **the question at `currentIndex`** (`{ question, options }`). It never receives the full quiz, previous questions or `correctIndex`.
- `GET /lessons/:id` also strips `correctIndex` and `explanation` from every quiz question.
- Questions are presented in authored order. There is no shuffling.

### 6.3 Answer submission

- One answer per call. `selectedIndex` must be a non-negative integer (Zod) **and** less than the number of options of the current question (service check → 400 "Selected option does not exist").
- There is no way to go back or change a submitted answer. The server does not accept a client-supplied answers array (the old bulk-submit schema is deprecated and unrouted).
- A quiz can be submitted before all questions are answered. Unanswered questions count as wrong.

### 6.4 Scoring

- `score = round(correct / totalQuestions × 100)`.
- `passed = score ≥ 60` (`QUIZ_PASS_PERCENT` in `constants/enums.ts`).
- `LessonProgress` is updated: `quizAttempts + 1`, `quizLastAttemptAt`, `quizBestScore = max(previous, score)`, and `quizPassed` becomes true on the first pass and **stays true** afterwards.
- If the quiz was the last outstanding stage, the lesson auto-completes (`lessonCompleted: true` in the response).

### 6.5 Attempt and retake rules

| Rule | Value |
|---|---|
| Attempts per lesson | Unlimited |
| Time limit | None for lesson quizzes |
| Retake after passing | Allowed (score history only keeps the best score; the pass is never lost) |
| Retake after failing / quitting | Allowed immediately |
| Quit | Recorded as score 0 and an attempt, `quizPassed` unchanged |

### 6.6 Answer protection — what students can and cannot see

| Student can see | Student cannot see |
|---|---|
| Current question text and options | Correct option index before passing |
| Their score, best score and pass/fail after submitting | Explanations before passing |
| Full per-question review (selected vs. correct, explanation) **only when the attempt passed** (`reviewAvailable: true`) | Previous questions during an attempt |
| Number of questions and current position | The answer key on a failed attempt (`results: []`), so an immediate retake can't be a guaranteed pass |

Admins and trainers who can author the course see the full lesson including answers (`GET /lessons/:id` authoring view).

> The same answer-protection rule applies to the final assessment (§5.6). Operational "Quiz"-type **tasks** (§15) are different: they are evaluated manually by staff, and their `isCorrect` flags are stripped from every student response (tested: `securityRegression` H5).

---

## 7. Coding assessment / grader

Source: `backend/src/utils/codingJudge.ts`, `services/coding.service.ts`, test `tests/codingJudge.test.ts`.

### 7.1 How students submit code

1. `GET /lessons/:id/coding/state` returns the last submission (code, passed flag, per-test pass/fail and error only).
2. `POST /lessons/:id/coding/submit` with `{ "code": "<JavaScript source>" }` (1–20,000 characters).
3. Preconditions (checked on the server): the lesson is unlocked, the lesson has a coding question, practice is done (if present), and **the quiz is passed** (if present).
4. The code must define a function named `codingQuestion.functionName`. Each test case calls it with `args` spread as arguments.

Only **JavaScript** is supported. The judge runs code with Node's `vm` inside a child Node process.

### 7.2 How the grader executes a submission

```mermaid
flowchart LR
    API["API process<br/>coding.service"] -->|"acquire slot (max 2 running, 20 queued)"| SP["spawn(process.execPath,<br/>--permission / --experimental-permission<br/>--disallow-code-generation-from-strings<br/>--max-old-space-size=64, env = {})"]
    SP -->|"stdin: { code, functionName, tests(args only), timeoutMs }"| R["Runner script<br/>per test: fresh vm context (null prototype),<br/>codeGeneration off, microtaskMode afterEvaluate,<br/>2 s vm timeout"]
    R -->|"stdout: [{ ok, json | error }]"| API
    API -->|"compare with expectedOutput<br/>(outside the sandbox)"| RES["passed / testResults"]
    API -->|"SIGKILL on wall-clock timeout<br/>or > 1 MB output"| SP
```

### 7.3 Security controls

| Control | Implementation | Status |
|---|---|---|
| **Process isolation** | Student code never runs in the API process (`node:vm` alone is not a security boundary). Each submission runs in a **separate short-lived Node process** that is killed after use. | Implemented, tested |
| **Environment variable protection** | Child is spawned with `env: {}`, so no `JWT_SECRET`, `MONGODB_URI` or Cloudinary secrets exist in its environment. | Implemented, tested ("does not expose the API process's secrets") |
| **Filesystem restrictions** | Node permission model (`--permission` or `--experimental-permission`, detected at runtime) with **no** `--allow-fs-*` grants, so all filesystem access is denied. | Implemented, tested ("blocks child_process and filesystem access even after a realm escape") |
| **Process-spawning restrictions** | The permission model without `--allow-child-process` / `--allow-worker` blocks child processes, workers, native addons and `process.binding`. | Implemented, tested |
| **Code generation from strings** | `--disallow-code-generation-from-strings`, plus `codeGeneration: { strings: false, wasm: false }` in each vm context. | Implemented |
| **Fail closed** | If the running Node binary supports neither permission flag, grading is refused with 500 "The code grader is unavailable on this server". Code is never run unsandboxed. | Implemented |
| **Memory limit** | `--max-old-space-size=64` (64 MB V8 old-space heap). Exhaustion kills the child and results in "Execution failed (memory or runtime limit)". | Implemented |
| **Execution timeout** | 2 s per test (vm timeout) **and** a hard wall-clock SIGKILL at `min(10 s, 2 s × tests + 1 s)`. The kill also catches microtask loops that bypass the vm timeout. | Implemented, tested ("kills infinite loops, including microtask loops") |
| **Output limit** | Child stdout over 1 MB → killed → "Output limit exceeded". Error messages truncated to 500 characters. | Implemented |
| **Code size limit** | 20,000 characters (Zod and judge). | Implemented |
| **Concurrency limit** | At most **2** judge processes at once per API instance. Up to **20** submissions wait in a queue. Beyond that the request gets **429** "The code grader is busy". | Implemented (in-memory, per instance) |
| **Rate limiting** | `codingSubmitLimiter`: **10 submissions per minute per authenticated user**, on top of the global 300 requests per 15 min per IP. | Implemented (in-memory store) |
| **Hidden test protection** | Test inputs and expected outputs are never sent to the student. `GET /lessons/:id` strips `testCases`, and submission responses contain only `{ passed, error? }` per test. The expected outputs are **never sent into the sandbox either**. | Implemented, tested |
| **Verdict integrity** | The child only reports what the code returned. Pass/fail comparison happens in the API process, so a sandbox escape cannot forge a "passed" verdict. | Implemented, tested ("never lets a forged verdict pass") |
| **Function name safety** | `functionName` must match `^[A-Za-z_$][A-Za-z0-9_$]*$` (validated at authoring and again at grading). | Implemented |

### 7.4 How results are returned

```json
{
  "success": true,
  "message": "Code submitted",
  "data": {
    "passed": false,
    "testResults": [ { "passed": true }, { "passed": false, "error": "Time limit exceeded" } ],
    "lessonCompleted": false
  }
}
```

- `passed` is true only when **every** test passes. Comparison is `Object.is` or equality of `JSON.stringify` output, so object key order matters.
- Every submission is stored in `CodingSubmission` with the full test results (including args and expected output), which are visible to staff via the database only. On a pass, `LessonProgress.codingCompleted` is set and the lesson may auto-complete.

### 7.5 Remaining infrastructure requirement — outbound network access

> ⚠️ **Network isolation is NOT implemented.** Node's permission model does **not** restrict network access, so submitted code can open outbound connections (e.g. to internal services or the internet). The source code states this as residual risk in `codingJudge.ts`.
>
> **Required before relying on the grader in production:** run the API, or better a dedicated judge service, with **egress blocked** at the infrastructure level (container network policy, firewall, or a no-network sandbox such as a separate container with `--network none`). Whether the current Railway deployment blocks egress is **Not verified**. Railway services have outbound internet access by default unless configured otherwise, so treat this as **open** until confirmed.

Other infrastructure considerations:

- The memory cap applies to the V8 heap only, and there is no CPU quota other than the wall-clock kill. A container-level CPU/memory limit gives a stronger bound.
- Concurrency and rate-limit counters are per process. With multiple API replicas the effective limits multiply.

---

## 8. Authentication and session security

Source: `services/auth.service.ts`, `services/session.service.ts`, `middleware/authenticate.ts`, `controllers/auth.controller.ts`, `utils/jwt.ts`, frontend `lib/api-client.ts`, `store/auth-store.ts`, `components/shared/require-auth.tsx`.

### 8.1 Overview

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant DB as MongoDB
    B->>A: POST /auth/login {email, password}
    A->>DB: find user (+passwordHash), bcrypt compare
    A->>DB: create Session {refreshTokenHash = sha256(secret), expiresAt = now + SESSION_TTL_DAYS}
    A-->>B: 200 {accessToken, user} + Set-Cookie refreshToken={sessionId}.{secret} (httpOnly, path=/api/v1/auth)
    Note over B: access token kept in memory only (Zustand, not persisted)
    B->>A: API calls with Authorization Bearer accessToken
    Note over B,A: access token expires (JWT_EXPIRES_IN, 15m)
    B->>A: POST /auth/refresh-token (cookie)
    A->>DB: verify secret hash, rotate (compare-and-swap), check user ACTIVE
    A-->>B: new accessToken + rotated cookie
    B->>A: POST /auth/logout (cookie)
    A->>DB: Session.revokedAt = now
    A-->>B: clear cookie
```

### 8.2 Component details

| Topic | Implementation |
|---|---|
| **Registration** | Student and trainer only. Password policy: 8–72 characters with lowercase, uppercase and digit (72 is bcrypt's input limit). Duplicate email → 409. User + profile created in one transaction. |
| **Email OTP** | 6 digits from `crypto.randomInt`, stored as a SHA-256 hash, expires after `OTP_EXPIRES_MINUTES` (10) via a TTL index. Only the newest code is valid. 5 wrong attempts → 429. Unknown, already-verified or missing-code emails all get the same generic error (no account enumeration; tested L1). |
| **Login** | Email + password. An unknown email still runs a bcrypt comparison against a dummy hash, so response time doesn't reveal whether the account exists. Unknown email and wrong password return the same 401 "Invalid email or password". Only **after** a correct password are unverified, pending, rejected, blocked and suspended accounts told their status (403). `lastLoginAt` is updated. `rememberMe` is accepted by the schema but **has no effect**. |
| **Access token** | JWT, **HS256 pinned** on sign and verify. Payload `{ sub, sid, role, status }`. Lifetime `JWT_EXPIRES_IN` (code default **15m**). Returned in the JSON body. The frontend holds it **in memory only**. |
| **Access token checks** | On **every** request: signature and expiry → `Session` exists for `sid` + `sub`, is not revoked and not expired → user exists → user `status === "ACTIVE"`. The role used for authorization is the **live database role**, not the token claim (tested: "never trusts a client-supplied role"). |
| **Token transport** | `Authorization: Bearer` header **only**. Cookies are never accepted as an access token, which removes CSRF exposure for state-changing routes (tested M5). |
| **Refresh token** | Opaque `<sessionId>.<64-hex secret>`. Only `sha256(secret)` is stored. Sent as cookie `refreshToken`: `httpOnly`, `Secure` (always outside development/test, and whenever `SameSite=None`), `SameSite = COOKIE_SAMESITE`, `path=/api/v1/auth`, `maxAge = SESSION_TTL_DAYS` (30). |
| **Token rotation** | Every successful refresh issues a new secret using a compare-and-swap update. The previous secret stays valid for **30 seconds** (so several tabs refreshing at once don't lock each other out). Presenting an older, already-rotated secret outside that window counts as **reuse**: the whole session is revoked. Tested: "rotates the refresh token on every refresh". |
| **Session storage** | `Session` collection: `user`, `refreshTokenHash`, `previousRefreshTokenHash`, `rotatedAt`, `expiresAt` (TTL index deletes expired rows), `revokedAt`, `lastUsedAt`. One login = one session, so several devices each have their own. |
| **Logout** | `POST /auth/logout` revokes **only this device's** session (matched by the cookie) and clears the cookie. Existing access tokens for that session stop working immediately, because every request checks the session (tested M5). |
| **Session revocation** | Password reset → **all** sessions revoked. Block or suspend → **all** sessions revoked. A refresh by a non-`ACTIVE` user → that session revoked. There is no admin UI to list or kill individual sessions. |
| **Password reset** | `POST /auth/forgot-password` always returns the same message. If the account exists, a 32-byte random token is created (SHA-256 stored, expires after `RESET_TOKEN_EXPIRES_MINUTES` = 30, TTL index) and a link `CLIENT_URL/reset-password?token=…` is handed to the email service. `POST /auth/reset-password` checks the token (unused, unexpired), sets the new bcrypt hash, **revokes all sessions**, marks the token used and invalidates every other outstanding reset token for the user. |
| **Account blocking / suspension** | Admin `PATCH /users/:id/block` or `/suspend` (optional reason) → status change + all sessions revoked + audit log. Enforced on the very next request, even with an unexpired access token (tested). Admin accounts cannot be blocked or suspended through these endpoints. |
| **Token expiration** | Access: `JWT_EXPIRES_IN`. Refresh session: `SESSION_TTL_DAYS`. There is no idle timeout separate from these. |
| **Failure handling (backend)** | Missing token → 401 "Authentication token is missing". Invalid or expired JWT → 401. Session ended → 401 "Session has ended. Please log in again." Non-active account → 403 "Account is blocked/suspended/…". Refresh failure clears the cookie. |
| **Failure handling (frontend)** | The Axios response interceptor catches **401**, performs **one** deduplicated refresh (`POST /auth/refresh-token` on a separate Axios instance) and retries the original request once. If refresh fails, auth state is cleared and the browser goes to `/login`. On page reload, `RequireAuth` restores the session from the refresh cookie before rendering protected layouts. |
| **Password storage** | bcrypt, 12 salt rounds. `passwordHash` has `select: false`, so it is never returned by default queries. |

### 8.3 Required production configuration

```env
JWT_SECRET=YOUR_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS_HERE
JWT_EXPIRES_IN=15m
SESSION_TTL_DAYS=30
COOKIE_SAMESITE=none   # or lax — see §24.4
CLIENT_URL=https://YOUR_FRONTEND_ORIGIN_HERE
NODE_ENV=production
```

- `JWT_EXPIRES_IN=15m` matches the code default (`config/env.ts`). Set it explicitly so a stray value in the host environment can't lengthen token lifetime.
- Outside `development`/`test` the server **refuses to start** if `JWT_SECRET` is shorter than 32 characters or still starts with `replace-with`, or if `CLIENT_URL` is not set.
- Any `NODE_ENV` value other than `development` or `test` (including unset or misspelled) gets the strict behaviour: `Secure` cookies and generic 500 messages.
- `JWT_REFRESH_SECRET` appears in `tests/setupEnv.ts` but is **not read by the application**. Refresh tokens are opaque random values, not JWTs.

---

## 9. Authorization and security

### 9.1 Implemented protections

| Area | Control | Where | Evidence |
|---|---|---|---|
| **Role-based authorization** | `authorize(...roles)` on every protected route, using the role re-read from the database on each request | `middleware/authorize.ts`, all `routes/*` | `authorization.test.ts` |
| **Ownership validation** | Queries are filtered by the requester's id (fees, payment requests, notifications, certificates `/my`, applications, attendance, submissions) | services | `feePaymentVerification`, `notifications`, `certificates` tests |
| **IDOR protection** | Another user's record is answered with **404** (existence not confirmed) for payment requests, screenshots, notifications, job applications and enrollment balances. Batch- and course-scoped resources return 403. | `paymentRequest.service`, `notification.service`, `job.service`, `fee.service` | "enforces role and ownership on every payment endpoint"; notifications test |
| **Student restrictions** | Enrollment + lock-state gate on all lesson, quiz, coding and final-assessment endpoints. Drafts hidden. Answer keys stripped. Attendance forced to self. | `utils/lessonAccess.ts`, `task.service`, `attendance.service` | `curriculumAccess`, `studentJourney`, `securityRegression` |
| **Trainer restrictions** | Batch-assignment scoping for batches, materials, schedules, tasks, submissions and attendance. Course-assignment scoping for curriculum, final assessments, interview resources and progress (plus "student must be in the trainer's batch"). No deleting content with student progress. | `utils/batchAccess.ts`, services | `trainerAuthorizationMatrix`, `batchAccess`, `securityRegression` (M1–M4, M8) |
| **Admin restrictions** | Admin accounts can't be blocked or suspended via API. Payment approval is re-validated against the current balance. Certificate issuance requires course completion. | services | tests |
| **Protected API routes** | Everything except: `GET /health`, `GET /courses` (published list), `POST /auth/*` (register, OTP, login, refresh, logout, forgot/reset), `GET /certificates/verify/:number` | `routes/*` | route files |
| **Input validation** | Zod schemas on bodies, queries and (payment routes) params. Parsed output replaces the raw input. Types coerced, strings trimmed, lengths bounded. | `middleware/validate.ts`, `validators/*` | tests |
| **Unknown-field handling** | **Payment write schemas are `.strict()`**: submit payment request, approve and reject **reject** any extra field (e.g. `status`, `amountPaid`, `studentId`) with 422. **All other schemas use Zod's default behaviour: unknown fields are silently stripped** before reaching the service, so they can't be mass-assigned, but they are not reported as errors. | `validators/fee.validator.ts` vs. others | "rejects tampered payloads" |
| **NoSQL injection** | `express-mongo-sanitize` strips `$` and `.` keys from body, params and query (patched for Express 5's getter-only `req.query`). | `middleware/sanitize.ts` | — |
| **Regex / ReDoS** | User search text is escaped into a literal regex and bounded to 100 characters. | `utils/searchRegex.ts`, `validators/common.ts` | — |
| **Link safety** | `httpUrl()` accepts only `http:`/`https:` for every user-supplied URL (avatars, resumes, materials, submissions, meeting links, job links). This blocks `javascript:`/`data:` stored XSS. | `validators/common.ts` | L3 test |
| **File validation** | Allowlisted MIME types + extension ↔ type match + **magic-byte content check**. SVG rejected. Size caps (25 MB general, 5 MB images). | `utils/fileSignature.ts`, `utils/imageValidation.ts`, `middleware/upload.ts` | M7 test, payment screenshot test |
| **Private files** | Payment screenshots and the QR code are Cloudinary `authenticated` assets. The storage key has `select: false` and is stripped from every response. Images are only streamed through authorized routes with `Cache-Control: private, no-store`. | `upload.service.ts`, `paymentRequest.service.ts` | "screenshot key never exposed" |
| **Rate limiting** | Global 300 / 15 min / IP. Auth endpoints (register, login, verify OTP, reset) 20 / 15 min / IP. Refresh and logout 100 / 15 min / IP. OTP resend and forgot-password 5 / 10 min / IP. Coding 10 / min / user. Uploads (`POST /uploads`) 30 / hour / user. | `middleware/rateLimiters.ts` | — |
| **Error handling** | Centralized handler. Internal error text only in `development`/`test`. Generic "Internal server error" otherwise. Stack traces logged server-side only. | `middleware/errorHandler.ts` | — |
| **Sensitive data protection** | `passwordHash` and `screenshot` have `select: false`. OTPs, reset tokens and refresh secrets are stored as SHA-256 hashes. Admin identity is reduced to `reviewedByName` in student views. The student's phone is only returned by admin payment endpoints. Logger policy: never log passwords, secrets, OTPs or tokens. Public certificate verification returns only denormalized display fields. | models, services, `utils/logger.ts` | WhatsApp phone test |
| **Transport / headers (API)** | Helmet defaults (incl. `X-Content-Type-Options: nosniff`, HSTS), CORS restricted to `CLIENT_URL` with credentials, `trust proxy = 1`, ETag disabled. | `app.ts` | — |
| **Transport / headers (frontend)** | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, `poweredByHeader: false`. | `frontend/next.config.ts` | — |
| **Email HTML injection** | User-controlled values are HTML-escaped in email templates. | `email.service.ts` | — |
| **Certificate enumeration** | Certificate numbers carry 64 random bits (`SSR-<year>-<16 hex>`). | `certificate.service.ts` | — |
| **Boot-time guardrails** | Refuses to start with a weak or placeholder `JWT_SECRET` or a missing `CLIENT_URL` outside development. | `config/env.ts` | — |
| **Audit trail** | `AuditLog` rows for user, course, batch, curriculum, task, material, attendance, fee, payment, certificate, job, interview and announcement actions. Failures never break the request. | `services/auditLog.service.ts` | — |

### 9.2 Security test results

| Suite | Tests | Result |
|---|---|---|
| `tests/securityRegression.test.ts` | 21 | 21 passed |
| `tests/codingJudge.test.ts` | 6 | 6 passed |
| **Security total** | **27** | **27 passed** |
| **All backend suites (14 files)** | **88** | **88 passed** (see verification note) |

### 9.3 Remaining recommendations (not implemented)

These are **infrastructure or hardening recommendations**, not existing controls.

| # | Recommendation | Why |
|---|---|---|
| R1 | **Block outbound network access for the coding grader** (dedicated judge container, `--network none` or egress firewall). | Node's permission model doesn't restrict network access (§7.5). |
| R2 | Move rate-limit and grader-queue state to a shared store (e.g. Redis) if more than one API instance runs. | Current counters are in-memory per process and reset on restart. |
| R3 | Add a full Content-Security-Policy (`script-src` with nonces) to the frontend. | Only `frame-ancestors`/`base-uri`/`object-src` are set today. The code comment defers script CSP. |
| R4 | Configure SMTP in production and monitor send failures. | Email is best-effort with no retry queue: failures are logged and never fail the request (§13.5). |
| R5 | Consider making all write schemas `.strict()`. | Only payment schemas reject unknown fields. Others strip them silently. |
| R6 | Populate `AuditLog.ipAddress`. | The field exists but no caller passes it. |
| R7 | Remove the `express.static("/uploads")` mount if unused. | No current code writes there. Anything placed in `backend/uploads/` would be publicly served. |
| R8 | Serve general uploads (materials, submissions) as authenticated assets if confidentiality matters. | They are public Cloudinary URLs today (§16). |
| R9 | Use custom domains that share one registrable domain for frontend and API. | Allows `COOKIE_SAMESITE=lax` and avoids third-party-cookie blocking of the refresh cookie (§24.4). |

---

## 10. Payment and fees system

Source: `services/fee.service.ts`, `services/paymentRequest.service.ts`, `services/paymentSettings.service.ts`, `routes/fee.routes.ts`, `validators/fee.validator.ts`, frontend `app/student/fees`, `app/admin/fees`, `components/student/pay-fee-dialog.tsx`, `components/admin/payment-request-dialog.tsx`, tests `tests/feePaymentVerification.test.ts` (13 tests) and `tests/emailService.test.ts` (4 tests).

### 10.1 Fee model — how a balance is calculated

There is **no stored balance**. For every enrollment the backend computes:

```
finalFee   = max(0, Course.fee − Enrollment.discount)
amountPaid = round2( Σ Payment.amount  where Payment.student = enrollment.student
                                         and Payment.batch   = enrollment.batch )
amountDue  = round2( max(0, finalFee − amountPaid) )
```

`round2` rounds to paise to avoid floating-point drift. Only **`Payment` ledger rows** move money. A `PaymentRequest` (screenshot submission) never changes the balance until it is approved.

| Status field | Values | Meaning |
|---|---|---|
| `status` (ledger status, admin view) | `PAID` / `PARTIALLY_PAID` / `PENDING` | due ≤ 0 / 0 < due < finalFee / due = finalFee |
| `paymentStatus` (student-facing) | `PAYMENT_UNDER_REVIEW` / `PAID` / `REJECTED` / `PENDING` | a PENDING request exists / due ≤ 0 / latest request rejected / otherwise |
| `canPay` | boolean | `true` when no request is pending **and** `amountDue > 0` |

### 10.2 End-to-end workflow

```mermaid
sequenceDiagram
    actor S as Student
    participant FE as Frontend
    participant API as Backend
    participant DB as MongoDB
    participant CL as Cloudinary (authenticated)
    actor A as Admin
    S->>FE: Fees page → "Pay Now" on an enrollment with amountDue > 0
    FE->>API: GET /fees/payment-settings, GET /fees/payment-settings/qr-code
    API-->>FE: QR image (private, no-store)
    S->>S: Pays via UPI using the QR code
    S->>FE: Enters amount paid, selects screenshot (PNG/JPG/JPEG/WEBP ≤ 5 MB)
    FE->>API: POST /fees/payment-requests (multipart: enrollmentId, amount, screenshot)
    API->>DB: ownership + balance from DB, no pending request, amount ≤ due
    API->>API: magic-byte image validation
    API->>CL: upload as authenticated asset
    API->>DB: PaymentRequest {status: PENDING, fee snapshots}
    API->>DB: Notification PAYMENT_SUBMITTED → every ACTIVE admin
    API-->>FE: 201 (student now sees "Payment under review")
    A->>FE: Admin Fees → Verification tab
    FE->>API: GET /fees/payment-requests/:id (+ history, currentBalance), GET .../screenshot
    alt Approve (optionally a corrected amount)
        FE->>API: PATCH /fees/payment-requests/:id/approve {amount?}
        API->>DB: transaction: re-check PENDING + current balance → status APPROVED + Payment ledger row
        API->>DB: Notification PAYMENT_APPROVED → student
        API-->>S: Automatic payment-approved email to the registered address (§13.5)
        A->>A: Optional: "Send WhatsApp" (wa.me link, §12)
        S->>FE: Payment History → download PDF receipt (§11)
    else Reject (reason 5–500 chars)
        FE->>API: PATCH /fees/payment-requests/:id/reject {reason}
        API->>DB: conditional update PENDING → REJECTED
        API->>DB: Notification PAYMENT_REJECTED → student (includes reason)
        S->>FE: Sees reason, can submit a new screenshot
    end
```

### 10.3 Rules and safeguards

| Topic | Behaviour |
|---|---|
| **Who can pay** | `STUDENT` only. The enrollment must belong to the authenticated student (otherwise 404 "Enrollment not found"). |
| **Payment modal** | Shows total fee, already paid, remaining, the QR code (or a placeholder if none is configured), an amount field defaulting to the remaining fee, and screenshot upload with preview and progress. Client checks are only for fast feedback. The backend re-validates everything. |
| **QR code** | A singleton `PaymentSettings` document. Admins replace it (`PUT /fees/payment-settings/qr-code`, image ≤ 5 MB) or remove it. Students and admins read it via an authorized route. Changing the payee account needs no redeploy. |
| **Partial payments** | Allowed: any amount > 0 and ≤ current `amountDue`, max 2 decimal places, ≤ ₹10,000,000. After approval the enrollment becomes `PARTIALLY_PAID` and the student can pay again. |
| **Full payments** | When approval brings `amountDue` to 0 the status becomes `PAID`, `canPay` becomes false, and further submissions get 409 "already fully paid". The student gets a "Course Fee Fully Paid" notification. |
| **Pending verification** | While a request is `PENDING` the student sees `PAYMENT_UNDER_REVIEW` and cannot submit another. |
| **Rejected payments** | Require a reason. The request keeps its full record. The student sees the latest rejection reason on the fees page. |
| **Resubmission** | After a rejection (or after a partial approval with balance left) the student can submit a new request. Every submission is a **separate, never-overwritten** record, so the full trail per enrollment is auditable. |
| **Duplicate prevention** | Service pre-check **plus** a partial unique index `one_pending_per_enrollment` (`{enrollment:1}` where `status = PENDING`). A concurrent duplicate is caught by the index, its uploaded file is deleted, and it returns 409 (tested: "including concurrent submissions"). |
| **Approval race protection** | Approval runs in a MongoDB **transaction**: re-read → must be `PENDING` → re-compute balance → conditional `findOneAndUpdate({status: PENDING})` → insert `Payment`. If two admins race, exactly one transition succeeds and the other gets **409** "already approved/rejected by <name>" (tested). Rejection is a single conditional update, so it cannot overwrite an approval. `Payment.paymentRequest` has a unique partial index, so one request can never produce two ledger rows. |
| **Server-side amount validation** | At submission: `amount ≤ amountDue` computed from the DB. At approval: `approvedAmount` (admin override or the claimed amount) is re-checked against the **current** balance, because the fee, discount or other payments may have changed. Approval of a request whose enrollment was removed returns 409 ("reject instead"). Tested: "re-validates against current DB state at approval time". |
| **Tamper resistance** | Submit, approve and reject bodies are `.strict()`: any extra field such as `status`, `amountPaid` or `studentId` → 422. Fee snapshots (`totalFee`, `previousPaidAmount`, `amountDueAtSubmission`), student and course names are taken from the DB, never from the client. |
| **Ledger entry for approvals** | `Payment { amount: approvedAmount, paymentDate: request.submittedAt, paymentMethod: "UPI", transactionRef: "PR-<requestId>", notes: "Verified from student-submitted payment screenshot", receiptNumber, recordedBy: admin, paymentRequest }`. |
| **Cash / manual payments** | Admin → Fees → **Record payment** (`POST /fees/payments`). Method defaults to **CASH** (also card, UPI, bank transfer, other). The form shows the student's total fee, paid and remaining amounts, and has a "Fill remaining" shortcut. Rules: the student must be enrolled in the batch, the amount must be > 0 with ≤ 2 decimals, and it **cannot exceed the current remaining fee** (400; 409 if already fully paid). The check and insert run in a transaction that writes to the enrollment first, so two admins recording at once cannot overshoot the fee (one gets 409). On success the student gets an in-app `PAYMENT_RECORDED` notification ("Payment Received" or "Course Fee Fully Paid") and an automatic **payment-received email** (§13.5). The response includes `paidAfterPayment`, `remainingAfterPayment` and `studentEmailSent`, and the admin sees whether the email went out. The payment date is the day it is recorded (the form has no date field). Recorded payments cannot be edited or deleted. |
| **Discounts** | `PATCH /fees/enrollments/:enrollmentId/discount` (admin, ≥ 0). `finalFee` is clamped at 0. |
| **Payment history** | Student: `GET /fees/my-payments` (ledger) and `GET /fees/my-payment-requests` (all submissions with status and reason). Admin: `GET /fees/payments` (paginated ledger, search by receipt number or student name), `GET /fees/payments/:studentId/:batchId`, and per-request history inside `GET /fees/payment-requests/:id`. |
| **Receipt generation** | For every `Payment` row, in the browser (§11). |
| **Audit** | `PAYMENT_REQUEST_SUBMITTED`, `PAYMENT_REQUEST_APPROVED` (claimed vs approved amount), `PAYMENT_REQUEST_REJECTED`, `PAYMENT_RECORDED`, `FEE_DISCOUNT_UPDATED`, `PAYMENT_QR_UPDATED`, `PAYMENT_QR_REMOVED`. |
| **Notification failures** | Payment notifications are sent after the state change commits, inside `safeNotify`. A notification failure is logged and never turns a successful submission or review into an error. |

### 10.4 Request states

```mermaid
stateDiagram-v2
    [*] --> PENDING: student submits screenshot
    PENDING --> APPROVED: admin approves (transaction → Payment row)
    PENDING --> REJECTED: admin rejects with reason
    APPROVED --> [*]
    REJECTED --> [*]
    note right of REJECTED: student may create a NEW request
```

---

## 11. Payment receipts

Source: `frontend/lib/receipt.ts`, `frontend/components/shared/receipt-download-button.tsx`.

### 11.1 Where receipts are generated

Receipts are generated **in the browser** (frontend) with **jsPDF**, loaded on demand (dynamic import, so it isn't in the page bundle). The backend provides the data (`Payment` record, including the receipt number) but **does not generate, store or sign PDF files**.

Available from:

- **Student:** Fees page → *Payment History* → receipt number link (data from `GET /fees/my-payments`).
- **Admin:** Fees page → *Payment History / ledger* → receipt number link (data from `GET /fees/payments`).

Receipts exist only for **recorded payments** (approved screenshot requests and manual payments). Pending or rejected requests have no receipt.

### 11.2 Receipt contents

| Field | Source |
|---|---|
| Receipt number | `Payment.receiptNumber`, generated by the backend as `RCPT-<timestamp base36>-<4 random chars>`, unique index |
| Date | `Payment.paymentDate` (for approved screenshots this is the student's **submission** date) |
| Student | `payment.student.name` (populated) |
| Email | `payment.student.email` (shown if present) |
| Course | `payment.course.name` |
| Batch | `payment.batch.name` |
| Payment method | `Payment.paymentMethod` (`UPI` for approved screenshots; admin's choice for manual payments) |
| Transaction reference | `Payment.transactionRef` (`PR-<paymentRequestId>` for approved screenshots; admin input for manual payments). Omitted if empty. |
| Notes | `Payment.notes` (omitted if empty) |
| Amount | `Payment.amount`, formatted `Rs. 12,345.00` (en-IN grouping) |
| Amount in words | Indian numbering (crore/lakh/thousand), e.g. "Rupees One Lakh Twenty Five Thousand Only", with paise if present |
| Footer | "This is a computer-generated receipt and does not require a signature." + receipt number + generation date |

### 11.3 Download behaviour

Clicking the receipt number shows a spinner while the PDF is built, then saves `Receipt-<receiptNumber>.pdf` via `doc.save()`. If generation fails the user sees a toast: "Couldn't generate the receipt. Please try again."

### 11.4 Limitations of browser-generated PDFs

- **No server-side copy or signature.** The PDF can be regenerated at any time, and it isn't cryptographically signed. There is **no receipt verification endpoint**, so a recipient cannot confirm a receipt's authenticity online (unlike certificates).
- The PDF shows whatever the API returned at download time. Names are **live** (populated from the current User, Course and Batch), so a later rename changes re-downloaded receipts.
- The built-in Helvetica font has no ₹ glyph, so amounts use "Rs.".
- No institute address, tax or GST details, logo image, or authorised signatory. Only the text "SSR Institute".
- Depends on client-side JavaScript and the browser's download handling. Some mobile browsers may open instead of save. Rendering across browsers is **Requires manual verification** (no browser testing was performed).
- The "Generated on" date is the viewer's local date, and dates are formatted in the viewer's timezone.

---

## 12. WhatsApp functionality

Source: `frontend/lib/whatsapp.ts`, `frontend/components/admin/send-whatsapp-button.tsx`, `frontend/app/admin/fees/page.tsx`. Backend support: admin payment endpoints populate `student.phone` (tested: "gives admins (only) the registered phone needed for the Send WhatsApp button").

### 12.1 What it is

A **WhatsApp Click-to-Chat (`https://wa.me`) link**. It is **not** the Meta WhatsApp Cloud/Business API. **No message is sent by the system.** The button opens WhatsApp (web or app) in a new tab with a pre-filled message, and the admin must review it and press **Send** themselves.

### 12.2 When it is available

| Location (Admin → Fees) | Condition |
|---|---|
| Payment History / ledger table | Every recorded `Payment` row (approved screenshots **and** manual payments) |
| Verification tab | Payment requests with status `APPROVED` |

It is **admin-only** (admin pages). It is **not** triggered automatically on approval.

### 12.3 How the number is obtained

- From the student's **registered phone** (`User.phone`, captured at registration and editable by the student via `PATCH /auth/me`), populated by the admin-only endpoints `GET /fees/payments` and `GET /fees/payment-requests`. Student-facing endpoints never return the phone.
- `toWhatsAppNumber()` normalizes it to wa.me's digits-only international format:
  - `+…` or `00…` prefix → treated as international (8–15 digits). If it starts with `91` it must be a valid Indian mobile.
  - Otherwise treated as an **Indian mobile**: 10 digits starting 6–9, optionally with a leading `0` or `91` → `91XXXXXXXXXX`.
  - Anything else → `null`, and the admin sees "Please update the student's registered mobile number before sending WhatsApp." A missing number shows "Student WhatsApp number is not available."

### 12.4 Message

Only the student's name is interpolated (no ids, amounts or links):

```
Hello <Student name>,

Your payment has been approved by SSR Institute Admin.

Please login to the LMS/CRM portal to view and download your payment receipt.

Thank you,
SSR Institute
```

URL: `https://wa.me/<number>?text=<URL-encoded message>`, opened with `window.open(url, "_blank", "noopener,noreferrer")`.

### 12.5 After payment approval

1. Backend: request → `APPROVED`, `Payment` row created, in-app `PAYMENT_APPROVED` notification to the student, and an **automatic payment-approved email** to the student's registered address (§13.5). Unlike WhatsApp, the email needs no admin action.
2. Admin (optional, manual): clicks **Send WhatsApp** → WhatsApp opens → admin presses Send.
3. Student: logs in and downloads the receipt from Payment History.

### 12.6 Limitations

- Manual. It depends on the admin's device having WhatsApp or WhatsApp Web, and on the admin pressing Send.
- No delivery or read status, no retries, no logging or audit of WhatsApp messages, no API call to the backend.
- Default country assumption is India (`91`). Non-Indian numbers must be stored with `+` and country code.
- The number is not verified as a WhatsApp account. It is only format-checked.
- The message does not include the amount or receipt number.
- The ledger button also appears for manual payments, where the fixed text ("approved by SSR Institute Admin") may not fit exactly.

---

## 13. Notifications

Source: `services/notification.service.ts`, model `Notification`, `routes/notification.routes.ts`, frontend `hooks/useNotifications.ts`.

### 13.1 Generation and delivery

- Notifications are **in-app records** in the `Notification` collection, created server-side by services at the moment of the triggering event (`notifyUser` / `notifyUsers`).
- **Delivery is by polling:** the frontend fetches the list and polls `GET /notifications/unread-count` **every 30 seconds**. There are no WebSockets, push notifications or SMS.
- Some events also send an **email** through SMTP (§13.5). Emails are best-effort and are only logged when SMTP isn't configured.

### 13.2 Notification catalogue

| Type | Trigger | Recipient(s) | Link |
|---|---|---|---|
| `ACCOUNT_APPROVED` | Admin approves a pending user | That user | `/login` |
| `ACCOUNT_REJECTED` | *Defined in the enum but never created.* Rejected users get an email only. | — | — |
| `TASK_PUBLISHED` | Task status set to `PUBLISHED` | All students enrolled in the task's batch | `/student/tasks` |
| `SUBMISSION_EVALUATED` | Trainer/admin evaluates a submission | The student | `/student/tasks` |
| `INTERVIEW_SCHEDULED` | Mock interview scheduled | The student | `/student/interviews` |
| `CERTIFICATE_ISSUED` | Admin issues a certificate | The student | `/student/certificates` |
| `APPLICATION_STATUS_CHANGED` | Admin changes a job application's status | The student | `/student/jobs` |
| `ANNOUNCEMENT` | Announcement created with `publishAt ≤ now` | Resolved audience (everyone / all students / all trainers — ACTIVE users; or students enrolled in a batch / course) | — |
| `PAYMENT_SUBMITTED` | Student submits a payment screenshot | **Every ACTIVE admin** | `/admin/fees?tab=verification` |
| `PAYMENT_APPROVED` | Admin approves a payment ("Payment Approved" with paid/remaining, or "Course Fee Fully Paid") | The student | `/student/fees` |
| `PAYMENT_REJECTED` | Admin rejects a payment (message includes the reason) | The student | `/student/fees` |
| `PAYMENT_RECORDED` | Admin records a cash / manual payment ("Payment Received" with paid/remaining, or "Course Fee Fully Paid") | The student | `/student/fees` |

Not notified: certificate **revocation**, account block/suspend, course completion, and **scheduled** announcements (an announcement with a future `publishAt` never produces a notification, because there is no scheduler; it only appears in announcement lists once live).

### 13.3 Read / unread behaviour

| Action | Endpoint | Rule |
|---|---|---|
| List | `GET /notifications?page&limit` (default 20, max 100) | Own notifications only, newest first |
| Unread count | `GET /notifications/unread-count` | Own, `read: false` |
| Mark one read | `PATCH /notifications/:id/read` | Only if it belongs to the requester, otherwise **404** (tested) |
| Mark all read | `PATCH /notifications/read-all` | Own unread → read, sets `readAt` |

There is no delete endpoint and no expiry. Notifications accumulate.

### 13.4 Permissions

Any authenticated role can use the notification endpoints, always scoped to `req.user.id`. Notifications can only be created by backend services. There is no API to create one directly.

### 13.5 Email

Source: `backend/src/services/email.service.ts` (nodemailer over SMTP), test `tests/emailService.test.ts`.

| Email | Trigger | Recipient |
|---|---|---|
| Verification OTP | Registration, `POST /auth/resend-otp` | The registering user |
| Password reset link | `POST /auth/forgot-password` | Account owner |
| Account approved / rejected | Admin approves or rejects a pending user | That user |
| Submission evaluated | Trainer/admin evaluates a submission | The student |
| Mock interview scheduled | Interview scheduled | The student |
| Certificate issued | Admin issues a certificate | The student |
| Application status changed | Admin changes a job application's status | The student |
| **Payment approved** | **Admin clicks Approve on a payment request — sent automatically** | **The student's registered email (`User.email`)** |
| **Payment received** | **Admin records a cash / manual payment — sent automatically** | **The student's registered email** |

**Payment-approved email.** The email is sent after the approval transaction has committed. Subject: `Payment approved — ₹{amount} for {course}`, or `Course fee fully paid — {course}` when nothing remains. It lists the course, batch, amount approved, total paid, remaining fee, payment date and receipt number, and links to `CLIENT_URL/student/fees` to download the receipt. All values come from the committed approval and ledger row. User-supplied text (names) is HTML-escaped. The approve response includes `studentEmailSent: true | false`. The admin sees "A confirmation email was sent to the student", or a warning that it couldn't be sent (the payment stays approved). Rejections do not send this email.

**Payment-received email (cash / manual).** Same layout, sent when an admin records an offline payment. Subject: `Payment received — ₹{amount} for {course}` (or the fully-paid subject). The intro says "Your cash payment has been received and recorded by SSR Institute." (other methods are named accordingly), and the table adds the payment method. The record-payment response carries `studentEmailSent` in the same way.

**Delivery rules**

- Transport: SMTP via nodemailer, configured by `SMTP_HOST`, `SMTP_PORT` (465 = implicit TLS, otherwise STARTTLS), `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM`. The connection is created on first use.
- Without `SMTP_HOST` emails are only logged (recipient and subject, never the body or OTP).
- **Best-effort:** `send()` never throws. An SMTP failure is logged and returns `false`, so it can't turn a committed action into an error. There is **no queue or retry**, so a failed email is not re-sent.
- The test suite forces `SMTP_HOST=""` (`tests/setupEnv.ts`), so tests never send real email even if a developer's `.env` configures SMTP.

---

## 14. Certificates

Source: `services/certificate.service.ts`, model `Certificate`, `routes/certificate.routes.ts`, `utils/lessonAccess.ts`, frontend `app/student/certificates`, `app/verify-certificate/[certificateId]`, test `tests/certificates.test.ts`.

### 14.1 Eligibility (checked by the backend at issuance)

1. The batch exists.
2. The student is enrolled in that batch.
3. **The student has completed the course** (`isCourseCompleted`): every published lesson in the course is completed (and the course has ≥ 1 lesson) **and**, if the course has a *published* final assessment, the student's attempt is `SUBMITTED` with `passed === true`.
4. No `ISSUED` certificate already exists for the same student + batch (409 otherwise).

> **Failing the final assessment does not complete the course.** A failed attempt leaves `isCourseCompleted` false, so certificate issuance is refused ("This student has not completed the course yet") and career resources stay locked. Tested in `securityRegression.test.ts` ("a failed final assessment does not complete the course or unlock a certificate").
>
> **Fees are not checked.** An outstanding balance does not block certificate issuance.
>
> **Batch status is not checked.** The existing `README.md` says the batch must be `COMPLETED`. The current code checks the student's **course completion** instead.

### 14.2 Generation

- **Issued manually by an admin** (`POST /certificates` `{ student, batch }`). There is **no automatic issuance** on course completion, even though the model comment mentions it (`issuedBy` is optional for that reason).
- "Generation" means creating the **certificate record**. There is **no PDF or image certificate rendering** in the codebase. Students see certificate cards with a verification link and a LinkedIn share link.
- On issue: an in-app `CERTIFICATE_ISSUED` notification and a certificate email are sent, and a `CERTIFICATE_ISSUED` audit log is written.

### 14.3 Certificate number

`SSR-<issue year>-<16 uppercase hex characters>`, for example `SSR-2026-9F3A1C0B7D24E6A1`. The 8 random bytes come from `crypto.randomBytes`, so numbers can't be guessed or enumerated. The number has a unique index, and a collision is retried up to 5 times.

### 14.4 Stored data

`certificateNumber`, `student`, `batch`, `course`, and **denormalized** `studentName`, `courseName`, `batchName` (copied at issue time, so renames don't rewrite history and verification never exposes live records), `issueDate`, `status` (`ISSUED`/`REVOKED`), `revokedReason`, `revokedAt`, `issuedBy`.

### 14.5 Verification

- **Public API:** `GET /api/v1/certificates/verify/:certificateNumber` (no authentication). Returns only `certificateNumber, studentName, courseName, batchName, issueDate, status`. An unknown number → 404 "No certificate found with this ID".
- **Public page:** `/verify-certificate/<certificateNumber>` (server-rendered Next.js route) shows a *valid* or *revoked* state.
- **Revoked certificates still resolve** and show `REVOKED`, so a revoked claim reads as invalid rather than unknown.

### 14.6 Access restrictions

| Action | Who |
|---|---|
| Verify by number | Anyone (public) |
| List own certificates (`GET /certificates/my`) | `STUDENT` (own only, incl. revoked) |
| List / view any, issue, revoke | `ADMIN` |
| Revoke | Admin, optional reason. Already-revoked → 400. There is no un-revoke and no hard delete. |

The student Certificates page is shown as locked until the student has completed at least one course or already has an issued certificate (UX only; the backend rules above are what matter).

---

## 15. Jobs and interview features

### 15.1 Job listings (placements)

Source: `services/job.service.ts`, `services/careerResources.service.ts`, models `Job`, `JobApplication`.

| Aspect | Behaviour |
|---|---|
| **Admin management** | Create, edit, set status (`DRAFT`/`PUBLISHED`/`CLOSED`), list with application counts, view applications, change application status (`APPLIED` → `UNDER_REVIEW` → `SHORTLISTED` → `INTERVIEW_SCHEDULED` → `SELECTED`/`REJECTED`). Status changes notify the student (in-app + email). Jobs are never deleted. |
| **Trainer access** | **None.** All job routes are `ADMIN` or `STUDENT`. |
| **Course-completion requirement** | `GET /jobs/public` returns an **empty list** unless the student has completed at least one course (tested M11). |
| **Listing** | `PUBLISHED` jobs with a deadline not yet passed, each with `isEligible` and the student's `applicationStatus`. |
| **Eligibility (enforced on apply)** | Job `PUBLISHED`, deadline not passed, student has completed ≥ 1 course. If `eligibleCourses` is set, one of **those** courses must be completed and the student must be enrolled in one of them. If `minAttendancePercent` is set, the student's overall attendance (PRESENT + LATE over all records) must meet it. A student with no attendance records fails this check. One application per job (unique index → 409). |
| **Student actions** | Apply (optional `resumeUrl`, http/https only), list own applications, withdraw (not after `SELECTED`/`REJECTED`/`WITHDRAWN`). |

### 15.2 Career resources status

`GET /career-resources/status` (student) returns, per enrolled course, `completed` / `careerResourcesUnlocked` and an overall `anyUnlocked` flag. It is a read-only summary. Enforcement lives in each resource's own service.

### 15.3 Interview resources

Source: `services/interviewResource.service.ts`, model `InterviewResource`.

- **Status: placeholder feature.** The model comment says full upload and download is deferred. A resource has `title`, `description`, `course`, optional `fileUrl` (http/https) and `status` (`COMING_SOON` default / `PUBLISHED`).
- **Admin:** create, edit, delete and list any.
- **Trainer:** create, edit, delete and list only for courses they're assigned to (moving a resource to another course also requires access to that course; tested M2).
- **Student:** `GET /interview-resources` returns resources **only for courses the student has completed**. Resources for incomplete courses are omitted entirely. The list is **not filtered by status**, so `COMING_SOON` items of completed courses are returned too.

### 15.4 Mock interviews

Source: `services/mockInterview.service.ts`, model `MockInterview`.

| Role | Access |
|---|---|
| Admin | Schedule for any student, list all (filter by student, interviewer, date range), update, record feedback, delete |
| Trainer | Schedule only for students in their own batches (and, if a batch is given, it must be theirs and the student enrolled; tested M8). Sees, updates, records feedback on and deletes only interviews where they are the interviewer. |
| Student | Lists **own** interviews only. Cannot modify. |

Feedback fields: `rating` (1–5), `strengths`, `weaknesses`, `feedback`, `recommendation`, `result` (`PENDING`/`RECOMMENDED`/`NOT_RECOMMENDED`). Scheduling notifies the student (in-app + email).

> **Mock interviews are not gated by course completion** in the backend. A student can see their scheduled interviews at any time. Only jobs and interview resources are completion-gated.

---

## 16. File uploads

There are **two separate upload pipelines**.

### 16.1 General uploads — `POST /api/v1/uploads`

Used for staff materials, task submission files and similar. The returned URL is then attached to a record through that record's own (authorized) route.

| Aspect | Value |
|---|---|
| Who | Any authenticated role (`ADMIN`, `TRAINER`, `STUDENT`) |
| Rate limit | 30 uploads / hour / user |
| Transport | `multipart/form-data`, field `file`, optional `folder` |
| Size | ≤ **25 MB** (Multer limit → 400 "File is too large (max 25MB)") |
| Allowed types | JPEG, PNG, GIF, WEBP, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, ZIP, MP4, MOV, WEBM. **SVG is not allowed** (scriptable). |
| Validation | 1) Multer MIME allowlist. 2) `assertValidUpload`: non-empty, extension must match the declared type, **leading-byte signature** must match (e.g. `%PDF-`, PNG header, ZIP `PK\x03\x04` for Office Open XML, OLE header for legacy Office, `ftyp` for MP4/MOV, EBML for WEBM, no NUL bytes for TXT). |
| Storage | Cloudinary, `resource_type: auto`, folder `ssr-portal/<folder>`. **Students are always forced into `submissions`.** Staff folder names must match `[a-z0-9-]{1,40}`, otherwise `general`. |
| Visibility | **Public** — the response contains Cloudinary's `secure_url`. Anyone holding the URL can open the file. |
| Response | `{ url, publicId, resourceType, format, bytes, originalName }` |
| Without Cloudinary | 500 "File storage is not configured (missing Cloudinary credentials)". There is no local fallback. |

### 16.2 Private images — payment screenshots and payment QR code

| Aspect | Value |
|---|---|
| Endpoints | `POST /fees/payment-requests` (field `screenshot`, student), `PUT /fees/payment-settings/qr-code` (field `qrCode`, admin) |
| Order of checks | `authenticate` → `authorize` **before** Multer, so unauthorized callers never have a file buffered |
| Size / count | ≤ **5 MB**, 1 file, ≤ 10 fields |
| Allowed types | PNG, JPG, JPEG, WEBP only. Extension, declared MIME **and** sniffed content must all agree (`assertValidImage`). |
| Storage (production) | Cloudinary `type: "authenticated"`, folder `ssr-portal/private/payment-screenshots` or `ssr-portal/private/payment-qr`. Only `{ provider, key, mimeType, bytes }` is stored. |
| Storage (development without Cloudinary) | Local folder `backend/private-uploads/<folder>/<uuid>.<ext>`, outside the statically served `uploads/` directory. The key must match a strict regex (no path traversal). **In production without Cloudinary, private uploads fail with 500** instead of falling back to disk. |
| Reading | Server-side only: Cloudinary `private_download_url` with a **60-second expiry**, fetched by the API and streamed to the client. The storage key and signed URL are never sent to clients. |
| Response headers | `Content-Type` = verified MIME, `Cache-Control: private, no-store`, `Content-Disposition: inline` |
| Clean-up | Upload is deleted if creating the request fails (e.g. duplicate race). Replacing or removing the QR deletes the previous file (best effort). |

### 16.3 Screenshot access authorization

`GET /fees/payment-requests/:id/screenshot`:

- `ADMIN` → any request's screenshot.
- `STUDENT` → only if `PaymentRequest.student` equals the requester. Otherwise **404** (existence not confirmed).
- `TRAINER` → 403 (route allows only `STUDENT`, `ADMIN`).
- Invalid id format → 422 (`validateParams`).

The frontend fetches screenshots and the QR as **blobs with the Authorization header** and renders them as data URLs, so no public URL is ever involved.

### 16.4 Other notes

- `app.ts` still mounts `express.static` for `/uploads` (the `backend/uploads/` folder). No current code writes there. Anything placed in that folder would be publicly readable. Railway's filesystem is also ephemeral.
- Profile fields like `avatarUrl` and `resumeUrl` are **URLs** (http/https only), not uploaded binaries handled by a dedicated endpoint.

---

## 17. Database

MongoDB (Atlas in production) through Mongoose 8. **A replica set is required**, because registration and payment approval use multi-document transactions. All models have `createdAt`/`updatedAt` timestamps unless noted. Source: `backend/src/models/*.ts` (33 models).

### 17.1 Core relationships

```mermaid
erDiagram
    User ||--o| StudentProfile : "role STUDENT"
    User ||--o| TrainerProfile : "role TRAINER"
    User ||--o{ Session : has
    Course ||--o{ Batch : "runs as"
    User ||--o{ Batch : "trainer of"
    Batch ||--o{ Enrollment : contains
    User ||--o{ Enrollment : "student in"
    Course ||--o{ Module : has
    Module ||--o{ Topic : has
    Topic ||--o{ Lesson : has
    Course ||--o| FinalAssessment : has
    User ||--o{ LessonProgress : tracks
    Lesson ||--o{ LessonProgress : "progress on"
    Lesson ||--o{ QuizAttempt : "attempted in"
    Lesson ||--o{ CodingSubmission : "graded in"
    FinalAssessment ||--o{ FinalAssessmentAttempt : "attempted in"
    Enrollment ||--o{ PaymentRequest : "fee claims"
    PaymentRequest ||--o| Payment : "approved into"
    User ||--o{ Payment : pays
    Batch ||--o{ Certificate : "issued for"
    User ||--o{ Certificate : holds
    User ||--o{ Notification : receives
    Job ||--o{ JobApplication : receives
    User ||--o{ JobApplication : submits
    Batch ||--o{ Task : has
    Task ||--o{ Submission : receives
```

### 17.2 Identity and access

| Model | Purpose | Important fields | Indexes | Security-sensitive |
|---|---|---|---|---|
| `User` | Every account | `name`, `email` (unique, lowercase), `phone`, `passwordHash`, `role` (`ADMIN`/`TRAINER`/`STUDENT`), `status` (`PENDING`/`ACTIVE`/`REJECTED`/`BLOCKED`/`SUSPENDED`), `isEmailVerified`, `avatarUrl`, `rejectionReason`, `lastLoginAt` | `email` unique; `phone`; `role`; `status`; `{role, status}`; text `{name, email}` | `passwordHash` (`select: false`, bcrypt), `phone` (admin-only exposure), `role`/`status` (never client-writable) |
| `StudentProfile` | Student details | `user` (unique), `dateOfBirth`, `gender`, `address`, `highestQualification`, `college`, `graduationYear`, `percentageOrCgpa`, `skills[]`, `experience`, `resumeUrl`, `portfolioUrl`, `linkedinUrl`, `githubUrl`, `interestedCourse` | `user` unique | Personal data |
| `TrainerProfile` | Trainer details | `user` (unique), `qualification`, `skills[]`, `specialization`, `experienceYears`, `bio`, `resumeUrl`, `documentUrls[]` | `user` unique | Personal data |
| `Session` | One per login (refresh session) | `user`, `refreshTokenHash`, `previousRefreshTokenHash`, `rotatedAt`, `expiresAt`, `revokedAt`, `lastUsedAt` | `user`; **TTL** on `expiresAt` | Hashes only, never the raw secret |
| `OTPVerification` | Email-verification codes | `user`, `otpHash`, `purpose` (`EMAIL_VERIFICATION`; `LOGIN_2FA` is defined but unused), `expiresAt`, `attempts`, `verified` | `user`; **TTL** on `expiresAt` | Hash only |
| `PasswordResetToken` | Reset links | `user`, `tokenHash` (unique), `expiresAt`, `used` | `tokenHash` unique; **TTL** on `expiresAt` | Hash only |
| `AuditLog` | Admin/staff action trail | `user`, `action`, `entity`, `entityId`, `metadata`, `ipAddress` (never populated) | `user`; `action` | No `updatedAt` |

### 17.3 Courses, batches and curriculum

| Model | Purpose | Important fields | Relationships | Indexes |
|---|---|---|---|---|
| `Course` | A programme | `name`, `shortDescription`, `fullDescription`, `category`, `duration`, `fee` (≥ 0), `thumbnailUrl`, `status`, `requirements[]`, `learningOutcomes[]` | — | `name`; `status`; text `{name, category}` |
| `Batch` | Cohort of a course | `name`, `course`, `trainer?`, `startDate`, `endDate`, `classDays[]`, `startTime`, `endTime`, `mode`, `location`, `capacity`, `status` | → Course, → User (trainer) | `course`; `trainer`; `startDate`; `status`; `{course, status}` |
| `Enrollment` | Student ↔ batch | `student`, `batch`, `course`, `discount` (≥ 0), `enrolledAt`, `lastVisitedLesson`, `lastVisitedAt` | → User, Batch, Course, Lesson | **`{student, batch}` unique**; `student`; `batch`; `course` |
| `Module` | Course section | `course`, `name`, `description`, `estimatedDuration`, `order` | → Course | `{course, order}`; text |
| `Topic` | Module section | `course`, `module`, `name`, `description`, `order` | → Course, Module | `{module, order}`; text |
| `Lesson` | Learning unit | `course`, `module`, `topic`, `title`, `description`, `order`, `difficulty`, `estimatedMinutes`, `published`, teaching fields (`whatIsIt`, `whyItMatters`, `analogy`, `simpleExample`, `technicalExplanation`, `codeExamples[]`, `realWorldUsage`, `commonMistakes[]`, `rememberThis`, `keyTakeaways[]`), `practice`, `quiz[]`, `codingQuestion` | → Topic, Module, Course | `{topic, order}`; `{module, order}`; text `{title, description}` |
| `FinalAssessment` | Course exam | `course` (unique), `title`, `questions[]` (≤ 100), `passingScore` (0–100, default 60), `published`, `createdBy` | → Course | `course` unique |

**Security-sensitive:** `Lesson.quiz[].correctIndex`, `Lesson.codingQuestion.testCases`, `FinalAssessment.questions[].correctIndex` must never reach students. They are stripped in the service layer (§6, §7).

### 17.4 Learning progress and assessments

| Model | Purpose | Important fields | Indexes |
|---|---|---|---|
| `LessonProgress` | Per-student lesson state | `student`, `lesson`, `topic`, `module`, `course`, `practiceCompleted(+At)`, `quizPassed(+At)`, `codingCompleted(+At)`, `completed(+At)`, `quizBestScore`, `quizAttempts`, `quizLastAttemptAt` | **`{student, lesson}` unique**; `{student, course}` |
| `QuizAttempt` | Lesson-quiz session state machine | `student`, `lesson`, `status` (`IN_PROGRESS`/`SUBMITTED`/`QUIT`), `currentIndex`, `answers[]`, `score`, `startedAt`, `submittedAt` | **`{student, lesson}` unique** (one row, reset per attempt) |
| `CodingSubmission` | Every graded code submission | `student`, `lesson`, `code`, `passed`, `testResults[]` (`passed`, `args`, `expectedOutput`, `actualOutput`, `error`), `submittedAt` | `{student, lesson, createdAt:-1}` |
| `FinalAssessmentAttempt` | Final-exam session | `student`, `course`, `finalAssessment`, `status`, `currentIndex`, `answers[]`, `score`, `passed`, `startedAt`, `submittedAt` | **`{student, course}` unique** |
| `Certificate` | Issued certificate | `certificateNumber` (unique), `student`, `batch`, `course`, `studentName`, `courseName`, `batchName`, `issueDate`, `status`, `revokedReason`, `revokedAt`, `issuedBy?` | `certificateNumber` unique; `student`; `batch`; `status`; `{student, batch}` |

**Security-sensitive:** `CodingSubmission.testResults` contains hidden test data. Student responses map it to `{passed, error}` only.

### 17.5 Fees and payments

| Model | Purpose | Important fields | Indexes |
|---|---|---|---|
| `Payment` | **The ledger.** The only thing that changes a balance. | `student`, `course`, `batch`, `amount`, `paymentDate`, `paymentMethod` (`CASH`/`CARD`/`UPI`/`BANK_TRANSFER`/`OTHER`), `transactionRef`, `receiptNumber` (unique), `notes`, `recordedBy`, `paymentRequest?` | `receiptNumber` unique; **`paymentRequest` unique (partial, when present)**; `student`; `paymentDate`; `{student, batch}` |
| `PaymentRequest` | Student's screenshot claim | `student`, `studentName`, `enrollment`, `batch`, `course`, `courseName`, `totalFee`, `previousPaidAmount`, `amountDueAtSubmission`, `amount`, `screenshot {provider, key, mimeType, bytes}`, `status` (`PENDING`/`APPROVED`/`REJECTED`), `submittedAt`, `reviewedBy`, `reviewedByName`, `reviewedAt`, `approvedAmount`, `paidAfterApproval`, `remainingAfterApproval`, `rejectionReason`, `payment` | **`one_pending_per_enrollment`: `{enrollment}` unique where `status = PENDING`**; `{status, createdAt:-1}`; `{student, createdAt:-1}`; `student`; `enrollment`; `course`; `status` |
| `PaymentSettings` | Singleton (`key: "default"`) | `qrCode {provider, key, mimeType, bytes, uploadedBy, uploadedAt}` | `key` unique |

**Security-sensitive:** `PaymentRequest.screenshot` (`select: false`, stripped from all responses), `reviewedBy` (removed from student views), all amounts (server-computed only).

### 17.6 Operations and engagement

| Model | Purpose | Important fields | Indexes |
|---|---|---|---|
| `Material` | Batch learning material (link to file) | `title`, `description`, `fileUrl`, `fileType` (`DOCUMENT`/`VIDEO`/`IMAGE`/`LINK`/`OTHER`), `module?`, `course`, `batch`, `uploadedBy` | `course`; `batch`; `{batch, module}` |
| `ClassSchedule` | Class sessions | `batch`, `module?`, `date`, `startTime`, `endTime`, `topic`, `description`, `meetingLink`, `location`, `createdBy` | `batch`; `date`; `{batch, date}` |
| `Attendance` | Daily attendance | `student`, `batch`, `course`, `date` (UTC day start), `status` (`PRESENT`/`ABSENT`/`LATE`/`LEAVE`), `markedBy`, `notes` | **`{student, batch, date}` unique** |
| `Task` | Assignment / quiz / project for a batch | `type`, `title`, `description`, `course`, `module?`, `batch`, `dueDate`, `maxMarks`, `status` (`DRAFT`/`PUBLISHED`/`CLOSED`), `attachmentUrls[]`, `questions[]` (`options[] {text, isCorrect}`, `marks`), `timeLimitMinutes`, `attemptsAllowed`, `requirements[]`, `submissionFormat`, `createdBy` | `course`; `batch`; `dueDate`; `status`; `{batch, status}` |
| `Submission` | Student's task submission | `task`, `student`, `batch`, `content`, `fileUrl`, `comments`, `status` (`DRAFT`/`SUBMITTED`/`LATE`/`EVALUATED`), `submittedAt`, `marks`, `feedback`, `evaluatedBy`, `evaluatedAt` | **`{task, student}` unique** |
| `MockInterview` | Mock interview + feedback | `student`, `interviewer`, `batch?`, `date`, `time`, `meetingLink`, `type`, `topics[]`, `notes`, `rating`, `strengths`, `weaknesses`, `feedback`, `recommendation`, `result`, `createdBy` | `student`; `interviewer`; `date`; `{interviewer, date}` |
| `Job` | Placement opening | `company`, `title`, `description`, `location`, `workMode`, `salaryRange`, `skills[]`, `minExperienceYears`, `educationRequirement`, `applicationDeadline`, `openings`, `jobLink`, `eligibleCourses[]`, `minAttendancePercent`, `status`, `createdBy` | `title`; `applicationDeadline`; `status`; `{status, applicationDeadline}` |
| `JobApplication` | Student application | `job`, `student`, `resumeUrl`, `status`, `statusNote`, `appliedAt` | **`{job, student}` unique** |
| `InterviewResource` | Placeholder career resource | `title`, `description`, `course`, `fileUrl`, `status` (`COMING_SOON`/`PUBLISHED`), `createdBy` | `course` |
| `Announcement` | Broadcast message | `title`, `content`, `audience` (`EVERYONE`/`STUDENTS`/`TRAINERS`/`BATCH`/`COURSE`), `batch?`, `course?`, `priority`, `publishAt`, `expiresAt`, `createdBy` | `audience`; `publishAt` |
| `Notification` | In-app notification | `user`, `type`, `title`, `message`, `link`, `read`, `readAt` | `user`; `read`; `{user, read, createdAt:-1}` |

**Security-sensitive:** `Task.questions[].options[].isCorrect` (stripped for students).

### 17.7 Data-integrity notes

- Deleting a module or topic cascades to lessons and `LessonProgress` only. `QuizAttempt` and `CodingSubmission` rows for deleted lessons are **not** removed (orphaned history).
- Removing a student from a batch deletes the `Enrollment` only. Payments, progress, submissions and certificates remain.
- Courses are never hard-deleted (`ARCHIVED`), so references from batches, enrollments and payments stay valid.

---

## 18. API documentation

### 18.1 Conventions

- **Base URL:** `https://<api-host>/api/v1` (local: `http://localhost:5000/api/v1`). Health check (outside the prefix): `GET /health` → `200 { success: true, message: "SSR Portal API is running" }`.
- **Authentication:** `Authorization: Bearer <accessToken>` unless marked **Public**. The refresh endpoint uses the `refreshToken` cookie.
- **Success envelope:** `{ "success": true, "message": "...", "data": <payload>, "meta"?: { "page", "limit", "total", "totalPages" } }`. Paginated lists include `meta`.
- **Error envelope:** `{ "success": false, "message": "...", "errors": [ ...details ] }`.
- **Pagination query (where supported):** `page` (≥ 1, default 1), `limit` (1–100, default 10; notifications 20; materials 20).
- **Common errors for every protected route:** `401` (missing, invalid or expired token, or ended session), `403` (wrong role, blocked/suspended account, or scope violation), `422` (validation), `429` (rate limit), `500`. Invalid ObjectIds in paths usually produce `400 Invalid value for field "_id"` (payment-request routes: 422).
- **Role column:** `S` = Student, `T` = Trainer, `A` = Admin.

### 18.2 Authentication — `/auth`

| Method | Endpoint | Auth / Role | Request | Response `data` | Common errors |
|---|---|---|---|---|---|
| POST | `/auth/register/student` | Public (20/15 min) | `name, email, phone, password, confirmPassword?, courseId, dateOfBirth?, gender?, highestQualification?, college?` | `{ userId, email }` (201) | 409 email exists; 400 course not available; 422 |
| POST | `/auth/register/trainer` | Public (20/15 min) | `name, email, phone, password, confirmPassword?, qualification?, skills?[], experienceYears?, specialization?, resumeUrl?` | `{ userId, email }` (201) | 409; 422 |
| POST | `/auth/verify-otp` | Public (20/15 min) | `email, otp` (6 chars) | `{ status }` | 400 invalid/expired; 429 too many attempts |
| POST | `/auth/resend-otp` | Public (5/10 min) | `email` | `{}` (always the same message) | 429 |
| POST | `/auth/login` | Public (20/15 min) | `email, password, rememberMe?` (ignored) | `{ accessToken, user: { id, name, email, role, status } }` + `Set-Cookie refreshToken` | 401 invalid credentials; 403 unverified / pending / rejected / blocked / suspended |
| POST | `/auth/refresh-token` | Cookie (100/15 min) | — | `{ accessToken }` (+ rotated cookie) | 401 missing / invalid / reused / expired / inactive (cookie cleared) |
| POST | `/auth/logout` | Cookie (100/15 min) | — | `{}` (cookie cleared, session revoked) | — |
| POST | `/auth/forgot-password` | Public (5/10 min) | `email` | `{}` (always the same message) | 429 |
| POST | `/auth/reset-password` | Public (20/15 min) | `token, password, confirmPassword` | `{}` | 400 invalid/expired link; 422 |
| GET | `/auth/me` | S T A | — | `{ id, name, email, phone, role, status, avatarUrl, lastLoginAt, profile }` | 401 |
| PATCH | `/auth/me` | S T A | `name?, phone?, avatarUrl?` (http/https or `""`) | current user | 422 |
| PATCH | `/auth/me/student-profile` | S | profile fields (§17.2); `""` values ignored | profile | 403 |
| PATCH | `/auth/me/trainer-profile` | T | `qualification?, specialization?, experienceYears?, bio?, skills?, resumeUrl?` | profile | 403 |

### 18.3 Students — enrollments, progress, dashboard, search

| Method | Endpoint | Role | Request | Response / notes |
|---|---|---|---|---|
| GET | `/enrollments/me` | S | — | Each enrollment with course, `overallProgress`, `totalLessons`, `totalCompleted`, `courseCompleted`, `certificateUnlocked`, `lastVisitedLesson` |
| PATCH | `/enrollments/last-visited` | S | `courseId, lessonId` | Updated enrollment. 400 lesson not in course; 403 not enrolled. |
| GET | `/progress/courses/:courseId` | S | — | Full progress tree (§5.4). 403 not enrolled. |
| POST | `/progress/lessons/:lessonId/complete` | S | — | Marks complete. 400 if stages outstanding; 403 locked. |
| DELETE | `/progress/lessons/:lessonId/complete` | S | — | Clears `completed` (stage flags kept) |
| GET | `/progress/students/:studentId/courses/:courseId` | T A | — | Same tree for staff. Trainer: must teach the course **and** the student must be in one of their batches. |
| GET | `/dashboard/student` | S | — | `enrollment, courseProgress, attendancePercentage, pendingTasksCount, upcomingClasses, upcomingInterviews, feeDue, recentAnnouncements, recentGrades` |
| GET | `/search?q=` | S T A | `q` 2–100 chars | `{ courses, modules, topics, lessons }` (≤ 10 each). Student scoped to enrolled courses, trainer to taught courses. Published lessons only. |
| GET | `/career-resources/status` | S | — | `{ anyUnlocked, courses: [{ courseId, courseName, completed, careerResourcesUnlocked }] }` |

### 18.4 Courses — `/courses`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/courses` | **Public** | — | Published courses: `name, shortDescription, category, duration, fee` |
| GET | `/courses/admin` | A | `page, limit, search, status, sortBy (createdAt\|name\|fee), sortOrder` | Paginated |
| GET | `/courses/trainer` | T | — | Courses of the trainer's batches |
| POST | `/courses` | A | `name, shortDescription, duration, fee, fullDescription?, category?, thumbnailUrl?, requirements?[], learningOutcomes?[]` | 201 |
| GET | `/courses/:id` | T A | — | Trainer must be assigned (403) |
| PATCH | `/courses/:id` | A | Any subset of the create fields | — |
| PATCH | `/courses/:id/status` | A | `status: DRAFT\|PUBLISHED\|ARCHIVED` | Soft delete = `ARCHIVED` |

### 18.5 Curriculum — modules and topics

All routes: roles **T A**. Trainer access requires assignment to the course (`assertCourseContentAccess`), otherwise 403. 404 if the parent doesn't exist.

| Method | Endpoint | Request | Notes |
|---|---|---|---|
| GET | `/courses/:courseId/modules` | — | Modules with `lessonCount` |
| POST | `/courses/:courseId/modules` | `name, description?, estimatedDuration?` | Appended at the end |
| PATCH | `/courses/:courseId/modules/reorder` | `orderedIds: ObjectId[]` | `order` = index |
| PATCH | `/modules/:id` | `name?, description?, estimatedDuration?` | — |
| DELETE | `/modules/:id` | — | Cascades topics, lessons and progress. Trainer blocked if progress exists (403). |
| GET | `/modules/:moduleId/topics` | — | Topics with `lessonCount` |
| POST | `/modules/:moduleId/topics` | `name, description?` | — |
| PATCH | `/modules/:moduleId/topics/reorder` | `orderedIds` | — |
| PATCH | `/topics/:id` | `name?, description?` | — |
| DELETE | `/topics/:id` | — | Cascades lessons and progress. Trainer blocked if progress exists. |
| GET | `/topics/:topicId/lessons` | — | Full lessons (authoring view) |
| POST | `/topics/:topicId/lessons` | Lesson fields (§18.6) | 201 |
| PATCH | `/topics/:topicId/lessons/reorder` | `orderedIds` | — |

### 18.6 Lessons — `/lessons`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/lessons/:id` | S T A | — | **Student:** learner view (enrolled + unlocked + published, answers and tests stripped, plus `lockState`, `stage`, progress flags); 403 locked / not enrolled; 404 unpublished. **Staff:** full authoring document (assignment required for trainers). |
| POST | `/lessons/:id/practice/complete` | S | — | `{ completed, stage }`. 400 if no practice. |
| PATCH | `/lessons/:id` | T A | Any of: `title, description, estimatedMinutes, difficulty, published, whatIsIt, whyItMatters, analogy, simpleExample, technicalExplanation, codeExamples[], realWorldUsage, commonMistakes[], practice (nullable), quiz[], codingQuestion (nullable), rememberThis, keyTakeaways[]` | — |
| DELETE | `/lessons/:id` | T A | — | Trainer blocked if any progress exists |

### 18.7 Quizzes (lesson quiz session) — `/lessons/:id/quiz`

| Method | Endpoint | Role | Request | Response `data` | Errors |
|---|---|---|---|---|---|
| GET | `/lessons/:id/quiz/state` | S | — | `{ status: NOT_STARTED, totalQuestions }` or `{ status, totalQuestions, currentIndex, done, question? , score? }` | 403 locked |
| POST | `/lessons/:id/quiz/start` | S | — | Session state with the current question | 400 no quiz; 403 practice not done / locked |
| POST | `/lessons/:id/quiz/answer` | S | `selectedIndex` (int ≥ 0) | Next state | 400 no attempt, all answered, option out of range |
| POST | `/lessons/:id/quiz/submit` | S | — | `{ score, bestScore, passed, results (only if passed), reviewAvailable, lessonCompleted }` | 400 no attempt |
| POST | `/lessons/:id/quiz/quit` | S | — | `{ score: 0, quit: true }` | 400 no attempt |

### 18.8 Coding — `/lessons/:id/coding`

| Method | Endpoint | Role | Request | Response `data` | Errors |
|---|---|---|---|---|---|
| GET | `/lessons/:id/coding/state` | S | — | `{ lastSubmission: { code, passed, testResults: [{passed, error?}], createdAt } \| null }` | 400 no coding question; 403 locked |
| POST | `/lessons/:id/coding/submit` | S (10/min/user) | `code` (1–20,000 chars) | `{ passed, testResults: [{passed, error?}], lessonCompleted }` | 403 practice/quiz not done; 429 rate limit or grader busy; 500 grader unavailable |

### 18.9 Final assessment — `/final-assessments`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/final-assessments/courses/:courseId/authoring` | T A | — | Full assessment (with answers) or `null` |
| POST | `/final-assessments/courses/:courseId` | T A | `questions[] (1–100: question, options[2–6], correctIndex, explanation?), title?, passingScore? (0–100), published?` | Upsert (one per course) |
| PATCH | `/final-assessments/courses/:courseId` | T A | Partial of the above | 404 if none |
| GET | `/final-assessments/courses/:courseId/state` | S | — | 403 modules incomplete; 404 none published |
| POST | `/final-assessments/courses/:courseId/start` | S | — | Resumes, returns the passed result, or starts a new attempt |
| POST | `/final-assessments/courses/:courseId/answer` | S | `selectedIndex` | Next state |
| POST | `/final-assessments/courses/:courseId/submit` | S | — | `{ score, passed, results (only if passed), reviewAvailable }` |

### 18.10 Certificates — `/certificates`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/certificates/verify/:certificateNumber` | **Public** | — | `{ certificateNumber, studentName, courseName, batchName, issueDate, status }`. 404 unknown. |
| GET | `/certificates/my` | S | — | Own certificates |
| GET | `/certificates` | A | `page, limit, search, status, batch, sortBy (createdAt\|issueDate\|studentName), sortOrder` | Paginated |
| POST | `/certificates` | A | `student, batch` | 201. 400 not enrolled / not completed; 404 batch; 409 active certificate exists. |
| GET | `/certificates/:id` | A | — | 404 |
| PATCH | `/certificates/:id/revoke` | A | `reason?` (≤ 500) | 400 already revoked |

### 18.11 Fees — `/fees` (status, ledger, discounts)

All `/fees` routes require authentication. Trainers get 403 on every route.

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/fees/my-status` | S | — | Own rows: `enrollmentId, course, batch, discount, finalFee, amountPaid, amountDue, status, paymentStatus, canPay, pendingRequest, lastRejection` |
| GET | `/fees/my-payments` | S | — | Own ledger (no `recordedBy`, no phone) |
| GET | `/fees/status` | A | `page, limit, search, batch, status (PAID\|PARTIALLY_PAID\|PENDING)` | All enrollments' fee rows |
| GET | `/fees/payments` | A | `page, limit, search, batch, paymentMethod, sortBy (createdAt\|paymentDate\|amount), sortOrder` | Ledger with `student {name,email,phone}` |
| POST | `/fees/payments` | A | `student, batch, amount (> 0, ≤ 2 dp, ≤ remaining fee), paymentMethod, paymentDate?, transactionRef?, notes?` | Cash / manual payment (201) → payment + `paidAfterPayment`, `remainingAfterPayment`, `studentEmailSent`. Notifies and emails the student. 400 not enrolled or amount > remaining; 409 already fully paid (or lost a concurrent race). |
| GET | `/fees/payments/:studentId/:batchId` | A | — | Payment history for one enrollment |
| PATCH | `/fees/enrollments/:enrollmentId/discount` | A | `discount (≥ 0)` | 404 enrollment |

### 18.12 Payments — screenshot verification and QR — `/fees`

| Method | Endpoint | Role | Request | Notes / errors |
|---|---|---|---|---|
| GET | `/fees/payment-settings` | S A | — | `{ qrCode: { available, updatedAt } }` |
| GET | `/fees/payment-settings/qr-code` | S A | — | Image bytes (`no-store`). 404 not configured. |
| PUT | `/fees/payment-settings/qr-code` | A | multipart `qrCode` (PNG/JPG/JPEG/WEBP ≤ 5 MB) | New settings. 400 invalid image. |
| DELETE | `/fees/payment-settings/qr-code` | A | — | Settings |
| POST | `/fees/payment-requests` | S | multipart: `enrollmentId`, `amount` (> 0, ≤ 2 dp, ≤ 1e7), `screenshot` (image ≤ 5 MB). **Strict: no other fields.** | 201 request (no storage key). 400 no file / invalid image / amount > due; 404 enrollment not the student's; 409 already paid / pending exists; 422 unknown fields. |
| GET | `/fees/my-payment-requests` | S | — | Own requests (`hasScreenshot: true`, no reviewer id) |
| GET | `/fees/payment-requests/:id/screenshot` | S (own) A | — | Image bytes. 404 not own; 422 bad id. |
| GET | `/fees/payment-requests` | A | `page, limit, status, search` (student or course name) | Pending oldest-first, others newest-first |
| GET | `/fees/payment-requests/:id` | A | — | Request + `currentBalance` + full `history` for the enrollment |
| PATCH | `/fees/payment-requests/:id/approve` | A | `{ amount? }` **strict** | 200 approved request. 409 already processed / fully paid / exceeds current due / enrollment removed. |
| PATCH | `/fees/payment-requests/:id/reject` | A | `{ reason }` 5–500 chars **strict** | 200. 409 already processed. |

### 18.13 Notifications — `/notifications`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/notifications` | S T A | `page, limit` | Own, newest first, paginated |
| GET | `/notifications/unread-count` | S T A | — | `number` |
| PATCH | `/notifications/read-all` | S T A | — | — |
| PATCH | `/notifications/:id/read` | S T A | — | 404 if not own |

### 18.14 Admin — users, reports, audit logs, announcements

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/users` | A | `page, limit, search (name/email/phone), role, status, sortBy (createdAt\|name\|email), sortOrder` | Paginated |
| GET | `/users/stats` | A | — | Counts by role × status + published course count |
| GET | `/users/:id` | A | — | User + profile |
| PATCH | `/users/:id/approve` | A | — | PENDING → ACTIVE (400 otherwise) |
| PATCH | `/users/:id/reject` | A | `reason?` | PENDING → REJECTED |
| PATCH | `/users/:id/block` | A | — | Revokes sessions. 403 for admin targets. |
| PATCH | `/users/:id/unblock` | A | — | → ACTIVE |
| PATCH | `/users/:id/suspend` | A | `reason?` | Revokes sessions |
| PATCH | `/users/:id/reactivate` | A | — | → ACTIVE |
| GET | `/reports/overview` | A | — | `summary`, `enrollmentsByCourse`, `feeCollectionByBatch`, `attendanceByBatch`, `applicationsByStatus`, `enrollmentsOverTime` (live aggregations) |
| GET | `/audit-logs` | A | `page, limit, action, entity` | Paginated, with user |
| GET | `/announcements` | S T A | `page, limit, audience` | Admin: all. Others: live and addressed to them. |
| POST | `/announcements` | A | `title, content, audience, priority?, batch? (required for BATCH), course? (required for COURSE), publishAt?, expiresAt?` | Notifies the audience if `publishAt ≤ now` |
| DELETE | `/announcements/:id` | A | — | 404 |

### 18.15 Batches — `/batches`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/batches` | T A | `page, limit, search, status, course, sortBy (createdAt\|startDate\|name), sortOrder` | Trainer: own batches only. Includes `enrolledCount`. |
| GET | `/batches/:id` | T A | — | Trainer: own only (403) |
| GET | `/batches/:id/students` | T A | — | Roster `{ enrollmentId, enrolledAt, student {name,email,phone,status} }` |
| POST | `/batches` | A | `name, course, trainer?, startDate, endDate (> start), classDays[MON..SUN], startTime, endTime, mode, location?, capacity` | Trainer must exist and be ACTIVE |
| PATCH | `/batches/:id` | A | Partial | Merged date order re-validated |
| PATCH | `/batches/:id/status` | A | `status` | — |
| POST | `/batches/:id/students` | A | `studentId` | 400 not active / full; 409 already enrolled |
| DELETE | `/batches/:id/students/:studentId` | A | — | 404 not enrolled |

### 18.16 Trainer operations — dashboard, materials, schedule, attendance, tasks, submissions

Trainer access to each record is checked with `assertBatchAccess` on the record's batch (403 otherwise). Students get read access scoped to enrolled batches where noted.

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/dashboard/trainer` | T | — | `assignedBatches, totalStudents, todaysClasses, pendingEvaluations, upcomingInterviews, recentAnnouncements` |
| GET | `/materials` | S T A | `page, limit (default 20), batch, module, search` | Scoped by role |
| POST | `/materials` | T A | `title, fileUrl (http/s), fileType, batch, description?, module?` | — |
| PATCH | `/materials/:id` | T A | Partial (no batch change) | — |
| DELETE | `/materials/:id` | T A | — | — |
| GET | `/classes` | S T A | `batch, from, to` | Scoped by role |
| POST | `/classes` | T A | `batch, date, startTime, endTime, topic, module?, description?, meetingLink?, location?` | — |
| PATCH | `/classes/:id` | T A | Partial | — |
| DELETE | `/classes/:id` | T A | — | — |
| GET | `/attendance` | S T A | `batch, student, date, from, to` | Student forced to own records |
| POST | `/attendance/mark` | T A | `batch, date, records[{ student, status, notes? }]` | Upsert per student/batch/day. 400 if any student is not enrolled in the batch. |
| GET | `/attendance/summary/:batchId` | S T A | — | Per-student totals and %. Student sees own row only. |
| GET | `/tasks` | S T A | `batch, status, type` | Students: no drafts, answer keys stripped, `mySubmission` added. Staff: `submissionCount`. |
| POST | `/tasks` | T A | Discriminated on `type`: `ASSIGNMENT` (`attachmentUrls?`), `QUIZ` (`questions[]`, `timeLimitMinutes?`, `attemptsAllowed?`), `PROJECT` (`requirements?`, `submissionFormat?`) + `title, description, batch, module?, dueDate, maxMarks` | — |
| GET | `/tasks/:id` | S T A | — | Student: 404 for drafts; answer keys stripped |
| PATCH | `/tasks/:id` | T A | Partial | — |
| PATCH | `/tasks/:id/status` | T A | `status` | `PUBLISHED` notifies enrolled students |
| DELETE | `/tasks/:id` | T A | — | Drafts only (400 otherwise) |
| GET | `/tasks/:taskId/submissions` | T A | — | — |
| GET | `/tasks/:taskId/my-submission` | S | — | Own submission or `null` |
| POST | `/tasks/:taskId/submit` | S | `content? (≤ 10k), fileUrl? (http/s), comments? (≤ 2k)` | Upsert. `LATE` after the due date. 400 not published; 403 not enrolled. |
| GET | `/submissions/pending` | T A | — | SUBMITTED/LATE, trainer-scoped |
| PATCH | `/submissions/:submissionId/evaluate` | T A | `marks (≤ maxMarks), feedback?` | Notifies the student |

### 18.17 Jobs — `/jobs`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/jobs/public` | S | — | `[]` until a course is completed. Otherwise jobs with `isEligible`, `applicationStatus`. |
| GET | `/jobs/applications/me` | S | — | Own applications |
| POST | `/jobs/:id/apply` | S | `resumeUrl?` | 400 closed / deadline passed; 403 not unlocked / not eligible; 404; 409 already applied |
| POST | `/jobs/applications/:applicationId/withdraw` | S | — | 400 final state; 404 not own |
| GET | `/jobs` | A | `page, limit, search, status, sortBy (createdAt\|applicationDeadline\|title), sortOrder` | With `applicationCount` |
| POST | `/jobs` | A | `company, title, description, workMode, applicationDeadline, openings, location?, salaryRange?, skills?, minExperienceYears?, educationRequirement?, jobLink?, eligibleCourses?, minAttendancePercent?` | — |
| GET | `/jobs/:id` | A | — | — |
| PATCH | `/jobs/:id` | A | Partial | — |
| PATCH | `/jobs/:id/status` | A | `status` | — |
| GET | `/jobs/:id/applications` | A | `page, limit, status` | With student name, email, phone |
| PATCH | `/jobs/applications/:applicationId/status` | A | `status, statusNote?` | Notifies the student |

### 18.18 Interviews — `/interviews` (mock interviews) and `/interview-resources`

| Method | Endpoint | Role | Request | Notes |
|---|---|---|---|---|
| GET | `/interviews` | S T A | `student?, interviewer?, from?, to?` (filters honoured for admin only) | Student: own. Trainer: as interviewer. |
| POST | `/interviews` | T A | `student, date, time, type, batch?, meetingLink?, topics?, notes?` | Trainer: student must be in their batch |
| PATCH | `/interviews/:id` | T A | `date?, time?, meetingLink?, type?, topics?, notes?` | Trainer: own only |
| PATCH | `/interviews/:id/feedback` | T A | `rating (1–5), result, strengths?, weaknesses?, feedback?, recommendation?` | Trainer: own only |
| DELETE | `/interviews/:id` | T A | — | Trainer: own only |
| GET | `/interview-resources` | S | — | Only for completed courses |
| GET | `/interview-resources/admin` | T A | — | Trainer: assigned courses only |
| POST | `/interview-resources` | T A | `title, course, description?, fileUrl?, status?` | Course access required |
| PATCH | `/interview-resources/:id` | T A | Partial | Access to the current and new course required |
| DELETE | `/interview-resources/:id` | T A | — | — |

### 18.19 Uploads — `/uploads`

| Method | Endpoint | Role | Request | Response / errors |
|---|---|---|---|---|
| POST | `/uploads` | S T A (30/h/user) | multipart `file` (≤ 25 MB, allowlisted type), `folder?` (staff only) | 201 `{ url, publicId, resourceType, format, bytes, originalName }`. 400 no file / unsupported / extension or content mismatch / too large; 500 storage not configured. |

---

## 19. Error handling

### 19.1 Backend

All errors reach one handler (`middleware/errorHandler.ts`), registered after all routes. Async controllers are wrapped with `asyncHandler`, so rejected promises are forwarded. Services throw `ApiError` with a status code.

| Category | Status | Produced by | Message / `errors` |
|---|---|---|---|
| Validation (Zod middleware) | **422** | `validateBody/Query/Params` | "Validation failed" / "Invalid query parameters" / "Invalid route parameters". `errors` = Zod issues (`path`, `message`, …). |
| Validation (Mongoose) | 422 | model validators | "Validation failed", `errors` = messages |
| Bad input / business rule | **400** | `ApiError.badRequest` | e.g. "Complete the practice, quiz, and coding question first", "Only draft tasks can be deleted" |
| Invalid ObjectId (cast) | 400 | Mongoose `CastError` | `Invalid value for field "<path>"` |
| Upload errors | 400 | Multer / file checks | "File is too large (max 25MB)", "Image must be 5MB or smaller", "Unsupported file type: …", "File content does not match its declared type" |
| Authentication | **401** | `authenticate`, JWT errors, refresh | "Authentication token is missing", "Invalid or expired token", "Session has ended. Please log in again.", "Invalid email or password" |
| Authorization | **403** | `authorize`, scope helpers, account status | "You do not have permission to perform this action", "You do not have access to this batch", "You are not assigned to this course", "Complete the previous lesson before accessing this one", "Account is blocked" |
| Not found | **404** | services, `notFound` middleware | "Lesson not found", "Payment request not found", `Route not found: <METHOD> <url>`. Also used deliberately for **other users' records** (IDOR). |
| Conflict | **409** | services, duplicate key (`E11000`) | "A payment for this course is already under review", "This payment has already been approved by <admin>", "You have already applied to this job", `A record with this <field> already exists` |
| Rate limiting | **429** | express-rate-limit handlers, grader queue, OTP attempts | "Too many requests. Please try again later.", "Too many attempts…", "Too many code submissions…", "Upload limit reached…", "The code grader is busy…". `RateLimit-*` standard headers are sent. |
| Server error | **500** | anything unhandled | Local dev/test: the real message. **Any other `NODE_ENV`: "Internal server error".** Logged with stack trace (JSON logger). |

**Logging:** 5xx → `logger.error` with stack. 4xx → `logger.warn` with the message (and validation details). Request lines via Morgan (`combined` in production). The logger is silent under `NODE_ENV=test`.

**Side-effect failures:** audit-log writes and payment notifications are best-effort (logged, never fail the request). Other notifications (task published, evaluation, certificate, …) are awaited inline, so a failure there surfaces as a 500 after the main write has already happened.

### 19.2 Frontend

| Situation | Handling |
|---|---|
| **401** on any API call | Axios interceptor → one shared refresh → retry once. If refresh fails → clear auth store → redirect to `/login`. |
| **403 / 404 / 409 / 422 / 429** | Promise rejects. Hooks and components show `extractErrorMessage(error)`: the first validation issue as `"<field>: <message>"` if present, otherwise the server's `message`. Mutations show a **Sonner toast**. Some dialogs (e.g. payment) show an inline error box. |
| **Network errors** (no response, CORS, API down) | `extractErrorMessage` falls back to Axios' `error.message` (e.g. "Network Error") or "Something went wrong". Queries retry **once** (`retry: 1`). Mutations are not retried. |
| **Loading states** | Skeleton placeholders (`components/ui/skeleton`) for lists, cards and the `RequireAuth` gate. Buttons show spinners and disable while pending. The payment upload shows a progress bar. |
| **Error states** | Inline messages such as "Failed to load payments." or "Couldn't load your fee details. Please check your connection and refresh." Empty states are separate ("No payments recorded yet."). |
| **Stale data after conflicts** | Payment mutations invalidate all `fees` queries on settle (success **or** error), so a 409 from another device refreshes the UI to the real server state. |
| **Unknown routes** | `app/not-found.tsx` |

---

## 20. Frontend architecture

> `frontend/AGENTS.md` warns that this Next.js version (16.x) has breaking changes compared with older releases. Consult `node_modules/next/dist/docs/` before changing framework-level code.

### 20.1 Folder structure

```
frontend/
├── app/                       # App Router (43 routes in the production build)
│   ├── layout.tsx             # Root: ThemeProvider → QueryProvider → TooltipProvider, Sonner Toaster
│   ├── page.tsx               # Landing page
│   ├── not-found.tsx
│   ├── (entry)/login/         # Login
│   ├── (auth)/                # register/student, register/trainer, verify-otp, forgot-password, reset-password
│   ├── admin/                 # layout.tsx → RoleDashboardLayout (RequireAuth ["ADMIN"] + dashboard shell)
│   ├── trainer/               # layout.tsx → RoleDashboardLayout (RequireAuth ["TRAINER"])
│   ├── student/               # layout.tsx → RoleDashboardLayout (RequireAuth ["STUDENT"])
│   └── verify-certificate/[certificateId]/   # Public, server-rendered
├── components/
│   ├── ui/                    # shadcn/ui primitives (button, dialog, table, sheet, tabs, …)
│   ├── layout/                # dashboard shell, top nav, topbar, profile sheet
│   ├── shared/                # RequireAuth, QueryProvider, receipt button, QR code, status badges, …
│   ├── admin/ | trainer/ | student/   # Role-specific dialogs, sheets, editors
│   └── auth/login/            # Login page components
├── hooks/                     # React Query hooks per domain (useFees, useLesson, useProgress, …)
├── services/                  # Typed API modules per domain (fee.service.ts, progress.service.ts, …)
├── lib/                       # api-client.ts (Axios), receipt.ts (jsPDF), whatsapp.ts, csv.ts, utils.ts
├── store/                     # Zustand: auth-store.ts, ui-store.ts
├── schemas/                   # Zod form schemas (React Hook Form resolvers)
├── types/                     # TypeScript API types per domain
├── constants/nav.ts           # Role navigation menus
├── next.config.ts             # Security headers
└── vercel.json                # Vercel build settings
```

### 20.2 App routes

| Area | Routes |
|---|---|
| Public | `/`, `/login`, `/register/student`, `/register/trainer`, `/verify-otp`, `/forgot-password`, `/reset-password`, `/verify-certificate/[certificateId]` |
| Admin | `/admin/dashboard`, `users`, `courses`, `courses/[id]` (curriculum), `courses/[id]/final-assessment`, `batches`, `fees`, `placements`, `certificates`, `reports`, `announcements`, `audit-logs`, `profile` |
| Trainer | `/trainer/dashboard`, `batches`, `curriculum`, `curriculum/[courseId]`, `curriculum/[courseId]/final-assessment`, `schedule`, `materials`, `tasks`, `submissions`, `attendance`, `interviews`, `profile` |
| Student | `/student/dashboard`, `courses`, `courses/[courseId]`, `courses/[courseId]/lessons/[lessonId]`, `courses/[courseId]/final-assessment`, `search`, `materials`, `tasks`, `attendance`, `schedule`, `interviews`, `interview-resources`, `jobs`, `fees`, `certificates`, `profile` |

### 20.3 Layers and data flow

```mermaid
flowchart LR
    Page["app/**/page.tsx<br/>(client components)"] --> Hook["hooks/useX.ts<br/>useQuery / useMutation"]
    Hook --> Svc["services/x.service.ts<br/>typed API calls"]
    Svc --> AX["lib/api-client.ts<br/>Axios + Bearer + 401 refresh"]
    AX --> API[("Backend /api/v1")]
    Page --> Comp["components/*<br/>ui · shared · role-specific"]
    Page --> Store["store/auth-store (Zustand)"]
    AX --> Store
```

| Concern | Implementation |
|---|---|
| **State management** | **Server state:** TanStack Query (`staleTime` 30 s, `refetchOnWindowFocus: false`, `retry: 1`). Query keys are grouped per domain (e.g. `["fees", …]`) so mutations invalidate them. **Client state:** Zustand. `auth-store` holds `user` (persisted to `localStorage` key `ssr-portal-auth`) and `accessToken` (**memory only**, excluded via `partialize`; an old persisted token is dropped by the v1 migration). `ui-store` holds sidebar state. |
| **API communication** | One Axios instance with `baseURL = NEXT_PUBLIC_API_URL`, `withCredentials: true`, Bearer header from the store, and a deduplicated refresh on 401. Private images (QR, screenshots) are fetched as blobs and turned into data URLs. File uploads use `FormData` with upload progress. |
| **Route protection** | `RequireAuth` in each role layout: waits for store hydration, restores the access token from the refresh cookie on reload, fetches `/auth/me`, redirects unauthenticated users to `/login` and wrong-role users to their own dashboard. **UX only.** The backend enforces access. |
| **Forms** | React Hook Form + Zod schemas in `schemas/`. They mirror backend rules for fast feedback. The backend remains authoritative. |
| **UI components** | shadcn/ui on `@base-ui/react`, Tailwind 4, Lucide icons, Recharts for reports, Framer Motion, Sonner toasts, next-themes (light/dark). |
| **Loading / error states** | See §19.2. |
| **Other client utilities** | `lib/receipt.ts` (PDF receipts), `lib/whatsapp.ts` (wa.me links), `lib/csv.ts` (client-side CSV export for reports). |

### 20.4 Where business logic belongs

| Belongs in the **backend** (authoritative) | May live in the **frontend** (presentation only) |
|---|---|
| Lock state, lesson completion, course completion | Showing lock icons, disabling links, progress bars |
| Quiz and final-assessment scoring, answer keys | Rendering the current question |
| Coding grading | Code editor, displaying pass/fail |
| Fee balances, payment amounts, status transitions | Displaying balances, pre-validating the amount field |
| Eligibility for certificates, jobs and interview resources | "Locked" screens and messages |
| Role, ownership and scope checks | Hiding menu items by role |
| Notification creation | Polling and rendering notifications |

Rule of thumb: **anything that affects money, grades, access or completion is decided on the server.** The frontend may repeat a check for UX, but must never be the only check.

---

## 21. Backend architecture

### 21.1 Folder structure

```
backend/src/
├── server.ts            # Connect DB → create app → listen; graceful SIGINT/SIGTERM
├── app.ts               # Express app + global middleware + /health + /api/v1
├── config/              # env.ts (validated env), db.ts (Mongoose), cloudinary.ts
├── constants/enums.ts   # Roles, statuses, progress states, QUIZ_PASS_PERCENT
├── routes/              # One router per domain; index.ts mounts them under /api/v1
├── middleware/          # authenticate, authorize, validate, upload, rateLimiters, sanitize, errorHandler, notFound
├── controllers/         # Thin HTTP adapters
├── services/            # Business logic per domain
├── models/              # 33 Mongoose schemas
├── validators/          # Zod schemas per domain (+ common.ts: httpUrl, searchText)
├── utils/               # ApiError, apiResponse, asyncHandler, jwt, tokens, password, logger,
│                        # batchAccess, lessonAccess, progressState, codingJudge,
│                        # fileSignature, imageValidation, searchRegex
└── seed/                # seed.ts + curriculum/ (7 course curricula)
backend/tests/           # 13 Jest suites + setupEnv.ts, setupDb.ts, helpers.ts
```

### 21.2 Request pipeline

```mermaid
flowchart TD
    Req["HTTP request"] --> G1["helmet → cors(CLIENT_URL, credentials) → compression"]
    G1 --> G2["express.json / urlencoded (10 MB) → cookieParser → mongoSanitize → morgan"]
    G2 --> H{"/health?"}
    H -- yes --> OK["200"]
    H -- no --> RL["apiLimiter (300 / 15 min / IP)"]
    RL --> R["Domain router"]
    R --> M1["route limiter (auth / otp / refresh / coding / upload)"]
    M1 --> M2["authenticate"]
    M2 --> M3["authorize(...roles)"]
    M3 --> M4["upload (multer) — after authorize"]
    M4 --> M5["validateParams / validateBody / validateQuery"]
    M5 --> C["Controller (asyncHandler)"]
    C --> S["Service: scope/ownership checks + business rules"]
    S --> DB[("Models → MongoDB")]
    C --> Resp["sendSuccess envelope"]
    S -. "throws ApiError / ZodError / Mongo error" .-> EH["errorHandler → sendError envelope"]
    R -. "no match" .-> NF["notFound → 404"]
```

### 21.3 Layer responsibilities

| Layer | Responsibility | Example |
|---|---|---|
| **Routes** | URL + method → middleware chain → controller. Declare the role allowlist and validation schema. | `fee.routes.ts`: `authorize("STUDENT")`, then `uploadSingleImage("screenshot")`, then `validateBody(submitPaymentRequestSchema)` |
| **Controllers** | Read `req.user`, `req.params`, `req.body`/`req.query`, call **one** service function, send `sendSuccess(res, status, message, data, meta?)`. No business logic. | `fee.controller.ts` |
| **Services** | Business rules, scope and ownership checks, transactions, notifications, audit logs. Throw `ApiError` for expected failures. | `paymentRequest.service.ts` |
| **Models** | Schema, enums, defaults, `select: false` fields, indexes (including unique/partial/TTL). | `PaymentRequest.ts` |
| **Utilities** | Cross-cutting helpers used by many services (access helpers, progression engine, grader, file validation, tokens). | `utils/lessonAccess.ts` |

### 21.4 Middleware

| Middleware | Purpose |
|---|---|
| `authenticate` | Bearer-only JWT verification + live session + live user status. Sets `req.user = { id, role, status }`. |
| `authorize(...roles)` | Role allowlist against `req.user.role`. |
| `validateBody / validateQuery / validateParams` | Zod parse. Replaces body/query with parsed values (Express 5-safe `defineProperty` for `req.query`). |
| `uploadSingleFile` | Multer memory storage, 25 MB, MIME allowlist, field `file`. |
| `uploadSingleImage(field)` | Multer memory storage, 5 MB, 1 file, PNG/JPEG/WEBP + extension check. Converts Multer errors to 400. |
| `apiLimiter`, `authLimiter`, `refreshLimiter`, `otpLimiter` | IP-keyed limits |
| `codingSubmitLimiter`, `uploadLimiter` | User-keyed limits (must run after `authenticate`) |
| `mongoSanitize` | Strips `$`/`.` keys (Express 5-compatible) |
| `errorHandler`, `notFound` | Centralized error envelope, 404 for unknown routes |

### 21.5 Utilities

| Utility | Purpose |
|---|---|
| `ApiError` | Typed HTTP errors (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `tooMany`, `internal`) |
| `apiResponse` | `sendSuccess`, `sendError`, `buildPaginationMeta` |
| `asyncHandler` | Forwards async errors to `next` |
| `jwt` | Sign and verify access tokens (HS256 pinned) |
| `tokens` | Secure random tokens, SHA-256 hashing, 6-digit OTPs |
| `password` | bcrypt hash/compare (12 rounds) |
| `logger` | JSON structured logs, silent in tests |
| `batchAccess` | Batch, course-content and enrollment scope helpers |
| `progressState` / `lessonAccess` | Progression engine, lesson gate, course-completion check |
| `codingJudge` | Isolated code runner |
| `fileSignature` / `imageValidation` | Content-based upload validation |
| `searchRegex` | Escaped literal search regex |

### 21.6 Startup and shutdown

`server.ts` connects to MongoDB (`config/db.ts` also forces the Node DNS resolvers to `8.8.8.8` and `1.1.1.1` to work around SRV lookup failures on some networks), then starts listening on `PORT`. `SIGINT`/`SIGTERM` close the HTTP server gracefully. Unhandled promise rejections are logged. A failed start exits with code 1.

---

## 22. Environment variables

> **Never commit real values.** `.env` files are git-ignored. Only `backend/.env.example` (placeholders) is tracked, and git history contains no other `.env` file (checked for this document).

### 22.1 Backend (`backend/.env`)

| Name | Purpose | Required | Default in code | Example format |
|---|---|---|---|---|
| `NODE_ENV` | `development` / `test` relax security defaults. **Anything else is treated as production-strict.** | Recommended | `development` | `production` |
| `PORT` | HTTP port | Optional (Railway injects it) | `5000` | `5000` |
| `MONGODB_URI` | MongoDB connection string (**replica set required**) | **Required** (startup fails without it) | — | `mongodb+srv://YOUR_DB_USER:YOUR_DB_PASSWORD_HERE@YOUR_CLUSTER.mongodb.net/ssr-portal` |
| `JWT_SECRET` | HS256 signing key for access tokens. ≥ 32 characters outside dev/test. | **Required** | — | `YOUR_RANDOM_64_CHAR_SECRET_HERE` |
| `JWT_EXPIRES_IN` | Access-token lifetime (jsonwebtoken format) | Optional (set explicitly in production) | `15m` | `15m` |
| `SESSION_TTL_DAYS` | Refresh session and cookie lifetime (days) | Optional | `30` | `30` |
| `COOKIE_SAMESITE` | Refresh-cookie SameSite: `lax`, `strict` or `none` (`none` forces `Secure`) | Optional (validated) | `lax` | `none` |
| `CLIENT_URL` | Allowed CORS origin **and** base URL for password-reset links. No trailing slash. | **Required outside dev** | `http://localhost:3000` | `https://YOUR_FRONTEND_DOMAIN_HERE` |
| `RESET_TOKEN_EXPIRES_MINUTES` | Password-reset link lifetime | Optional | `30` | `30` |
| `OTP_EXPIRES_MINUTES` | Email OTP lifetime | Optional | `10` | `10` |
| `EMAIL_FROM` | Sender address for all outgoing email | Optional | `no-reply@ssrinstitute.in` | `no-reply@YOUR_DOMAIN_HERE` |
| `SMTP_HOST` | SMTP server. If empty, emails are only logged ("SMTP not configured, not sent"). | **Required in production** (OTP, password reset, payment-approved emails) | `""` | `smtp.YOUR_PROVIDER_HERE` |
| `SMTP_PORT` | SMTP port. `465` = implicit TLS; anything else (e.g. `587`) = STARTTLS. | Optional | `587` | `587` |
| `SMTP_USER` | SMTP username (authentication is skipped if empty) | Optional | `""` | `YOUR_SMTP_USER_HERE` |
| `SMTP_PASSWORD` | SMTP password (e.g. a Gmail App Password) | Optional | `""` | `YOUR_SMTP_PASSWORD_HERE` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account | **Required in production** for any upload; private uploads refuse to fall back to disk in production | `""` | `YOUR_CLOUD_NAME_HERE` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | As above | `""` | `YOUR_CLOUDINARY_API_KEY_HERE` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | As above | `""` | `YOUR_CLOUDINARY_API_SECRET_HERE` |
| `SEED_PASSWORD` | Password for all seeded accounts (`npm run seed` only). 12+ characters with upper, lower and digit. No default. | Seed only | — | `YOUR_STRONG_SEED_PASSWORD_HERE` |

Test-only variables (set automatically by `tests/setupEnv.ts`, not needed in `.env`): `MONGOMS_VERSION` (pins in-memory MongoDB 7.0.14) and `JWT_REFRESH_SECRET` (unused by the app).

### 22.2 Frontend (`frontend/.env.local` locally; Vercel project settings in production)

| Name | Purpose | Required | Default in code | Example format |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL **including** `/api/v1`. Inlined at **build time** (public). | **Required in production** | `http://localhost:5000/api/v1` | `https://YOUR_API_DOMAIN_HERE/api/v1` |

> The root README says `frontend/.env.example` exists, but **no such file is in the repository**. Create `.env.local` manually (§23).

### 22.3 Development vs. production

| Variable | Development | Production |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `MONGODB_URI` | Atlas dev cluster or local replica set | Atlas production cluster (separate database/user) |
| `JWT_SECRET` | Any value (weak allowed) | Random ≥ 32 characters, unique per environment |
| `JWT_EXPIRES_IN` | `15m` | **`15m`** |
| `SESSION_TTL_DAYS` | `30` | `30` (or per policy) |
| `COOKIE_SAMESITE` | `lax` (same site: localhost:3000 ↔ localhost:5000) | `none` for `*.vercel.app` + `*.up.railway.app`; `lax` if both are subdomains of one domain (§24.4) |
| `CLIENT_URL` | `http://localhost:3000` | `https://<frontend domain>` (exact origin, no trailing slash) |
| Cloudinary | Optional (private images fall back to `backend/private-uploads/`; general uploads fail) | **Required** |
| `SMTP_*` | Empty (emails only logged) or a sandbox SMTP server | **Required** — a real SMTP provider |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api/v1` | `https://<api domain>/api/v1` |

**Production template (placeholders only):**

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://YOUR_DB_USER:YOUR_DB_PASSWORD_HERE@YOUR_CLUSTER.mongodb.net/ssr-portal
JWT_SECRET=YOUR_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS_HERE
JWT_EXPIRES_IN=15m
SESSION_TTL_DAYS=30
COOKIE_SAMESITE=none
CLIENT_URL=https://YOUR_FRONTEND_DOMAIN_HERE
RESET_TOKEN_EXPIRES_MINUTES=30
OTP_EXPIRES_MINUTES=10
EMAIL_FROM=no-reply@YOUR_DOMAIN_HERE
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME_HERE
CLOUDINARY_API_KEY=YOUR_CLOUDINARY_API_KEY_HERE
CLOUDINARY_API_SECRET=YOUR_CLOUDINARY_API_SECRET_HERE
```

---

## 23. Local development setup

### Prerequisites

- **Node.js 20+** (verification for this document used v20.20.2) and npm.
- **MongoDB replica set:** MongoDB Atlas (free tier works) **or** a local `mongod` started as a single-node replica set. A standalone `mongod` fails on registration and payment approval because they use transactions.
- Optional: a Cloudinary account (needed for material and submission uploads).
- Git.

### 1. Clone the repository

```bash
git clone https://github.com/MathiHarshitha/SSR_INSTITUTE_PORTAL.git
cd SSR_INSTITUTE_PORTAL
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure environment variables

```bash
# backend
cd backend
cp .env.example .env
# edit .env: set MONGODB_URI, JWT_SECRET (any value locally), optionally Cloudinary keys

# frontend (no .env.example exists — create it)
cd ../frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1" > .env.local
```

### 4. Start or connect to MongoDB

- **Atlas:** put the `mongodb+srv://…` URI in `MONGODB_URI`, and allow your IP in Atlas Network Access.
- **Local replica set** (one-time):
  ```bash
  mongod --replSet rs0 --dbpath <data-dir>
  mongosh --eval "rs.initiate()"
  # MONGODB_URI=mongodb://127.0.0.1:27017/ssr-portal?replicaSet=rs0
  ```
- Note: `config/db.ts` forces Node's DNS resolvers to `8.8.8.8` and `1.1.1.1`. On networks that block public DNS, SRV (`mongodb+srv`) resolution may fail. Use a standard connection string or adjust that line locally.

**Seed development data** (1 admin, 3 trainers, 10 students (8 active, 2 pending), 7 published courses with seeded curricula, batches and enrollments):

```bash
cd backend
SEED_PASSWORD='YOUR_STRONG_SEED_PASSWORD_HERE' npm run seed            # bash / Git Bash
# PowerShell:  $env:SEED_PASSWORD='YOUR_STRONG_SEED_PASSWORD_HERE'; npm run seed
```

The seeded admin is `admin@ssrinstitute.in`. All seeded accounts are email-verified and use `SEED_PASSWORD`. Without `SMTP_*` configured locally, OTP emails are only logged (never the code itself), so seeded accounts are the practical way to log in. To test real emails locally, point `SMTP_*` at a real or sandbox SMTP server.

### 5. Start the backend

```bash
cd backend
npm run dev        # ts-node-dev with respawn → http://localhost:5000  (health: /health)
```

### 6. Start the frontend

```bash
cd frontend
npm run dev        # http://localhost:3000
```

### 7. Run tests

```bash
cd backend
npm test           # Jest; starts its own in-memory MongoDB replica set — never touches MONGODB_URI
```

The first run downloads the MongoDB 7.0.14 binary. Suites run serially (`maxWorkers: 1`). A full run took about 7 minutes during verification. The frontend has **no automated tests**.

### 8. Run lint

```bash
cd backend  && npm run lint     # eslint src --ext .ts
cd frontend && npm run lint     # eslint (Next.js config)
```

### 9. Run typecheck

Neither package defines a `typecheck` script. Use:

```bash
cd backend  && npx tsc -p tsconfig.json --noEmit
cd frontend && npx tsc --noEmit
```

### 10. Run production builds

```bash
cd backend  && npm run build && npm start      # tsc → dist/, then node dist/server.js
cd frontend && npm run build && npm start      # next build, then next start
```

> If a stray `package-lock.json` exists in a parent directory, Next.js prints a Turbopack workspace-root warning during `next build`. It is harmless, but removing the stray file (or setting `turbopack.root`) silences it.

---

## 24. Deployment

### 24.1 Deployment architecture

```mermaid
flowchart LR
    User["Browser"] -->|HTTPS| V["Vercel<br/>Next.js frontend<br/>(frontend/)"]
    User -->|"HTTPS API calls<br/>Bearer + refresh cookie"| RW["Railway<br/>Express API<br/>(backend/, Nixpacks)"]
    RW --> AT[("MongoDB Atlas<br/>replica set")]
    RW --> CL[("Cloudinary<br/>public + authenticated assets")]
    V -. "NEXT_PUBLIC_API_URL (build time)" .-> RW
```

The repository contains the Railway and Vercel configuration files. The **actual hosting projects, domains and environment values are Not verified** from the repository and must be checked in the respective dashboards.

### 24.2 Backend — Railway

`railway.json` (repository root):

| Setting | Value |
|---|---|
| Builder | `NIXPACKS` |
| Build command | `cd backend && npm install && npm run build` |
| Start command | `cd backend && node dist/server.js` |
| Health check | `GET /health` |
| Restart policy | `ON_FAILURE`, max 3 retries |

- Set every backend variable from §22.1 in the Railway service (`PORT` is provided by Railway).
- `app.set("trust proxy", 1)` assumes exactly one proxy hop in front of the app, which rate limiting relies on for client IPs. Railway's proxy topology: **Requires manual verification.**
- **Egress:** Railway services have outbound internet access unless restricted. The coding grader requires egress blocking (§7.5). **Not verified / open.**
- The container filesystem is ephemeral. Production must use Cloudinary (the code enforces this for private images).

### 24.3 Frontend — Vercel

`frontend/vercel.json`: `framework: nextjs`, `installCommand: npm install`, `buildCommand: npm run build`, `outputDirectory: .next`.

- The Vercel project's **Root Directory must be `frontend`** (because `vercel.json` and `package.json` live there). **Requires manual verification.**
- Set `NEXT_PUBLIC_API_URL=https://<api domain>/api/v1` for the Production (and Preview, if used) environments. It is inlined at build time, so **redeploy after changing it**.
- Security headers are applied by `next.config.ts`.

### 24.4 Domains, cookies and `COOKIE_SAMESITE`

The refresh cookie is set by the **API** domain and must be sent on cross-origin `fetch` calls from the frontend (`withCredentials: true`).

| Deployment shape | Same site? | `COOKIE_SAMESITE` | Notes |
|---|---|---|---|
| Default hostnames: `<app>.vercel.app` + `<svc>.up.railway.app` | **No** (different registrable domains) | **`none`** (automatically `Secure`) | Required for the refresh cookie to be sent at all. Browsers that block third-party cookies (e.g. Safari by default, Chrome with third-party cookies disabled) may still drop it. Users would then be logged out on every page reload once the in-memory access token is gone. **Requires manual verification.** |
| Custom subdomains of one domain, e.g. `portal.<institute-domain>` + `api.<institute-domain>` | **Yes** | **`lax`** (recommended) | Cookie is first-party. Most robust option. |

The actual production domains are **Not verified**. Choose the row that matches the real deployment and set `CLIENT_URL` to the exact frontend origin. CORS allows only that single origin.

### 24.5 MongoDB Atlas

- Use a replica set cluster (all Atlas clusters are replica sets). Transactions are required.
- Create a dedicated database user with least privilege for the application database.
- Network access: allow the Railway egress (unless static outbound IPs are configured for the Railway service, this often means `0.0.0.0/0` combined with strong credentials). **Requires manual verification.**
- Indexes are created by Mongoose on startup (`autoIndex` default). TTL indexes clean up sessions, OTPs and reset tokens.
- Backups and point-in-time recovery: **Not verified.** Configure them in Atlas.

### 24.6 Cloudinary

- Required in production. The API key and secret live only in backend env vars.
- Public assets: `ssr-portal/<folder>`. Private assets: `ssr-portal/private/payment-screenshots`, `ssr-portal/private/payment-qr` (`type: authenticated`).
- Make sure the account allows **authenticated delivery** and signed private download URLs (default Cloudinary behaviour). **Requires manual verification** with a real payment upload.

### 24.7 Node.js version

- Backend: `package.json` declares `engines` **twice** (`"20.x"` and `">=20"`). JSON parsers keep the last key, so the effective value is `">=20"`. Use **Node 20 LTS or newer**. Remove the duplicate key to avoid ambiguity.
- The coding grader needs a Node version that supports `--permission` (newer releases where the permission model is stable) or `--experimental-permission` (Node 20.x). Both are detected automatically. Grading is refused if neither is available.
- Frontend: Next.js 16 on Vercel. Use Node 20+ in the Vercel project settings.

### 24.8 Required production configuration (summary)

| Item | Required value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_EXPIRES_IN` | **`15m`** |
| `JWT_SECRET` | Random, ≥ 32 characters (server refuses weak values) |
| `COOKIE_SAMESITE` | `none` for vercel.app + railway.app; `lax` for shared custom domain |
| `CLIENT_URL` | Exact frontend origin (server refuses to start without it) |
| Cloudinary vars | Set |
| `MONGODB_URI` | Atlas replica set |
| `NEXT_PUBLIC_API_URL` | `https://<api>/api/v1` (set before building the frontend) |
| Coding grader egress | Blocked at infrastructure level (**open item**) |

---

## 25. Security audit

### 25.1 Summary

| | Before fixes | After fixes |
|---|---|---|
| Backend tests | **55 / 56** passing (reported by project owner; not reproducible from the current repository) | **83 / 83** passing (re-run 2026-09-26) |
| Security tests | — | **27 / 27** passing (`securityRegression` 21 + `codingJudge` 6) |
| Backend TypeScript / lint | — | Passing / 0 errors |
| Frontend TypeScript / lint / build | — | Passing / 0 errors (10 warnings) / passing |
| Reviews | Security audit | + second security review (reported completed) |

### 25.2 Major vulnerabilities fixed

The finding IDs (H = high, M = medium, L = low) are the ones referenced in `backend/tests/securityRegression.test.ts`, where each block exercises the real HTTP API the way an attacker would. Items without an ID are hardening that is visible in the code and/or covered by other suites. This document cannot confirm the original severity ratings beyond these labels.

| ID | Vulnerability | Fix | Verified by |
|---|---|---|---|
| **H1 / H2** | A failed final assessment could complete the course (unlocking certificates and career resources), and failed attempts leaked the answer key | Course completion requires a `SUBMITTED` **and passed** attempt. Per-question results are only returned on a pass (quizzes and final assessment). Option index range checked. | `securityRegression` H1/H2 (2 tests) |
| **H5** | Task-quiz answer keys (`isCorrect`) reached students, and drafts were readable by id | `toStudentTask` strips `isCorrect` in list and detail. Drafts return 404 to students. | `securityRegression` H5 |
| — (coding judge) | Student code ran in `node:vm` inside the API process (not a security boundary: realm escape → host access, secrets, filesystem, process spawning; forged verdicts; microtask infinite loops) | Separate process per submission, empty env, Node permission model, no code generation from strings, 64 MB heap, wall-clock SIGKILL, output cap, concurrency cap, per-user rate limit, expected outputs kept outside the sandbox, fail-closed | `codingJudge` (6 tests) |
| **M5** | Sessions weren't server-side revocable (logout, password reset and block didn't kill tokens). Access token accepted from a cookie (CSRF surface). A token forged with a leaked secret wasn't bound to a session. | Server-side `Session` with hashed, rotating refresh tokens and reuse detection. Access tokens carry `sid` and are checked on every request. Bearer-only. Revocation on logout, reset and block. | `securityRegression` M5 (6 tests) |
| **M1** | Trainers could delete curriculum that students had progress in (erasing progress across all batches) | Trainers blocked when progress exists. Admins can still delete. | `securityRegression` M1 |
| **M2** | Trainers could manage interview resources for courses they don't teach | `assertCourseContentAccess` on create, update (incl. target course) and delete | `securityRegression` M2 |
| **M3** | Trainers could view the progress of students outside their batches | Staff progress requires course assignment **and** the student in the trainer's batch | `securityRegression` M3, `trainerAuthorizationMatrix` |
| **M4** | Attendance could be written for students not in the batch (which affects job-eligibility attendance %) | All records must belong to students enrolled in the batch | `securityRegression` M4 |
| **M7** | Uploads trusted the declared MIME type (SVG/scriptable or disguised files) | Allowlist without SVG + extension match + magic-byte signature check | `securityRegression` M7 |
| **M8** | Trainers could schedule interviews for any student | Student must be in the trainer's batch (and in the given batch) | `securityRegression` M8 |
| **L6 / M9** | Empty courses counted as "completed". Unpublished lessons were usable through student endpoints. | `totalLessons > 0` required. Unpublished lessons excluded from the tree and refused by every student lesson endpoint. | `securityRegression` L6/M9 (2 tests) |
| **M10** | Announcements weren't scoped to their audience | `visibleAnnouncementFilter`: live + addressed to the requester's role, batches or courses | `securityRegression` M10 |
| **M11** | Career resources (jobs) were reachable before course completion | Job list empty and applications refused until a course is completed | `securityRegression` M11 |
| **L3** | `javascript:` and other non-http URLs accepted in user-supplied links (stored XSS) | `httpUrl()` validator on every URL field | `securityRegression` L3 |
| **L1** | OTP endpoints revealed which emails have accounts | Uniform responses for unknown, verified and no-code cases | `securityRegression` L1 |
| — (payments) | Fee payment workflow risks: tampered payloads, over-payment, duplicate submissions, double approval, IDOR on screenshots, exposed storage keys | Strict schemas, DB-derived balances, partial unique indexes, transactional conditional approval, 404 on foreign ids, private Cloudinary assets, `select:false` keys | `feePaymentVerification` (13 tests) |
| — (hardening in code) | Algorithm confusion, weak secrets, user enumeration by timing, ReDoS in search, certificate-number guessing, HTML injection in emails, verbose production errors | HS256 pinned; boot refuses weak `JWT_SECRET`/missing `CLIENT_URL`; dummy-hash compare; escaped search regex + length caps; 64-bit certificate numbers; HTML escaping; strict `NODE_ENV` handling | Code review (see §9.1) |

### 25.3 Remaining security considerations

| Priority | Item | Status |
|---|---|---|
| **High** | **Coding grader outbound network access is not blocked.** Node's permission model doesn't cover network access. | **Open — infrastructure action required** (§7.5) |
| Medium | Email is best-effort SMTP with no queue or retry. A failed send is logged (and reported to the admin for payment approvals) but not re-sent. | Configure and monitor SMTP |
| Medium | Rate limiting and grader queue are in-memory (per instance, reset on restart) | Open if scaling horizontally |
| Medium | Frontend has no script-level CSP (only framing/base/object directives) | Open |
| Medium | Cross-site refresh cookie (`SameSite=None`) may be blocked by third-party-cookie policies | Deployment decision (§24.4) |
| Low | General uploads are public Cloudinary URLs | By design; revisit if materials are confidential |
| Low | Only payment schemas reject unknown fields. Others strip them. | Acceptable; stricter option available |
| Low | `AuditLog.ipAddress` never populated | Open |
| Low | Unused public `/uploads` static mount | Open |
| — | Browser/E2E security testing (headers, cookie behaviour on real domains) | **Not performed** |

---

## 26. Testing

### 26.1 Test stack

Jest 30 + ts-jest, Supertest against the real Express app (`createApp()`), and **mongodb-memory-server** running a **single-node replica set** (MongoDB 7.0.14) so transactions work. Collections are wiped after each test. Suites run serially. Test env values are placeholders (`tests/setupEnv.ts`). No real database or secret is used.

### 26.2 Suites

| Suite | Tests | Type | Covers |
|---|---|---|---|
| `auth.test.ts` | 5 | API / integration | Registration → PENDING, duplicate email, OTP wrong/right, login blocked until verified + approved, `/me` |
| `authorization.test.ts` | 6 | API / authorization | No token, garbage token, RBAC 403, admin allowed, block mid-session, forged role claim |
| `batchAccess.test.ts` | 4 | Unit / authorization | `assertBatchAccess` for trainer, student, admin |
| `curriculumAccess.test.ts` | 9 | API / authorization | Course-content access, topic CRUD and cascade deletes, quiz answers never leaked, unenrolled student blocked |
| `trainerAuthorizationMatrix.test.ts` | 8 | API / authorization | Two trainers with disjoint courses, full cross-course matrix for modules, topics, lessons and progress |
| `studentJourney.test.ts` | 1 | API / end-to-end (API level) | Enroll → curriculum → lesson → practice → quiz → complete → progress → continue learning |
| `searchScoping.test.ts` | 1 | API / authorization | Search limited to enrolled courses |
| `notifications.test.ts` | 2 | API | Task-publish notifications only to the batch, mark-read ownership |
| `certificates.test.ts` | 5 | API | Issuance refusals, issue → duplicate → revoke, unknown verify → 404, admin-only issue, `/my` ownership |
| `feePaymentVerification.test.ts` | 13 | API / payment / security | Full payment workflow (see §10), incl. concurrency, tampering, file validation, ownership, partial/full approval, rejection + resubmission, admin race, re-validation, QR settings, admin-only phone exposure, automatic payment-approved email (sent on approval, not on rejection, failure never blocks approval) |
| `emailService.test.ts` | 4 | Unit (SMTP mocked) | Logs-only without `SMTP_HOST`, payment-approved email content and escaping, TLS/port selection, fully-paid subject, SMTP failure reported as not sent |
| `securityRegression.test.ts` | 21 | API / security | Audit findings H1/H2, H5, L1, L3, L6/M9, M1–M5, M7, M8, M10, M11 (§25.2) |
| `codingJudge.test.ts` | 6 | Unit / security | Correct vs wrong grading, secret isolation, fs/child_process blocked after realm escape, escape fails for the right reason, infinite and microtask loops killed, forged verdicts rejected |
| `seedCurriculum.test.ts` | 3 | Integration | Curriculum seeding wiring, lossless upsert, idempotency |
| **Total** | **88** | | **88 passed** (14 suites) |

### 26.3 Coverage by concern

| Concern | Suites |
|---|---|
| Unit tests | `batchAccess`, `codingJudge` (plus pure-function progression exercised via API suites) |
| Integration / API tests | All suites use Supertest + a real database except `batchAccess`/`codingJudge` |
| Security tests | `securityRegression` (21), `codingJudge` (6) = **27** |
| Authentication | `auth`, `authorization`, `securityRegression` (M5, L1) |
| Authorization | `authorization`, `batchAccess`, `curriculumAccess`, `trainerAuthorizationMatrix`, `searchScoping`, `securityRegression` (M1–M4, M8, M10, M11), `feePaymentVerification` |
| Payments | `feePaymentVerification` (12) |
| Coding grader | `codingJudge` (6) |

### 26.4 Current verified results (2026-09-26, Node v20.20.2)

```
Original 83 tests (clean full run):
Test Suites: 13 passed, 13 total
Tests:       83 passed, 83 total

After the email change: 88 tests, 14 suites. Every suite passes; see the verification note in the header.
```

Backend `tsc --noEmit`: exit 0 · Backend lint: 0 problems · Frontend `tsc --noEmit`: exit 0 · Frontend lint: 0 errors, 10 warnings · `next build`: success, 43 routes.

### 26.5 Not covered

- **No frontend tests** (unit, component or E2E) exist.
- **No browser testing was performed** for this document. Receipt PDFs, the WhatsApp link, cookie behaviour on real domains, and responsive layouts need manual verification.
- No load or performance tests. No tests against real Cloudinary or Atlas (Cloudinary is not configured in tests; private images use the local dev fallback).

---

## 27. Known limitations

Every item below is confirmed in the current source code.

| # | Limitation | Evidence | Impact |
|---|---|---|---|
| 1 | **Coding grader has no network isolation** | `utils/codingJudge.ts` security comment | Submitted code can make outbound connections until egress is blocked at the infrastructure level |
| 2 | **Email is best-effort, with no queue or retry.** Sent via nodemailer/SMTP. A failure is logged and swallowed so it never fails the triggering request. Without `SMTP_HOST`, emails are only logged. | `services/email.service.ts` | A transient SMTP outage means that email is lost (for payment approvals the admin is warned in the UI). Registration and password reset depend on SMTP being configured. |
| 3 | **In-memory rate limiting and grader queue** | `express-rate-limit` default store, module-level counters in `codingJudge.ts` | Limits are per instance and reset on restart/redeploy |
| 4 | **Frontend CSP is partial** (no `script-src`/`style-src`) | `frontend/next.config.ts` comment | Less defence-in-depth against XSS |
| 5 | **Receipts are browser-generated**, unsigned, not stored, not verifiable online, use "Rs." instead of ₹, and show live names | `frontend/lib/receipt.ts` | See §11.4 |
| 6 | **WhatsApp is a manual wa.me link**, not an API integration | `frontend/lib/whatsapp.ts` | No automatic or tracked messaging (§12.6) |
| 7 | **Certificates are admin-issued records only**: no auto-issue on completion and no PDF certificate | `services/certificate.service.ts` | Admin must issue each certificate. Students share the verification link. |
| 8 | **Fees don't gate learning or certification** | No fee checks in `lessonAccess` / `certificate.service` | Students with dues can complete courses and receive certificates |
| 9 | **Recorded payments can't be edited or deleted**, and manual payments have no date field in the form (recorded as today) | `fee.service.recordPayment`, `record-payment-dialog.tsx` | A wrong entry (e.g. wrong student within the remaining fee) needs a direct database correction |
| 10 | **Receipt numbers use `Math.random`** + timestamp (unique index, no retry on collision) | `fee.service.generateReceiptNumber` | A (very unlikely) collision would fail that payment insert |
| 11 | **Interview resources are a placeholder** (no upload flow; `COMING_SOON` items are shown to eligible students) | `models/InterviewResource.ts` | Limited functionality |
| 12 | **Mock interviews are not completion-gated** | `mockInterview.service.listInterviews` | Differs from jobs and interview resources |
| 13 | **Scheduled announcements don't notify** when they go live (no scheduler) | `announcement.service.createAnnouncement` | Only visible in lists |
| 14 | **Course status doesn't restrict enrolled students** (draft/archived courses remain accessible to enrolled students) | `lessonAccess` checks enrollment only | Archiving doesn't hide content from enrolled students |
| 15 | **Unknown fields are stripped, not rejected**, outside payment schemas | `validators/*` | Silent drop of unexpected input |
| 16 | **`rememberMe` has no effect**; `OTPVerification.purpose = LOGIN_2FA` and `Notification` type `ACCOUNT_REJECTED` are unused | `auth.service`, models | Dead options; no 2FA exists |
| 17 | **Orphaned history** on curriculum delete (`QuizAttempt`, `CodingSubmission` not removed) | `module.service` | Data hygiene only |
| 18 | **Public `/uploads` static mount** is still present though unused | `app.ts` | Anything placed there is public |
| 19 | **`AuditLog.ipAddress` never recorded** | `auditLog.service` callers | Less forensic detail |
| 20 | **Forced public DNS resolvers** (`8.8.8.8`, `1.1.1.1`) for the whole backend process | `config/db.ts` | Fails where public DNS is blocked. Also affects Cloudinary lookups. |
| 21 | **Duplicate `engines` key** in `backend/package.json` | `package.json` | Ambiguous Node version declaration |
| 22 | **Documentation drift:** root README describes some stale rules (e.g. certificate "batch must be COMPLETED", admin-only curriculum/materials routes, `frontend/.env.example`) | `README.md` vs code | Follow this document / the code |
| 23 | **No frontend automated tests and no browser testing** | repository | UI regressions not caught automatically |
| 24 | **Notifications are polled** (30 s), not pushed | `hooks/useNotifications.ts` | Up to 30 s delay |

---

## 28. Maintenance guide

### 28.1 General rules

1. **Server-authoritative by default.** Money, grades, access, completion, eligibility and roles are decided in backend services, never in the frontend.
2. **Add a regression test with every security-relevant change** (`backend/tests/securityRegression.test.ts` style: call the real API as an attacker would).
3. **Keep controllers thin.** Put rules in services or shared utils so every route that needs a rule gets the same one.
4. Run before every merge: `npm test`, `npm run lint`, `npx tsc --noEmit` (both packages) and `npm run build` (frontend).

### 28.2 Authentication

- Do not add a cookie fallback to `authenticate`. Bearer-only is what keeps state-changing routes CSRF-safe.
- Keep the per-request session and user-status lookup. It is what makes logout, reset, block and suspend immediate.
- Keep `algorithms: ["HS256"]` pinned in `verifyAccessToken`.
- Never persist the access token in the browser (`auth-store` `partialize`). If you add persisted fields, keep tokens out.
- If you change refresh logic, preserve: hashed secret storage, rotation with compare-and-swap, the 30 s grace window, and reuse → revoke.
- New status values must be handled in `login`, `authenticate` and `refreshSession`.
- Wiring email: implement the transport inside `email.service.send()` only. Callers need no change. Never log OTPs or reset URLs.

### 28.3 Authorization

- Every new route needs `authenticate` + `authorize(...)` **and** a service-level scope check (`assertBatchAccess`, `assertCourseContentAccess`, `assertStudentEnrolledInCourse` or an owner filter).
- For per-user records, filter by `req.user.id` in the query and return **404** for others (don't confirm existence).
- Never take `role`, `studentId`, `userId` or `status` from the request body for authorization decisions.
- Extend `trainerAuthorizationMatrix.test.ts` when adding trainer-accessible routes.

### 28.4 Payments

- **Only `Payment` rows change balances.** Never add stored balance fields or trust client amounts.
- Keep `getEnrollmentBalance` the single source of truth. Reuse it for any new fee logic.
- Keep the approval **transaction** and the conditional `{ status: "PENDING" }` update. Keep the partial unique indexes (`one_pending_per_enrollment`, unique `Payment.paymentRequest`).
- Keep payment write schemas `.strict()`.
- Keep screenshots private: never return `screenshot.key` or signed URLs, and keep `select: false`.
- If fee gating is desired, add it to `lessonAccess` / `certificate.service` on the server (not only in the UI) and add tests.
- Keep the balance cap and the enrollment-write transaction in `recordPayment` (they prevent over-crediting, including by concurrent admins).

### 28.5 Coding grader

- **Never run student code in the API process** and never pass secrets (`env` must stay `{}`).
- Keep expected outputs out of the child process, and keep the comparison in the parent.
- Keep fail-closed behaviour when the permission flag is unavailable.
- Any new language needs an equivalent isolated runner. Don't reuse `vm` in-process.
- Before scaling, move the judge to a dedicated, **egress-blocked** container/service and a shared queue.
- Changing limits (`PER_TEST_TIMEOUT_MS`, `MAX_TOTAL_TIMEOUT_MS`, heap, concurrency) → re-run `codingJudge.test.ts`.

### 28.6 Course progression

- `utils/progressState.ts` is the **single** progression engine. Don't duplicate lock logic elsewhere. Call `assertLessonUnlocked` / `loadCourseProgressTree`.
- Every new student-facing lesson endpoint must go through `assertLessonUnlocked` (it also enforces enrollment and published status).
- New lesson stages must be added to `getLessonStageStatus`, `isLessonStagesComplete`, the lesson-progress model, and the answer-stripping in `getLessonForStudent`.
- Never store lock state. It is derived on each request by design.
- Keep answer keys and test cases stripped in **all** student responses (lesson, quiz, final assessment, coding, tasks).

### 28.7 Certificates

- Issuance must keep calling `isCourseCompleted` (which requires a **passed** final assessment when one is published).
- If adding auto-issue, call the same `createCertificateRecord` path after a server-side completion check, and keep the duplicate guard.
- Keep certificate numbers cryptographically random and the public verify response minimal (denormalized fields only).

### 28.8 File uploads

- Always validate by **content** (`assertValidUpload` / `assertValidImage`), not only by MIME type or extension. Don't add SVG or HTML to allowlists.
- Put `authorize` **before** Multer so unauthorized requests never buffer files.
- Private data must use `uploadPrivateImage` / `readPrivateFile` (authenticated delivery), never `uploadBuffer` (public URLs).
- Keep folder names sanitized and students confined to `submissions`.

---

## 29. Production checklist

Status legend: ✅ verified for this document · ⬜ must be done or confirmed by the deploying team · ⚠️ known open item.

| # | Item | Status (2026-09-26) | Notes |
|---|---|---|---|
| 1 | [ ] Environment variables configured | ⬜ | §22 (backend on Railway, `NEXT_PUBLIC_API_URL` on Vercel) |
| 2 | [ ] Secrets configured securely | ⬜ | Host secret stores only. Unique `JWT_SECRET` ≥ 32 chars per environment. |
| 3 | [ ] JWT expiration verified | ⬜ | `JWT_EXPIRES_IN=15m` set explicitly (code default is 15m) |
| 4 | [ ] `COOKIE_SAMESITE` verified | ⬜ | `none` for vercel.app + railway.app; `lax` for shared custom domain (§24.4) |
| 5 | [ ] Node.js 20+ | ✅ locally (v20.20.2) / ⬜ hosts | Confirm Railway and Vercel runtime versions |
| 6 | [ ] MongoDB configured | ⬜ | Atlas replica set, least-privilege user, network access, backups |
| 7 | [ ] Cloudinary configured | ⬜ | Required in production; test a private screenshot round-trip |
| 8 | [ ] Authentication tested | ✅ automated / ⬜ live | Test login, refresh on reload, logout, reset on real domains |
| 9 | [ ] Authorization tested | ✅ automated | 14 suites incl. trainer matrix |
| 10 | [ ] Payment flow tested | ✅ automated / ⬜ live | Submit → approve/reject with real Cloudinary |
| 11 | [ ] Receipt tested | ⬜ | Browser-generated. Check PDF in target browsers (not tested). |
| 12 | [ ] Notifications tested | ✅ automated (partial) / ⬜ live | Unread badge polling in UI |
| 13 | [ ] Coding grader tested | ✅ automated / ⚠️ | **Egress blocking required** (§7.5) |
| 14 | [ ] Security tests passed | ✅ | 27 / 27 |
| 15 | [ ] Backend tests passed | ✅ | 88 tests (see verification note) |
| 16 | [ ] TypeScript passed | ✅ | Backend + frontend `tsc --noEmit` |
| 17 | [ ] Lint passed | ✅ | 0 errors (frontend: 10 warnings) |
| 18 | [ ] Production build passed | ✅ | `next build` (43 routes); backend `tsc` build config verified via `--noEmit` |
| 19 | [ ] Browser smoke testing completed | ⬜ | **Not performed** |
| 20 | [ ] No sensitive credentials committed | ✅ (tracked files) | Only `backend/.env.example` (placeholders) is tracked |
| 21 | [ ] Git history checked | ✅ (partial) | No `.env` file other than `.env.example` was ever added. A full secret-scan of all file contents in history (e.g. gitleaks) was **not** performed. |
| 22 | [ ] SMTP configured and a test email received | ⬜ | Required for OTP, password reset and payment-approved emails (§13.5, §22) |
| 23 | [ ] Admin account created and seed password rotated | ⬜ | Admins exist only via `npm run seed`. Change the seeded password immediately. |

---

## 30. Summary

### 30.1 Documentation structure

29 sections: overview (1) → architecture (2) → roles (3) → student workflow (4) → curriculum (5) → quiz (6) → grader (7) → authentication (8) → security (9) → fees (10) → receipts (11) → WhatsApp (12) → notifications (13) → certificates (14) → jobs and interviews (15) → uploads (16) → database (17) → API (18) → errors (19) → frontend (20) → backend (21) → environment (22) → local setup (23) → deployment (24) → security audit (25) → testing (26) → limitations (27) → maintenance (28) → production checklist (29).

### 30.2 Architecture summary

Two independently deployed apps. A Next.js 16 frontend (Vercel) talks only to an Express 5 REST API (Railway) at `/api/v1`. The API follows routes → middleware (authenticate, authorize, validate, upload, rate-limit) → thin controllers → services → Mongoose models → MongoDB Atlas (replica set), with Cloudinary for files and an isolated child-process judge for code. All business rules live in backend services. The frontend is presentation plus a UX-only route gate.

### 30.3 Technology stack

Next.js 16.3.5 · React 19.2.8 · TypeScript · Tailwind 4 · shadcn/ui · TanStack Query 5 · Zustand 5 · Axios · React Hook Form + Zod · jsPDF — Node 20 · Express 5.2 · Mongoose 8 · Zod 4 · jsonwebtoken (HS256) · bcryptjs · Helmet · express-rate-limit · Multer · Cloudinary — Jest 30 · Supertest · mongodb-memory-server.

### 30.4 Major modules

Authentication and sessions · Users and approvals · Courses, batches and enrollments · Curriculum (modules, topics, lessons) · Progression engine · Lesson quizzes · Coding grader · Final assessments · Certificates · Fees, payment verification, QR settings and receipts · WhatsApp click-to-chat · Notifications and announcements · Materials, schedules, attendance, tasks and submissions · Mock interviews, interview resources and jobs · Search · Dashboards and reports · Audit logs.

### 30.5 Security summary

Bearer-only short-lived JWT (15m) + server-side revocable sessions with rotating hashed refresh tokens. Live role/status check on every request. Role guards plus service-level ownership and scope checks (404 on foreign ids). Zod validation (strict on payments). NoSQL sanitization. Content-signature upload validation. Private Cloudinary assets for payment images. Answer keys and hidden tests never sent to students. Transactional, race-safe payment approval. Sandboxed coding judge. Helmet and frontend security headers. Tiered rate limiting. **27/27 security tests pass.** **Open:** grader network isolation (infrastructure), shared rate-limit store, full frontend CSP.

### 30.6 API summary

28 routers under `/api/v1` (auth, users, courses, batches, fees, jobs, announcements, audit-logs, modules, topics, lessons, materials, classes, attendance, tasks, submissions, interviews, dashboard, progress, certificates, uploads, reports, notifications, enrollments, search, final-assessments, career-resources, interview-resources), 155 endpoints (plus `GET /health`). Public: health, published courses, auth flows and certificate verification. Standard `{ success, message, data, meta? }` / `{ success: false, message, errors }` envelopes.

### 30.7 Database summary

MongoDB replica set with 33 Mongoose models across identity (User, profiles, Session, OTP, reset tokens, AuditLog), curriculum (Course, Batch, Enrollment, Module, Topic, Lesson, FinalAssessment), progress (LessonProgress, QuizAttempt, CodingSubmission, FinalAssessmentAttempt, Certificate), payments (Payment ledger, PaymentRequest, PaymentSettings) and operations (Material, ClassSchedule, Attendance, Task, Submission, MockInterview, Job, JobApplication, InterviewResource, Announcement, Notification). Integrity relies on unique, partial-unique and TTL indexes.

### 30.8 Deployment summary

Backend: Railway, Nixpacks, `cd backend && npm install && npm run build` → `node dist/server.js`, health check `/health`, restart on failure. Frontend: Vercel (root `frontend/`), `npm run build`, `NEXT_PUBLIC_API_URL` at build time. Data: MongoDB Atlas. Files: Cloudinary. Production requires `NODE_ENV=production`, `JWT_EXPIRES_IN=15m`, a strong `JWT_SECRET`, `CLIENT_URL`, the correct `COOKIE_SAMESITE` (`none` for vercel.app + railway.app, `lax` for a shared custom domain), Cloudinary credentials, and grader egress blocking.

### 30.9 Testing summary

14 backend suites, **88 tests passing**, including **27/27 security tests**, re-run on 2026-09-26. Backend and frontend typecheck pass. Lint has 0 errors. The Next.js production build passes. No frontend automated tests and no browser testing.

### 30.10 Known limitations

Grader network isolation (infrastructure) · email has no retry queue · in-memory rate limits · partial frontend CSP · browser-generated unsigned receipts · manual wa.me WhatsApp · admin-issued, record-only certificates · fees don't gate learning · recorded payments can't be edited or deleted · placeholder interview resources · mock interviews not completion-gated · scheduled announcements don't notify · no frontend/browser tests. Full list in §27.

### 30.11 Production checklist

See §29. Already verified: tests (88, all passing), security tests (27/27), typecheck, lint, production build, and no committed `.env` secrets. Still to do: configure and verify environment variables, secrets, `JWT_EXPIRES_IN=15m`, `COOKIE_SAMESITE`, host Node versions, Atlas, Cloudinary, live auth/payment/receipt/notification checks, browser smoke testing, **grader egress blocking**, **SMTP configuration**, a full git-history secret scan, and rotating the seeded admin password.
