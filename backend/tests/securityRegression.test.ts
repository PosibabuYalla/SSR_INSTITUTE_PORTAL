/**
 * Regression tests for the security audit findings. Each block asserts that a specific
 * vulnerability is closed by exercising the real HTTP API the way an attacker would.
 */
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { Course } from "../src/models/Course";
import { Batch } from "../src/models/Batch";
import { Module } from "../src/models/Module";
import { Topic } from "../src/models/Topic";
import { Lesson } from "../src/models/Lesson";
import { Enrollment } from "../src/models/Enrollment";
import { LessonProgress } from "../src/models/LessonProgress";
import { FinalAssessment } from "../src/models/FinalAssessment";
import { FinalAssessmentAttempt } from "../src/models/FinalAssessmentAttempt";
import { Task } from "../src/models/Task";
import { Announcement } from "../src/models/Announcement";
import { InterviewResource } from "../src/models/InterviewResource";
import { Job } from "../src/models/Job";
import { PasswordResetToken } from "../src/models/PasswordResetToken";
import { generateSecureToken } from "../src/utils/tokens";
import { createUser, authHeader } from "./helpers";

const app = createApp();

async function makeCourse(name = "Course") {
  return Course.create({ name, shortDescription: "...", duration: "3 months", fee: 1000, status: "PUBLISHED" });
}

async function makeBatch(courseId: unknown, trainerId: unknown, name = "Batch") {
  return Batch.create({
    name,
    course: courseId,
    trainer: trainerId,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    classDays: ["MON"],
    startTime: "10:00",
    endTime: "12:00",
    mode: "ONLINE",
    capacity: 30,
  });
}

/** One module → one topic → one plain reading lesson (no stages). */
async function makeSimpleCurriculum(courseId: unknown) {
  const mod = await Module.create({ course: courseId, name: "Module 1", order: 0 });
  const topic = await Topic.create({ course: courseId, module: mod._id, name: "Topic 1", order: 0 });
  const lesson = await Lesson.create({ course: courseId, module: mod._id, topic: topic._id, title: "Lesson 1", order: 0 });
  return { mod, topic, lesson };
}

function refreshCookieFrom(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith("refreshToken="));
  if (!cookie) throw new Error("no refresh cookie set");
  return cookie.split(";")[0];
}

