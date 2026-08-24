import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { formatNumber } from "@/lib/format";
import { Building2, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";

export default function SuperAdmin() {
  const { user } = useAuth();
  const claim = useMutation(api.superAdmin.claimSuperAdmin);
  const [claiming, setClaiming] = useState(false);
  const overview = useQuery(
    api.superAdmin.globalOverview,
    user?.role === "admin" ? {} : "skip",
  );

  if (user && user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border p-8 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">داشبورد مدیریت پلتفرم</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            این بخش مخصوص مدیر پلتفرم (Super Admin) است. حساب شما مدیر مدرسه است.
            برای نمایش دمو می‌توانید نقش مدیر پلتفرم بگیرید.
          </p>
          <Button
            className="mt-5"
            disabled={claiming}
            onClick={async () => {
              setClaiming(true);
              try {
                await claim({});
                window.location.reload();
              } finally {
                setClaiming(false);
              }
            }}
          >
            {claiming ? "…" : "دریافت نقش مدیر پلتفرم (دمو)"}
          </Button>
          <div className="mt-4">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              بازگشت به داشبورد مدرسه
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
              Super Admin
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              نمای کلی پلتفرم
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              همه مدارس، بدون مرز تننت — فقط برای مدیر پلتفرم.
            </p>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            داشبورد مدرسه
          </Link>
        </div>

        {/* Totals */}
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "مدرسه", value: overview?.totals.schools },
            { label: "دانش‌آموز", value: overview?.totals.students },
            { label: "راننده", value: overview?.totals.drivers },
            { label: "خودرو", value: overview?.totals.vehicles },
            { label: "رویداد امروز", value: overview?.totals.todayEvents },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {card.value === undefined ? "…" : formatNumber(card.value)}
              </p>
            </div>
          ))}
        </section>

        {overview && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3.5" />
            {formatNumber(overview.outboxQueued)} اعلان در صف ارسال (Outbox)
          </p>
        )}

        {/* Schools */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" />
            مدارس
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border">
            <Table dir="rtl">
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead>مدرسه</TableHead>
                  <TableHead>شهر</TableHead>
                  <TableHead>دانش‌آموز</TableHead>
                  <TableHead>راننده</TableHead>
                  <TableHead>خودرو</TableHead>
                  <TableHead>سرویس</TableHead>
                  <TableHead>رویداد امروز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!overview && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      …
                    </TableCell>
                  </TableRow>
                )}
                {overview?.schools.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      هنوز مدرسه‌ای ثبت نشده است.
                    </TableCell>
                  </TableRow>
                )}
                {overview?.schools.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.city ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(s.counts.students)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(s.counts.drivers)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(s.counts.vehicles)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(s.counts.services)}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(s.todayEvents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!overview && <Skeleton className="mt-3 h-4 w-40" />}
        </section>
      </div>
    </main>
  );
}
