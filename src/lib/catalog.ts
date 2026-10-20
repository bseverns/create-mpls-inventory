// Loads the LEGO catalog into the database (ETL)
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import type { Pool } from "pg";

// Splits one line of a CSV file into its columns
// A column wrapped in quotes can contain commas, and double-quotes inside quotes means one quote
function splitCsvLine(line: string) {
  const columns: string[] = [];
  for (const match of line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)) {
    columns.push(match[1].replace(/^"|"$/g, "").replaceAll('""', '"'));
  }
  return columns;
}

// Reads one zipped CSV file, from the website or from the data folder
// The data folder is filled when the Docker image is built
async function readCsvFile(fileName: string, fromWebsite: boolean) {
  let zippedFile: Buffer;
  if (fromWebsite) {
    const response = await fetch(
      `https://cdn.rebrickable.com/media/downloads/${fileName}`,
      {
        headers: { "User-Agent": "create-mpls-inventory" },
      },
    );
    if (!response.ok) throw new Error(`${fileName}: HTTP ${response.status}`);
    zippedFile = Buffer.from(await response.arrayBuffer());
  } else {
    zippedFile = await readFile(`data/${fileName}`);
  }

  const lines = gunzipSync(zippedFile).toString("utf8").split(/\r?\n/);
  // The first line holds the column names
  lines.shift();
  return lines.filter((line) => line !== "").map(splitCsvLine);
}

// Saves every set in the lego_sets table, and returns how many there are
export async function importCatalog(
  pool: Pool,
  fromWebsite: boolean,
  onlyIfEmpty = false,
) {
  const setRows = await readCsvFile("sets.csv.gz", fromWebsite);
  const themeRows = await readCsvFile("themes.csv.gz", fromWebsite);

  const themes: Record<string, { name: string; parentId: string }> = {};
  for (const [id, name, parentId] of themeRows) {
    themes[id] = { name, parentId };
  }

  // Themes sit inside other themes, so this gives names like "Technic / Mindstorms"
  function getThemeName(themeId: string): string {
    const theme = themes[themeId];
    if (!theme) return "";
    if (theme.parentId === "") return theme.name;
    return `${getThemeName(theme.parentId)} / ${theme.name}`;
  }

  // Swap each theme id for the theme's name
  const sets = setRows.map((row) => [
    row[0],
    row[1],
    row[2],
    getThemeName(row[3]),
    row[4],
    row[5],
  ]);

  if (sets.length === 0) throw new Error("Catalog contained no sets");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE lego_sets IN EXCLUSIVE MODE");
    if (onlyIfEmpty) {
      const result = await client.query(
        "SELECT count(*)::int AS set_count FROM lego_sets",
      );
      if (result.rows[0].set_count !== 0) {
        await client.query("COMMIT");
        return 0;
      }
    }
    await client.query(
      `WITH entries AS MATERIALIZED (
       SELECT entry FROM jsonb_array_elements($1::jsonb) AS entry
     ), upserted AS (
       INSERT INTO lego_sets (set_num, name, year, theme, num_parts, img_url)
       SELECT entry->>0, entry->>1, nullif(nullif(entry->>2, ''), '0')::int, entry->>3,
              nullif(nullif(entry->>4, ''), '0')::int, nullif(entry->>5, '')
       FROM entries
       ON CONFLICT (set_num) DO UPDATE SET
         name = EXCLUDED.name,
         year = EXCLUDED.year,
         theme = EXCLUDED.theme,
         num_parts = EXCLUDED.num_parts,
         img_url = EXCLUDED.img_url
     )
     DELETE FROM lego_sets
     WHERE set_num NOT IN (SELECT entry->>0 FROM entries)`,
      [JSON.stringify(sets)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return sets.length;
}

export async function importCatalogFromFilesIfEmpty(pool: Pool) {
  try {
    await importCatalog(pool, false, true);
  } catch (error) {
    console.warn("Could not load the LEGO catalog from the data folder", error);
  }
}
