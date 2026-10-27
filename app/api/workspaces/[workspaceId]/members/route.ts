import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { addMember, listMembers } from "@/lib/workspaces/service";
import { addWorkspaceMemberSchema } from "@/lib/validation/workspaces";

export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { workspaceId } = await context.params;
    return Response.json({ data: await listMembers(supabase, workspaceId) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { workspaceId } = await context.params;
    const body = await request.json();
    const parsed = addWorkspaceMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid membership payload.", parsed.error.flatten());
    }

    const data = await addMember(supabase, workspaceId, parsed.data);
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
