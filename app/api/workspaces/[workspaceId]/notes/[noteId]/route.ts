import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateNote } from "@/lib/core/service";
import { noteUpdateSchema } from "@/lib/validation/core";

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string; noteId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { workspaceId, noteId } = await params;
    const parsed = noteUpdateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(422, "VALIDATION_ERROR", "Invalid note payload.", parsed.error.flatten());
    return Response.json({ data: await updateNote(supabase, user, workspaceId, noteId, parsed.data) });
  } catch (error) { return apiErrorResponse(error); }
}
