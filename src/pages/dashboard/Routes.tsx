import { CrudSection, type CrudColumn } from "@/components/dashboard/crud-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";

type Row = Doc<"routes">;

const columns: CrudColumn<Row>[] = [
  { key: "name", label: "نام مسیر", render: (r) => <span className="font-medium">{r.name}</span> },
  { key: "stops", label: "ایستگاه‌ها", render: (r) => <span className="text-muted-foreground">{r.stopsNote ?? "—"}</span> },
  {
    key: "status",
    label: "وضعیت",
    render: (r) =>
      r.isActive ? (
        <Badge variant="outline" className="rounded-full font-normal">فعال</Badge>
      ) : (
        <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">غیرفعال</Badge>
      ),
  },
];

export default function Routes() {
  const rows = useQuery(api.routes.list);
  const create = useMutation(api.routes.create);

  return (
    <div>
      <PageHeader
        title="مسیرها"
        description="مسیرهای رفت‌وبرگشت سرویس مدرسه و ایستگاه‌های هر مسیر."
      />
      <CrudSection<Row>
        rows={rows}
        columns={columns}
        rowKey={(r) => r._id}
        addLabel="افزودن مسیر"
        emptyMessage="هنوز مسیری ثبت نشده است."
        fields={[
          { name: "name", label: "نام مسیر", required: true },
          { name: "stopsNote", label: "ایستگاه‌ها", placeholder: "مثلاً میدان کاج، بلوار دریا" },
        ]}
        onCreate={async (v) => {
          await create({
            name: v.name,
            stopsNote: v.stopsNote || undefined,
          });
        }}
      />
    </div>
  );
}
