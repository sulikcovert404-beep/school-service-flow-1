import { PageHeader } from "@/components/dashboard/page-header";
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
import { formatDateTime } from "@/lib/format";

export default function AuditLog() {
  const result = usePaginatedQuery(api.audit.list, {}, { initialNumItems: 20 });

  return (
    <div>
      <PageHeader
        title="لاگ حسابرسی"
        description="هر عملیات حساس — ثبت، تغییر وضعیت، تخصیص — با نام انجام‌دهنده و زمان دقیق."
      />

      <div className="overflow-hidden rounded-lg border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead>عملیات</TableHead>
              <TableHead>توضیح</TableHead>
              <TableHead>انجام‌دهنده</TableHead>
              <TableHead>زمان</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.results.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <code dir="ltr" className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {log.action}
                  </code>
                </TableCell>
                <TableCell>{log.summary}</TableCell>
                <TableCell className="text-muted-foreground">{log.actorName}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {!result.results.length && !result.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  هنوز لاگی ثبت نشده است.
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
