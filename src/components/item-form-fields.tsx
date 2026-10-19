import {
  Field,
  Input,
  Select,
  Textarea,
  TwoFields,
} from "@/components/ui/input";
import { detailsToText } from "@/lib/utils";
import type { Category, Item, Owner, Status } from "@/lib/types";

// The Category dropdown
export function CategoryField({
  categories,
  defaultValue,
}: {
  categories: Category[];
  defaultValue?: number;
}) {
  const uncategorized = categories.find(
    (category) => category.slug === "uncategorized",
  );
  return (
    <Field label="Category">
      <Select
        name="category_id"
        defaultValue={defaultValue ?? uncategorized?.id}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// The Owner dropdown
export function OwnerField({
  owners,
  defaultValue,
}: {
  owners: Owner[];
  defaultValue?: number;
}) {
  const unassigned = owners.find(
    (owner) => owner.name.toLowerCase() === "unassigned",
  );
  return (
    <Field label="Owner">
      <Select name="owner_id" defaultValue={defaultValue ?? unassigned?.id}>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// The Status dropdown
export function StatusField({
  statuses,
  defaultValue,
}: {
  statuses: Status[];
  defaultValue?: number | null;
}) {
  return (
    <Field label="Status">
      <Select name="status_id" defaultValue={defaultValue ?? ""}>
        <option value="">No status</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// All the fields of the New item and Edit item pop-ups
export function ItemFormFields({
  categories,
  owners,
  statuses,
  item,
}: {
  categories: Category[];
  owners: Owner[];
  statuses: Status[];
  item?: Item;
}) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Name">
        <Input
          name="name"
          required
          defaultValue={item?.name}
          placeholder="SPIKE Essential Class Pack"
        />
      </Field>
      <TwoFields>
        <CategoryField
          categories={categories}
          defaultValue={item?.category_id}
        />
        <Field label="Quantity">
          <Input
            name="quantity"
            type="number"
            min={1}
            defaultValue={item?.quantity ?? 1}
            inputMode="numeric"
          />
        </Field>
      </TwoFields>
      <TwoFields>
        <OwnerField owners={owners} defaultValue={item?.owner_id} />
        <StatusField statuses={statuses} defaultValue={item?.status_id} />
      </TwoFields>
      <TwoFields>
        <Field label={item?.image_source ? "Replace photo" : "Photo"}>
          <Input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="pt-2"
          />
        </Field>
        <Field label="Or image URL">
          <Input
            name="image_url"
            type="url"
            defaultValue={item?.image_url ?? ""}
            placeholder="https://"
          />
        </Field>
      </TwoFields>
      <Field label="Details" hint="One “label: value” per line.">
        <Textarea
          name="metadata"
          defaultValue={item ? detailsToText(item.metadata) : ""}
          placeholder={"Color: Red\nPart #: 3001\nStored in: Bin 4"}
        />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={item?.notes} />
      </Field>
    </>
  );
}
