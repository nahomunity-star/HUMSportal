import { getSupabase } from "./supabaseClient.js";

const RECORD_TYPES = ["students", "teachers", "classes", "announcements"];
const STORAGE_KEYS = {
  students: "humsStudents",
  teachers: "humsTeachers",
  classes: "humsClasses",
  announcements: "humsAnnouncements",
  schedules: "humsSchedule",
};

function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    throw new Error(`Unable to read local records from ${key}.`, {
      cause: error,
    });
  }
}

function withoutPassword(record) {
  const { password: _password, ...safeRecord } = record;
  return safeRecord;
}

function scheduleRows(schedule) {
  const rows = [];
  for (const [grade, value] of Object.entries(schedule ?? {})) {
    const isStreamGrade = ["11", "12"].includes(String(grade));
    const streams = isStreamGrade ? Object.entries(value ?? {}) : [["", value]];
    for (const [stream, days] of streams) {
      for (const [day, lessons] of Object.entries(days ?? {})) {
        if (!Array.isArray(lessons)) {
          continue;
        }
        rows.push({
          record_type: "schedules",
          record_id: `${grade}|${stream}|${day}`,
          grade: String(grade),
          stream: String(stream),
          day,
          data: { grade: String(grade), stream: String(stream), day, lessons },
        });
      }
    }
  }
  return rows;
}

function toScheduleData(rows) {
  const schedule = {};
  rows.forEach((row) => {
    const { grade, stream, day, lessons } = row.data;
    if (!grade || !day || !Array.isArray(lessons)) {
      return;
    }
    if (["11", "12"].includes(String(grade))) {
      schedule[grade] ??= {};
      schedule[grade][stream || "Natural"] ??= {};
      schedule[grade][stream || "Natural"][day] = lessons;
    } else {
      schedule[grade] ??= {};
      schedule[grade][day] = lessons;
    }
  });
  return schedule;
}

function notifyCloudHydration() {
  const detail = { remote: true };
  window.dispatchEvent(new CustomEvent("hums-records-updated", { detail }));
  window.dispatchEvent(new CustomEvent("hums-announcements-updated", { detail }));
  window.dispatchEvent(new CustomEvent("hums-schedule-updated", { detail }));
}

function notifyCloudSync() {
  window.dispatchEvent(new Event("hums-cloud-synced"));
}

export async function checkPortalAdmin() {
  const { data, error } = await getSupabase().rpc("is_portal_admin");
  if (error) {
    throw new Error(`Unable to verify admin access: ${error.message}`);
  }
  return data === true;
}

export async function loadPortalData() {
  const { data, error } = await getSupabase()
    .from("portal_records")
    .select("record_type, record_id, owner_id, grade, stream, day, data")
    .order("record_id");
  if (error) {
    throw new Error(`Unable to load shared school records: ${error.message}`);
  }

  const rows = data ?? [];
  for (const type of RECORD_TYPES) {
    const records = rows
      .filter((row) => row.record_type === type)
      .map((row) => ({
        ...row.data,
        id: row.record_id,
        ...(type === "students" ? { password: "" } : {}),
      }));
    localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(records));
  }
  localStorage.setItem(
    STORAGE_KEYS.schedules,
    JSON.stringify(
      toScheduleData(rows.filter((row) => row.record_type === "schedules"))
    )
  );
  notifyCloudHydration();
  return rows;
}

async function createStudentAccount(student) {
  const { data, error } = await getSupabase().functions.invoke(
    "create-student",
    { body: { student } }
  );
  if (error) {
    throw new Error(
      `Unable to create student login for ${student.id}: ${error.message}`
    );
  }
  if (!data?.id) {
    throw new Error(
      `Student login for ${student.id} was not confirmed by the database.`
    );
  }
  return data;
}

