import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { queryDatabase } from "@/lib/database";
import { getAllOwners, getAllStatuses } from "@/lib/queries";
import { buttonStyles } from "@/components/ui/button";
import { FilterAndSortDialog } from "@/components/filter-and-sort-dialog";
import { ItemCard } from "@/components/item-card";
import { PageHeader } from "@/components/page-header";
import { makeLikePattern } from "@/lib/utils";
import type { Category, Item } from "@/lib/types";

// The filters are kept in the web address
type SearchParameters = {
  q?: string;
  category?: string;
  owner?: string;
  status?: string;
  sort?: string;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const filters = await searchParams;

  // The three ways to sort
  let orderBy = "i.created_at DESC";
  if (filters.sort === "name") orderBy = "lower(i.name), i.id";
  if (filters.sort === "qty") orderBy = "i.quantity DESC, lower(i.name)";

  const [categories, owners, statuses, ownersWithItems, items] =
    await Promise.all([
      queryDatabase<Category & { item_count: number }>(
        `SELECT c.id, c.name, c.slug, count(i.id)::int AS item_count
       FROM categories c
       LEFT JOIN items i ON i.category_id = c.id
       GROUP BY c.id
       ORDER BY (c.slug = 'uncategorized'), lower(c.name)`,
      ),
      getAllOwners(),
      getAllStatuses(),
      queryDatabase<{ id: number; name: string }>(
        `SELECT id, name FROM owners
       WHERE EXISTS (SELECT 1 FROM items WHERE items.owner_id = owners.id)
       ORDER BY lower(name)`,
      ),
      // Blank filter matches everything
      queryDatabase<Item>(
        `SELECT i.id, i.name, i.quantity, i.notes, i.image_url, i.metadata, i.status_id,
              coalesce(i.image_url, CASE WHEN i.image_data IS NOT NULL THEN '/api/photo/' || i.id END) AS image_source,
              s.name AS status_name, s.color AS status_color,
              c.name AS category, c.id AS category_id,
              o.name AS owner, o.id AS owner_id
       FROM items i
       JOIN categories c ON c.id = i.category_id
       JOIN owners o ON o.id = i.owner_id
       LEFT JOIN statuses s ON s.id = i.status_id
       WHERE ($1 = '' OR c.slug = $1)
         AND ($2 = 0 OR o.id = $2)
         AND ($3 = '' OR s.slug = $3 OR ($3 = 'none' AND i.status_id IS NULL))
         AND ($4 = '' OR i.name ILIKE $4 OR i.metadata::text ILIKE $4)
       ORDER BY ${orderBy}`,
        [
          filters.category ?? "",
          Number(filters.owner) || 0,
          filters.status ?? "",
          filters.q ? makeLikePattern(filters.q) : "",
        ],
      ),
    ]);

  const filtersAreOn = Boolean(
    filters.q || filters.category || filters.owner || filters.status,
  );
  const categoryName = categories.find(
    (category) => category.slug === filters.category,
  )?.name;

  return (
    <>
      <PageHeader
        title={categoryName ?? "Inventory"}
        description={`${items.length} ${items.length === 1 ? "item" : "items"}${filtersAreOn ? " match your filters" : ""}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FilterAndSortDialog
          currentFilters={{
            search: filters.q ?? "",
            category: filters.category ?? "",
            owner: filters.owner ?? "",
            status: filters.status ?? "",
            sort:
              filters.sort === "name" || filters.sort === "qty"
                ? filters.sort
                : "new",
          }}
          // The Uncategorized category is left out of the filter list while it is empty
          categories={categories.filter(
            (category) =>
              category.item_count > 0 || category.slug !== "uncategorized",
          )}
          owners={ownersWithItems}
          statuses={statuses}
        />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed py-16 text-center">
          <PackageOpen
            className="mb-3 size-10 text-muted-foreground"
            aria-hidden
          />
          <p className="font-semibold">
            {filtersAreOn ? "Nothing matches those filters" : "No items yet"}
          </p>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            {!filtersAreOn &&
              "Use Add at the top right to create an item, or pull a set from the LEGO catalog."}
          </p>
          {filtersAreOn ? (
            <Link href="/inventory" className={buttonStyles("outline")}>
              Clear filters
            </Link>
          ) : (
            <Link href="/catalog" className={buttonStyles()}>
              Browse LEGO catalog
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              categories={categories}
              owners={owners}
              statuses={statuses}
            />
          ))}
        </div>
      )}
    </>
  );
}
