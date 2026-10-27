import { requireAuthenticatedUser } from "@/lib/api/auth";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { updateTask } from "@/lib/core/service";
import { taskUpdateSchema } from "@/lib/validation/core";

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; taskId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { workspaceId, taskId } = await params;
    const parsed = taskUpdateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(422, "VALIDATION_ERROR", "Invalid task payload.", parsed.error.flatten());
    return Response.json({ data: await updateTask(supabase, user, workspaceId, taskId, parsed.data) });
  } catch (error) { return apiErrorResponse(error); }
}
