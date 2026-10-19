import Link from "next/link";
import { queryDatabase } from "@/lib/database";
import { CategoryOwnerOrStatusRowMenu } from "@/components/category-owner-or-status-row-menu";
import { PageHeader } from "@/components/page-header";
import { STATUS_COLORS, cn } from "@/lib/utils";

// One row of the list
// The link opens the Inventory page filtered to that row
type ManageRow = {
  id: number;
  name: string;
  // Categories only
  description: string | null;
  // Statuses only
  color: string | null;
  link: string;
  // Unassigned and Uncategorized are built in
  is_built_in: boolean;
  item_count: number;
  unit_count: number;
};

// The three lists with one for each tab
const TABS = {
  categories: {
    kind: "category" as const,
    sql: `SELECT c.id, c.name, c.description, NULL AS color,
                 '/inventory?category=' || c.slug AS link,
                 c.slug = 'uncategorized' AS is_built_in,
                 count(i.id)::int AS item_count,
                 coalesce(sum(i.quantity), 0)::int AS unit_count
          FROM categories c LEFT JOIN items i ON i.category_id = c.id
          GROUP BY c.id
          ORDER BY is_built_in, lower(c.name)`,
  },
  owners: {
    kind: "owner" as const,
    sql: `SELECT o.id, o.name, NULL AS description, NULL AS color,
                 '/inventory?owner=' || o.id AS link,
                 lower(o.name) = 'unassigned' AS is_built_in,
                 count(i.id)::int AS item_count,
                 coalesce(sum(i.quantity), 0)::int AS unit_count
          FROM owners o LEFT JOIN items i ON i.owner_id = o.id
          GROUP BY o.id
          ORDER BY is_built_in, lower(o.name)`,
  },
  statuses: {
    kind: "status" as const,
    sql: `SELECT s.id, s.name, NULL AS description, s.color,
                 '/inventory?status=' || s.slug AS link,
                 false AS is_built_in,
                 count(i.id)::int AS item_count,
                 coalesce(sum(i.quantity), 0)::int AS unit_count
          FROM statuses s LEFT JOIN items i ON i.status_id = s.id
          GROUP BY s.id
          ORDER BY s.id`,
  },
};

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  let currentTab: keyof typeof TABS = "categories";
  if (tab === "owners" || tab === "statuses") currentTab = tab;

  const { kind, sql } = TABS[currentTab];
  const rows = await queryDatabase<ManageRow>(sql);

  return (
    <>
      <PageHeader
        title="Manage"
        description="Create, rename and delete the categories, owners and statuses that items use."
      />
      <nav
        aria-label="Manage"
        className="mb-5 inline-flex rounded-lg bg-secondary p-1"
      >
        {Object.keys(TABS).map((tabName) => (
          <Link
            key={tabName}
            href={`/manage?tab=${tabName}`}
            aria-current={tabName === currentTab ? "page" : undefined}
            className={cn(
              "flex h-9 items-center rounded-md px-4 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tabName === currentTab
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tabName}
          </Link>
        ))}
      </nav>

      <ul className="grid gap-2">
        {rows.map((row) => {
          const itemWord = row.item_count === 1 ? "item" : "items";
          let summary = "No items yet";
          if (row.item_count > 0) {
            summary = `${row.item_count} ${itemWord} · ${row.unit_count} units`;
          }
          if (row.description) summary += ` · ${row.description}`;

          const rowContent = (
            <>
              <span className="flex items-center gap-2">
                {row.color && (
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${STATUS_COLORS[row.color]}`}
                    aria-hidden
                  />
                )}
                <span className="truncate font-semibold">{row.name}</span>
                {row.is_built_in && (
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    Default
                  </span>
                )}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {summary}
              </span>
            </>
          );

          return (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-lg border bg-card pr-2"
            >
              {row.item_count > 0 ? (
                <Link
                  href={row.link}
                  prefetch={false}
                  className="min-w-0 flex-1 rounded-lg p-4 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View ${row.item_count} ${itemWord} in ${row.name}`}
                >
                  {rowContent}
                </Link>
              ) : (
                <div className="min-w-0 flex-1 p-4">{rowContent}</div>
              )}
              {!row.is_built_in && (
                <CategoryOwnerOrStatusRowMenu
                  kind={kind}
                  entry={{
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    color: row.color,
                  }}
                  itemCount={row.item_count}
                />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
