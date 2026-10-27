import { requireAuthenticatedUser } from "@/lib/api/auth";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { registerDevice } from "@/lib/sync/service";
import { registerDeviceSchema } from "@/lib/validation/sync";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const parsed = registerDeviceSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid device registration.", parsed.error.flatten());
    }

    return Response.json({ data: await registerDevice(supabase, user, parsed.data) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
