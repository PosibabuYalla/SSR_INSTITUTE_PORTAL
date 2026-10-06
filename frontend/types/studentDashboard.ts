export interface StudentEnrollment {
  _id: string;
  course: { _id: string; name: string };
  batch: { _id: string; name: string };
  discount: number;
  enrolledAt: string;
}

export interface StudentDashboardStats {
  enrollment: StudentEnrollment | null;
  courseProgress: number;
  attendancePercentage: number;
  pendingTasksCount: number;
  upcomingClasses: {
    _id: string;
    batch: { _id: string; name: string };
    date: string;
    startTime: string;
    endTime: string;
    topic: string;
    meetingLink?: string;
    location?: string;
  }[];
  upcomingInterviews: number;
  feeDue: number;
  recentAnnouncements: {
    _id: string;
    title: string;
    content: string;
    priority: string;
    publishAt: string;
  }[];
  recentGrades: {
    _id: string;
    task: { _id: string; title: string; maxMarks: number };
    marks?: number;
    feedback?: string;
  }[];
}
