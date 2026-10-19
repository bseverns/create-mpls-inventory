import Link from "next/link";
import { queryDatabase } from "@/lib/database";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_COLORS } from "@/lib/utils";

// The Overview page
export default async function OverviewPage() {
  const [totalRows, statusRows, categories] = await Promise.all([
    queryDatabase<{
      item_count: number;
      unit_count: number;
      owner_count: number;
    }>(
      `SELECT count(*)::int AS item_count,
              coalesce(sum(quantity), 0)::int AS unit_count,
              count(DISTINCT owner_id)::int AS owner_count
       FROM items`,
    ),
    // How many units have each status
    // Units with no status come back as one row with no name.
    queryDatabase<{
      name: string | null;
      slug: string | null;
      color: string | null;
      unit_count: number;
    }>(
      `SELECT s.name, s.slug, s.color, sum(i.quantity)::int AS unit_count
       FROM items i
       LEFT JOIN statuses s ON s.id = i.status_id
       GROUP BY s.id
       ORDER BY s.id`,
    ),
    queryDatabase<{
      name: string;
      slug: string;
      description: string;
      item_count: number;
      unit_count: number;
    }>(
      `SELECT c.name, c.slug, c.description,
              count(i.id)::int AS item_count,
              coalesce(sum(i.quantity), 0)::int AS unit_count
       FROM categories c
       LEFT JOIN items i ON i.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`,
    ),
  ]);
  const totals = totalRows[0];

  const totalCards = [
    { label: "Unique items", value: totals.item_count },
    { label: "Total units", value: totals.unit_count },
    { label: "Owners", value: totals.owner_count },
  ];

  return (
    <>
      <dl className="mb-8 grid grid-cols-3 gap-3">
        {totalCards.map((totalCard) => (
          <Card key={totalCard.label}>
            <CardContent>
              <dd className="text-3xl font-semibold tabular-nums md:text-4xl">
                {totalCard.value}
              </dd>
              <dt className="mt-1 text-xs text-muted-foreground md:text-sm">
                {totalCard.label}
              </dt>
            </CardContent>
          </Card>
        ))}
      </dl>

      <Card className="mb-8">
        <CardContent>
          <h2 className="mb-3 text-lg font-semibold">Status</h2>
          {statusRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <>
              <div
                className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted"
                aria-hidden
              >
                {statusRows.map((row) => (
                  <div
                    key={row.slug ?? "none"}
                    className={
                      row.color ? STATUS_COLORS[row.color] : "bg-border"
                    }
                    style={{
                      width: `${(row.unit_count / totals.unit_count) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <ul className="grid gap-1">
                {statusRows.map((row) => (
                  <li key={row.slug ?? "none"}>
                    <Link
                      href={`/inventory?status=${row.slug ?? "none"}`}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`size-2.5 rounded-full ${row.color ? STATUS_COLORS[row.color] : "bg-border"}`}
                          aria-hidden
                        />
                        {row.name ?? "No status"}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {row.unit_count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Categories</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/inventory?category=${category.slug}`}
            prefetch={false}
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent>
                <p className="font-semibold">{category.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {category.description}
                </p>
                <p className="mt-4 text-sm">
                  <span className="font-semibold tabular-nums">
                    {category.item_count}
                  </span>{" "}
                  items ·{" "}
                  <span className="tabular-nums">{category.unit_count}</span>{" "}
                  units
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
