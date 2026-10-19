// Sends the lists for the dropdowns of the New item form
import { getAllCategories, getAllOwners, getAllStatuses } from "@/lib/queries";

export async function GET() {
  const [categories, owners, statuses] = await Promise.all([
    getAllCategories(),
    getAllOwners(),
    getAllStatuses(),
  ]);
  return Response.json({ categories, owners, statuses });
}
