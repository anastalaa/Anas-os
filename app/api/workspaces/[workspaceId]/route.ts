import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { getWorkspace, updateWorkspace } from "@/lib/workspaces/service";
import { updateWorkspaceSchema } from "@/lib/validation/workspaces";

export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { workspaceId } = await context.params;
    return Response.json({ data: await getWorkspace(supabase, workspaceId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { workspaceId } = await context.params;
    const body = await request.json();
    const parsed = updateWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid workspace update payload.", parsed.error.flatten());
    }

    const data = await updateWorkspace(supabase, workspaceId, parsed.data);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
