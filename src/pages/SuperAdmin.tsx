import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Role } from "@/convex/schema";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  Building2,
  ClipboardList,
  History,
  Plus,
  ShieldCheck,
  Users,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدیر پلتفرم",
  school_admin: "مدیر مدرسه",
  driver: "راننده",
  parent: "والد",
  user: "کاربر",
  member: "عضو",
};

const EVENT_LABELS: Record<string, string> = {
  PICKED_UP: "سوار شد",
  DROPPED_OFF: "پیاده شد",
  ABSENT: "غایب",
};

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "در صف",
  SENT: "ارسال شد",
  FAILED: "ناموفق",
};

function LogPager({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (n: number) => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      {status === "CanLoadMore" && (
        <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
          نمایش بیشتر
        </Button>
      )}
      {status === "LoadingMore" && (
        <span className="text-xs text-muted-foreground">…</span>
      )}
    </div>
  );
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const claim = useMutation(api.superAdmin.claimSuperAdmin);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
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
              setClaimError(null);
              try {
                await claim({});
                window.location.reload();
              } catch {
                setClaimError("دریافت نقش ناموفق بود. لطفاً دوباره تلاش کنید.");
                setClaiming(false);
              }
            }}
          >
            {claiming ? "…" : "دریافت نقش مدیر پلتفرم (دمو)"}
          </Button>
          {claimError && (
            <p className="mt-3 text-xs text-destructive">{claimError}</p>
          )}
          <div className="mt-4">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              بازگشت به داشبورد مدرسه
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (user && user.role === "admin") {
    return <SuperAdminPanel />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Skeleton className="h-8 w-40" />
    </main>
  );
}

