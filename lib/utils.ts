import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function dateLabel(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(
    "en-US",
    options ?? { month: "short", day: "numeric" },
  );
}
export function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
