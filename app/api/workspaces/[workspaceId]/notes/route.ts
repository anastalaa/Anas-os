import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createNote, listNotes } from "@/lib/core/service";
import { noteCreateSchema } from "@/lib/validation/core";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { supabase } = await requireAuthenticatedUser(); return Response.json({ data: await listNotes(supabase, (await params).workspaceId) }); }
  catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const parsed = noteCreateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(422, "VALIDATION_ERROR", "Invalid note payload.", parsed.error.flatten());
    return Response.json({ data: await createNote(supabase, user, (await params).workspaceId, parsed.data) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
