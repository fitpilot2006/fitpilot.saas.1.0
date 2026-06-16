import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(date: string): number {
  const d = new Date(date);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function membershipStatusColor(status: string): string {
  switch (status) {
    case "active": return "text-green-400";
    case "expired": return "text-red-400";
    case "suspended": return "text-yellow-400";
    default: return "text-slate-400";
  }
}

export function paymentStatusColor(status: string): string {
  switch (status) {
    case "paid": return "text-green-400";
    case "pending": return "text-yellow-400";
    case "overdue": return "text-red-400";
    default: return "text-slate-400";
  }
}
