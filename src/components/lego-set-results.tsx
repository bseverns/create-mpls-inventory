"use client";
import { useState } from "react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, TwoFields } from "@/components/ui/input";
import { FormDialog } from "@/components/form-dialog";
import {
  CategoryField,
  OwnerField,
  StatusField,
} from "@/components/item-form-fields";
import { addCatalogSet, loadMoreLegoSets } from "@/lib/actions";
import type { Category, LegoSet, Owner, Status } from "@/lib/types";

// The grid of LEGO sets found by a search, the Show more button, and the one Add to inventory pop-up
export function LegoSetResults({
  firstLegoSets,
  totalCount,
  searchText,
  categories,
  owners,
  statuses,
}: {
  firstLegoSets: LegoSet[];
  totalCount: number;
  searchText: string;
  categories: Category[];
  owners: Owner[];
  statuses: Status[];
}) {
  const [legoSets, setLegoSets] = useState(firstLegoSets);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedSet, setSelectedSet] = useState<LegoSet | null>(null);

  async function showMore() {
    setIsLoadingMore(true);
    const nextLegoSets = await loadMoreLegoSets(searchText, legoSets.length);
    setLegoSets([...legoSets, ...nextLegoSets]);
    setIsLoadingMore(false);
  }

  const detailsLines: string[] = [];
  if (selectedSet) {
    detailsLines.push(`Set #: ${selectedSet.set_num}`);
    if (selectedSet.year) detailsLines.push(`Year: ${selectedSet.year}`);
    if (selectedSet.theme) detailsLines.push(`Theme: ${selectedSet.theme}`);
    if (selectedSet.num_parts)
      detailsLines.push(`Parts: ${selectedSet.num_parts}`);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {legoSets.map((legoSet) => {
          // Under the name show set number, year and parts, and skip any that are unknown
          const subtitleParts = [legoSet.set_num];
          if (legoSet.year) subtitleParts.push(String(legoSet.year));
          if (legoSet.num_parts) {
            subtitleParts.push(`${legoSet.num_parts.toLocaleString()} parts`);
          }

          return (
            <Card
              key={legoSet.set_num}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                {legoSet.img_url && (
                  <img
                    src={legoSet.img_url}
                    alt={legoSet.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain p-2"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                  {legoSet.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {subtitleParts.join(" · ")}
                </p>
                <Badge className="w-fit max-w-full truncate">
                  {legoSet.theme}
                </Badge>
                <div className="mt-auto pt-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedSet(legoSet)}
                  >
                    Add to inventory
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {legoSets.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {legoSets.length.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} sets
          </p>
          {legoSets.length < totalCount && (
            <Button
              variant="outline"
              onClick={showMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Loading…" : "Show more"}
            </Button>
          )}
        </div>
      )}

      <FormDialog
        title="Add to inventory"
        description={
          selectedSet && `${selectedSet.name} (${selectedSet.set_num})`
        }
        wide
        isOpen={selectedSet !== null}
        onOpenChange={() => setSelectedSet(null)}
        action={addCatalogSet}
        submitText="Add to inventory"
        pendingText="Adding…"
        successMessage={() => `Added “${selectedSet?.name}” to the inventory`}
      >
        <input type="hidden" name="set_num" value={selectedSet?.set_num} />
        <TwoFields>
          <CategoryField categories={categories} />
          <Field label="Quantity">
            <Input
              name="quantity"
              type="number"
              min={1}
              defaultValue={1}
              inputMode="numeric"
            />
          </Field>
        </TwoFields>
        <TwoFields>
          <OwnerField owners={owners} />
          <StatusField statuses={statuses} />
        </TwoFields>
        <Field label="Details" hint="One “label: value” per line.">
          <Textarea
            name="metadata"
            defaultValue={detailsLines.join("\n")}
            placeholder="Stored in: Bin 4"
          />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" />
        </Field>
      </FormDialog>
    </>
  );
}
