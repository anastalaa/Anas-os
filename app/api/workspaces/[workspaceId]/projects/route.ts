import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createProject, listProjects } from "@/lib/core/service";
import { projectCreateSchema } from "@/lib/validation/core";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try { const { supabase } = await requireAuthenticatedUser(); return Response.json({ data: await listProjects(supabase, (await params).workspaceId) }); }
  catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const parsed = projectCreateSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(422, "VALIDATION_ERROR", "Invalid project payload.", parsed.error.flatten());
    return Response.json({ data: await createProject(supabase, user, (await params).workspaceId, parsed.data) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
