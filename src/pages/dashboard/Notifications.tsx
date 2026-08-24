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
import { formatDateTime } from "@/lib/format";
import { usePaginatedQuery } from "convex/react";

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "در صف",
  SENT: "ارسال شد",
  FAILED: "ناموفق",
};

export default function Notifications() {
  const result = usePaginatedQuery(api.notifications.listForSchool, {}, { initialNumItems: 20 });

  return (
    <div>
      <PageHeader
        title="لاگ اعلان‌ها"
        description="پیام‌های اطلاع‌رسانی والدین — از صف (Outbox) تا وضعیت ارسال. ارسال به‌صورت async انجام می‌شود و هرگز مسیر ثبت رویداد را مسدود نمی‌کند."
      />

      <div className="overflow-hidden rounded-lg border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead>پیام</TableHead>
              <TableHead>والد</TableHead>
              <TableHead>دانش‌آموز</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>زمان</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.results.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="max-w-xs">{n.body}</TableCell>
                <TableCell className="text-muted-foreground">{n.parentName}</TableCell>
                <TableCell className="text-muted-foreground">{n.studentName}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`rounded-full font-normal ${
                      n.status === "SENT"
                        ? ""
                        : n.status === "FAILED"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABELS[n.status] ?? n.status}
                  </Badge>
                  {n.attempts > 1 && (
                    <span className="mr-2 text-xs text-muted-foreground">
                      ({n.attempts} تلاش)
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {!result.results.length && !result.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  هنوز اعلانی در صف قرار نگرفته است.
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
      </div>
    </div>
  );
}