describe("M5 — sessions are server-side and revocable", () => {
  it("logout kills both the refresh token and existing access tokens", async () => {
    const { user, password } = await createUser({ role: "STUDENT" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: user.email, password });
    expect(login.status).toBe(200);
    const accessToken = login.body.data.accessToken as string;
    const cookie = refreshCookieFrom(login);

    expect((await request(app).get("/api/v1/auth/me").set(authHeader(accessToken))).status).toBe(200);

    const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);

    expect((await request(app).get("/api/v1/auth/me").set(authHeader(accessToken))).status).toBe(401);
    expect((await request(app).post("/api/v1/auth/refresh-token").set("Cookie", cookie)).status).toBe(401);
  });

  it("rotates the refresh token on every refresh", async () => {
    const { user, password } = await createUser({ role: "STUDENT" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: user.email, password });
    const first = refreshCookieFrom(login);

    const refreshed = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", first);
    expect(refreshed.status).toBe(200);
    const second = refreshCookieFrom(refreshed);
    expect(second).not.toBe(first);
    expect((await request(app).get("/api/v1/auth/me").set(authHeader(refreshed.body.data.accessToken))).status).toBe(200);
  });

  it("heals a browser whose refresh response was lost (e.g. hard reload mid-refresh)", async () => {
    const { user, password } = await createUser({ role: "STUDENT" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: user.email, password });
    const stale = refreshCookieFrom(login);

    // The server rotates, but the browser never receives this response's cookie.
    expect((await request(app).post("/api/v1/auth/refresh-token").set("Cookie", stale)).status).toBe(200);

    // The reloaded page presents the stale token within the grace window: it must get a fresh one…
    const retry = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", stale);
    expect(retry.status).toBe(200);
    const healed = refreshCookieFrom(retry);
    expect(healed).not.toBe(stale);

    // …which keeps working for later refreshes, so the user is never logged out.
    expect((await request(app).post("/api/v1/auth/refresh-token").set("Cookie", healed)).status).toBe(200);
  });

  it("password reset signs the user out of every existing session", async () => {
    const { user, token } = await createUser({ role: "STUDENT" });
    const { raw, hashed } = generateSecureToken();
    await PasswordResetToken.create({ user: user._id, tokenHash: hashed, expiresAt: new Date(Date.now() + 60_000) });

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: raw, password: "NewPassw0rd1", confirmPassword: "NewPassw0rd1" });
    expect(reset.status).toBe(200);
    expect((await request(app).get("/api/v1/auth/me").set(authHeader(token))).status).toBe(401);
  });

  it("blocking a user revokes their sessions", async () => {
    const { token: adminToken } = await createUser({ role: "ADMIN" });
    const { user, token } = await createUser({ role: "STUDENT" });
    expect((await request(app).patch(`/api/v1/users/${user._id}/block`).set(authHeader(adminToken))).status).toBe(200);
    expect((await request(app).patch(`/api/v1/users/${user._id}/unblock`).set(authHeader(adminToken))).status).toBe(200);
    // Unblocking does not resurrect the old session.
    expect((await request(app).get("/api/v1/auth/me").set(authHeader(token))).status).toBe(401);
  });

  it("rejects a correctly signed token that has no session (forged with a leaked secret)", async () => {
    const { user } = await createUser({ role: "ADMIN" });
    const forged = jwt.sign({ sub: String(user._id), role: "ADMIN", status: "ACTIVE" }, process.env.JWT_SECRET!, {
      algorithm: "HS256",
    });
    expect((await request(app).get("/api/v1/users").set(authHeader(forged))).status).toBe(401);
  });

  it("does not accept an access token from a cookie (CSRF surface)", async () => {
    const { token } = await createUser({ role: "STUDENT" });
    expect((await request(app).get("/api/v1/auth/me").set("Cookie", `accessToken=${token}`)).status).toBe(401);
  });
});

describe("H1/H2 — final assessment must be passed; failed attempts don't leak the key", () => {
  it("a failed final assessment does not complete the course or unlock a certificate", async () => {
    const course = await makeCourse();
    const { user: trainer } = await createUser({ role: "TRAINER" });
    const batch = await makeBatch(course._id, trainer._id);
    const { lesson } = await makeSimpleCurriculum(course._id);
    const { user: admin, token: adminToken } = await createUser({ role: "ADMIN" });
    await FinalAssessment.create({
      course: course._id,
      questions: [{ question: "1+1?", options: ["1", "2"], correctIndex: 1, explanation: "two" }],
      passingScore: 60,
      published: true,
      createdBy: admin._id,
    });
    const { user: student, token } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: student._id, batch: batch._id, course: course._id });

    await request(app).post(`/api/v1/progress/lessons/${lesson._id}/complete`).set(authHeader(token)).expect(200);

    const base = `/api/v1/final-assessments/courses/${course._id}`;
    await request(app).post(`${base}/start`).set(authHeader(token)).expect(200);
    await request(app).post(`${base}/answer`).set(authHeader(token)).send({ selectedIndex: 0 }).expect(200);
    const failed = await request(app).post(`${base}/submit`).set(authHeader(token));
    expect(failed.body.data.passed).toBe(false);
    expect(failed.body.data.results).toEqual([]);
    expect(JSON.stringify(failed.body)).not.toContain("correctIndex");

    const progress = await request(app).get(`/api/v1/progress/courses/${course._id}`).set(authHeader(token));
    expect(progress.body.data.courseCompleted).toBe(false);
    expect(progress.body.data.certificateUnlocked).toBe(false);

    const cert = await request(app)
      .post("/api/v1/certificates")
      .set(authHeader(adminToken))
      .send({ student: String(student._id), batch: String(batch._id) });
    expect(cert.status).toBe(400);

    // Retake (after the failed-attempt cooldown) and pass → now complete.
    await request(app).post(`${base}/start`).set(authHeader(token)).expect(429);
    await FinalAssessmentAttempt.updateOne(
      { student: student._id, course: course._id },
      { $set: { submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    );
    await request(app).post(`${base}/start`).set(authHeader(token)).expect(200);
    await request(app).post(`${base}/answer`).set(authHeader(token)).send({ selectedIndex: 1 }).expect(200);
    const passed = await request(app).post(`${base}/submit`).set(authHeader(token));
    expect(passed.body.data.passed).toBe(true);
    const after = await request(app).get(`/api/v1/progress/courses/${course._id}`).set(authHeader(token));
    expect(after.body.data.courseCompleted).toBe(true);
  });

  it("rejects an out-of-range quiz option index", async () => {
    const course = await makeCourse();
    const { user: trainer } = await createUser({ role: "TRAINER" });
    const batch = await makeBatch(course._id, trainer._id);
    const mod = await Module.create({ course: course._id, name: "M", order: 0 });
    const topic = await Topic.create({ course: course._id, module: mod._id, name: "T", order: 0 });
    const lesson = await Lesson.create({
      course: course._id, module: mod._id, topic: topic._id, title: "L", order: 0,
      quiz: [{ question: "q", options: ["a", "b"], correctIndex: 0 }],
    });
    const { user: student, token } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: student._id, batch: batch._id, course: course._id });
    await request(app).post(`/api/v1/lessons/${lesson._id}/quiz/start`).set(authHeader(token)).expect(200);
    const bad = await request(app).post(`/api/v1/lessons/${lesson._id}/quiz/answer`).set(authHeader(token)).send({ selectedIndex: 9 });
    expect(bad.status).toBe(400);
  });
});

