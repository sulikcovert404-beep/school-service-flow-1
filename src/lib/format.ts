/** Persian formatting helpers for the dashboard UI. */

const faNum = new Intl.NumberFormat("fa-IR");

export function formatNumber(n: number): string {
  return faNum.format(n);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("fa-IR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const EVENT_LABELS: Record<string, string> = {
  PICKED_UP: "سوار شد",
  DROPPED_OFF: "پیاده شد",
  ABSENT: "غایب",
};

export const STATUS_LABELS: Record<string, string> = {
  waiting: "در انتظار",
  picked_up: "سوار شده",
  dropped_off: "رسید به مقصد",
  absent: "غایب",
};

export const SHIFT_LABELS: Record<string, string> = {
  morning: "شیفت صبح",
  return: "شیفت برگشت",
};
