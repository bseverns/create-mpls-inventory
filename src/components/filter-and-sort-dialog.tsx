"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type Filters = {
  search: string;
  // A category slug
  category: string;
  // An owner id
  owner: string;
  // A status slug, or none
  status: string;
  // New, Name or Quantity
  sort: string;
};

const NO_FILTERS = { search: "", category: "", owner: "", status: "" };

// The Filter & sort button and its pop-up on the Inventory page
export function FilterAndSortDialog({
  currentFilters,
  categories,
  owners,
  statuses,
}: {
  currentFilters: Filters;
  categories: { slug: string; name: string }[];
  owners: { id: number; name: string }[];
  statuses: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const [filters, setFilters] = useState(currentFilters);

  // The number on the button
  const activeFilterCount = [
    currentFilters.search,
    currentFilters.category,
    currentFilters.owner,
    currentFilters.status,
  ].filter(Boolean).length;

  function changeFilter(filterName: keyof Filters, value: string) {
    setFilters({ ...filters, [filterName]: value });
  }

  // Runs when Apply is pressed, or Enter is pressed in the search box
  // Saves the filters in the web address
  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addressParameters = new URLSearchParams();
    if (filters.search.trim())
      addressParameters.set("q", filters.search.trim());
    if (filters.category) addressParameters.set("category", filters.category);
    if (filters.owner) addressParameters.set("owner", filters.owner);
    if (filters.status) addressParameters.set("status", filters.status);
    if (filters.sort !== "new") addressParameters.set("sort", filters.sort);

    const parameterText = addressParameters.toString();
    router.replace(
      parameterText ? `/inventory?${parameterText}` : "/inventory",
      {
        scroll: false,
      },
    );
    setIsOpen(false);
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nowOpen) => {
        if (nowOpen) setFilters(currentFilters);
        setIsOpen(nowOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal />
          Filter & sort
          {activeFilterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Filter & sort</DialogTitle>
        <form className="mt-4 grid gap-4" onSubmit={applyFilters}>
          <Field label="Item name or details">
            <Input
              type="search"
              value={filters.search}
              onChange={(event) => changeFilter("search", event.target.value)}
              placeholder="Search items"
            />
          </Field>
          <Field label="Category">
            <Select
              value={filters.category}
              onChange={(event) => changeFilter("category", event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner">
            <Select
              value={filters.owner}
              onChange={(event) => changeFilter("owner", event.target.value)}
            >
              <option value="">All owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={filters.status}
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="none">No status</option>
              {statuses.map((status) => (
                <option key={status.slug} value={status.slug}>
                  {status.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sort by">
            <Select
              value={filters.sort}
              onChange={(event) => changeFilter("sort", event.target.value)}
            >
              <option value="new">Newest first</option>
              <option value="name">Name, A to Z</option>
              <option value="qty">Quantity, high to low</option>
            </Select>
          </Field>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={
                !(
                  filters.search ||
                  filters.category ||
                  filters.owner ||
                  filters.status
                )
              }
              onClick={() => setFilters({ ...filters, ...NO_FILTERS })}
            >
              Clear filters
            </Button>
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
