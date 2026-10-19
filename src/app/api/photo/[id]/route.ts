// Sends back a photo that was uploaded for an item
import { queryDatabase } from "@/lib/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await queryDatabase<{ image_data: Buffer; image_type: string }>(
    "SELECT image_data, image_type FROM items WHERE id = $1 AND image_data IS NOT NULL",
    [Number(id)],
  );
  if (rows.length === 0) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(rows[0].image_data), {
    headers: { "Content-Type": rows[0].image_type },
  });
}
