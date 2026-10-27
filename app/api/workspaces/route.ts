import { createWorkspaceSchema } from "@/lib/validation/workspaces";
import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces/service";

export async function GET() {
  try {
    const { supabase } = await requireAuthenticatedUser();
    return Response.json({ data: await listWorkspaces(supabase) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const body = await request.json();
    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid workspace payload.", parsed.error.flatten());
    }

    const data = await createWorkspace(supabase, user, parsed.data);
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
