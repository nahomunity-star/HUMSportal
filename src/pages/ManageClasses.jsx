
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readStudents } from "../data/studentRecords.js";
import { deletePortalRecord } from "../data/portalCloud.js";
import "./ManageClasses.css";

const CLASS_KEY = "humsClasses";
const TEACHER_KEY = "humsTeachers";
const emptyForm = {
  className: "",
  grade: "9",
  stream: "",
  section: "A",
  academicYear: "2026/2027",
  teacherId: "",
};

function generatedClassName(grade, section, stream) {
  return `Grade ${grade}${stream ? ` ${stream}` : ""}${section}`;
}

function readStorage(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function getStudentName(student) {
  return (
    student.name ||
    student.fullName ||
    [student.firstName, student.lastName].filter(Boolean).join(" ") ||
    "Unnamed student"
  );
}

function getStudentId(student) {
  return String(
    student.id ?? student.studentId ?? student.admissionNumber ?? ""
  );
}

function getStudentGrade(student) {
  return String(
    student.grade ?? student.gradeLevel ?? student.classGrade ?? ""
  ).replace(/^grade\s*/i, "").trim();
}

function getStudentSection(student) {
  return String(student.section ?? student.classSection ?? "").trim();
}

export default function ManageClasses() {
  const [classes, setClasses] = useState(() =>
    readStorage(CLASS_KEY)
  );
  const [teachers, setTeachers] = useState(() =>
    readStorage(TEACHER_KEY)
  );
  const [students, setStudents] = useState(() =>
    readStudents()
  );

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [search, setSearch] = useState("");
  const [studentToAssign, setStudentToAssign] = useState("");

  useEffect(() => {
    localStorage.setItem(CLASS_KEY, JSON.stringify(classes));
    window.dispatchEvent(new Event("hums-records-updated"));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(TEACHER_KEY, JSON.stringify(teachers));
    window.dispatchEvent(new Event("hums-records-updated"));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem("humsStudents", JSON.stringify(students));
    window.dispatchEvent(new Event("hums-records-updated"));
  }, [students]);

  useEffect(() => {
    function refreshRecords() {
      setTeachers(readStorage(TEACHER_KEY));
      setStudents(readStudents());
    }

    window.addEventListener("focus", refreshRecords);
    return () => window.removeEventListener("focus", refreshRecords);
  }, []);

  const selectedClass = classes.find(
    (item) => String(item.id) === String(selectedClassId)
  );

  function getTeacher(teacherId) {
    return teachers.find(
      (teacher) => String(teacher.id) === String(teacherId)
    );
  }

  function getClassStudents(classItem) {
    return students.filter((student) => {
      if (
        String(student.classId ?? "") === String(classItem.id)
      ) {
        return true;
      }

      const studentGrade = getStudentGrade(student);
      const studentSection = getStudentSection(student);

      const sameGrade =
        studentGrade === String(classItem.grade);
      const sameStream =
        !["11", "12"].includes(String(classItem.grade)) ||
        !classItem.stream ||
        student.stream === classItem.stream;

      const sameSection =
        studentSection.toLowerCase() ===
        String(classItem.section).toLowerCase();

      const existingClassName = String(
        student.className ?? student.class ?? ""
      ).trim();

      const sameClassName =
        existingClassName.toLowerCase() ===
        String(classItem.className).toLowerCase();

      return sameGrade && sameStream && (sameSection || sameClassName);
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "grade"
        ? {
            stream: "",
            className: generatedClassName(value, previous.section, ""),
          }
        : {}),
      ...(name === "section"
        ? {
            className: generatedClassName(
              previous.grade,
              value,
              previous.stream
            ),
          }
        : {}),
      ...(name === "stream"
        ? {
            className: generatedClassName(
              previous.grade,
              previous.section,
              value
            ),
          }
        : {}),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const className = form.className.trim();
    const grade = String(form.grade);
    const section = form.section.trim();
    const stream = ["11", "12"].includes(grade) ? form.stream : "";

    if (
      !className ||
      !["9", "10", "11", "12"].includes(grade) ||
      !section ||
      (["11", "12"].includes(grade) && !stream)
    ) {
      alert("Enter a valid class in Grades 9–12.");
      return;
    }

    const duplicate = classes.some(
      (item) =>
        item.className.toLowerCase() === className.toLowerCase() &&
        String(item.id) !== String(editingId)
    );

    if (duplicate) {
      alert("This class already exists.");
      return;
    }

    const classData = {
      ...form,
      className,
      grade,
      stream,
      section,
      teacherId: form.teacherId || "",
    };

    if (editingId !== null) {
      setClasses((previous) =>
        previous.map((item) =>
          String(item.id) === String(editingId)
            ? { ...item, ...classData }
            : item
        )
      );
    } else {
      setClasses((previous) => [
        ...previous,
        { ...classData, id: Date.now() },
      ]);
    }

    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(classItem) {
    setForm({
      ...emptyForm,
      ...classItem,
      grade: String(classItem.grade),
      stream: classItem.stream || "",
      section: String(classItem.section),
      teacherId: String(classItem.teacherId || ""),
    });
    setEditingId(classItem.id);
    setSelectedClassId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteClass(classItem) {
    const assignedStudents = getClassStudents(classItem);

    const message =
      assignedStudents.length > 0
        ? `${classItem.className} has ${assignedStudents.length} student(s). Delete the class? Their student records will not be deleted.`
        : `Delete ${classItem.className}?`;

    if (!window.confirm(message)) return;

    try {
      await deletePortalRecord("classes", classItem.id);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("hums-cloud-error", {
          detail:
            error instanceof Error ? error.message : "Unable to delete class.",
        })
      );
      return;
    }

    setClasses((previous) =>
      previous.filter(
        (item) => String(item.id) !== String(classItem.id)
      )
    );

    if (String(selectedClassId) === String(classItem.id)) {
      setSelectedClassId(null);
    }

    if (String(editingId) === String(classItem.id)) {
      setEditingId(null);
      setForm(emptyForm);
    }
  }

  function assignStudent() {
    if (!selectedClass || !studentToAssign) return;

    const studentExists = students.some(
      (student) => getStudentId(student) === String(studentToAssign)
    );

    if (!studentExists) {
      alert("Student not found. Refresh and try again.");
      return;
    }

    setStudents((previous) =>
      previous.map((student) =>
        getStudentId(student) === String(studentToAssign)
          ? {
              ...student,
              classId: selectedClass.id,
              className: selectedClass.className,
              grade: selectedClass.grade,
              stream: selectedClass.stream || "",
              section: selectedClass.section,
            }
          : student
      )
    );

    setStudentToAssign("");
  }

  const filteredClasses = classes.filter((item) =>
    [
      item.className,
      item.grade,
      item.stream,
      item.section,
      item.academicYear,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selectedStudents = selectedClass
    ? getClassStudents(selectedClass)
    : [];

  const availableStudents = students.filter((student) => {
    const assignedToClass = classes.some((classItem) =>
      getClassStudents(classItem).some(
        (assignedStudent) =>
          getStudentId(assignedStudent) === getStudentId(student)
      )
    );

    return (
      !assignedToClass &&
      getStudentId(student) !== "" &&
      (!getStudentGrade(student) ||
        getStudentGrade(student) === String(selectedClass?.grade)) &&
      (!["11", "12"].includes(String(selectedClass?.grade)) ||
        student.stream === selectedClass?.stream)
    );
  });

  if (selectedClass) {
    const teacher = getTeacher(selectedClass.teacherId);

    return (
      <main className="cm-page">
        <button
          className="cm-back"
          onClick={() => {
            setSelectedClassId(null);
            setStudentToAssign("");
          }}
        >
          ← Back to Classes
        </button>

        <header className="cm-header cm-detail-header">
          <div>
            <p className="cm-eyebrow">CLASS MANAGEMENT</p>
            <h1>{selectedClass.className}</h1>
            <p>
              Grade {selectedClass.grade} · Section{" "}
              {selectedClass.section}
              {selectedClass.stream ? ` · ${selectedClass.stream}` : ""} ·{" "}
              {selectedClass.academicYear || "Academic year not set"}
            </p>
          </div>

          <button
            className="cm-primary"
            onClick={() => startEdit(selectedClass)}
          >
            Edit Class
          </button>
        </header>

        <section className="cm-stats">
          <article className="cm-stat">
            <span>Grade</span>
            <strong>{selectedClass.grade}</strong>
          </article>
          <article className="cm-stat">
            <span>Enrolled Students</span>
            <strong>{selectedStudents.length}</strong>
          </article>
          <article className="cm-stat">
            <span>Class Teacher</span>
            <strong className="cm-stat-name">
              {teacher?.name || "Not assigned"}
            </strong>
          </article>
        </section>

        <section className="cm-card">
          <div className="cm-card-heading">
            <div>
              <h2>Class Information</h2>
              <p>Academic and teacher assignment details.</p>
            </div>
          </div>

          <div className="cm-info-grid">
            <div>
              <span>Class Name</span>
              <strong>{selectedClass.className}</strong>
            </div>
            <div>
              <span>Academic Year</span>
              <strong>{selectedClass.academicYear || "—"}</strong>
            </div>
            <div>
              <span>Assigned Teacher</span>
              <strong>{teacher?.name || "Not assigned"}</strong>
            </div>
            <div>
              <span>Teacher's Subject</span>
              <strong>{teacher?.subject || "—"}</strong>
            </div>
            <div>
              <span>Teacher's Phone</span>
              <strong>{teacher?.phone || "—"}</strong>
            </div>
            <div>
              <span>Teacher's Email</span>
              <strong>{teacher?.email || "—"}</strong>
            </div>
          </div>
        </section>

        <section className="cm-card">
          <div className="cm-card-heading">
            <div>
              <h2>Student Roster</h2>
              <p>Students currently assigned to this class.</p>
            </div>
          </div>

          <div className="cm-assign-row">
            <select
              value={studentToAssign}
              onChange={(event) =>
                setStudentToAssign(event.target.value)
              }
            >
              <option value="">Select a student to assign</option>
              {availableStudents.map((student) => (
                <option
                  key={getStudentId(student)}
                  value={getStudentId(student)}
                >
                  {getStudentName(student)} · {getStudentId(student)}
                </option>
              ))}
            </select>

            <button
              className="cm-primary"
              onClick={assignStudent}
              disabled={!studentToAssign}
            >
              Assign Student
            </button>
          </div>

          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Student Name</th>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedStudents.map((student) => (
                  <tr key={getStudentId(student)}>
                    <td>{getStudentId(student)}</td>
                    <td>{getStudentName(student)}</td>
                    <td>Grade {getStudentGrade(student) || selectedClass.grade}</td>
                    <td>{getStudentSection(student) || selectedClass.section}</td>
                    <td>
                      <button
                        className="cm-text-danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${getStudentName(student)} from this class?`
                            )
                          ) {
                            setStudents((previous) =>
                              previous.map((item) =>
                                getStudentId(item) === getStudentId(student)
                                  ? {
                                      ...item,
                                      classId: "",
                                      className: "",
                                      section: "",
                                    }
                                  : item
                              )
                            );
                          }
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                {selectedStudents.length === 0 && (
                  <tr>
                    <td colSpan="5" className="cm-empty">
                      No students are assigned to this class yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cm-page">
      <Link className="cm-dashboard-link" to="/admin">
        ← Back to Dashboard
      </Link>

      <header className="cm-header">
        <div>
          <p className="cm-eyebrow">SCHOOL ADMINISTRATION</p>
          <h1>Class Management</h1>
          <p>Manage classes, class teachers, and student rosters.</p>
        </div>

        <div className="cm-total">
          <span>Total Classes</span>
          <strong>{classes.length}</strong>
        </div>
      </header>

      <section className="cm-card">
        <div className="cm-card-heading">
          <div>
            <h2>{editingId !== null ? "Edit Class" : "Create Class"}</h2>
            <p>Only Grades 9 through 12 are available.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="cm-form-grid">
            <label>
              Grade
              <select
                name="grade"
                value={form.grade}
                onChange={handleChange}
                required
              >
                {["9", "10", "11", "12"].map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </label>

            {["11", "12"].includes(String(form.grade)) && (
              <label>
                Stream
                <select
                  name="stream"
                  value={form.stream}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select stream</option>
                  <option value="Natural">Natural</option>
                  <option value="Social">Social</option>
                </select>
              </label>
            )}

            <label>
              Section
              <input
                name="section"
                value={form.section}
                onChange={handleChange}
                placeholder="A"
                required
              />
            </label>

            <label>
              Class Name
              <input
                name="className"
                value={form.className}
                onChange={handleChange}
                placeholder={
                  ["11", "12"].includes(String(form.grade))
                    ? `Grade ${form.grade} ${form.stream || "Natural"}A`
                    : `Grade ${form.grade}A`
                }
                required
              />
            </label>

            <label>
              Academic Year
              <input
                name="academicYear"
                value={form.academicYear}
                onChange={handleChange}
                placeholder="2026/2027"
              />
            </label>

            <label className="cm-full">
              Assigned Class Teacher
              <select
                name="teacherId"
                value={form.teacherId}
                onChange={handleChange}
              >
                <option value="">Not assigned</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={String(teacher.id)}>
                    {teacher.name} — {teacher.subject || "No subject"}
                  </option>
                ))}
              </select>
              {teachers.length === 0 && (
                <small>
                  No teachers found. Add teachers in the Teachers section first.
                </small>
              )}
            </label>
          </div>

          <div className="cm-form-actions">
            <button className="cm-primary" type="submit">
              {editingId !== null ? "Save Changes" : "Create Class"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="cm-secondary"
                onClick={() => {
                  setForm(emptyForm);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="cm-card">
        <div className="cm-card-heading cm-list-heading">
          <div>
            <h2>Classes</h2>
            <p>Select a class to view its information and roster.</p>
          </div>

          <input
            className="cm-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classes..."
          />
        </div>

        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Academic Year</th>
                <th>Class Teacher</th>
                <th>Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((item) => {
                const teacher = getTeacher(item.teacherId);

                return (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="cm-class-link"
                        onClick={() => setSelectedClassId(item.id)}
                      >
                        {item.className}
                      </button>
                      <span className="cm-subtext">
                        Grade {item.grade}
                        {item.stream ? ` · ${item.stream}` : ""}
                        {` · Section ${item.section}`}
                      </span>
                    </td>
                    <td>{item.academicYear || "—"}</td>
                    <td>{teacher?.name || "Not assigned"}</td>
                    <td>{getClassStudents(item).length}</td>
                    <td>
                      <div className="cm-row-actions">
                        <button
                          className="cm-action"
                          onClick={() => setSelectedClassId(item.id)}
                        >
                          View
                        </button>
                        <button
                          className="cm-action"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="cm-text-danger"
                          onClick={() => deleteClass(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredClasses.length === 0 && (
                <tr>
                  <td colSpan="5" className="cm-empty">
                    No classes found. Create a Grade 9–12 class above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
