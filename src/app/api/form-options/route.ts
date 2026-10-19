// Sends the lists for the dropdowns of the New item form
import { isAuthorized, unauthorizedResponse } from "@/lib/auth.mjs";
import { getAllCategories, getAllOwners, getAllStatuses } from "@/lib/queries";

export async function GET(request: Request) {
  if (!isAuthorized(request.headers)) return unauthorizedResponse();
  const [categories, owners, statuses] = await Promise.all([
    getAllCategories(),
    getAllOwners(),
    getAllStatuses(),
  ]);
  return Response.json({ categories, owners, statuses });
}
