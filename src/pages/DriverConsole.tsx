import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import {
  EVENT_LABELS,
  SHIFT_LABELS,
  STATUS_LABELS,
  formatTime,
} from "@/lib/format";
import {
  ArrowRight,
  Bus,
  CheckCircle2,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";

type Status = "waiting" | "picked_up" | "dropped_off" | "absent";

const STATUS_STYLES: Record<Status, string> = {
  waiting: "bg-secondary text-secondary-foreground",
  picked_up: "bg-foreground text-background",
  dropped_off: "bg-muted text-muted-foreground",
  absent: "bg-muted text-muted-foreground line-through",
};

export default function DriverConsole() {
  const ctx = useQuery(api.bootstrap.myContext);
  const isAdmin =
    ctx?.role === "school_admin" || ctx?.role === "admin";

  const drivers = useQuery(
    api.driverApp.listDriversForPreview,
    isAdmin ? {} : "skip",
  );
  const [previewDriverId, setPreviewDriverId] = useState<string | null>(null);

  const services = useQuery(
    api.driverApp.myServices,
    isAdmin && previewDriverId ? { driverId: previewDriverId as never } : isAdmin ? "skip" : {},
  );
  const [serviceId, setServiceId] = useState<string | null>(null);
  const activeServiceId =
    serviceId && services?.some((s) => s._id === serviceId)
      ? serviceId
      : services?.[0]?._id ?? null;

  const roster = useQuery(
    api.driverApp.serviceRoster,
    activeServiceId ? { serviceId: activeServiceId as never } : "skip",
  );

  const { pending, isOnline, syncing, enqueue } = useOfflineQueue();
  const [search, setSearch] = useState("");

  // Optimistic status: pending (unsynced) events override the server state.
  const pendingByStudent = useMemo(() => {
    const map = new Map<string, "PICKED_UP" | "DROPPED_OFF">();
    for (const p of pending) {
      map.set(p.studentId, p.eventType);
    }
    return map;
  }, [pending]);

  const rows = useMemo(() => {
    if (!roster) return [];
    const q = search.trim();
    return roster.rows.filter((r) => !q || r.name.includes(q) || r.grade === q);
  }, [roster, search]);

  const record = (studentId: string, eventType: "PICKED_UP" | "DROPPED_OFF") => {
    if (!activeServiceId) return;
    enqueue({
      idempotencyKey: crypto.randomUUID(),
      serviceId: activeServiceId as never,
      studentId: studentId as never,
      eventType,
      clientTimestamp: Date.now(),
    });
  };

  const activeService = services?.find((s) => s._id === activeServiceId);
  const isReturnShift = activeService?.shift === "return";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10">
        {/* Header */}
        <header className="flex items-center justify-between py-5">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            داشبورد
          </Link>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="outline" className="gap-1.5 rounded-full font-normal">
                <CheckCircle2 className="size-3" />
                آنلاین
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 rounded-full font-normal text-muted-foreground">
                <CloudOff className="size-3" />
                آفلاین — صف محلی
              </Badge>
            )}
          </div>
        </header>

        <h1 className="text-xl font-semibold tracking-tight">کنسول راننده</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ثبت سوار/پیاده شدن با یک لمس — بدون اینترنت هم کار می‌کند.
        </p>

        {/* Driver preview selector (School Admin) */}
        {isAdmin && (
          <section className="mt-5 rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">پیش‌نمایش به‌عنوان راننده</p>
            {!drivers ? (
              <Skeleton className="mt-2 h-9 w-full" />
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {drivers.map((d) => (
                  <Button
                    key={d._id}
                    size="sm"
                    variant={previewDriverId === d._id ? "default" : "outline"}
                    onClick={() => {
                      setPreviewDriverId(d._id);
                      setServiceId(null);
                    }}
                  >
                    {d.fullName}
                  </Button>
                ))}
                {drivers.length === 0 && (
                  <p className="text-sm text-muted-foreground">راننده‌ای ثبت نشده است.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Pending sync indicator */}
        {(pending.length > 0 || syncing) && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm">
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            <span>
              {pending.length > 0
                ? `${pending.length} رویداد در انتظار همگام‌سازی`
                : "در حال همگام‌سازی…"}
            </span>
          </div>
        )}

        {/* Service selector */}
        <section className="mt-5">
          {!services ? (
            <Skeleton className="h-20 w-full" />
          ) : services.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {isAdmin && !previewDriverId
                ? "برای مشاهده، یک راننده را انتخاب کنید."
                : "سرویسی به این راننده تخصیص نیافته است."}
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {services.map((s) => (
                <Button
                  key={s._id}
                  size="sm"
                  variant={s._id === activeServiceId ? "default" : "outline"}
                  className="shrink-0 flex-col items-start gap-0.5"
                  onClick={() => setServiceId(s._id)}
                >
                  <span className="flex items-center gap-1.5">
                    <Bus className="size-3.5" />
                    {s.routeName ?? s.name}
                  </span>
                  <span className="text-[11px] font-normal opacity-70">
                    {SHIFT_LABELS[s.shift]} · {s.studentCount} دانش‌آموز
                  </span>
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* Search */}
        {roster && roster.rows.length > 0 && (
          <div className="relative mt-5">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی دانش‌آموز…"
              className="pl-9"
            />
          </div>
        )}

        {/* Roster */}
        <section className="mt-4 flex flex-col gap-3">
          {!roster && activeServiceId && (
            <Skeleton className="h-24 w-full" />
          )}
          {roster?.rows.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              فهرست این سرویس خالی است.
            </p>
          )}
          {rows.map((row) => {
            const pendingType = pendingByStudent.get(row.studentId);
            const status: Status = pendingType
              ? pendingType === "PICKED_UP"
                ? "picked_up"
                : "dropped_off"
              : row.status;
            const actionType = isReturnShift ? "DROPPED_OFF" : "PICKED_UP";
            const actionDone =
              isReturnShift ? status === "dropped_off" : status === "picked_up";
            return (
              <article key={row.studentId} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      پایه {row.grade}
                      {pendingType && " · در انتظار ارسال"}
                      {!pendingType && row.lastEventAt &&
                        ` · آخرین رویداد: ${formatTime(row.lastEventAt)}`}
                    </p>
                  </div>
                  <Badge className={`rounded-full font-normal ${STATUS_STYLES[status]}`}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </div>
                {!actionDone && row.isActive && (
                  <Button
                    size="lg"
                    className="mt-3 w-full gap-2 text-base"
                    onClick={() => record(row.studentId, actionType)}
                  >
                    {isReturnShift ? (
                      <LogOut className="size-4" />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    {isReturnShift ? "ثبت پیاده شدن" : "ثبت سوار شدن"}
                  </Button>
                )}
              </article>
            );
          })}
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          رویدادها append-only هستند؛ زمان سرور مرجع است · {EVENT_LABELS.PICKED_UP} /{" "}
          {EVENT_LABELS.DROPPED_OFF}
        </p>
      </div>
    </main>
  );
}
