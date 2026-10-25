import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readAnnouncements, saveAnnouncements } from "../data/announcementsStore.js";
import { deletePortalRecord } from "../data/portalCloud.js";
import "./ManageAnnouncements.css";

const EMPTY_FORM = {
  title: "",
  message: "",
  type: "General",
  important: false,
  date: new Date().toISOString().slice(0, 10),
};

function loadAnnouncements() {
  try {
    return readAnnouncements();
  } catch (error) {
    console.error("Unable to load announcements.", error);
    return [];
  }
}

function ManageAnnouncements() {
  const [announcements, setAnnouncements] = useState(loadAnnouncements);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refreshAnnouncements = () => setAnnouncements(loadAnnouncements());
    window.addEventListener("focus", refreshAnnouncements);
    window.addEventListener("hums-announcements-updated", refreshAnnouncements);
    window.addEventListener("storage", refreshAnnouncements);
    return () => {
      window.removeEventListener("focus", refreshAnnouncements);
      window.removeEventListener(
        "hums-announcements-updated",
        refreshAnnouncements
      );
      window.removeEventListener("storage", refreshAnnouncements);
    };
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setMessage("");
  }

  function submitAnnouncement(event) {
    event.preventDefault();
    const savedAnnouncement = {
      ...form,
      title: form.title.trim(),
      message: form.message.trim(),
      id: editingId ?? `announcement-${Date.now()}`,
    };
    const updatedAnnouncements = editingId
      ? announcements.map((announcement) =>
          announcement.id === editingId ? savedAnnouncement : announcement
        )
      : [savedAnnouncement, ...announcements];

    try {
      saveAnnouncements(updatedAnnouncements);
      setAnnouncements(updatedAnnouncements);
      resetForm();
      setMessage(editingId ? "Announcement updated." : "Announcement published.");
    } catch (error) {
      console.error("Unable to save announcement.", error);
      setMessage("Could not save the announcement. Check browser storage space.");
    }
  }

  function editAnnouncement(announcement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title ?? "",
      message: announcement.message ?? "",
      type: announcement.type ?? "General",
      important: Boolean(announcement.important),
      date: announcement.date ?? new Date().toISOString().slice(0, 10),
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAnnouncement(id) {
    try {
      await deletePortalRecord("announcements", id);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("hums-cloud-error", {
          detail:
            error instanceof Error
              ? error.message
              : "Unable to delete announcement.",
        })
      );
      return;
    }

    const updatedAnnouncements = announcements.filter(
      (announcement) => announcement.id !== id
    );
    try {
      saveAnnouncements(updatedAnnouncements);
      setAnnouncements(updatedAnnouncements);
      if (editingId === id) {
        resetForm();
      }
      setMessage("Announcement deleted.");
    } catch (error) {
      console.error("Unable to delete announcement.", error);
      setMessage("Could not delete the announcement. Check browser storage space.");
    }
  }

  return (
    <main className="manage-announcements-page">
      <Link className="manage-announcements-back" to="/admin">
        ← Back to Dashboard
      </Link>
      <header className="manage-announcements-header">
        <p>SCHOOL ADMINISTRATION</p>
        <h1>Announcements</h1>
        <span>Publish updates for students and manage existing notices.</span>
      </header>

      <section className="manage-announcements-card">
        <h2>{editingId ? "Edit Announcement" : "Write an Announcement"}</h2>
        <form onSubmit={submitAnnouncement}>
          <div className="announcement-form-grid">
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label>
              Category
              <select
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value)}
              >
                <option>General</option>
                <option>Academic</option>
                <option>Event</option>
                <option>Schedule</option>
                <option>Examination</option>
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
                required
              />
            </label>
            <label className="announcement-important-option">
              <input
                type="checkbox"
                checked={form.important}
                onChange={(event) =>
                  updateForm("important", event.target.checked)
                }
              />
              Mark as important
            </label>
            <label className="announcement-message-field">
              Message
              <textarea
                value={form.message}
                onChange={(event) => updateForm("message", event.target.value)}
                rows={5}
                maxLength={2000}
                required
              />
            </label>
          </div>
          {message && (
            <p className="manage-announcements-message" role="status">
              {message}
            </p>
          )}
          <div className="announcement-form-actions">
            {editingId && (
              <button
                className="announcement-cancel"
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
            <button className="announcement-submit" type="submit">
              {editingId ? "Save Changes" : "Publish Announcement"}
            </button>
          </div>
        </form>
      </section>

      <section className="manage-announcements-card">
        <div className="manage-announcements-list-heading">
          <div>
            <h2>Published Announcements</h2>
            <p>{announcements.length} currently visible to students</p>
          </div>
        </div>
        {announcements.length === 0 ? (
          <p className="manage-announcements-empty">
            No announcements have been published yet.
          </p>
        ) : (
          <div className="manage-announcement-list">
            {announcements.map((announcement) => (
              <article className="manage-announcement-item" key={announcement.id}>
                <div>
                  <div className="manage-announcement-meta">
                    <span>{announcement.type || "General"}</span>
                    <span>{announcement.date}</span>
                    {announcement.important && (
                      <strong>Important</strong>
                    )}
                  </div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.message}</p>
                </div>
                <div className="manage-announcement-actions">
                  <button
                    type="button"
                    onClick={() => editAnnouncement(announcement)}
                  >
                    Edit
                  </button>
                  <button
                    className="manage-announcement-delete"
                    type="button"
                    onClick={() => deleteAnnouncement(announcement.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ManageAnnouncements;
