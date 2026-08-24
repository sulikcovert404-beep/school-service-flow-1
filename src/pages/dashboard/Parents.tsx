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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Plus, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Parents() {
  const rows = useQuery(api.parents.listWithChildren);
  const students = useQuery(api.students.list);
  const create = useMutation(api.parents.create);
  const linkChild = useMutation(api.parents.linkChild);
  const unlinkChild = useMutation(api.parents.unlinkChild);

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await create({ fullName, phone: phone || undefined });
      setFullName("");
      setPhone("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت والد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="والدین"
        description="اطلاعات خانواده‌ها و فرزندان متصل به هر حساب."
      />

      <div className="flex justify-start">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="size-4" />
              افزودن والد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>افزودن والد</DialogTitle>
              <DialogDescription>اطلاعات والد را وارد کنید.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="p-name">نام و نام خانوادگی</Label>
                <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-phone">تلفن همراه</Label>
                <Input id="p-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={submit} disabled={busy || !fullName.trim()}>
                {busy ? "در حال ثبت…" : "ثبت"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead>نام والد</TableHead>
              <TableHead>تلفن</TableHead>
              <TableHead>فرزندان</TableHead>
              <TableHead className="w-24"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  هنوز والدی ثبت نشده است.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-medium">{p.fullName}</TableCell>
                <TableCell dir="ltr" className="tabular-nums">{p.phone ?? "—"}</TableCell>
                <TableCell>
                  {p.children.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {p.children.map((c) => (
                        <Badge key={c.id} variant="outline" className="rounded-full font-normal">
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {students && (
                    <ChildrenDialog
                      parentName={p.fullName}
                      childIds={new Set(p.children.map((c) => c.id))}
                      students={(students ?? [])
                        .filter((s) => s.isActive)
                        .map((s) => ({ id: s._id, name: `${s.firstName} ${s.lastName}` }))}
                      onLink={(studentId) => linkChild({ parentId: p._id, studentId })}
                      onUnlink={(studentId) => unlinkChild({ parentId: p._id, studentId })}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ChildrenDialog({
  parentName,
  childIds,
  students,
  onLink,
  onUnlink,
}: {
  parentName: string;
  childIds: Set<string>;
  students: { id: string; name: string }[];
  onLink: (studentId: any) => Promise<unknown>;
  onUnlink: (studentId: any) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);

  const toggle = async (studentId: string, linked: boolean) => {
    try {
      if (linked) await onUnlink(studentId);
      else await onLink(studentId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
          <UserRound className="size-3.5" />
          مدیریت فرزندان
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>فرزندان {parentName}</DialogTitle>
          <DialogDescription>برای اتصال یا حذف اتصال، روی نام کلیک کنید.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {students.map((s) => {
            const linked = childIds.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggle(s.id, linked)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60 ${
                    linked ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="text-xs">{linked ? "متصل ✓" : "اتصال +"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
