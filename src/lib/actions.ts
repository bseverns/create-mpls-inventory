"use server";
// Every button that changes something calls one of these functions
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAuthorized } from "@/lib/auth.mjs";
import { importCatalog } from "@/lib/catalog";
import { prepareDatabase, queryDatabase, withTransaction } from "@/lib/database";
import { searchLegoSets } from "@/lib/queries";
import { STATUS_COLORS, makeSlug, parseDetails } from "@/lib/utils";

type ActionResult = { error?: string };

async function requireAuthorization() {
  if (!isAuthorized(await headers())) throw new Error("Authentication required");
}

// Reads a text field from a form
function getText(formData: FormData, fieldName: string) {
  return String(formData.get(fieldName) ?? "").trim();
}

// The quantity from a form is always at least 1
function getQuantity(formData: FormData) {
  return Math.max(1, parseInt(getText(formData, "quantity")) || 1);
}

// After any change, reload the data on every page
function refreshAllPages() {
  revalidatePath("/", "layout");
}

function getBadDetailsMessage(badLine: string) {
  return `Details: “${badLine}” needs a label, a colon and a value, like “Stored in: Bin 4”. Put it in Notes instead if it is not a label and value.`;
}

// Finds the category, owner and status chosen in a form
async function getChosenIds(formData: FormData) {
  const rows = await queryDatabase<{
    category_id: number;
    owner_id: number;
    status_id: number | null;
  }>(
    `SELECT
       coalesce((SELECT id FROM categories WHERE id = $1),
                (SELECT id FROM categories WHERE slug = 'uncategorized')) AS category_id,
       coalesce((SELECT id FROM owners WHERE id = $2),
                (SELECT id FROM owners WHERE lower(name) = 'unassigned')) AS owner_id,
       (SELECT id FROM statuses WHERE id = $3) AS status_id`,
    [
      Number(formData.get("category_id")) || 0,
      Number(formData.get("owner_id")) || 0,
      Number(formData.get("status_id")) || 0,
    ],
  );
  return rows[0];
}

// Items

