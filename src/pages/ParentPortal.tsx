import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import {
  EVENT_LABELS,
  SHIFT_LABELS,
  STATUS_LABELS,
  formatTime,
} from "@/lib/format";
import {
  ArrowRight,
  Bell,
  Bus,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  Phone,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";

type Status = "waiting" | "picked_up" | "dropped_off" | "absent";

const STATUS_STYLES: Record<Status, string> = {
  waiting: "bg-secondary text-secondary-foreground",
  picked_up: "bg-foreground text-background",
  dropped_off: "bg-muted text-muted-foreground",
  absent: "bg-muted text-muted-foreground",
};

/** Convert a URL-safe base64 VAPID key to the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function ParentPortal() {
  const ctx = useQuery(api.bootstrap.myContext);
  const isAdmin = ctx?.role === "school_admin" || ctx?.role === "admin";

  // Web Push subscription (only offered when VAPID keys are configured).
  const webPushKey = useQuery(api.notifications.getWebPushPublicKey);
  const registerDevice = useMutation(api.notifications.registerDevice);
  const [pushState, setPushState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [pushError, setPushError] = useState<string | null>(null);

  const enablePush = async () => {
    if (!webPushKey) return;
    setPushState("working");
    setPushError(null);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(webPushKey),
      });
      await registerDevice({
        token: JSON.stringify(subscription.toJSON()),
        platform: "web",
        parentId: isAdmin && previewParentId ? (previewParentId as never) : undefined,
      });
      setPushState("done");
    } catch (err) {
      setPushState("error");
      setPushError(err instanceof Error ? err.message : "خطای ناشناخته");
    }
  };

  const parents = useQuery(api.parents.listWithChildren, isAdmin ? {} : "skip");
  const [previewParentId, setPreviewParentId] = useState<string | null>(null);

  // Admins must pick a parent to preview first — otherwise skip the query
  // (the guard would reject an unscoped request and crash the page).
  const children = useQuery(
    api.parentApp.myChildren,
    isAdmin ? (previewParentId ? { parentId: previewParentId as never } : "skip") : {},
  );
  const notifications = useQuery(
    api.notifications.listForParent,
    isAdmin ? (previewParentId ? { parentId: previewParentId as never } : "skip") : {},
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10">
        <header className="flex items-center justify-between py-5">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            داشبورد
          </Link>
          <Badge variant="outline" className="gap-1.5 rounded-full font-normal">
            <UserRound className="size-3" />
            پورتال والد
          </Badge>
        </header>

        <h1 className="text-xl font-semibold tracking-tight">وضعیت امروز</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          رفت‌وبرگشت فرزندان شما به‌صورت زنده.
        </p>

        {isAdmin && (
          <section className="mt-5 rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">پیش‌نمایش به‌عنوان والد</p>
            {!parents ? (
              <Skeleton className="mt-2 h-9 w-full" />
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {parents.slice(0, 8).map((p) => (
                  <Button
                    key={p._id}
                    size="sm"
                    variant={previewParentId === p._id ? "default" : "outline"}
                    onClick={() => setPreviewParentId(p._id)}
                  >
                    {p.fullName}
                  </Button>
                ))}
                {parents.length === 0 && (
                  <p className="text-sm text-muted-foreground">والدی ثبت نشده است.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Web Push subscription (only when VAPID keys are configured) */}
        {webPushKey && (
          <section className="mt-5 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">اعلان‌های این دستگاه</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pushState === "done"
                    ? "فعال است — رویدادهای فرزندان را همین‌جا دریافت می‌کنید."
                    : "با فعال‌سازی، لحظه سوار/پیاده شدن فرزندتان اعلان می‌گیرید."}
                </p>
              </div>
              {pushState !== "done" && (
                <Button
                  size="sm"
                  onClick={enablePush}
                  disabled={pushState === "working" || (isAdmin && !previewParentId)}
                >
                  {pushState === "working" ? "در حال فعال‌سازی…" : "فعال‌سازی اعلان"}
                </Button>
              )}
            </div>
            {isAdmin && !previewParentId && pushState !== "done" && (
              <p className="mt-2 text-xs text-muted-foreground">
                ابتدا یک والد را برای پیش‌نمایش انتخاب کنید.
              </p>
            )}
            {pushError && <p className="mt-2 text-xs text-destructive">خطا: {pushError}</p>}
          </section>
        )}

        {/* Children */}
        <section className="mt-5 flex flex-col gap-4">
          {!children && !isAdmin && <Skeleton className="h-40 w-full" />}
          {!children && isAdmin && !previewParentId && (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              برای مشاهده وضعیت، یک والد را انتخاب کنید.
            </p>
          )}
          {children?.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              فرزندی به این حساب متصل نیست.
            </p>
          )}
          {children?.map((child) => (
            <article key={child.studentId} className="rounded-lg border">
              <div className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{child.name}</p>
                  <p className="text-xs text-muted-foreground">
                    پایه {child.grade}
                    {child.className ? ` · کلاس ${child.className}` : ""}
                  </p>
                </div>
                <Badge className={`rounded-full font-normal ${STATUS_STYLES[child.status]}`}>
                  {STATUS_LABELS[child.status]}
                </Badge>
              </div>

              {child.service && (
                <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Bus className="size-3.5" />
                    {child.service.name} · {SHIFT_LABELS[child.service.shift]}
                  </p>
                  <p className="mt-1">
                    راننده: {child.service.driverName ?? "—"}
                    {child.service.vehiclePlate ? ` · ${child.service.vehiclePlate}` : ""}
                  </p>
                </div>
              )}

              {/* Today timeline */}
              <div className="border-t px-4 py-3">
                <p className="mb-2 text-xs font-medium">تایم‌لاین امروز</p>
                {child.timeline.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    هنوز رویدادی ثبت نشده — در انتظار سوار شدن.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {child.timeline.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 text-sm">
                        {e.eventType === "PICKED_UP" ? (
                          <LogIn className="size-3.5 text-foreground" />
                        ) : (
                          <LogOut className="size-3.5 text-muted-foreground" />
                        )}
                        <span>{EVENT_LABELS[e.eventType]}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          ساعت {formatTime(e.serverTimestamp)}
                        </span>
                        {e.serviceName && (
                          <span className="truncate text-xs text-muted-foreground">
                            · {e.serviceName}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          ))}
        </section>

        {/* Notification history */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Bell className="size-4" />
            تاریخچه اعلان‌ها
          </h2>
          <div className="mt-3 flex flex-col divide-y rounded-lg border">
            {!notifications && (
              <div className="p-4">
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {notifications?.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                هنوز اعلانی دریافت نشده است.
              </p>
            )}
            {notifications?.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3">
                <CheckCircle2
                  className={`mt-0.5 size-4 shrink-0 ${
                    n.status === "SENT" ? "text-foreground" : "text-muted-foreground"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatTime(n.createdAt)}
                    {n.status !== "SENT" && ` · ${n.status === "QUEUED" ? "در صف ارسال" : "ناموفق"}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Phone className="size-3" />
          برای موارد اضطراری با مدرسه تماس بگیرید.
        </p>
      </div>
    </main>
  );
}
