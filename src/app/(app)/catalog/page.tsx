import { Search } from "lucide-react";
import { queryDatabase } from "@/lib/database";
import {
  getAllCategories,
  getAllOwners,
  getAllStatuses,
  searchLegoSets,
} from "@/lib/queries";
import { LegoSetResults } from "@/components/lego-set-results";
import { RefreshLegoCatalogButton } from "@/components/refresh-lego-catalog-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";

// Shortcut links under the search box
const QUICK_SEARCHES = ["SPIKE", "EV3", "Mindstorms", "WeDo", "Education"];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const searchText = (await searchParams).q ?? "";

  // Database calls started together
  const [setCountRows, legoSets, categories, owners, statuses] =
    await Promise.all([
      queryDatabase<{ set_count: number }>(
        "SELECT count(*)::int AS set_count FROM lego_sets",
      ),
      searchText ? searchLegoSets(searchText, 0) : [],
      getAllCategories(),
      getAllOwners(),
      getAllStatuses(),
    ]);
  const setCount = setCountRows[0].set_count;

  return (
    <>
      <PageHeader
        title="LEGO catalog"
        description={
          setCount === 0
            ? "Search official LEGO sets."
            : `Search ${setCount.toLocaleString()} official LEGO sets.`
        }
        action={setCount === 0 ? undefined : <RefreshLegoCatalogButton />}
      />
      {setCount === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          The LEGO catalog is still loading for the first time. Reload this page
          in a moment.
        </div>
      ) : (
        <>
          <form
            className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]"
            role="search"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                defaultValue={searchText}
                placeholder="Set name, number, or theme (e.g. 45678)"
                className="pl-9"
                aria-label="Search catalog"
              />
            </div>
            <Button variant="secondary">Search</Button>
          </form>
          <div className="mb-6 flex flex-wrap gap-2">
            {QUICK_SEARCHES.map((quickSearch) => (
              <a
                key={quickSearch}
                href={`/catalog?q=${quickSearch}`}
                className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {quickSearch}
              </a>
            ))}
          </div>
          {searchText && legoSets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No sets match “{searchText}”.
            </p>
          )}
          <LegoSetResults
            key={searchText}
            firstLegoSets={legoSets}
            totalCount={legoSets[0]?.total_count ?? 0}
            searchText={searchText}
            categories={categories}
            owners={owners}
            statuses={statuses}
          />
        </>
      )}
    </>
  );
}
