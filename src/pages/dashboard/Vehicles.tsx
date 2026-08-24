import { CrudSection, type CrudColumn } from "@/components/dashboard/crud-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { formatNumber } from "@/lib/format";

type Row = Doc<"vehicles">;

const columns: CrudColumn<Row>[] = [
  { key: "plate", label: "پلاک خودرو", render: (v) => <span className="font-medium">{v.plateNumber}</span> },
  { key: "model", label: "مدل", render: (v) => v.model ?? "—" },
  { key: "capacity", label: "ظرفیت", render: (v) => `${formatNumber(v.capacity)} نفر` },
  {
    key: "status",
    label: "وضعیت",
    render: (v) =>
      v.isActive ? (
        <Badge variant="outline" className="rounded-full font-normal">فعال</Badge>
      ) : (
        <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">غیرفعال</Badge>
      ),
  },
];

export default function Vehicles() {
  const rows = useQuery(api.vehicles.list);
  const create = useMutation(api.vehicles.create);

  return (
    <div>
      <PageHeader
        title="خودروها"
        description="ناوگان حمل‌ونقل مدرسه به همراه ظرفیت هر خودرو."
      />
      <CrudSection<Row>
        rows={rows}
        columns={columns}
        rowKey={(r) => r._id}
        addLabel="افزودن خودرو"
        emptyMessage="هنوز خودرویی ثبت نشده است."
        fields={[
          { name: "plateNumber", label: "پلاک", required: true, placeholder: "مثلاً 12ب345 ایران 22" },
          { name: "model", label: "مدل", placeholder: "مثلاً ایسوزو NPR" },
          { name: "capacity", label: "ظرفیت (نفر)", type: "number", required: true },
        ]}
        onCreate={async (v) => {
          await create({
            plateNumber: v.plateNumber,
            model: v.model || undefined,
            capacity: Number(v.capacity),
          });
        }}
      />
    </div>
  );
}