describe("L6/M9 — empty courses and unpublished lessons", () => {
  it("a course with no lessons is never 'completed'", async () => {
    const course = await makeCourse();
    const { user: trainer } = await createUser({ role: "TRAINER" });
    const batch = await makeBatch(course._id, trainer._id);
    await Module.create({ course: course._id, name: "Empty module", order: 0 });
    const { user: student, token } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: student._id, batch: batch._id, course: course._id });
    const progress = await request(app).get(`/api/v1/progress/courses/${course._id}`).set(authHeader(token));
    expect(progress.body.data.courseCompleted).toBe(false);
  });

  it("unpublished lessons can't be used through any student lesson endpoint", async () => {
    const course = await makeCourse();
    const { user: trainer } = await createUser({ role: "TRAINER" });
    const batch = await makeBatch(course._id, trainer._id);
    const mod = await Module.create({ course: course._id, name: "M", order: 0 });
    const topic = await Topic.create({ course: course._id, module: mod._id, name: "T", order: 0 });
    const hidden = await Lesson.create({
      course: course._id, module: mod._id, topic: topic._id, title: "Draft", order: 0, published: false,
      quiz: [{ question: "secret?", options: ["a", "b"], correctIndex: 0 }],
    });
    const { user: student, token } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: student._id, batch: batch._id, course: course._id });

    expect((await request(app).post(`/api/v1/lessons/${hidden._id}/quiz/start`).set(authHeader(token))).status).toBe(404);
    expect((await request(app).post(`/api/v1/progress/lessons/${hidden._id}/complete`).set(authHeader(token))).status).toBe(404);
  });
});

describe("H5 — task quiz answer keys never reach students", () => {
  it("strips isCorrect from list and detail, and hides drafts by id", async () => {
    const course = await makeCourse();
    const { user: trainer } = await createUser({ role: "TRAINER" });
    const batch = await makeBatch(course._id, trainer._id);
    const { user: student, token } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: student._id, batch: batch._id, course: course._id });
    const quizFields = {
      type: "QUIZ", description: "quiz task", course: course._id, batch: batch._id,
      dueDate: new Date(Date.now() + 86400000), maxMarks: 10, createdBy: trainer._id,
      questions: [{ question: "q", marks: 1, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] }],
    };
    const published = await Task.create({ ...quizFields, title: "Published quiz", status: "PUBLISHED" });
    const draft = await Task.create({ ...quizFields, title: "Draft quiz", status: "DRAFT" });

    const list = await request(app).get("/api/v1/tasks").set(authHeader(token));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain("isCorrect");

    const detail = await request(app).get(`/api/v1/tasks/${published._id}`).set(authHeader(token));
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toContain("isCorrect");

    expect((await request(app).get(`/api/v1/tasks/${draft._id}`).set(authHeader(token))).status).toBe(404);
  });
});

