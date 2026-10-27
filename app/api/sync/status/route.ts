import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { getSyncOperationStatus } from "@/lib/sync/service";

export async function GET(request: Request) {
  try {
    const clientOperationId = new URL(request.url).searchParams.get("client_operation_id");
    if (!clientOperationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientOperationId)) {
      throw new ApiError(422, "VALIDATION_ERROR", "A valid client_operation_id is required.");
    }

    const { supabase, user } = await requireAuthenticatedUser();
    const data = await getSyncOperationStatus(supabase, user, clientOperationId);
    return Response.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
