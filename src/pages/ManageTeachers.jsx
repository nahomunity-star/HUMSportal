
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deletePortalRecord } from "../data/portalCloud.js";
import "./ManageTeachers.css";

const emptyTeacher = {
  teacherId: "",
  name: "",
  subject: "",
  gender: "",
  phone: "",
  email: "",
  assignedClass: "",
  photo: "",
};

export default function ManageTeachers() {
  const [teachers, setTeachers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("humsTeachers")) || [];
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState(emptyTeacher);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem("humsTeachers", JSON.stringify(teachers));
    window.dispatchEvent(new Event("hums-records-updated"));
  }, [teachers]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 512 * 1024) {
      alert("Please choose an image smaller than 512 KB so it can be stored with the teacher record.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setForm((previous) => ({
        ...previous,
        photo: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.teacherId.trim() ||
      !form.name.trim() ||
      !form.subject.trim()
    ) {
      alert("Teacher ID, name, and subject are required.");
      return;
    }

    const duplicate = teachers.some(
      (teacher) =>
        teacher.teacherId.toLowerCase() ===
          form.teacherId.trim().toLowerCase() &&
        teacher.id !== editingId
    );

    if (duplicate) {
      alert("This Teacher ID already exists.");
      return;
    }

    const teacherData = {
      ...form,
      teacherId: form.teacherId.trim(),
      name: form.name.trim(),
      subject: form.subject.trim(),
    };

    if (editingId !== null) {
      setTeachers((previous) =>
        previous.map((teacher) =>
          teacher.id === editingId
            ? { ...teacher, ...teacherData }
            : teacher
        )
      );
    } else {
      setTeachers((previous) => [
        ...previous,
        { ...teacherData, id: Date.now() },
      ]);
    }

    setForm(emptyTeacher);
    setEditingId(null);
    event.target.reset();
  }

  function editTeacher(teacher) {
    setForm({
      ...emptyTeacher,
      ...teacher,
    });
    setEditingId(teacher.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTeacher(id) {
    if (window.confirm("Are you sure you want to delete this teacher?")) {
      try {
        await deletePortalRecord("teachers", id);
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent("hums-cloud-error", {
            detail:
              error instanceof Error
                ? error.message
                : "Unable to delete teacher.",
          })
        );
        return;
      }
      setTeachers((previous) =>
        previous.filter((teacher) => teacher.id !== id)
      );

      if (editingId === id) {
        setForm(emptyTeacher);
        setEditingId(null);
      }
    }
  }

  const filteredTeachers = teachers.filter((teacher) =>
    [
      teacher.teacherId,
      teacher.name,
      teacher.subject,
      teacher.assignedClass,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="manage-teachers-page">
      <header className="manage-teachers-header">
        <div>
          <Link className="back-dashboard-link" to="/admin">
            ← Back to Dashboard
          </Link>
          <h1>Manage Teachers</h1>
          <p>Add, view, update, and manage school teachers.</p>
        </div>

        <div className="manage-teacher-count">
          <span>Total Teachers</span>
          <strong>{teachers.length}</strong>
        </div>
      </header>

      <section className="teacher-form-card">
        <h2>{editingId !== null ? "Edit Teacher" : "Add New Teacher"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="teacher-form-grid">
            <label>
              Teacher ID *
              <input
                name="teacherId"
                value={form.teacherId}
                onChange={handleChange}
                placeholder="e.g. TCH001"
                required
              />
            </label>

            <label>
              Full Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter full name"
                required
              />
            </label>

            <label>
              Subject *
              <input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="e.g. Mathematics"
                required
              />
            </label>

            <label>
              Gender
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>

            <label>
              Phone Number
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </label>

            <label>
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="teacher@example.com"
              />
            </label>

            <label>
              Assigned Class
              <input
                name="assignedClass"
                value={form.assignedClass}
                onChange={handleChange}
                placeholder="e.g. Grade 9A"
              />
            </label>

            <label>
              Teacher Photo
              <input
                type="file"
                accept="image/*"
                onChange={handlePhoto}
              />
            </label>
          </div>

          {form.photo && (
            <div className="teacher-photo-preview">
              <img src={form.photo} alt="Teacher preview" />
              <button
                type="button"
                className="remove-photo"
                onClick={() =>
                  setForm((previous) => ({ ...previous, photo: "" }))
                }
              >
                Remove photo
              </button>
            </div>
          )}

          <div className="teacher-form-actions">
            <button type="submit" className="teacher-save-btn">
              {editingId !== null ? "Update Teacher" : "Save Teacher"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                className="teacher-cancel-btn"
                onClick={() => {
                  setForm(emptyTeacher);
                  setEditingId(null);
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="teacher-list-card">
        <div className="teacher-list-header">
          <h2>Teacher Directory</h2>

          <input
            className="teacher-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teachers..."
          />
        </div>

        <div className="teacher-table-wrapper">
          <table className="teacher-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Teacher ID</th>
                <th>Name</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td>
                    {teacher.photo ? (
                      <img
                        className="teacher-avatar"
                        src={teacher.photo}
                        alt={teacher.name}
                      />
                    ) : (
                      <div className="teacher-avatar-placeholder">
                        {teacher.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td>{teacher.teacherId}</td>
                  <td>{teacher.name}</td>
                  <td>{teacher.subject}</td>
                  <td>{teacher.assignedClass || "—"}</td>
                  <td>{teacher.phone || "—"}</td>
                  <td className="teacher-actions">
                    <button
                      className="teacher-edit-btn"
                      onClick={() => editTeacher(teacher)}
                    >
                      Edit
                    </button>
                    <button
                      className="teacher-delete-btn"
                      onClick={() => deleteTeacher(teacher.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredTeachers.length === 0 && (
                <tr>
                  <td colSpan="7" className="teacher-empty">
                    No teachers found. Add a teacher using the form above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
