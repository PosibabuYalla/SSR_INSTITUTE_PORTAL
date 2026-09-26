"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import {
  Award,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Megaphone,
  Menu,
  Moon,
  Search,
  Sun,
  Video,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileSheet } from "@/components/layout/profile-sheet";
import { roleHomePath } from "@/hooks/useAuth";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { cn } from "cn";
import { AppNotification, NotificationType } from "@/types/notification";
import { AuthUser } from "@/types/auth";

interface TopbarProps {
  user: AuthUser;
  title: string;
  onOpenMobileSidebar: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const NOTIFICATION_ICON: Record<NotificationType, { icon: typeof Bell; chip: string }> = {
  ACCOUNT_APPROVED: { icon: CheckCircle2, chip: "bg-status-good/10 text-status-good" },
  ACCOUNT_REJECTED: { icon: XCircle, chip: "bg-destructive/10 text-destructive" },
  TASK_PUBLISHED: { icon: ClipboardList, chip: "bg-secondary/10 text-secondary" },
  SUBMISSION_EVALUATED: { icon: ClipboardCheck, chip: "bg-secondary/10 text-secondary" },
  INTERVIEW_SCHEDULED: { icon: Video, chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400" },
  CERTIFICATE_ISSUED: { icon: Award, chip: "bg-secondary/10 text-secondary" },
  APPLICATION_STATUS_CHANGED: { icon: Briefcase, chip: "bg-secondary/10 text-secondary" },
  ANNOUNCEMENT: { icon: Megaphone, chip: "bg-secondary/10 text-secondary" },
  PAYMENT_SUBMITTED: { icon: Wallet, chip: "bg-secondary/10 text-secondary" },
  PAYMENT_APPROVED: { icon: Wallet, chip: "bg-status-good/10 text-status-good" },
  PAYMENT_REJECTED: { icon: Wallet, chip: "bg-destructive/10 text-destructive" },
  PAYMENT_RECORDED: { icon: Wallet, chip: "bg-status-good/10 text-status-good" },
};

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const { icon: Icon, chip } = NOTIFICATION_ICON[notification.type];

  const content = (
    <div className="flex w-full items-start gap-2.5 whitespace-normal py-1">
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", chip)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <p className={cn("truncate text-sm", !notification.read ? "font-semibold text-foreground" : "text-foreground")}>
            {notification.title}
          </p>
          {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <DropdownMenuLinkItem
        render={<Link href={notification.link} />}
        className="items-start px-2 py-1.5"
        onClick={() => !notification.read && onRead(notification._id)}
      >
        {content}
      </DropdownMenuLinkItem>
    );
  }

  return (
    <DropdownMenuItem
      className="items-start px-2 py-1.5"
      onClick={() => !notification.read && onRead(notification._id)}
    >
      {content}
    </DropdownMenuItem>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 dark:hidden" />
      <Moon className="hidden h-5 w-5 dark:block" />
    </Button>
  );
}

export function Topbar({ user, title, onOpenMobileSidebar }: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const { data: notificationsData } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllAsRead = useMarkAllNotificationsRead();
  const notifications = notificationsData?.notifications ?? [];

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/student/search?q=${encodeURIComponent(q)}` : "/student/search");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={onOpenMobileSidebar}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Link href={roleHomePath(user.role)} className="flex shrink-0 items-center gap-2 lg:hidden">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
            <Image src="/ssr-logo.webp" alt="SSR Institute" fill sizes="36px" className="object-contain p-1" />
          </div>
        </Link>

        <h1
          className={cn(
            "truncate text-base font-semibold text-foreground sm:text-lg",
            user.role === "STUDENT" && "lg:hidden"
          )}
        >
          {title}
        </h1>

        {user.role === "STUDENT" && (
          <form onSubmit={handleSearchSubmit} className="hidden max-w-xl flex-1 lg:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anything... (courses, materials, tasks)"
                className="h-10 rounded-full bg-muted pl-9"
              />
            </div>
          </form>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({ variant: "ghost", size: "icon" }) + " relative"}
            aria-label="Notifications"
          >
            <Bell className={cn("h-5 w-5", unreadCount > 0 && "text-primary")} />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 animate-pulse justify-center rounded-full bg-accent p-0 text-[10px] text-accent-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent glass={false} align="end" className="w-80 p-2">
            <div className="flex items-center justify-between px-1 py-1.5">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs font-medium text-secondary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <DropdownMenuSeparator className="-mx-2" />
            {notifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="flex flex-col gap-0.5 pr-2 pt-1">
                  {notifications.map((notification) => (
                    <NotificationRow
                      key={notification._id}
                      notification={notification}
                      onRead={(id) => markAsRead.mutate(id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2 rounded-full pl-1 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open account panel"
        >
          <Avatar className="h-9 w-9 ring-2 ring-secondary/40 ring-offset-2 ring-offset-background transition-all hover:ring-secondary/70">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold text-foreground">{user.name}</span>
            <span className="block text-xs text-muted-foreground capitalize">{user.role.toLowerCase()}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </button>
        </div>
      </div>

      <ProfileSheet user={user} open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
