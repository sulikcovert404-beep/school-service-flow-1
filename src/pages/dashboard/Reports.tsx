import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { EVENT_LABELS, formatDateTime } from "@/lib/format";

const FILTERS = [
  { value: undefined, label: "همه" },
  { value: "PICKED_UP" as const, label: "سوار شد" },
  { value: "DROPPED_OFF" as const, label: "پیاده شد" },
  { value: "ABSENT" as const, label: "غایب" },
];

export default function Reports() {
  const [eventType, setEventType] = useState<"PICKED_UP" | "DROPPED_OFF" | "ABSENT" | undefined>(
    undefined,
  );
  const result = usePaginatedQuery(
    api.attendance.listEvents,
    { eventType },
    { initialNumItems: 20 },
  );

  return (
    <div>
      <PageHeader
        title="گزارش رویدادها"
        description="تاریخچه کامل و فقط‌الحاقی رویدادهای رفت‌وبرگشت مدرسه."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setEventType(f.value)}
            className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
              eventType === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead>دانش‌آموز</TableHead>
              <TableHead>رویداد</TableHead>
              <TableHead>سرویس</TableHead>
              <TableHead>منبع</TableHead>
              <TableHead>زمان</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.results.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.studentName}</TableCell>
                <TableCell>
                  <span
                    className={
                      e.eventType === "ABSENT" ? "text-destructive" : undefined
                    }
                  >
                    {EVENT_LABELS[e.eventType]}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{e.serviceName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full font-normal">
                    {e.source === "manual" ? "ثبت دستی" : e.source === "driver" ? "راننده" : "سیستمی"}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDateTime(e.serverTimestamp)}
                </TableCell>
              </TableRow>
            ))}
            {!result.results.length && !result.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  رویدادی یافت نشد.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-center">
        {result.status === "CanLoadMore" && (
          <Button variant="outline" size="sm" onClick={() => result.loadMore(20)}>
            نمایش بیشتر
          </Button>
        )}
        {result.status === "LoadingMore" && (
          <span className="text-xs text-muted-foreground">…</span>
        )}
      </div>
    </div>
  );
}
