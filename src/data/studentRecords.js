const STUDENT_KEY = "humsStudents";
const LEGACY_STUDENT_KEYS = [
  "students",
  "studentData",
  "schoolStudents",
];

export function readStudents() {
  const storageKey = [STUDENT_KEY, ...LEGACY_STUDENT_KEYS].find(
    (key) => localStorage.getItem(key) !== null
  );

  if (!storageKey) {
    return [];
  }

  try {
    const savedStudents = JSON.parse(localStorage.getItem(storageKey));
    if (!Array.isArray(savedStudents)) {
      return [];
    }

    const students = savedStudents;
    if (storageKey !== STUDENT_KEY) {
      localStorage.setItem(STUDENT_KEY, JSON.stringify(students));
    }

    return students;
  } catch (error) {
    console.error("Unable to read saved student records.", error);
    return [];
  }
}

export function readLoggedInStudent() {
  const savedLogin = localStorage.getItem("humsStudent");
  if (!savedLogin) {
    return null;
  }

  try {
    const login = JSON.parse(savedLogin);
    const student = readStudents().find(
      (student) =>
        String(student.id) === String(login.id) &&
        String(student.grade) === String(login.grade)
    );

    return student &&
      String(student.status ?? "Active").toLowerCase() === "active"
      ? student
      : null;
  } catch (error) {
    console.error("Unable to read the active student session.", error);
    return null;
  }
}
