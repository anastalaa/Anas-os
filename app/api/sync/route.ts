import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { processSyncOperation, queueSyncOperation } from "@/lib/sync/service";
import { syncRequestSchema } from "@/lib/validation/sync";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const parsed = syncRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid sync operation.", parsed.error.flatten());
    }

    const queued = await queueSyncOperation(supabase, user, parsed.data);
    const data = await processSyncOperation(supabase, queued.id);

    if (data.status === "SYNCED") {
      return Response.json({ data }, { status: 200 });
    }

    if (data.status === "CONFLICT") {
      return Response.json({
        error: {
          code: "CONFLICT",
          message: "The server detected a version conflict while applying this operation.",
          details: data,
        },
      }, { status: 409 });
    }

    if (data.status === "FAILED") {
      return Response.json({
        error: {
          code: data.error_code ?? "SYNC_FAILED",
          message: "The server could not apply this synchronization operation.",
          details: data,
        },
      }, { status: 422 });
    }

    // The accepted operation remains queued if a server processor cannot yet finalize it.
    return Response.json({ data }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
