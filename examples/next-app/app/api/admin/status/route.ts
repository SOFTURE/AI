// An admin-only route handler: requireRole answers 404 to anyone without the admin role.
import { ADMIN_ROLE } from "@softure-ai/auth";
import { requireRole } from "@softure-ai/auth/next";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const admin = await requireRole(ADMIN_ROLE);
  return Response.json({ admin: { id: admin.id } }, { headers: { "cache-control": "no-store" } });
}