function SuperAdminPanel() {
  const overview = useQuery(api.superAdmin.globalOverview, {});
  const createSchool = useMutation(api.superAdmin.createSchool);
  const updateSchool = useMutation(api.superAdmin.updateSchool);
  const setUserRole = useMutation(api.superAdmin.setUserRole);
  const setUserActive = useMutation(api.superAdmin.setUserActive);

  // School management form
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [creating, setCreating] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; name: string; city: string; phone: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Users tab
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const users = usePaginatedQuery(
    api.superAdmin.listUsers,
    roleFilter === "all" ? {} : { role: roleFilter as Role },
    { initialNumItems: 20 },
  );

  const events = usePaginatedQuery(api.superAdmin.listEvents, {}, { initialNumItems: 20 });
  const notifs = usePaginatedQuery(api.superAdmin.listNotifications, {}, { initialNumItems: 20 });
  const audit = usePaginatedQuery(api.superAdmin.listAudit, {}, { initialNumItems: 20 });

  const handleCreateSchool = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createSchool({ name: newName, city: newCity || undefined });
      setNewName("");
      setNewCity("");
      toast.success("مدرسه ایجاد شد");
    } catch {
      toast.error("ایجاد مدرسه ناموفق بود");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleSchool = async (id: string, isActive: boolean) => {
    try {
      await updateSchool({ schoolId: id as never, isActive });
      toast.success(isActive ? "مدرسه فعال شد" : "مدرسه غیرفعال شد");
    } catch {
      toast.error("تغییر وضعیت ناموفق بود");
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await updateSchool({
        schoolId: editTarget.id as never,
        name: editTarget.name,
        city: editTarget.city || undefined,
        phone: editTarget.phone || undefined,
      });
      setEditTarget(null);
      toast.success("مدرسه به‌روزرسانی شد");
    } catch {
      toast.error("به‌روزرسانی ناموفق بود");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
              Super Admin
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              مدیریت پلتفرم
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              مدیریت مدارس، کاربران و لاگ‌های سراسری — همه عملیات حساس در حسابرسی ثبت می‌شود.
            </p>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            داشبورد مدرسه
          </Link>
        </div>

        {/* Totals */}
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "مدرسه", value: overview?.totals.schools },
            { label: "مدرسه فعال", value: overview?.totals.activeSchools },
            { label: "دانش‌آموز", value: overview?.totals.students },
            { label: "راننده", value: overview?.totals.drivers },
            { label: "خودرو", value: overview?.totals.vehicles },
            { label: "کاربر", value: overview?.totals.users },
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
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Bell className="size-3.5" />
              {formatNumber(overview.outboxQueued)} در صف ارسال
            </span>
            {overview.outboxFailed > 0 && (
              <span className="text-destructive">
                {formatNumber(overview.outboxFailed)} اعلان ناموفق
              </span>
            )}
          </p>
        )}

        <Tabs defaultValue="schools" className="mt-8">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-lg border bg-transparent p-1">
            <TabsTrigger value="schools" className="gap-1.5 rounded-md">
              <Building2 className="size-3.5" /> مدارس
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 rounded-md">
              <Users className="size-3.5" /> کاربران
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5 rounded-md">
              <ClipboardList className="size-3.5" /> رویدادها
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 rounded-md">
              <Bell className="size-3.5" /> اعلان‌ها
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 rounded-md">
              <History className="size-3.5" /> حسابرسی
            </TabsTrigger>
          </TabsList>

          {/* ---- Schools ---- */}
          <TabsContent value="schools" className="mt-5">
            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
              <div className="grow space-y-1.5">
                <Label htmlFor="new-school-name">نام مدرسه جدید</Label>
                <Input
                  id="new-school-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثلاً دبیرستان شهید بهشتی"
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label htmlFor="new-school-city">شهر</Label>
                <Input
                  id="new-school-city"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="تهران"
                />
              </div>
              <Button onClick={handleCreateSchool} disabled={creating || !newName.trim()} className="gap-1.5">
                <Plus className="size-4" />
                {creating ? "…" : "ایجاد مدرسه"}
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border">
              <Table dir="rtl">
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead>مدرسه</TableHead>
                    <TableHead>شهر</TableHead>
                    <TableHead>مدیران</TableHead>
                    <TableHead>دانش‌آموز</TableHead>
                    <TableHead>سرویس</TableHead>
                    <TableHead>رویداد امروز</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="text-left">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!overview && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        …
                      </TableCell>
                    </TableRow>
                  )}
                  {overview?.schools.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        هنوز مدرسه‌ای ثبت نشده است.
                      </TableCell>
                    </TableRow>
                  )}
                  {overview?.schools.map((s) => (
                    <TableRow key={s._id} className={!s.isActive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.city ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(s.adminCount)}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(s.counts.students)}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(s.counts.services)}</TableCell>
                      <TableCell className="tabular-nums">{formatNumber(s.todayEvents)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={s.isActive}
                          onCheckedChange={(v) => handleToggleSchool(s._id, v)}
                        />
                      </TableCell>
                      <TableCell className="text-left">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditTarget({ id: s._id, name: s.name, city: s.city ?? "", phone: s.phone ?? "" })
                          }
                        >
                          ویرایش
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ---- Users ---- */}
          <TabsContent value="users" className="mt-5">
            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه نقش‌ها</SelectItem>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                تغییر نقش و فعال/غیرفعال‌سازی بلافاصله اعمال و در حسابرسی ثبت می‌شود.
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border">
              <Table dir="rtl">
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead>کاربر</TableHead>
                    <TableHead>مدرسه</TableHead>
                    <TableHead>نقش</TableHead>
                    <TableHead>فعال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.results.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.name ?? "بدون نام"}</div>
                        {u.email && (
                          <div dir="ltr" className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.schoolName ?? "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role ?? "user"}
                          onValueChange={async (role) => {
                            try {
                              await setUserRole({ userId: u.id, role: role as Role });
                              toast.success("نقش تغییر یافت");
                            } catch (err) {
                              toast.error(
                                err instanceof Error && err.message.includes("CANNOT_CHANGE_SELF")
                                  ? "تغییر نقش خودتان مجاز نیست"
                                  : "تغییر نقش ناموفق بود",
                              );
                            }
                          }}
                        >
                          <SelectTrigger size="sm" className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={async (v) => {
                            try {
                              await setUserActive({ userId: u.id, isActive: v });
                              toast.success(v ? "کاربر فعال شد" : "کاربر غیرفعال شد");
                            } catch (err) {
                              toast.error(
                                err instanceof Error && err.message.includes("CANNOT_CHANGE_SELF")
                                  ? "تغییر وضعیت خودتان مجاز نیست"
                                  : "تغییر وضعیت ناموفق بود",
                              );
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!users.results.length && !users.isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                        کاربری یافت نشد.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <LogPager status={users.status} loadMore={users.loadMore} />
          </TabsContent>

          {/* ---- Events ---- */}
          <TabsContent value="events" className="mt-5">
            <div className="overflow-hidden rounded-lg border">
              <Table dir="rtl">
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead>رویداد</TableHead>
                    <TableHead>دانش‌آموز</TableHead>
                    <TableHead>مدرسه</TableHead>
                    <TableHead>منبع</TableHead>
                    <TableHead>ثبت‌کننده</TableHead>
                    <TableHead>زمان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.results.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full font-normal ${
                            e.eventType === "ABSENT" ? "text-destructive" : ""
                          }`}
                        >
                          {EVENT_LABELS[e.eventType] ?? e.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{e.studentName}</TableCell>
                      <TableCell className="text-muted-foreground">{e.schoolName ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.source === "driver" ? "راننده" : e.source === "manual" ? "دستی" : "نمونه"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.actorName}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDateTime(e.serverTimestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!events.results.length && !events.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        رویدادی ثبت نشده است.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <LogPager status={events.status} loadMore={events.loadMore} />
          </TabsContent>

          {/* ---- Notifications ---- */}
          <TabsContent value="notifications" className="mt-5">
            <div className="overflow-hidden rounded-lg border">
              <Table dir="rtl">
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead>پیام</TableHead>
                    <TableHead>مدرسه</TableHead>
                    <TableHead>والد</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>زمان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifs.results.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="max-w-xs">{n.body}</TableCell>
                      <TableCell className="text-muted-foreground">{n.schoolName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{n.parentName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full font-normal ${
                            n.status === "FAILED" ? "text-destructive" : n.status === "QUEUED" ? "text-muted-foreground" : ""
                          }`}
                        >
                          {STATUS_LABELS[n.status] ?? n.status}
                        </Badge>
                        {n.attempts > 1 && (
                          <span className="mr-2 text-xs text-muted-foreground">({n.attempts} تلاش)</span>
                        )}
                        {n.lastError && n.status === "FAILED" && (
                          <div dir="ltr" className="mt-1 max-w-48 truncate text-xs text-destructive">
                            {n.lastError}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDateTime(n.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!notifs.results.length && !notifs.isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        اعلانی ثبت نشده است.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <LogPager status={notifs.status} loadMore={notifs.loadMore} />
          </TabsContent>

          {/* ---- Audit ---- */}
          <TabsContent value="audit" className="mt-5">
            <div className="overflow-hidden rounded-lg border">
              <Table dir="rtl">
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead>عملیات</TableHead>
                    <TableHead>توضیح</TableHead>
                    <TableHead>مدرسه</TableHead>
                    <TableHead>انجام‌دهنده</TableHead>
                    <TableHead>زمان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.results.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <code dir="ltr" className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                          {log.action}
                        </code>
                      </TableCell>
                      <TableCell>{log.summary}</TableCell>
                      <TableCell className="text-muted-foreground">{log.schoolName ?? "پلتفرم"}</TableCell>
                      <TableCell className="text-muted-foreground">{log.actorName}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!audit.results.length && !audit.isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        لاگی ثبت نشده است.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <LogPager status={audit.status} loadMore={audit.loadMore} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit school dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش مدرسه</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">نام</Label>
                <Input
                  id="edit-name"
                  value={editTarget.name}
                  onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-city">شهر</Label>
                <Input
                  id="edit-city"
                  value={editTarget.city}
                  onChange={(e) => setEditTarget({ ...editTarget, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">تلفن</Label>
                <Input
                  id="edit-phone"
                  value={editTarget.phone}
                  onChange={(e) => setEditTarget({ ...editTarget, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              انصراف
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit || !editTarget?.name.trim()}>
              {savingEdit ? "…" : "ذخیره"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