export async function addItem(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  if (name === "") return { error: "Name is required" };
  const { details, badLine } = parseDetails(getText(formData, "metadata"));
  if (badLine) return { error: getBadDetailsMessage(badLine) };

  const photo = formData.get("image") as File;
  const hasPhoto = photo.size > 0;

  const ids = await getChosenIds(formData);
  await queryDatabase(
    `INSERT INTO items
       (category_id, owner_id, status_id, name, quantity, notes, image_url, image_data, image_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      ids.category_id,
      ids.owner_id,
      ids.status_id,
      name,
      getQuantity(formData),
      getText(formData, "notes"),
      hasPhoto ? null : getText(formData, "image_url") || null,
      hasPhoto ? Buffer.from(await photo.arrayBuffer()) : null,
      hasPhoto ? photo.type : null,
      JSON.stringify(details),
    ],
  );
  refreshAllPages();
  return {};
}

export async function updateItem(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const itemId = Number(formData.get("id"));
  const name = getText(formData, "name");
  if (name === "") return { error: "Name is required" };
  const { details, badLine } = parseDetails(getText(formData, "metadata"));
  if (badLine) return { error: getBadDetailsMessage(badLine) };

  const ids = await getChosenIds(formData);
  await queryDatabase(
    `UPDATE items
     SET category_id = $2, owner_id = $3, status_id = $4, name = $5,
         quantity = $6, notes = $7, metadata = $8
     WHERE id = $1`,
    [
      itemId,
      ids.category_id,
      ids.owner_id,
      ids.status_id,
      name,
      getQuantity(formData),
      getText(formData, "notes"),
      JSON.stringify(details),
    ],
  );

  // Update the picture
  const photo = formData.get("image") as File;
  if (photo.size > 0) {
    // A new photo replaces the image link
    await queryDatabase(
      "UPDATE items SET image_url = NULL, image_data = $2, image_type = $3 WHERE id = $1",
      [itemId, Buffer.from(await photo.arrayBuffer()), photo.type],
    );
  } else if (formData.get("remove_image") === "on") {
    await queryDatabase(
      "UPDATE items SET image_url = NULL, image_data = NULL, image_type = NULL WHERE id = $1",
      [itemId],
    );
  } else {
    await queryDatabase(
      `UPDATE items
       SET image_url = $2,
           image_data = CASE WHEN $2::text IS NULL THEN image_data END,
           image_type = CASE WHEN $2::text IS NULL THEN image_type END
       WHERE id = $1`,
      [itemId, getText(formData, "image_url") || null],
    );
  }

  refreshAllPages();
  return {};
}

// The plus and minus buttons on an item card
export async function adjustQuantity(itemId: number, amount: number) {
  await requireAuthorization();
  await queryDatabase(
    "UPDATE items SET quantity = GREATEST(1, quantity + $2) WHERE id = $1",
    [itemId, amount],
  );
}

export async function deleteItem(formData: FormData) {
  await requireAuthorization();
  await queryDatabase("DELETE FROM items WHERE id = $1", [
    Number(formData.get("id")),
  ]);
  refreshAllPages();
}

// Moves some units of an item into a new item, which starts as a copy of the original
export async function splitItem(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  if (name === "") return { error: "Name is required" };

  const ids = await getChosenIds(formData);
  const rows = await queryDatabase(
    `WITH new_item AS (
       INSERT INTO items
         (category_id, owner_id, status_id, name, quantity, notes, image_url, image_data, image_type, metadata, catalog_ref)
       SELECT $2::int, $3::int, $4::int, $5::text, $6::int, $7::text,
              image_url, image_data, image_type, metadata, catalog_ref
       FROM items WHERE id = $1 AND $6::int >= 1 AND quantity > $6::int
       RETURNING id
     )
     UPDATE items SET quantity = quantity - $6::int
     WHERE id = $1 AND EXISTS (SELECT 1 FROM new_item)
     RETURNING id`,
    [
      Number(formData.get("id")),
      ids.category_id,
      ids.owner_id,
      ids.status_id,
      name,
      parseInt(getText(formData, "units")) || 0,
      getText(formData, "notes"),
    ],
  );
  if (rows.length === 0) {
    return {
      error: "Choose at least 1 unit to split off, and leave at least 1 behind",
    };
  }

  refreshAllPages();
  return {};
}

// LEGO catalog

// The Show more button
export async function loadMoreLegoSets(searchText: string, offset: number) {
  await requireAuthorization();
  return searchLegoSets(searchText, offset);
}

// Adds a LEGO set from the catalog to the inventory
export async function addCatalogSet(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const { details, badLine } = parseDetails(getText(formData, "metadata"));
  if (badLine) return { error: getBadDetailsMessage(badLine) };

  const ids = await getChosenIds(formData);
  const setNumber = getText(formData, "set_num");
  const quantity = getQuantity(formData);
  const notes = getText(formData, "notes");

  // If an identical item is already in the inventory, just add to its quantity
  // A different status, note or detail makes a separate item
  // Items with notes are never merged into, because notes belong to specific units
  if (notes === "") {
    const merged = await queryDatabase(
      `UPDATE items SET quantity = quantity + $1
       WHERE id = (
         SELECT id FROM items
         WHERE catalog_ref = $2 AND category_id = $3 AND owner_id = $4
           AND status_id IS NOT DISTINCT FROM $5 AND notes = '' AND metadata = $6::jsonb
         LIMIT 1
       )
       RETURNING id`,
      [
        quantity,
        setNumber,
        ids.category_id,
        ids.owner_id,
        ids.status_id,
        JSON.stringify(details),
      ],
    );
    if (merged.length > 0) return {};
  }

  // The name and picture come from the catalog
  await queryDatabase(
    `INSERT INTO items
       (category_id, owner_id, status_id, name, quantity, notes, image_url, metadata, catalog_ref)
     SELECT $1::int, $2::int, $3::int, name, $4::int, $5::text, img_url, $6::jsonb, set_num
     FROM lego_sets WHERE set_num = $7`,
    [
      ids.category_id,
      ids.owner_id,
      ids.status_id,
      quantity,
      notes,
      JSON.stringify(details),
      setNumber,
    ],
  );
  return {};
}

// The Refresh catalog button
export async function refreshCatalog(): Promise<{
  importedCount?: number;
  error?: string;
}> {
  await requireAuthorization();
  try {
    const pool = await prepareDatabase();
    return { importedCount: await importCatalog(pool, true) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// Categories, owners and statuses

async function saveIfNameIsFree(
  sql: string,
  values: unknown[],
  kind: string,
): Promise<ActionResult> {
  let rows;
  try {
    rows = await queryDatabase(sql, values);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { error: `A ${kind} with that name already exists` };
    }
    throw error;
  }
  if (rows.length === 0)
    return { error: `A ${kind} with that name already exists` };
  refreshAllPages();
  return {};
}

export async function createOwner(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  if (name === "") return { error: "Enter a name" };
  return saveIfNameIsFree(
    `INSERT INTO owners (name) SELECT $1::text
     WHERE NOT EXISTS (SELECT 1 FROM owners WHERE lower(name) = lower($1))
     RETURNING id`,
    [name],
    "owner",
  );
}

export async function updateOwner(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  if (name === "") return { error: "Enter a name" };
  return saveIfNameIsFree(
    `UPDATE owners SET name = $2
     WHERE id = $1 AND lower(name) <> 'unassigned'
       AND NOT EXISTS (SELECT 1 FROM owners WHERE id <> $1 AND lower(name) = lower($2))
     RETURNING id`,
    [Number(formData.get("id")), name],
    "owner",
  );
}

// Deleting an owner moves all of their items to Unassigned
export async function deleteOwner(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const ownerId = Number(formData.get("id"));
  const deleted = await withTransaction(async (client) => {
    const target = await client.query(
      "SELECT id FROM owners WHERE id = $1 AND lower(name) <> 'unassigned' FOR UPDATE",
      [ownerId],
    );
    if (target.rowCount === 0) return false;
    await client.query(
      `UPDATE items SET owner_id = (SELECT id FROM owners WHERE lower(name) = 'unassigned')
       WHERE owner_id = $1`,
      [ownerId],
    );
    await client.query("DELETE FROM owners WHERE id = $1", [ownerId]);
    return true;
  });
  if (!deleted) return { error: "The built-in owner cannot be deleted" };
  refreshAllPages();
  return {};
}

export async function createCategory(
  formData: FormData,
): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  const slug = makeSlug(name);
  if (slug === "") return { error: "Enter a name using letters or numbers" };
  return saveIfNameIsFree(
    `INSERT INTO categories (name, slug, description) SELECT $1::text, $2::text, $3::text
     WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = $2 OR lower(name) = lower($1))
     RETURNING id`,
    [name, slug, getText(formData, "description")],
    "category",
  );
}

export async function updateCategory(
  formData: FormData,
): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  const slug = makeSlug(name);
  if (slug === "") return { error: "Enter a name using letters or numbers" };
  return saveIfNameIsFree(
    `UPDATE categories SET name = $2, slug = $3, description = $4
     WHERE id = $1 AND slug <> 'uncategorized' AND NOT EXISTS (
       SELECT 1 FROM categories WHERE id <> $1 AND (slug = $3 OR lower(name) = lower($2))
     )
     RETURNING id`,
    [Number(formData.get("id")), name, slug, getText(formData, "description")],
    "category",
  );
}

// Deleting a category moves all of its items to Uncategorized
export async function deleteCategory(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const categoryId = Number(formData.get("id"));
  const deleted = await withTransaction(async (client) => {
    const target = await client.query(
      "SELECT id FROM categories WHERE id = $1 AND slug <> 'uncategorized' FOR UPDATE",
      [categoryId],
    );
    if (target.rowCount === 0) return false;
    await client.query(
      `UPDATE items SET category_id = (SELECT id FROM categories WHERE slug = 'uncategorized')
       WHERE category_id = $1`,
      [categoryId],
    );
    await client.query("DELETE FROM categories WHERE id = $1", [categoryId]);
    return true;
  });
  if (!deleted)
    return { error: "The built-in category cannot be deleted" };
  refreshAllPages();
  return {};
}

function getColor(formData: FormData) {
  const color = getText(formData, "color");
  return color in STATUS_COLORS ? color : "slate";
}

export async function createStatus(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  const slug = makeSlug(name);
  if (slug === "") return { error: "Enter a name using letters or numbers" };
  return saveIfNameIsFree(
    `INSERT INTO statuses (name, slug, color) SELECT $1::text, $2::text, $3::text
     WHERE NOT EXISTS (SELECT 1 FROM statuses WHERE slug = $2 OR lower(name) = lower($1))
     RETURNING id`,
    [name, slug, getColor(formData)],
    "status",
  );
}

export async function updateStatus(formData: FormData): Promise<ActionResult> {
  await requireAuthorization();
  const name = getText(formData, "name");
  const slug = makeSlug(name);
  if (slug === "") return { error: "Enter a name using letters or numbers" };
  return saveIfNameIsFree(
    `UPDATE statuses SET name = $2, slug = $3, color = $4
     WHERE id = $1 AND NOT EXISTS (
       SELECT 1 FROM statuses WHERE id <> $1 AND (slug = $3 OR lower(name) = lower($2))
     )
     RETURNING id`,
    [Number(formData.get("id")), name, slug, getColor(formData)],
    "status",
  );
}

// Deleting a status gives its items no status
export async function deleteStatus(formData: FormData) {
  await requireAuthorization();
  await queryDatabase("DELETE FROM statuses WHERE id = $1", [
    Number(formData.get("id")),
  ]);
  refreshAllPages();
}
