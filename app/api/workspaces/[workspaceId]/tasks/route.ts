import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createTask, listTasks } from "@/lib/core/service";
import { taskCreateSchema } from "@/lib/validation/core";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    return Response.json({ data: await listTasks(supabase, (await params).workspaceId) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const parsed = taskCreateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(422, "VALIDATION_ERROR", "Invalid task payload.", parsed.error.flatten());
    return Response.json({ data: await createTask(supabase, user, (await params).workspaceId, parsed.data) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
