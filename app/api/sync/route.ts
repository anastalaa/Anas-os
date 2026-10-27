import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { queueSyncOperation } from "@/lib/sync/service";
import { syncRequestSchema } from "@/lib/validation/sync";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const parsed = syncRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid sync operation.", parsed.error.flatten());
    }

    const data = await queueSyncOperation(supabase, user, parsed.data);
    return Response.json({ data }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
