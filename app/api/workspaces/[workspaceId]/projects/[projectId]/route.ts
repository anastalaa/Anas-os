import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateProject } from "@/lib/core/service";
import { projectUpdateSchema } from "@/lib/validation/core";

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { workspaceId, projectId } = await params;
    const parsed = projectUpdateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(422, "VALIDATION_ERROR", "Invalid project payload.", parsed.error.flatten());
    return Response.json({ data: await updateProject(supabase, user, workspaceId, projectId, parsed.data) });
  } catch (error) { return apiErrorResponse(error); }
}
