import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { readStudents } from "../data/studentRecords.js";
import {
  createPortalStudent,
  deletePortalRecord,
} from "../data/portalCloud.js";
import "./ManageStudents.css";

function ManageStudents() {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [students, setStudents] = useState(() => {
    try {
      return readStudents();
    } catch (error) {
      console.error("Unable to load saved student records.", error);
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All Grades");
  const [formData, setFormData] = useState({
    id: "",
    password: "",
    name: "",
    grade: "9",
    stream: "",
    section: "A",
    gender: "",
    phone: "",
    status: "Active",
    dateOfBirth: "",
    parentName: "",
    parentPhone: "",
    address: "",
  });

  useEffect(() => {
    localStorage.setItem("humsStudents", JSON.stringify(students));
    window.dispatchEvent(new Event("hums-records-updated"));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    return students.filter((student) => {
      const matchesGrade =
        selectedGrade === "All Grades" || `Grade ${student.grade}` === selectedGrade;
      const matchesSearch =
        !normalizedSearch ||
        `${student.id} ${student.name}`.toLowerCase().includes(normalizedSearch);

      return matchesGrade && matchesSearch;
    });
  }, [searchTerm, selectedGrade, students]);

  const openForm = () => {
    setFormError("");
    setFormData({
      id: "",
      password: "",
      name: "",
      grade: "9",
      stream: "",
      section: "A",
      gender: "",
      phone: "",
      status: "Active",
      dateOfBirth: "",
      parentName: "",
      parentPhone: "",
      address: "",
    });
    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === "grade" ? { stream: "" } : {}),
    }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 512 * 1024) {
      alert("Please choose an image smaller than 512 KB so it can be stored with the student record.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        alert("Unable to read the selected photo.");
        return;
      }
      setFormData((current) => ({ ...current, photo: reader.result }));
    };
    reader.onerror = () => alert("Unable to read the selected photo.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const studentId = formData.id.trim();

    if (
      students.some(
        (student) =>
          String(student.id).trim().toLowerCase() ===
          studentId.toLowerCase()
      )
    ) {
      alert("This Student ID already exists.");
      return;
    }

    const student = {
      ...formData,
      id: studentId,
      name: formData.name.trim(),
      grade: String(formData.grade),
      scores: [],
    };
    setSaving(true);
    setFormError("");
    try {
      await createPortalStudent(student);
      setStudents((current) => [...current, { ...student, password: "" }]);
      setFormData((current) => ({ ...current, password: "" }));
      setShowForm(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create the student account.";
      setFormError(message);
      window.dispatchEvent(
        new CustomEvent("hums-cloud-error", { detail: message })
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (studentId) => {
    try {
      await deletePortalRecord("students", studentId);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("hums-cloud-error", {
          detail:
            error instanceof Error ? error.message : "Unable to delete student.",
        })
      );
      return;
    }
    setStudents((current) => current.filter((student) => student.id !== studentId));
    if (selectedStudent?.id === studentId) {
      setSelectedStudent(null);
    }
  };

  return (
    <div className="students-page">

      <div className="students-header">
        <div>
          <Link className="back-dashboard-link" to="/admin">
            ← Back to Dashboard
          </Link>
          <h1>Students</h1>
          <p>Manage student information</p>
        </div>

        <button
          className="add-student-btn"
          onClick={openForm}
        >
          + Add Student
        </button>
      </div>

      <div className="students-tools">
        <input
          type="text"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          value={selectedGrade}
          onChange={(event) => setSelectedGrade(event.target.value)}
        >
          <option>All Grades</option>
          {["9", "10", "11", "12"].map((grade) => (
            <option key={grade}>Grade {grade}</option>
          ))}
        </select>
      </div>

      <div className="students-table">

        <div className="student-table-header">
          <span>Photo</span>
          <span>Student ID</span>
          <span>Name</span>
          <span>Grade</span>
          <span>Class</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {filteredStudents.map((student) => (
          <div className="student-table-row" key={student.id}>
            <span className="student-avatar">{student.name.charAt(0)}</span>
            <span>{student.id}</span>
            <button
              type="button"
              className="student-name-button"
              onClick={() => setSelectedStudent(student)}
              aria-label={`View details for ${student.name}`}
            >
              {student.name}
            </button>
            <span>
              Grade {student.grade}
              {student.stream ? ` · ${student.stream}` : ""}
            </span>
            <span>{student.section}</span>
            <span className="student-status">{student.status || "Active"}</span>
            <div className="student-row-actions">
              <button
                type="button"
                className="student-details-btn"
                onClick={() => setSelectedStudent(student)}
              >
                See Details
              </button>
              <button
                type="button"
                className="delete-student-btn"
                onClick={() => deleteStudent(student.id)}
                aria-label={`Delete ${student.name}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {filteredStudents.length === 0 && (
          <div className="empty-students">
            <h2>No students found</h2>
            <p>Try another search or add a new student.</p>
          </div>
        )}

      </div>

      {selectedStudent && (
        <div
          className="form-overlay student-details-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedStudent(null);
            }
          }}
        >
          <section
            className="student-form student-details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-details-title"
          >
            <div className="form-header">
              <div>
                <h2 id="student-details-title">Student Details</h2>
                <p>{selectedStudent.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                aria-label="Close student details"
              >
                ×
              </button>
            </div>

            {selectedStudent.photo && (
              <img
                className="student-details-photo"
                src={selectedStudent.photo}
                alt={`${selectedStudent.name} profile`}
              />
            )}

            <dl className="student-details-grid">
              <div><dt>Student ID</dt><dd>{selectedStudent.id || "—"}</dd></div>
              <div><dt>Password</dt><dd>Stored securely and never displayed</dd></div>
              <div><dt>Full Name</dt><dd>{selectedStudent.name || "—"}</dd></div>
              <div><dt>Grade</dt><dd>Grade {selectedStudent.grade || "—"}</dd></div>
              {selectedStudent.stream && (
                <div><dt>Stream</dt><dd>{selectedStudent.stream}</dd></div>
              )}
              <div><dt>Class / Section</dt><dd>{selectedStudent.section || "—"}</dd></div>
              <div><dt>Gender</dt><dd>{selectedStudent.gender || "—"}</dd></div>
              <div><dt>Date of Birth</dt><dd>{selectedStudent.dateOfBirth || "—"}</dd></div>
              <div><dt>Student Phone</dt><dd>{selectedStudent.phone || "—"}</dd></div>
              <div><dt>Parent / Guardian</dt><dd>{selectedStudent.parentName || "—"}</dd></div>
              <div><dt>Parent Phone</dt><dd>{selectedStudent.parentPhone || "—"}</dd></div>
              <div><dt>Address</dt><dd>{selectedStudent.address || "—"}</dd></div>
              <div><dt>Status</dt><dd>{selectedStudent.status || "Active"}</dd></div>
              <div><dt>Average</dt><dd>{selectedStudent.average ?? "—"}</dd></div>
            </dl>

            <div className="student-details-results">
              <h3>Academic Results</h3>
              {(selectedStudent.scores ?? []).length > 0 ? (
                <ul>
                  {selectedStudent.scores.map((score) => (
                    <li key={score.subject}>
                      <span>{score.subject}</span>
                      <strong>{score.score}{score.max ? ` / ${score.max}` : ""}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No academic results have been recorded.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {showForm && (
        <div className="form-overlay">

          <div className="student-form">

            <div className="form-header">
              <h2>Add New Student</h2>

              <button
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>

              {formError && (
                <p className="auth-message auth-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="photo-upload">
                <div className="photo-placeholder">
                  {formData.photo ? (
                    <img src={formData.photo} alt="Student preview" />
                  ) : (
                    "Photo"
                  )}
                </div>

                <label>
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>

              <div className="form-grid">

                <div>
                  <label>Student ID</label>
                  <input
                    name="id"
                    type="text"
                    placeholder="e.g. HUMS-001"
                    value={formData.id}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Full Name</label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Initial Password</label>
                  <input
                    name="password"
                    type="password"
                    placeholder="Set the student's password"
                    minLength={8}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Date of Birth</label>
                  <input
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} required>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>

                <div>
                  <label>Grade</label>
                  <select
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                    required
                  >
                    {["9", "10", "11", "12"].map((grade) => (
                      <option key={grade} value={grade}>
                        Grade {grade}
                      </option>
                    ))}
                  </select>
                </div>

                {["11", "12"].includes(String(formData.grade)) && (
                  <div>
                    <label>Stream</label>
                    <select
                      name="stream"
                      value={formData.stream}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select stream</option>
                      <option value="Natural">Natural</option>
                      <option value="Social">Social</option>
                    </select>
                  </div>
                )}

                <div>
                  <label>Class</label>
                  <input
                    name="section"
                    type="text"
                    placeholder="e.g. 10A"
                    value={formData.section}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Parent / Guardian</label>
                  <input
                    name="parentName"
                    type="text"
                    placeholder="Parent name"
                    value={formData.parentName}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Student Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    placeholder="Phone number"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Parent Phone</label>
                  <input
                    name="parentPhone"
                    type="tel"
                    placeholder="Parent phone number"
                    value={formData.parentPhone}
                    onChange={handleChange}
                  />
                </div>

                <div className="full-width">
                  <label>Address</label>
                  <input
                    name="address"
                    type="text"
                    placeholder="Student address"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>

              </div>

              <div className="form-buttons">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-btn"
                  disabled={saving}
                >
                  {saving ? "Creating account…" : "Save Student"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default ManageStudents;