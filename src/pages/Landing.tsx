import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Bus, ClipboardList, ShieldCheck, Users, Route as RouteIcon, FileBarChart } from "lucide-react";
import { Link } from "react-router";

const features = [
  {
    icon: ClipboardList,
    title: "ثبت لحظه‌ای رفت‌وبرگشت",
    body: "وضعیت هر دانش‌آموز — سوار شد، پیاده شد، غایب — به‌صورت رویدادهای ثبت‌شونده و بدون بازنویسی تاریخچه.",
  },
  {
    icon: Users,
    title: "مدیریت دانش‌آموزان و والدین",
    body: "پرونده دانش‌آموز، اتصال چند فرزند به یک خانواده و تخصیص دقیق به سرویس‌ها.",
  },
  {
    icon: Bus,
    title: "سرویس، مسیر، خودرو و راننده",
    body: "ترکیب شفاف منابع حمل‌ونقل مدرسه در قالب سرویس‌های صبح و برگشت.",
  },
  {
    icon: ShieldCheck,
    title: "امنیت و مرزبندی داده",
    body: "دسترسی فقط برای مدیر مدرسه؛ هر داده از نشست کاربر اعتبارسنجی می‌شود، نه از سمت کلاینت.",
  },
  {
    icon: FileBarChart,
    title: "گزارش و ردیابی",
    body: "تاریخچه کامل رویدادهای رفت‌وبرگشت با فیلتر و صفحه‌بندی، به‌همراه لاگ حسابرسی عملیات.",
  },
  {
    icon: RouteIcon,
    title: "مانیتورینگ زنده امروز",
    body: "آمار زنده سوار شده، در انتظار و رسیده به مقصد — بدون نیاز به نوسازی دستی.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="لوگو" className="size-8" />
          <span className="text-sm font-medium tracking-tight">سامانه سرویس مدارس</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/auth">ورود مدیر مدرسه</Link>
        </Button>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-start gap-10 border-b pb-20 pt-16 sm:flex-row-reverse sm:items-end sm:justify-between sm:gap-16 sm:pt-28">
          <div className="flex w-full flex-col items-start gap-6 sm:max-w-xl">
            <Badge variant="outline" className="rounded-full font-normal text-muted-foreground">
              نسخه اول — داشبورد مدرسه
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.25] tracking-tight sm:text-5xl sm:leading-[1.2]">
              مدیریت آرام و مطمئن
              <br />
              سرویس رفت‌وبرگشت مدارس
            </h1>
            <p className="max-w-md text-base leading-8 text-muted-foreground">
              یک داشبورد مینیمال برای ثبت وضعیت سوار و پیاده شدن دانش‌آموزان،
              مدیریت سرویس‌ها و مشاهده گزارش‌ها — همه‌چیز در یک جای خلوت و منظم.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/auth" className="gap-2">
                  شروع کنید
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="hidden w-full max-w-xs shrink-0 sm:block">
            <div className="rounded-lg border bg-card p-5 shadow-none">
              <p className="text-xs text-muted-foreground">امروز</p>
              <Separator className="my-4" />
              <ul className="space-y-4 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">دانش‌آموزان</span>
                  <span className="font-medium">۲۴ نفر</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">سوار شده</span>
                  <span className="font-medium">۱۹ نفر</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">در انتظار</span>
                  <span className="font-medium">۳ نفر</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">غایب</span>
                  <span className="font-medium">۲ نفر</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-b py-20">
          <h2 className="text-2xl font-semibold tracking-tight">همه‌چیز برای یک روزِ بی‌دردسر</h2>
          <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
            نسخه اول دقیقاً همان چیزی است که یک مدرسه لازم دارد — نه بیشتر، نه کمتر.
          </p>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3">
                <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} />
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            مدرسه خود را راه‌اندازی کنید
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            با اولین ورود، فضای اختصاصی مدرسه شما همراه با داده نمونه ساخته می‌شود.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/auth" className="gap-2">
              ورود به داشبورد
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-4 border-t py-8 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} سامانه مدیریت سرویس مدارس</span>
          <span>نسخه ۱ — داشبورد مدرسه</span>
        </footer>
      </div>
    </main>
  );
}
