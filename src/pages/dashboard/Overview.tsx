import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bus,
  Car,
  ClipboardList,
  UserRound,
  Users,
} from "lucide-react";
import {
  EVENT_LABELS,
  formatNumber,
  formatTime,
} from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

type OverviewData = {
  counts: Record<string, number>;
  today: {
    total: number;
    pickedUp: number;
    droppedOff: number;
    absent: number;
    waiting: number;
  };
  recentEvents: Array<{
    id: Id<"attendanceEvents">;
    eventType: string;
    serverTimestamp: number;
    source: string;
    studentName: string;
    serviceName: string | null;
  }>;
};

const EVENT_STYLES: Record<string, string> = {
  PICKED_UP: "text-foreground",
  DROPPED_OFF: "text-muted-foreground",
  ABSENT: "text-destructive",
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="px-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="size-4 text-muted-foreground/70" strokeWidth={1.75} />
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
          {value === undefined ? <Skeleton className="h-7 w-12" /> : formatNumber(value)}
        </p>
      </CardContent>
    </Card>
  );
}

export default function Overview() {
  const data = useQuery(api.attendance.overview) as OverviewData | undefined;

  if (!data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const t = data.today;

  return (
    <div>
      <PageHeader
        title="نمای کلی"
        description="وضعیت زنده سرویس رفت‌وبرگشت امروز مدرسه."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="دانش‌آموزان" value={data.counts.students} />
        <StatCard icon={UserRound} label="والدین" value={data.counts.parentsActive} />
        <StatCard icon={ClipboardList} label="رانندگان" value={data.counts.drivers} />
        <StatCard icon={Car} label="خودروها" value={data.counts.vehicles} />
        <StatCard icon={Bus} label="سرویس‌ها" value={data.counts.services} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">وضعیت امروز</h2>
        <Card className="mt-4 shadow-none">
          <CardContent className="grid grid-cols-2 gap-y-6 px-6 py-6 sm:grid-cols-4">
            {[
              { label: "سوار شده", value: t.pickedUp },
              { label: "در انتظار", value: t.waiting },
              { label: "رسیده به مقصد", value: t.droppedOff },
              { label: "غایب", value: t.absent },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight">
                  {formatNumber(item.value)}
                  <span className="mr-1.5 text-xs font-normal text-muted-foreground">
                    از {formatNumber(t.total)}
                  </span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium">آخرین رویدادهای امروز</h2>
        {data.recentEvents.length === 0 ? (
          <Card className="shadow-none">
            <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">
              هنوز رویدادی برای امروز ثبت نشده است.
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {data.recentEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.studentName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.serviceName ?? "بدون سرویس"} · {EVENT_LABELS[e.eventType]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className={`text-xs ${EVENT_STYLES[e.eventType] ?? ""}`}>
                    {EVENT_LABELS[e.eventType]}
                  </span>
                  <span className="w-14 text-left text-xs tabular-nums text-muted-foreground">
                    {formatTime(e.serverTimestamp)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
