import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "./errors";

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication could not be verified.");
  }

  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return { supabase, user };
}
