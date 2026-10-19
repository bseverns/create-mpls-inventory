import { queryDatabase } from "@/lib/database";
import { makeLikePattern } from "@/lib/utils";
import type { Category, LegoSet, Owner, Status } from "@/lib/types";

// The lists used by dropdowns
export function getAllCategories() {
  return queryDatabase<Category>(
    "SELECT id, name, slug FROM categories ORDER BY (slug = 'uncategorized'), lower(name)",
  );
}

export function getAllOwners() {
  return queryDatabase<Owner>(
    "SELECT id, name FROM owners ORDER BY (lower(name) = 'unassigned') DESC, lower(name)",
  );
}

export function getAllStatuses() {
  return queryDatabase<Status>(
    "SELECT id, name, slug, color FROM statuses ORDER BY id",
  );
}

// Finds LEGO sets by name, set number or theme, 48 at a time, newest first
export function searchLegoSets(searchText: string, offset: number) {
  return queryDatabase<LegoSet>(
    `SELECT *, (count(*) OVER ())::int AS total_count FROM lego_sets
     WHERE name ILIKE $1 OR set_num ILIKE $1 OR theme ILIKE $1
     ORDER BY year DESC NULLS LAST, name, set_num
     LIMIT 48 OFFSET $2`,
    [makeLikePattern(searchText), offset],
  );
}
