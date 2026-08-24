import { CrudSection, type CrudColumn } from "@/components/dashboard/crud-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";

type Row = Doc<"drivers">;

const columns: CrudColumn<Row>[] = [
  {
    key: "name",
    label: "نام راننده",
    render: (d) => <span className="font-medium">{d.fullName}</span>,
  },
  { key: "phone", label: "تلفن", render: (d) => <span dir="ltr" className="tabular-nums">{d.phone ?? "—"}</span> },
  { key: "license", label: "شماره گواهینامه", render: (d) => <span dir="ltr">{d.licenseNumber ?? "—"}</span> },
  {
    key: "status",
    label: "وضعیت",
    render: (d) =>
      d.isActive ? (
        <Badge variant="outline" className="rounded-full font-normal">فعال</Badge>
      ) : (
        <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">غیرفعال</Badge>
      ),
  },
];

export default function Drivers() {
  const rows = useQuery(api.drivers.list);
  const create = useMutation(api.drivers.create);

  return (
    <div>
      <PageHeader
        title="رانندگان"
        description="رانندگان سرویس مدرسه و اطلاعات تماس آن‌ها."
      />
      <CrudSection<Row>
        rows={rows}
        columns={columns}
        rowKey={(r) => r._id}
        addLabel="افزودن راننده"
        emptyMessage="هنوز راننده‌ای ثبت نشده است."
        fields={[
          { name: "fullName", label: "نام و نام خانوادگی", required: true },
          { name: "phone", label: "تلفن همراه", type: "tel", placeholder: "09121234567" },
          { name: "licenseNumber", label: "شماره گواهینامه" },
        ]}
        onCreate={async (v) => {
          await create({
            fullName: v.fullName,
            phone: v.phone || undefined,
            licenseNumber: v.licenseNumber || undefined,
          });
        }}
      />
    </div>
  );
}
