"use client";

import Link from "next/link";
import { format, isFuture, isToday, isTomorrow } from "date-fns";
import {
  GraduationCap,
  ClipboardList,
  CalendarClock,
  Wallet,
  Calendar,
  CalendarOff,
  BookOpen,
  Layers,
  BarChart3,
  ArrowRight,
  MountainSnow,
  ClipboardCheck,
  CreditCard,
  Award,
  Search,
  Megaphone,
  Clock3,
  Users,
  Video,
  MapPin,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { useAuthStore } from "@/store/auth-store";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { useMyEnrollments } from "@/hooks/useEnrollments";
import { StatCard, StatCardColor } from "@/components/shared/stat-card";

const COURSE_ICONS = [
  { icon: BookOpen, chip: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" },
  { icon: Layers, chip: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400" },
  { icon: BarChart3, chip: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" },
];

const QUICK_ACTIONS = [
  { label: "Browse Materials", href: "/student/materials", icon: BookOpen, chip: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" },
  { label: "Submit Task", href: "/student/tasks", icon: ClipboardCheck, chip: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400" },
  { label: "View Fees", href: "/student/fees", icon: CreditCard, chip: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" },
  { label: "Certificates", href: "/student/certificates", icon: Award, chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" },
  { label: "Search Courses", href: "/student/search", icon: Search, chip: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" },
];

/** "14:30" -> "2:30 PM"; anything not in HH:mm form is shown as-is. */
function formatTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return t;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

function minutesOf(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

type ClassStatus = "live" | "upcoming" | "done";

/** Status of a class happening today, based on the viewer's local clock. */
function todayStatus(startTime: string, endTime: string): ClassStatus {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  if (start === null || end === null) return "upcoming";
  if (nowMin >= end) return "done";
  if (nowMin >= start) return "live";
  return "upcoming";
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function StudentDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading, isError } = useStudentDashboard();
  const { data: enrollments, isLoading: enrollmentsLoading } = useMyEnrollments();

  const statCards: {
    label: string;
    value: string | number;
    icon: typeof GraduationCap;
    color: StatCardColor;
  }[] = stats
    ? [
        { label: "Course Progress", value: `${stats.courseProgress}%`, icon: GraduationCap, color: "primary" },
        { label: "Pending Tasks", value: stats.pendingTasksCount, icon: ClipboardList, color: "accent" },
        { label: "Attendance", value: `${stats.attendancePercentage}%`, icon: CalendarClock, color: "secondary" },
        {
          label: "Fee Due",
          value: `₹${stats.feeDue.toLocaleString("en-IN")}`,
          icon: Wallet,
          color: stats.feeDue > 0 ? "critical" : "green",
        },
      ]
    : [];

  const classes = stats?.upcomingClasses ?? [];
  const todaysClasses = classes
    .filter((c) => isToday(new Date(c.date)))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  // Feature the live class, else the next one today, else the last one that ended.
  const featuredClass =
    todaysClasses.find((c) => todayStatus(c.startTime, c.endTime) === "live") ??
    todaysClasses.find((c) => todayStatus(c.startTime, c.endTime) === "upcoming") ??
    todaysClasses[todaysClasses.length - 1];
  const featuredStatus = featuredClass ? todayStatus(featuredClass.startTime, featuredClass.endTime) : null;
  const otherTodayClasses = todaysClasses.filter(
    (c) => c !== featuredClass && todayStatus(c.startTime, c.endTime) !== "done"
  );
  // Today's classes that haven't ended yet, followed by future days.
  const upcomingClasses = classes.filter((c) =>
    isToday(new Date(c.date)) ? todayStatus(c.startTime, c.endTime) !== "done" : isFuture(new Date(c.date))
  );

  const topCourses = (enrollments ?? []).slice(0, 3);
  const continueCourseId = stats?.enrollment?.course._id ?? topCourses[0]?.course._id;

  return (
    <div className="flex flex-col gap-3">
      {/* Greeting + quote */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{greeting()} 👋</p>
          <h1 className="truncate text-xl font-bold leading-tight text-foreground">
            Welcome back, {user?.name}!
          </h1>
        </div>
        <div className="flex w-full items-center gap-2.5 clay px-3.5 py-2 sm:w-auto sm:max-w-sm sm:shrink-0">
          <MountainSnow className="h-5 w-5 shrink-0 text-secondary" />
          <p className="text-xs font-medium italic leading-snug text-foreground">
            &ldquo;Discipline today creates opportunities tomorrow.&rdquo;
            <span className="ml-1 not-italic text-[11px] text-muted-foreground">— SSR Institute</span>
          </p>
        </div>
      </div>

      {/* Stat cards */}
      {isError ? (
        <div className="clay py-6 text-center text-sm text-muted-foreground">
          Failed to load dashboard stats.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[60px] rounded-2xl" />)
            : statCards.map((card) => <StatCard key={card.label} {...card} />)}
        </div>
      )}

      {/* Hero banner + today's schedule */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="relative flex flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#0092b5] via-[#047a97] to-[#065f74] p-4 text-white shadow-lg sm:p-5 lg:flex-[2]">
          <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0 shrink-0">
              <h2 className="text-xl font-bold leading-tight">
                Keep Learning,
                <br />
                Keep Building
              </h2>
              <p className="mt-1.5 text-xs text-white/80">Small progress everyday leads to big results.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["LEARN", "PRACTICE", "BUILD", "GROW"].map((word) => (
                  <span key={word} className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold tracking-wide">
                    {word}
                  </span>
                ))}
              </div>
            </div>

            <div className="hidden h-32 w-40 shrink-0 md:block lg:h-36 lg:w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/online-learning.svg"
                alt=""
                className="h-full w-full object-contain drop-shadow-lg"
              />
            </div>

            <div className="w-full max-w-[15rem] shrink-0 rounded-2xl bg-white p-3.5 text-foreground shadow-xl">
              <p className="text-[11px] font-medium text-muted-foreground">Current Course</p>
              <p className="truncate text-sm font-bold">{stats?.enrollment?.course.name ?? "No course yet"}</p>
              <div className="mt-2 space-y-1">
                <Progress value={stats?.courseProgress ?? 0} />
                <p className="text-right text-[11px] text-muted-foreground">{stats?.courseProgress ?? 0}%</p>
              </div>
              <Link
                href={continueCourseId ? `/student/courses/${continueCourseId}` : "/student/courses"}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/90"
              >
                Continue Learning
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col clay p-4 lg:w-72 lg:shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Calendar className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <h3 className="text-sm font-semibold text-foreground">Today&apos;s Schedule</h3>
                <p className="text-[11px] text-muted-foreground">{format(new Date(), "EEEE, d MMM")}</p>
              </div>
            </div>
            {todaysClasses.length > 0 && (
              <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                {todaysClasses.length} {todaysClasses.length === 1 ? "class" : "classes"}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col">
            {isLoading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : featuredClass ? (
              <>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0092b5] via-[#047a97] to-[#065f74] p-3.5 text-white shadow-md">
                  <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-20" />
                  <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                  <div className="relative">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                      {featuredStatus === "live" ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        </span>
                      ) : (
                        <Clock3 className="h-2.5 w-2.5" />
                      )}
                      {featuredStatus === "live" ? "Live now" : featuredStatus === "done" ? "Completed" : "Up next"}
                    </span>
                    <p className="mt-2 line-clamp-2 text-base font-bold capitalize leading-snug">
                      {featuredClass.topic.toLowerCase()}
                    </p>
                    <div className="mt-1.5 space-y-0.5 text-[11px] text-white/85">
                      <p className="flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3" />
                        {formatTime(featuredClass.startTime)} – {formatTime(featuredClass.endTime)}
                      </p>
                      {featuredClass.batch?.name && (
                        <p className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">{featuredClass.batch.name}</span>
                        </p>
                      )}
                      {featuredClass.location && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{featuredClass.location}</span>
                        </p>
                      )}
                    </div>
                    {featuredClass.meetingLink && featuredStatus !== "done" && (
                      <a
                        href={featuredClass.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-1.5 text-xs font-semibold text-[#047a97] shadow-sm transition-transform hover:scale-[1.02]"
                      >
                        <Video className="h-3.5 w-3.5" />
                        {featuredStatus === "live" ? "Join Class Now" : "Join Link"}
                      </a>
                    )}
                  </div>
                </div>

                {otherTodayClasses.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {otherTodayClasses.slice(0, 2).map((c) => (
                      <li key={c._id} className="flex items-center gap-2 px-1.5 py-1 text-xs">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                        <span className="w-14 shrink-0 text-[11px] font-semibold text-secondary">
                          {formatTime(c.startTime)}
                        </span>
                        <span className="truncate capitalize text-foreground">{c.topic.toLowerCase()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="text-xs font-medium text-foreground">No classes today</p>
                <p className="text-[11px] text-muted-foreground">Take this time to revise or catch up.</p>
              </div>
            )}
          </div>

          <Link
            href="/student/schedule"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-border py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            View Full Schedule
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* My courses + upcoming classes */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="flex flex-col clay p-4 lg:flex-[2]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <GraduationCap className="h-4 w-4 text-secondary" />
              My Courses
            </h3>
            <Link href="/student/courses" className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline">
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {enrollmentsLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : topCourses.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">You are not enrolled in any course yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topCourses.map((e, i) => {
                const { icon: Icon, chip } = COURSE_ICONS[i % COURSE_ICONS.length];
                return (
                  <div key={e.enrollmentId} className="flex flex-col rounded-2xl border border-border p-3">
                    <span className={cn("mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", chip)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="truncate text-sm font-semibold text-foreground">{e.course.name}</p>
                    <p className="mb-2 truncate text-[11px] text-muted-foreground">
                      {e.overallProgress}% completed · {e.totalCompleted}/{e.totalLessons} lessons
                    </p>
                    <Progress value={e.overallProgress} className="mb-2" />
                    <Link
                      href={`/student/courses/${e.course._id}`}
                      className="mt-auto flex items-center justify-center gap-1.5 rounded-xl border border-border py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Continue Learning
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col clay p-4 lg:w-72 lg:shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Upcoming Classes</h3>
            <Link href="/student/schedule" className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline">
              View All
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : upcomingClasses.length > 0 ? (
            <ul className="divide-y divide-border">
              {upcomingClasses.slice(0, 3).map((c) => {
                const date = new Date(c.date);
                const today = isToday(date);
                const live = today && todayStatus(c.startTime, c.endTime) === "live";
                return (
                  <li key={c._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-card text-center shadow-sm">
                      <p
                        className={cn(
                          "py-0.5 text-[8px] font-bold uppercase tracking-wider",
                          live ? "bg-status-good text-white" : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        {today ? "Today" : format(date, "MMM")}
                      </p>
                      <p className="py-0.5 text-sm font-bold leading-tight text-foreground">{format(date, "d")}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold capitalize text-foreground">{c.topic.toLowerCase()}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {live ? (
                          <span className="font-semibold text-status-good">Live now</span>
                        ) : today ? (
                          "Today"
                        ) : isTomorrow(date) ? (
                          "Tomorrow"
                        ) : (
                          format(date, "EEEE")
                        )}{" "}
                        · {formatTime(c.startTime)} – {formatTime(c.endTime)}
                      </p>
                    </div>
                    {c.meetingLink && (
                      <a
                        href={c.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Join ${c.topic}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/10 hover:text-secondary"
                      >
                        <Video className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-3 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <CalendarOff className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-xs font-medium text-foreground">No upcoming classes.</p>
              <p className="text-[11px] text-muted-foreground">Enjoy your free time or work on tasks!</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions + announcements + future banner */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="flex flex-col clay p-4 lg:flex-1">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Quick Actions</h3>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border p-2 text-center transition-colors hover:bg-muted"
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", action.chip)}>
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="line-clamp-2 text-[10px] font-medium leading-tight text-foreground">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col clay p-4 lg:flex-1">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-secondary" />
              Recent Announcements
            </span>
          </h3>

          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !stats || stats.recentAnnouncements.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-center text-xs text-muted-foreground">
              No announcements yet.
            </p>
          ) : (
            <ul className="flex-1 space-y-2">
              {stats.recentAnnouncements.slice(0, 2).map((a, i) => (
                <li key={a._id} className="rounded-xl border-l-4 border-secondary bg-muted/50 p-2">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-foreground">{a.title}</p>
                    {i === 0 && (
                      <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative flex min-h-[9rem] flex-1 flex-col justify-end overflow-hidden rounded-3xl bg-[#0f172a] p-4 text-white shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/hiking.svg"
            alt=""
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent" />
          <p className="relative line-clamp-3 text-sm font-bold leading-snug">
            Your future is built by what you do today, not tomorrow.
          </p>
          <div className="relative mt-2 h-1.5 w-20 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-secondary to-accent" />
          </div>
          <p className="relative mt-2 text-[10px] text-white/60">SSR Institute — Skills Today. Success Tomorrow.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-between gap-1 border-t border-border pt-2 text-[11px] text-muted-foreground sm:flex-row">
        <span>SSR Institute · Learn • Build • Grow</span>
        <span>Made with ❤️ for better learners</span>
      </div>
    </div>
  );
}
