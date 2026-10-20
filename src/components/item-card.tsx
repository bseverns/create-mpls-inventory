"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Split,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input, Textarea, TwoFields } from "@/components/ui/input";
import { FormDialog } from "@/components/form-dialog";
import {
  CategoryField,
  ItemFormFields,
  OwnerField,
  StatusField,
} from "@/components/item-form-fields";
import {
  adjustQuantity,
  deleteItem,
  splitItem,
  updateItem,
} from "@/lib/actions";
import { STATUS_COLORS } from "@/lib/utils";
import type { Category, Item, Owner, Status } from "@/lib/types";

// One item on the Inventory page, with its quantity buttons, notes button and menu
export function ItemCard({
  item,
  categories,
  owners,
  statuses,
}: {
  item: Item;
  categories: Category[];
  owners: Owner[];
  statuses: Status[];
}) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<
    "notes" | "edit" | "split" | "delete" | null
  >(null);

  // The quantity shown on the card
  const [quantity, setQuantity] = useState(item.quantity);
  useEffect(() => {
    setQuantity(item.quantity);
  }, [item.quantity]);

  async function changeQuantity(amount: 1 | -1) {
    setQuantity((current) => current + amount);
    try {
      await adjustQuantity(item.id, amount);
    } catch {
      toast.error("Could not change the quantity");
      router.refresh();
    }
  }

  const shownItem = { ...item, quantity };
  const closeDialog = () => setOpenDialog(null);

  // Show at most two extra details so cards stay the same size
  const extraDetails = Object.entries(item.metadata).slice(0, 2);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {item.image_source ? (
          <img
            src={item.image_source}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <Package className="size-10 text-muted-foreground/60" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {item.name}
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Owner</dt>
          <dd className="truncate font-medium" title={item.owner}>
            {item.owner}
          </dd>
          <dt className="text-muted-foreground">Category</dt>
          <dd className="truncate font-medium" title={item.category}>
            {item.category}
          </dd>
          {item.status_name && (
            <>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="flex items-center gap-1.5 truncate font-medium">
                <span
                  className={`size-2 shrink-0 rounded-full ${STATUS_COLORS[item.status_color ?? "slate"]}`}
                  aria-hidden
                />
                {item.status_name}
              </dd>
            </>
          )}
          {extraDetails.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="truncate" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            {/* The quantity can never go lower than 1 */}
            <Button
              variant="outline"
              size="icon"
              aria-label={`Remove one ${item.name}`}
              disabled={quantity <= 1}
              onClick={() => changeQuantity(-1)}
            >
              <Minus />
            </Button>
            <span
              className="min-w-8 text-center text-sm font-semibold tabular-nums"
              aria-label="Quantity"
            >
              {quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Add one ${item.name}`}
              onClick={() => changeQuantity(1)}
            >
              <Plus />
            </Button>
          </div>

          <div className="flex items-center">
            {item.notes && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Read notes for ${item.name}`}
                onClick={() => setOpenDialog("notes")}
              >
                <StickyNote />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${item.name}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onSelect={() => setOpenDialog("edit")}>
                  <Pencil />
                  Edit
                </DropdownMenuItem>
                {/* Splitting needs at least 2 units */}
                {quantity >= 2 && (
                  <DropdownMenuItem onSelect={() => setOpenDialog("split")}>
                    <Split />
                    Split off units…
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => setOpenDialog("delete")}
                  className="text-destructive data-[highlighted]:bg-destructive/10 [&_svg]:text-destructive"
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Notes */}
      <Dialog open={openDialog === "notes"} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogTitle>Notes</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
          <p className="mt-4 max-h-[60dvh] overflow-y-auto whitespace-pre-wrap break-words text-sm">
            {item.notes}
          </p>
          <div className="mt-5 flex justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <FormDialog
        title="Edit item"
        wide
        isOpen={openDialog === "edit"}
        onOpenChange={closeDialog}
        action={updateItem}
        submitText="Save changes"
        successMessage={(formData) =>
          `Saved changes to “${formData.get("name")}”`
        }
      >
        <ItemFormFields
          categories={categories}
          owners={owners}
          statuses={statuses}
          item={shownItem}
        />
      </FormDialog>

      {/* Split off units */}
      <FormDialog
        title="Split off units"
        description={`Move some of the ${quantity} units of “${item.name}” into their own item.`}
        wide
        isOpen={openDialog === "split"}
        onOpenChange={closeDialog}
        action={splitItem}
        submitText="Split off"
        pendingText="Splitting…"
        successMessage={(formData) =>
          `Split ${formData.get("units")} off “${item.name}” into “${formData.get("name")}”`
        }
      >
        <input type="hidden" name="id" value={item.id} />
        <TwoFields>
          <Field label="Units to split off">
            <Input
              name="units"
              type="number"
              min={1}
              max={quantity - 1}
              defaultValue={1}
              inputMode="numeric"
            />
          </Field>
          <Field label="Name of the new item">
            <Input
              name="name"
              required
              defaultValue={item.name}
              placeholder="SPIKE Prime Class Pack, 2"
            />
          </Field>
        </TwoFields>
        <TwoFields>
          <CategoryField
            categories={categories}
            defaultValue={item.category_id}
          />
          <OwnerField owners={owners} defaultValue={item.owner_id} />
        </TwoFields>
        <StatusField statuses={statuses} defaultValue={item.status_id} />
        <Field label="Notes for the new item">
          <Textarea name="notes" placeholder="Missing three bricks" />
        </Field>
      </FormDialog>

      {/* Delete */}
      <FormDialog
        title="Delete this item?"
        description={`“${item.name}” (${quantity} in stock) will be permanently removed from the inventory.`}
        isOpen={openDialog === "delete"}
        onOpenChange={closeDialog}
        action={deleteItem}
        submitText="Delete item"
        pendingText="Deleting…"
        destructive
        successMessage={() => `Deleted “${item.name}”`}
      >
        <input type="hidden" name="id" value={item.id} />
      </FormDialog>
    </Card>
  );
}
