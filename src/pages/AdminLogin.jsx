import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  checkPortalAdmin,
  hasLocalPortalRecords,
  loadPortalData,
  syncLocalPortalData,
} from "../data/portalCloud.js";
import { getAdminLoginEmail, getSupabase } from "../data/supabaseClient.js";
import "./AdminLogin.css";

function AdminLogin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (username.trim().toLowerCase() !== "admin") {
        throw new Error("Invalid admin username or password.");
      }
      const client = getSupabase();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: getAdminLoginEmail(),
        password,
      });
      if (signInError) {
        throw new Error("Invalid admin username or password.");
      }
      if (!(await checkPortalAdmin())) {
        await client.auth.signOut();
        throw new Error(
          "This account has not been granted school administrator access."
        );
      }

      const { count, error: countError } = await client
        .from("portal_records")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;

      if (count === 0 && hasLocalPortalRecords()) {
        localStorage.setItem("humsImportIncomplete", "true");
        await syncLocalPortalData();
      }
      await loadPortalData();
      navigate("/admin");
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

  const handlePasswordReset = async () => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(
        getAdminLoginEmail(),
        {
          redirectTo: `${window.location.origin}/admin-reset-password`,
        }
      );
      if (resetError) throw resetError;
      setMessage("If the admin account is registered, a reset link will be sent to its email.");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to send the password reset email."
      );
    } finally {
      setBusy(false);
    }
  };

  const goToStudentLogin = () => {
    navigate("/");
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">

        <div className="admin-login-logo">
          <img
            src="/hums-logo.jpg"
            alt="Haramaya University Model School Students Union"
          />
        </div>

        <h1>HUMS</h1>
        <p className="school-name">
          Haramaya University Model School
        </p>

        <div className="admin-title">
          <h2>Admin Login</h2>
          <p>Sign in to manage the school portal</p>
        </div>

        <p className="auth-message auth-warning" role="note">
          Sign in with the administrator credentials configured for the shared school database.
        </p>

        {error && (
          <p className="auth-message auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth-message auth-success" role="status">
            {message}
          </p>
        )}

        <form onSubmit={handleLogin}>
          <label htmlFor="admin-username">Admin Username</label>
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            placeholder="Enter admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : "Login to Admin Panel →"}
          </button>
        </form>

        <button
          className="forgot-password"
          type="button"
          onClick={handlePasswordReset}
          disabled={busy}
        >
          Forgot admin password?
        </button>

        <button
          className="back-student"
          type="button"
          onClick={goToStudentLogin}
        >
          ← Back to Student Login
        </button>

      </div>
    </div>
  );
}

export default AdminLogin;
