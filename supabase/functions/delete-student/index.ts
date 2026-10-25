import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond(405, { error: "Method not allowed." });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, {
      error: "Student account deletion is not configured.",
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return respond(401, { error: "Sign in as an administrator first." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: admin, error: adminError } = await adminClient
    .from("portal_admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (adminError) {
    console.error("Unable to verify portal administrator.", adminError);
    return respond(500, { error: "Unable to verify administrator access." });
  }
  if (!admin) {
    return respond(403, { error: "Administrator access is required." });
  }

  let payload: { studentId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return respond(400, { error: "Request body must be valid JSON." });
  }
  const studentId = String(payload.studentId ?? "").trim();
  if (!studentId) {
    return respond(400, { error: "A student ID is required." });
  }

  const { data: student, error: studentError } = await adminClient
    .from("portal_records")
    .select("owner_id")
    .eq("record_type", "students")
    .eq("record_id", studentId)
    .maybeSingle();
  if (studentError) {
    console.error("Unable to find student record for deletion.", studentError);
    return respond(500, { error: "Unable to find the student record." });
  }
  if (!student) {
    return respond(404, { error: "Student record was not found." });
  }

  if (student.owner_id) {
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      student.owner_id
    );
    if (deleteUserError) {
      console.error("Unable to delete student login.", deleteUserError);
      return respond(500, { error: "Unable to delete the student's login." });
    }
  }

  const { error: deleteRecordError } = await adminClient
    .from("portal_records")
    .delete()
    .eq("record_type", "students")
    .eq("record_id", studentId);
  if (deleteRecordError) {
    console.error(
      "Unable to delete student record after removing its login.",
      deleteRecordError
    );
    return respond(500, {
      error:
        "Student login was deleted, but the student record could not be removed. Retry the deletion.",
    });
  }

  return respond(200, { id: studentId });
});
