"use client";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  FolderPlus,
  PackagePlus,
  Tag,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryOwnerOrStatusDialog } from "@/components/category-owner-or-status-dialog";
import { FormDialog } from "@/components/form-dialog";
import { ItemFormFields } from "@/components/item-form-fields";
import { addItem } from "@/lib/actions";
import type { FormOptions } from "@/lib/types";

// The Add button in the top right
export function AddNewItemCategoryOwnerOrStatusMenu() {
  // Which pop-up is open
  const [openDialog, setOpenDialog] = useState<
    "item" | "category" | "owner" | "status" | null
  >(null);

  // The dropdown lists for the New item form
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null);

  async function loadFormOptions() {
    const response = await fetch("/api/form-options", { cache: "no-store" });
    if (response.ok) setFormOptions(await response.json());
  }

  // Load the lists when the page opens and and again each time New item is chosen
  useEffect(() => {
    loadFormOptions();
  }, []);

  function openNewItemDialog() {
    setOpenDialog("item");
    loadFormOptions();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            Add
            <ChevronDown className="-mr-1 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openNewItemDialog}>
            <PackagePlus />
            Item
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("category")}>
            <FolderPlus />
            Category
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("owner")}>
            <UserPlus />
            Owner
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpenDialog("status")}>
            <Tag />
            Status
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {formOptions && (
        <FormDialog
          title="New item"
          wide
          isOpen={openDialog === "item"}
          onOpenChange={() => setOpenDialog(null)}
          action={addItem}
          submitText="Create item"
          successMessage={(formData) =>
            `Added “${formData.get("name")}” to the inventory`
          }
        >
          <ItemFormFields
            categories={formOptions.categories}
            owners={formOptions.owners}
            statuses={formOptions.statuses}
          />
        </FormDialog>
      )}
      <CategoryOwnerOrStatusDialog
        kind="category"
        isOpen={openDialog === "category"}
        onOpenChange={() => setOpenDialog(null)}
      />
      <CategoryOwnerOrStatusDialog
        kind="owner"
        isOpen={openDialog === "owner"}
        onOpenChange={() => setOpenDialog(null)}
      />
      <CategoryOwnerOrStatusDialog
        kind="status"
        isOpen={openDialog === "status"}
        onOpenChange={() => setOpenDialog(null)}
      />
    </>
  );
}
