// Downloads the LEGO catalog from Rebrickable
// Runs in the Dockerfile, and can be run with: npm run catalog:fetch
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("data", { recursive: true });

for (const fileName of ["sets.csv.gz", "themes.csv.gz"]) {
  const response = await fetch(
    `https://cdn.rebrickable.com/media/downloads/${fileName}`,
    {
      headers: { "User-Agent": "create-mpls-inventory" },
    },
  );
  if (!response.ok) throw new Error(`Could not download ${fileName}`);
  await writeFile(
    `data/${fileName}`,
    Buffer.from(await response.arrayBuffer()),
  );
  console.log(`Downloaded ${fileName}`);
}