describe("Trainer scoping (M1/M2/M3/M4/M8)", () => {
  async function setup() {
    const course = await makeCourse();
    const otherCourse = await makeCourse("Other");
    const { user: trainerA, token: tokenA } = await createUser({ role: "TRAINER" });
    const { user: trainerB } = await createUser({ role: "TRAINER" });
    const batchA = await makeBatch(course._id, trainerA._id, "A");
    const batchB = await makeBatch(course._id, trainerB._id, "B");
    const { user: studentA } = await createUser({ role: "STUDENT" });
    const { user: studentB } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: studentA._id, batch: batchA._id, course: course._id });
    await Enrollment.create({ student: studentB._id, batch: batchB._id, course: course._id });
    return { course, otherCourse, trainerA, tokenA, batchA, studentA, studentB };
  }

  it("M3: a trainer can't view progress of a student in another trainer's batch", async () => {
    const { course, tokenA, studentA, studentB } = await setup();
    const own = await request(app).get(`/api/v1/progress/students/${studentA._id}/courses/${course._id}`).set(authHeader(tokenA));
    expect(own.status).toBe(200);
    const other = await request(app).get(`/api/v1/progress/students/${studentB._id}/courses/${course._id}`).set(authHeader(tokenA));
    expect(other.status).toBe(403);
  });

  it("M4: attendance can't be written for students outside the batch", async () => {
    const { tokenA, batchA, studentA, studentB } = await setup();
    const res = await request(app)
      .post("/api/v1/attendance/mark")
      .set(authHeader(tokenA))
      .send({ batch: String(batchA._id), date: new Date().toISOString(), records: [
        { student: String(studentA._id), status: "PRESENT" },
        { student: String(studentB._id), status: "PRESENT" },
      ] });
    expect(res.status).toBe(400);
  });

  it("M8: a trainer can't schedule interviews for students outside their batches", async () => {
    const { tokenA, studentB } = await setup();
    const res = await request(app)
      .post("/api/v1/interviews")
      .set(authHeader(tokenA))
      .send({ student: String(studentB._id), date: new Date().toISOString(), time: "10:00", type: "HR" });
    expect(res.status).toBe(403);
  });

  it("M2: a trainer can't create/edit/delete interview resources for courses they don't teach", async () => {
    const { otherCourse, trainerA, tokenA } = await setup();
    const create = await request(app)
      .post("/api/v1/interview-resources")
      .set(authHeader(tokenA))
      .send({ title: "Leak", course: String(otherCourse._id) });
    expect(create.status).toBe(403);

    const foreign = await InterviewResource.create({ title: "Theirs", course: otherCourse._id, createdBy: trainerA._id });
    expect((await request(app).patch(`/api/v1/interview-resources/${foreign._id}`).set(authHeader(tokenA)).send({ title: "Mine now" })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/interview-resources/${foreign._id}`).set(authHeader(tokenA))).status).toBe(403);
  });

  it("M1: a trainer can't delete curriculum students have progress in; an admin can", async () => {
    const { course, tokenA, studentA } = await setup();
    const { lesson } = await makeSimpleCurriculum(course._id);
    await LessonProgress.create({ student: studentA._id, lesson: lesson._id, topic: lesson.topic, module: lesson.module, course: course._id, completed: true });

    expect((await request(app).delete(`/api/v1/lessons/${lesson._id}`).set(authHeader(tokenA))).status).toBe(403);
    const { token: adminToken } = await createUser({ role: "ADMIN" });
    expect((await request(app).delete(`/api/v1/lessons/${lesson._id}`).set(authHeader(adminToken))).status).toBe(200);
  });
});

describe("M10 — announcements are scoped to their audience", () => {
  it("students only see live announcements addressed to them", async () => {
    const course = await makeCourse();
    const { user: trainer } = await createUser({ role: "TRAINER" });
    const myBatch = await makeBatch(course._id, trainer._id, "Mine");
    const otherBatch = await makeBatch(course._id, trainer._id, "Other");
    const { user: admin } = await createUser({ role: "ADMIN" });
    const { user: student, token } = await createUser({ role: "STUDENT" });
    await Enrollment.create({ student: student._id, batch: myBatch._id, course: course._id });
    const base = { content: "hello world", createdBy: admin._id };
    await Announcement.create([
      { ...base, title: "for everyone", audience: "EVERYONE" },
      { ...base, title: "for my batch", audience: "BATCH", batch: myBatch._id },
      { ...base, title: "trainers only", audience: "TRAINERS" },
      { ...base, title: "other batch", audience: "BATCH", batch: otherBatch._id },
      { ...base, title: "future", audience: "EVERYONE", publishAt: new Date(Date.now() + 86400000) },
      { ...base, title: "expired", audience: "EVERYONE", expiresAt: new Date(Date.now() - 1000) },
    ]);
    const res = await request(app).get("/api/v1/announcements").set(authHeader(token));
    const titles = (res.body.data as { title: string }[]).map((a) => a.title).sort();
    expect(titles).toEqual(["for everyone", "for my batch"]);
  });
});

describe("M11 — career resources stay locked until a course is completed", () => {
  it("hides the job list and refuses applications", async () => {
    const { user: admin } = await createUser({ role: "ADMIN" });
    const job = await Job.create({
      company: "Acme", title: "Dev", description: "desc", workMode: "REMOTE",
      applicationDeadline: new Date(Date.now() + 86400000), openings: 1, status: "PUBLISHED", createdBy: admin._id,
    });
    const { token } = await createUser({ role: "STUDENT" });
    const list = await request(app).get("/api/v1/jobs/public").set(authHeader(token));
    expect(list.body.data).toEqual([]);
    expect((await request(app).post(`/api/v1/jobs/${job._id}/apply`).set(authHeader(token)).send({})).status).toBe(403);
  });
});

describe("L3 — only http(s) links are accepted", () => {
  it("rejects javascript: URLs in student submissions", async () => {
    const { token } = await createUser({ role: "STUDENT" });
    const res = await request(app)
      .post("/api/v1/tasks/000000000000000000000000/submit")
      .set(authHeader(token))
      .send({ fileUrl: "javascript:alert(document.cookie)" });
    expect(res.status).toBe(422);
  });
});

describe("M7 — uploads are validated by content", () => {
  it("rejects SVG and files whose content doesn't match their type", async () => {
    const { token } = await createUser({ role: "STUDENT" });
    const svg = await request(app)
      .post("/api/v1/uploads")
      .set(authHeader(token))
      .attach("file", Buffer.from("<svg onload=alert(1)>"), { filename: "x.svg", contentType: "image/svg+xml" });
    expect(svg.status).toBe(400);

    const disguised = await request(app)
      .post("/api/v1/uploads")
      .set(authHeader(token))
      .attach("file", Buffer.from("<html><script>alert(1)</script></html>"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(disguised.status).toBe(400);
  });
});

describe("L1 — OTP endpoints don't reveal which emails exist", () => {
  it("answers the same for unknown emails", async () => {
    const resend = await request(app).post("/api/v1/auth/resend-otp").send({ email: "nobody@test.local" });
    expect(resend.status).toBe(200);
    const verify = await request(app).post("/api/v1/auth/verify-otp").send({ email: "nobody@test.local", otp: "123456" });
    expect(verify.status).toBe(400);
    expect(verify.body.message).toMatch(/Invalid or expired verification code/);
  });
});
