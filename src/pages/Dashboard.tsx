import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  Bus,
  Car,
  ClipboardList,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Route as RouteIcon,
  School,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const NAV = [
  { to: "/dashboard", label: "نمای کلی", icon: LayoutDashboard, end: true },
  { to: "/dashboard/students", label: "دانش‌آموزان", icon: Users },
  { to: "/dashboard/parents", label: "والدین", icon: UserRound },
  { to: "/dashboard/drivers", label: "رانندگان", icon: ClipboardList },
  { to: "/dashboard/vehicles", label: "خودروها", icon: Car },
  { to: "/dashboard/routes", label: "مسیرها", icon: RouteIcon },
  { to: "/dashboard/services", label: "سرویس‌ها", icon: Bus },
  { to: "/dashboard/reports", label: "گزارش رویدادها", icon: FileBarChart },
  { to: "/dashboard/audit", label: "لاگ حسابرسی", icon: History },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const ctx = useQuery(api.bootstrap.myContext);
  const seed = useMutation(api.bootstrap.seedDemoData);

  // One-time tenant provisioning for a freshly signed-in admin.
  useEffect(() => {
    if (ctx && !ctx.school) {
      void seed().catch(() => {});
    }
  }, [ctx, seed]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (!ctx || !ctx.school) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <School className="size-6 animate-pulse" />
          <p className="text-sm">در حال آماده‌سازی فضای مدرسه…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <img src="/logo.svg" alt="" className="size-7" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{ctx.school.name}</p>
            <p className="text-xs text-muted-foreground">داشبورد مدیریت</p>
          </div>
        </div>

        <Separator className="my-5" />

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={"end" in rest}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`
              }
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-1 pt-6">
          <p className="truncate text-xs text-muted-foreground">
            {user?.name ?? user?.email ?? "مدیر مدرسه"}
          </p>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="justify-start gap-2">
            <LogOut className="size-3.5" />
            خروج از حساب
          </Button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="border-b px-5 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="size-6" />
              <span className="text-sm font-medium">{ctx.school.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
          <nav className="mt-4 -mx-1 flex gap-1 overflow-x-auto pb-1">
            {NAV.map(({ to, label, icon: Icon, ...rest }) => (
              <NavLink
                key={to}
                to={to}
                end={"end" in rest}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="size-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:px-10">
          {!ctx.isAnonymous && (
            <Badge variant="outline" className="mb-6 hidden rounded-full font-normal text-muted-foreground lg:inline-flex">
              مدیر مدرسه
            </Badge>
          )}
          <Outlet />
        </div>
      </div>
    </main>
  );
}

export function DashboardSkeleton() {
  return <Skeleton className="h-8 w-48" />;
}