async function upsertRecords(type, records, existingRows) {
  const existingById = new Map(
    existingRows
      .filter((row) => row.record_type === type)
      .map((row) => [String(row.record_id).toLowerCase(), row])
  );

  const rows = [];
  for (const record of records) {
    const recordId = String(
      record.record_id ?? record.id ?? record.teacherId ?? ""
    ).trim();
    if (!recordId) {
      throw new Error(`A ${type.slice(0, -1)} record is missing its ID.`);
    }
    let existing = existingById.get(recordId.toLowerCase());

    if (type === "students" && !existing) {
      const password = String(record.password ?? "");
      if (password.length < 8) {
        throw new Error(
          `Student ${recordId} needs an initial password of at least 8 characters before it can be shared.`
        );
      }
      await createStudentAccount(record);
      const { data: createdRow, error: fetchError } = await getSupabase()
        .from("portal_records")
        .select("record_type, record_id, owner_id")
        .eq("record_type", "students")
        .eq("record_id", recordId)
        .single();
      if (fetchError) {
        throw new Error(
          `Student account was created, but its shared record could not be loaded: ${fetchError.message}`
        );
      }
      existing = createdRow;
      existingById.set(recordId.toLowerCase(), createdRow);
      record.password = "";
    }

    const safeData = withoutPassword(record);
    rows.push({
      record_type: type,
      record_id: recordId,
      owner_id: existing?.owner_id ?? null,
      grade:
        type === "students" || type === "schedules"
          ? String(record.grade ?? "")
          : null,
      stream:
        type === "students" || type === "schedules"
          ? String(record.stream ?? "")
          : null,
      day: type === "schedules" ? String(record.day ?? "") : null,
      data: safeData,
    });
  }

  if (!rows.length) {
    return;
  }
  const { error } = await getSupabase()
    .from("portal_records")
    .upsert(rows, { onConflict: "record_type,record_id" });
  if (error) {
    throw new Error(`Unable to save shared ${type} records: ${error.message}`);
  }
}

export async function createPortalStudent(student) {
  if (!(await checkPortalAdmin())) {
    throw new Error("Administrator access is required to create student accounts.");
  }
  return createStudentAccount(student);
}

export async function syncLocalPortalData() {
  if (!(await checkPortalAdmin())) {
    throw new Error("Administrator access is required to publish school records.");
  }

  const { data: existingRows, error } = await getSupabase()
    .from("portal_records")
    .select("record_type, record_id, owner_id");
  if (error) {
    throw new Error(`Unable to check the shared records: ${error.message}`);
  }

  for (const type of RECORD_TYPES) {
    await upsertRecords(type, readLocalArray(STORAGE_KEYS[type]), existingRows ?? []);
  }
  const scheduleData = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.schedules) ?? "{}"
  );
  await upsertRecords(
    "schedules",
    scheduleRows(scheduleData),
    existingRows ?? []
  );
  await loadPortalData();
  localStorage.removeItem("humsImportIncomplete");
  notifyCloudSync();
}

export async function deletePortalRecord(type, id) {
  if (type === "students") {
    const { error } = await getSupabase().functions.invoke("delete-student", {
      body: { studentId: String(id) },
    });
    if (error) {
      throw new Error(`Unable to delete shared student ${id}: ${error.message}`);
    }
    return;
  }

  const { error } = await getSupabase()
    .from("portal_records")
    .delete()
    .eq("record_type", type)
    .eq("record_id", String(id));
  if (error) {
    throw new Error(`Unable to delete shared ${type} record: ${error.message}`);
  }
}

export async function clearPortalCache() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem("humsStudent");
}

export function hasLocalPortalRecords() {
  const hasRecords = [
    "humsStudents",
    "humsTeachers",
    "humsClasses",
    "humsAnnouncements",
  ].some((key) => readLocalArray(key).length > 0);
  if (hasRecords) return true;
  try {
    return Object.keys(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.schedules) ?? "{}")
    ).length > 0;
  } catch (error) {
    throw new Error("Unable to check local schedule records for import.", {
      cause: error,
    });
  }
}
