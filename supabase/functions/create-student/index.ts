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
      error: "Student account provisioning is not configured.",
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

  let payload: { student?: Record<string, unknown> };
  try {
    payload = await request.json();
  } catch {
    return respond(400, { error: "Request body must be valid JSON." });
  }

  const student = payload.student;
  const studentId = String(student?.id ?? "").trim();
  const password = String(student?.password ?? "");
  const name = String(student?.name ?? "").trim();
  const grade = String(student?.grade ?? "").trim();
  if (
    studentId.length > 64 ||
    !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(studentId)
  ) {
    return respond(400, {
      error:
        "Student ID must use letters, numbers, underscores, or hyphens; dots cannot be consecutive or at either end.",
    });
  }
  if (password.length < 8) {
    return respond(400, {
      error: "Student password must be at least 8 characters.",
    });
  }
  if (!name || !["9", "10", "11", "12"].includes(grade)) {
    return respond(400, {
      error: "Student name and a valid grade are required.",
    });
  }

  const { data: existingRows, error: existingError } = await adminClient
    .from("portal_records")
    .select("record_id")
    .eq("record_type", "students");
  if (existingError) {
    console.error("Unable to check for an existing student.", existingError);
    return respond(500, {
      error: "Unable to check whether this student ID is already registered.",
    });
  }
  if (
    existingRows?.some(
      (row) => row.record_id.toLowerCase() === studentId.toLowerCase()
    )
  ) {
    return respond(409, {
      error: "This student ID already exists in the shared database.",
    });
  }

  const email = `student-${studentId.toLowerCase()}@students.hums.invalid`;
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "student", student_id: studentId },
    });
  if (createError || !created.user) {
    console.error("Unable to create student login.", createError);
    return respond(400, {
      error: createError?.message ?? "Unable to create student login.",
    });
  }

  const { password: _password, ...safeStudent } = student;
  const { error: insertError } = await adminClient
    .from("portal_records")
    .insert({
      record_type: "students",
      record_id: studentId,
      owner_id: created.user.id,
      grade,
      stream: String(student?.stream ?? ""),
      data: { ...safeStudent, id: studentId },
    });
  if (insertError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(
      created.user.id
    );
    if (cleanupError) {
      console.error(
        "Unable to roll back student auth user after a record insert failure.",
        cleanupError
      );
    }
    console.error("Unable to save student record.", insertError);
    return respond(500, {
      error:
        "Student account was created but the student record could not be saved.",
    });
  }

  return respond(201, { id: studentId, userId: created.user.id });
});
