import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Bus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SHIFT_LABELS, STATUS_LABELS, formatNumber, formatTime } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  waiting: "text-muted-foreground",
  picked_up: "text-foreground",
  dropped_off: "text-muted-foreground",
  absent: "text-destructive",
};

export default function Services() {
  const rows = useQuery(api.services.list);
  const routes = useQuery(api.routes.list);
  const vehicles = useQuery(api.vehicles.list);
  const drivers = useQuery(api.drivers.list);
  const students = useQuery(api.students.list);
  const create = useMutation(api.services.create);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [routeId, setRouteId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");
  const [shift, setShift] = useState<"morning" | "return">("morning");

  const submit = async () => {
    setBusy(true);
    try {
      await create({
        name,
        routeId: routeId as Id<"routes">,
        vehicleId: vehicleId as Id<"vehicles">,
        driverId: driverId as Id<"drivers">,
        shift,
      });
      setName("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت سرویس");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="سرویس‌ها"
        description="ترکیب مسیر، خودرو و راننده در قالب شیفته صبح یا برگشت. با باز کردن هر سرویس می‌توانید وضعیت زنده دانش‌آموزان را ببینید و ثبت کنید."
      />

      <div className="flex justify-start">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="size-4" />
              افزودن سرویس
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>افزودن سرویس</DialogTitle>
              <DialogDescription>منابع فعال را انتخاب کنید.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="s-name">نام سرویس</Label>
                <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>مسیر</Label>
                <Select dir="rtl" value={routeId} onValueChange={setRouteId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب مسیر" /></SelectTrigger>
                  <SelectContent>
                    {(routes ?? []).filter((r) => r.isActive).map((r) => (
                      <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>خودرو</Label>
                <Select dir="rtl" value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب خودرو" /></SelectTrigger>
                  <SelectContent>
                    {(vehicles ?? []).filter((v) => v.isActive).map((v) => (
                      <SelectItem key={v._id} value={v._id}>{v.plateNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>راننده</Label>
                <Select dir="rtl" value={driverId} onValueChange={setDriverId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب راننده" /></SelectTrigger>
                  <SelectContent>
                    {(drivers ?? []).filter((d) => d.isActive).map((d) => (
                      <SelectItem key={d._id} value={d._id}>{d.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>شیفته</Label>
                <div className="flex gap-2">
                  {(["morning", "return"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setShift(s)}
                      className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                        shift === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {SHIFT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                onClick={submit}
                disabled={busy || !name.trim() || !routeId || !vehicleId || !driverId}
              >
                {busy ? "در حال ثبت…" : "ثبت"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {!rows &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-secondary/50" />
          ))}
        {rows?.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            هنوز سرویسی ثبت نشده است.
          </p>
        )}
        {rows?.map((s) => (
          <RosterCard key={s._id} serviceId={s._id} />
        ))}
      </div>
    </div>
  );
}

type RosterRow = {
  studentId: Id<"students">;
  name: string;
  grade: string;
  isActive: boolean;
  status: "waiting" | "picked_up" | "dropped_off" | "absent";
  lastEventAt: number | null;
};

function RosterCard({ serviceId }: { serviceId: Id<"services"> }) {
  const data = useQuery(api.attendance.roster, { serviceId });
  const recordManual = useMutation(api.attendance.recordManual);
  const assignStudent = useMutation(api.services.assignStudent);
  const unassignStudent = useMutation(api.services.unassignStudent);
  const allStudents = useQuery(api.students.list);

  if (!data) {
    return <div className="h-40 animate-pulse rounded-lg bg-secondary/50" />;
  }

  const assignedIds = new Set(data.rows.map((r) => r.studentId));
  const candidates = (allStudents ?? []).filter(
    (s) => s.isActive && !assignedIds.has(s._id),
  );

  const record = async (studentId: Id<"students">, eventType: "PICKED_UP" | "DROPPED_OFF" | "ABSENT") => {
    try {
      await recordManual({ serviceId, studentId, eventType });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت وضعیت");
    }
  };

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <p className="text-sm font-medium">{data.service.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{SHIFT_LABELS[data.service.shift]}</p>
        </div>
        <Badge variant="outline" className="rounded-full font-normal">
          {formatNumber(data.rows.length)} دانش‌آموز
        </Badge>
      </div>

      <ul className="min-h-[80px] divide-y border-t">
        {data.rows.length === 0 && (
          <li className="px-5 py-6 text-center text-xs text-muted-foreground">
            هنوز دانش‌آموزی تخصیص نیافته است.
          </li>
        )}
        {data.rows.map((row) => (
          <li key={row.studentId} className="flex items-center justify-between gap-2 px-5 py-2.5">
            <div className="min-w-0">
              <p className={`truncate text-sm ${row.isActive ? "" : "text-muted-foreground line-through"}`}>
                {row.name}
              </p>
              <p className={`mt-0.5 text-xs ${STATUS_BADGE[row.status]}`}>
                {STATUS_LABELS[row.status]}
                {row.lastEventAt && ` · ${formatTime(row.lastEventAt)}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <MiniBtn label="سوار" active={row.status === "picked_up"} onClick={() => record(row.studentId, "PICKED_UP")} />
              <MiniBtn label="پیاده" active={row.status === "dropped_off"} onClick={() => record(row.studentId, "DROPPED_OFF")} />
              <MiniBtn label="غایب" danger active={row.status === "absent"} onClick={() => record(row.studentId, "ABSENT")} />
              <button
                type="button"
                title="حذف از سرویس"
                onClick={() =>
                  unassignStudent({ serviceId, studentId: row.studentId }).catch((e) =>
                    toast.error(e instanceof Error ? e.message : "خطا"),
                  )
                }
                className="ms-1 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-destructive"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t px-5 py-3">
        {candidates.length > 0 ? (
          <Select
            dir="rtl"
            value=""
            onValueChange={(studentId) =>
              assignStudent({
                serviceId,
                studentId: studentId as Id<"students">,
              }).catch((e) => toast.error(e instanceof Error ? e.message : "خطا"))
            }
          >
            <SelectTrigger size="sm" className="w-full text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Bus className="size-3.5" />
                افزودن دانش‌آموز به این سرویس…
              </span>
            </SelectTrigger>
            <SelectContent>
              {candidates.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.firstName} {s.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">همه دانش‌آموزان فعال تخصیص یافته‌اند.</p>
        )}
      </div>
    </div>
  );
}

function MiniBtn({
  label,
  onClick,
  active,
  danger,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
        active
          ? danger
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-primary/20 bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary/70"
      }`}
    >
      {label}
    </button>
  );
}
