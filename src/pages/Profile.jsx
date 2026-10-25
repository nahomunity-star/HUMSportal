import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/sidebar.jsx";
import { readLoggedInStudent } from "../data/studentRecords.js";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [student] = useState(readLoggedInStudent);

  useEffect(() => {
    if (!student) {
      navigate("/");
    }
  }, [navigate, student]);

  if (!student) {
    return null;
  }

  return (
    <div className="portal-layout">
      <Sidebar />

      <main className="profile-page">
        <div className="profile-header">
          <p className="page-label">HUMS STUDENT PORTAL</p>
          <h1>My Profile</h1>
          <p>View your personal and academic information.</p>
        </div>

        <section className="profile-card">
          <div className="profile-top">
            {student.photo ? (
              <img
                src={student.photo}
                alt={student.name}
                className="profile-photo"
              />
            ) : (
              <div className="profile-photo" aria-label="No student photo">
                {student.name.charAt(0)}
              </div>
            )}

            <div className="profile-name">
              <h2>{student.name}</h2>
              <p>Student ID: {student.id}</p>

              <span className="student-badge">
                Grade {student.grade}
                {student.stream ? ` - ${student.stream}` : ""}
                {" - "}Section {student.section}
              </span>
            </div>
          </div>

          <div className="profile-section">
            <h3>Personal Information</h3>

            <div className="profile-grid">
              <div className="profile-item">
                <span>Student ID</span>
                <strong>{student.id}</strong>
              </div>

              <div className="profile-item">
                <span>Full Name</span>
                <strong>{student.name}</strong>
              </div>

              <div className="profile-item">
                <span>Gender</span>
                <strong>{student.gender || "—"}</strong>
              </div>

              <div className="profile-item">
                <span>Phone</span>
                <strong>{student.phone || "—"}</strong>
              </div>

              <div className="profile-item">
                <span>Date of Birth</span>
                <strong>{student.dateOfBirth || "—"}</strong>
              </div>

              <div className="profile-item">
                <span>Parent / Guardian</span>
                <strong>{student.parentName || "—"}</strong>
              </div>

              <div className="profile-item">
                <span>Parent Phone</span>
                <strong>{student.parentPhone || "—"}</strong>
              </div>

              <div className="profile-item">
                <span>Address</span>
                <strong>{student.address || "—"}</strong>
              </div>

              <div className="profile-item">
                <span>Grade</span>
                <strong>{student.grade}</strong>
              </div>

              {student.stream && (
                <div className="profile-item">
                  <span>Academic Stream</span>
                  <strong>{student.stream}</strong>
                </div>
              )}

              <div className="profile-item">
                <span>Section</span>
                <strong>{student.section}</strong>
              </div>

              <div className="profile-item">
                <span>Roll Number</span>
                <strong>{student.rollNumber || "—"}</strong>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3>Academic Overview</h3>

            <div className="academic-grid">
              <div className="academic-card">
                <span>AVG</span>
                <small>Average</small>
                <strong>{student.average ?? "—"}{student.average != null ? "%" : ""}</strong>
              </div>

              <div className="academic-card">
                <span>RANK</span>
                <small>Class Rank</small>
                <strong>
                  {student.rank == null ? "—" : `#${student.rank}`}
                </strong>
              </div>

              <div className="academic-card">
                <span>CLASS</span>
                <small>Total Students</small>
                <strong>{student.totalStudents ?? "—"}</strong>
              </div>

            </div>
          </div>

          <div className="profile-actions">
            <button onClick={() => navigate("/update-password")}>
              Change Password
            </button>

            <button onClick={() => navigate("/scores")}>
              View My Scores
            </button>

            <button onClick={() => navigate("/schedule")}>
              View My Schedule
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Profile;