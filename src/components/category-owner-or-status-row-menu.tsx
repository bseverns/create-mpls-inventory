"use client";
import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CategoryOwnerOrStatusDialog,
  type CategoryOwnerOrStatus,
  type ExistingEntry,
} from "@/components/category-owner-or-status-dialog";
import { FormDialog } from "@/components/form-dialog";
import { deleteCategory, deleteOwner, deleteStatus } from "@/lib/actions";

const DELETE_ACTIONS = {
  category: deleteCategory,
  owner: deleteOwner,
  status: deleteStatus,
};

// The menu on each row of the Manage page
export function CategoryOwnerOrStatusRowMenu({
  kind,
  entry,
  itemCount,
}: {
  kind: CategoryOwnerOrStatus;
  entry: ExistingEntry;
  itemCount: number;
}) {
  const [openDialog, setOpenDialog] = useState<"edit" | "delete" | null>(null);

  const itemWord = itemCount === 1 ? "item" : "items";
  const whatHappensToItems = {
    owner: `${itemCount} ${itemWord} in this owner will be moved to Unassigned.`,
    category: `${itemCount} ${itemWord} in this category will be moved to Uncategorized.`,
    status: `${itemCount} ${itemWord} with this status will have no status.`,
  };
  const deleteWarning =
    itemCount === 0
      ? `No items use this ${kind}.`
      : `${whatHappensToItems[kind]} The items themselves are not deleted.`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${entry.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={() => setOpenDialog("edit")}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenDialog("delete")}
            className="text-destructive data-[highlighted]:bg-destructive/10 [&_svg]:text-destructive"
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CategoryOwnerOrStatusDialog
        kind={kind}
        existingEntry={entry}
        isOpen={openDialog === "edit"}
        onOpenChange={() => setOpenDialog(null)}
      />

      <FormDialog
        title={`Delete “${entry.name}”?`}
        description={`${deleteWarning} This can't be undone.`}
        isOpen={openDialog === "delete"}
        onOpenChange={() => setOpenDialog(null)}
        action={DELETE_ACTIONS[kind]}
        submitText={`Delete ${kind}`}
        pendingText="Deleting…"
        destructive
        successMessage={() => `Deleted ${kind} “${entry.name}”`}
      >
        <input type="hidden" name="id" value={entry.id} />
      </FormDialog>
    </>
  );
}
