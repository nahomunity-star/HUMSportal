import announcements from "./announcments.js";
import scheduleData from "./schedule.js";
import students from "./students.js";
import teachers from "./teachers.js";

const DATABASE_DEFAULTS = {
  humsStudents: students,
  humsTeachers: teachers,
  humsClasses: [],
  humsAnnouncements: announcements,
  humsSchedule: scheduleData,
};

function shouldInitializeStorage(currentValue, defaultValue) {
  if (currentValue === null) {
    return true;
  }

  try {
    const parsed = JSON.parse(currentValue);

    if (Array.isArray(defaultValue) && Array.isArray(parsed)) {
      return parsed.length === 0 && defaultValue.length > 0;
    }

    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue) &&
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return Object.keys(parsed).length === 0 && Object.keys(defaultValue).length > 0;
    }
  } catch {
    return true;
  }

  return false;
}

export function initializeDatabase() {
  if (typeof window === "undefined") {
    return;
  }

  if (localStorage.getItem("humsStudent") !== null) {
    localStorage.removeItem("humsStudent");
  }

  Object.entries(DATABASE_DEFAULTS).forEach(([key, value]) => {
    const currentValue = localStorage.getItem(key);

    if (key === "humsStudents" || Array.isArray(value) && value.length === 0) {
      if (currentValue === null) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return;
    }

    if (
      key === "humsSchedule" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    ) {
      if (currentValue === null) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return;
    }

    if (shouldInitializeStorage(currentValue, value)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });
}

export default DATABASE_DEFAULTS;
