"use client";
import { FormDialog } from "@/components/form-dialog";
import { Field, Input } from "@/components/ui/input";
import {
  createCategory,
  createOwner,
  createStatus,
  updateCategory,
  updateOwner,
  updateStatus,
} from "@/lib/actions";
import { STATUS_COLORS } from "@/lib/utils";

// Categories, owners and statuses
export type CategoryOwnerOrStatus = "category" | "owner" | "status";

// The entry being edited
export type ExistingEntry = {
  id: number;
  name: string;
  // Categories only
  description?: string | null;
  // Statuses only
  color?: string | null;
};

const NAME_PLACEHOLDERS = {
  category: "Sensors & motors",
  owner: "Hamline Elementary",
  status: "Needs sorting",
};

const SAVE_ACTIONS = {
  category: { create: createCategory, update: updateCategory },
  owner: { create: createOwner, update: updateOwner },
  status: { create: createStatus, update: updateStatus },
};

export function CategoryOwnerOrStatusDialog({
  kind,
  existingEntry,
  isOpen,
  onOpenChange,
}: {
  kind: CategoryOwnerOrStatus;
  existingEntry?: ExistingEntry;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <FormDialog
      title={`${existingEntry ? "Edit" : "New"} ${kind}`}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      action={
        existingEntry ? SAVE_ACTIONS[kind].update : SAVE_ACTIONS[kind].create
      }
      submitText={existingEntry ? "Save changes" : `Create ${kind}`}
      successMessage={(formData) =>
        `${existingEntry ? "Saved changes to" : "Created"} ${kind} “${formData.get("name")}”`
      }
    >
      {existingEntry && (
        <input type="hidden" name="id" value={existingEntry.id} />
      )}
      <Field label="Name">
        <Input
          name="name"
          required
          autoComplete="off"
          defaultValue={existingEntry?.name}
          placeholder={NAME_PLACEHOLDERS[kind]}
        />
      </Field>
      {kind === "category" && (
        <Field label="Description (optional)">
          <Input
            name="description"
            defaultValue={existingEntry?.description ?? ""}
          />
        </Field>
      )}
      {kind === "status" && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium leading-none">Color</legend>
          <div className="flex flex-wrap gap-3 pt-1">
            {Object.entries(STATUS_COLORS).map(([colorName, dotClass]) => (
              <label key={colorName} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={colorName}
                  defaultChecked={
                    (existingEntry?.color ?? "slate") === colorName
                  }
                  className="peer sr-only"
                />
                <span className="sr-only">{colorName}</span>
                <span
                  className={`block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${dotClass}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </FormDialog>
  );
}
