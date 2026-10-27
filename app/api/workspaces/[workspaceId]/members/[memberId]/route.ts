import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateMember } from "@/lib/workspaces/service";
import { updateWorkspaceMemberSchema } from "@/lib/validation/workspaces";

export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string; memberId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { workspaceId, memberId } = await context.params;
    const body = await request.json();
    const parsed = updateWorkspaceMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid membership update payload.", parsed.error.flatten());
    }

    const data = await updateMember(supabase, workspaceId, memberId, parsed.data, user.id);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ workspaceId: string; memberId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { workspaceId, memberId } = await context.params;
    const data = await updateMember(supabase, workspaceId, memberId, { status: "REMOVED" }, user.id);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
