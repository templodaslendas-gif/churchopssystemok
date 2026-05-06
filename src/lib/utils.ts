import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("pt-BR", opts ?? { dateStyle: "short", timeStyle: "short" });
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
}

export function daysUntil(iso: string): string {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (d < 0) return "Passado";
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  return `Em ${d} dias`;
}

export function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
