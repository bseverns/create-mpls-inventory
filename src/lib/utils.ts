import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins CSS class names together
export function cn(...classNames: ClassValue[]) {
  return twMerge(clsx(classNames));
}

export const STATUS_COLORS: Record<string, string> = {
  green: "bg-green-600",
  teal: "bg-teal-600",
  blue: "bg-blue-600",
  purple: "bg-purple-600",
  pink: "bg-pink-600",
  red: "bg-red-600",
  amber: "bg-amber-500",
  slate: "bg-slate-400",
};

// Turns a name into a web-address-friendly word
export function makeSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Turns the Details box into an object
export function parseDetails(text: string) {
  const details: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const colonPosition = line.indexOf(":");
    const label = line.slice(0, colonPosition).trim();
    const value = line.slice(colonPosition + 1).trim();
    if (colonPosition === -1 || label === "" || value === "") {
      return { details, badLine: line.trim() };
    }
    details[label] = value;
  }
  return { details, badLine: null };
}

// Fills the Details box
export function detailsToText(details: Record<string, string>) {
  return Object.entries(details)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

// Makes text safe for a database ILIKE search
export function makeLikePattern(searchText: string) {
  return `%${searchText.replace(/[\\%_]/g, "\\$&")}%`;
}
