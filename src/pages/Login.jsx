import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearPortalCache, loadPortalData } from "../data/portalCloud.js";
import { getSupabase, studentLoginEmail } from "../data/supabaseClient.js";
import "./Login.css";

function Login() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState("9");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: studentLoginEmail(studentId),
        password,
      });
      if (signInError) {
        throw new Error(
          "Invalid Student ID or password, or this account is inactive."
        );
      }
      const rows = await loadPortalData();
      const student = rows.find((row) => row.record_type === "students");
      if (!student || String(student.grade) !== grade) {
        await getSupabase().auth.signOut();
        await clearPortalCache();
        throw new Error(
          student
            ? "The selected grade does not match this student account."
            : "This student account is inactive or not set up. Ask the school administrator for help."
        );
      }
      localStorage.setItem(
        "humsStudent",
        JSON.stringify({ id: student.record_id, grade: String(student.grade) })
      );
      navigate("/dashboard");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Check the shared database setup and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">

      <div className="login-background"></div>

      <div className="login-container">

        <div className="school-brand">

          <div className="school-logo">
            <img
              src="/hums-logo.jpg"
              alt="Haramaya University Model School Students Union"
            />
          </div>

          <h1>HUMS</h1>

          <p>
            Haramaya University Model School
          </p>

          <span>
            Student Academic Portal
          </span>

        </div>

        <div className="login-card">

          <div className="login-heading">
            <h2>Welcome Back</h2>

            <p>
              Sign in to access your student portal
            </p>
          </div>

          {error && (
            <p className="auth-message auth-error" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={handleLogin}>

            <div className="input-group">

              <label>Student ID</label>

              <input
                type="text"
                autoComplete="username"
                placeholder="Enter your student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />

            </div>

            <div className="input-group">

              <label>Password</label>

              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

            </div>

            <div className="input-group">

              <label>Grade</label>

              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >

                {["9", "10", "11", "12"].map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}

              </select>

            </div>

            <button type="submit" className="login-button" disabled={busy}>
              {busy ? "Signing in…" : "Login"}
              <span>→</span>
            </button>

          </form>

          <div className="login-footer">

            <a href="/admin-login" className="admin-login-link">
              Admin Login
            </a>

            <p>
              © 2026 Haramaya University Model School
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Login;