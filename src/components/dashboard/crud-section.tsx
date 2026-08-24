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
import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

export type CrudField = {
  name: string;
  label: string;
  type?: "text" | "number" | "tel";
  required?: boolean;
  placeholder?: string;
};

export type CrudColumn<Row> = {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
};

type Props<Row> = {
  rows: Row[] | undefined;
  columns: CrudColumn<Row>[];
  fields: CrudField[];
  addLabel: string;
  emptyMessage: string;
  onCreate: (values: Record<string, string>) => Promise<unknown>;
  rowKey: (row: Row) => string;
};

/** Generic list + add form used by the simple management pages. */
export function CrudSection<Row>({
  rows,
  columns,
  fields,
  addLabel,
  emptyMessage,
  onCreate,
  rowKey,
}: Props<Row>) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onCreate(values);
      setValues({});
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت اطلاعات");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex justify-start">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="size-4" />
              {addLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>{addLabel}</DialogTitle>
              <DialogDescription>اطلاعات جدید را وارد کنید.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {fields.map((f) => (
                <div key={f.name} className="grid gap-2">
                  <Label htmlFor={`crud-${f.name}`}>{f.label}</Label>
                  <Input
                    id={`crud-${f.name}`}
                    type={f.type ?? "text"}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={submit} disabled={busy || !fields.every((f) => !f.required || (values[f.name] ?? "").trim())}>
                {busy ? "در حال ثبت…" : "ثبت"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                انصراف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  …
                </TableCell>
              </TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows?.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((c) => (
                  <TableCell key={c.key}>{c.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
