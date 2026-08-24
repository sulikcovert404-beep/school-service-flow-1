import { CrudSection, type CrudColumn } from "@/components/dashboard/crud-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";

type Row = Doc<"students">;

const columns: CrudColumn<Row>[] = [
  {
    key: "name",
    label: "نام و نام خانوادگی",
    render: (s) => `${s.firstName} ${s.lastName}`,
  },
  { key: "grade", label: "پایه", render: (s) => `پایه ${s.grade}` },
  {
    key: "className",
    label: "کلاس",
    render: (s) => s.className ?? "—",
  },
  {
    key: "status",
    label: "وضعیت",
    render: (s) =>
      s.isActive ? (
        <Badge variant="outline" className="rounded-full font-normal">فعال</Badge>
      ) : (
        <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">غیرفعال</Badge>
      ),
  },
];

export default function Students() {
  const rows = useQuery(api.students.list);
  const create = useMutation(api.students.create);

  return (
    <div>
      <PageHeader
        title="دانش‌آموزان"
        description="فهرست دانش‌آموزان مدرسه. دانش‌آموزان از بخش سرویس‌ها به سرویس‌ها تخصیص داده می‌شوند."
      />
      <CrudSection<Row>
        rows={rows}
        columns={columns}
        rowKey={(r) => r._id}
        addLabel="افزودن دانش‌آموز"
        emptyMessage="هنوز دانش‌آموزی ثبت نشده است."
        fields={[
          { name: "firstName", label: "نام", required: true },
          { name: "lastName", label: "نام خانوادگی", required: true },
          { name: "grade", label: "پایه", required: true, placeholder: "مثلاً ۳" },
          { name: "className", label: "کلاس", placeholder: "مثلاً ۲" },
        ]}
        onCreate={async (v) => {
          await create({
            firstName: v.firstName,
            lastName: v.lastName,
            grade: v.grade,
            className: v.className || undefined,
          });
        }}
      />
    </div>
  );
}
