import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { checkPortalAdmin } from "../data/portalCloud.js";
import {
  getAdminLoginEmail,
  getSupabase,
  isSupabaseConfigured,
} from "../data/supabaseClient.js";
import "./AdminLogin.css";

function AdminPasswordReset() {
  const navigate = useNavigate();
  const isConfigured = isSupabaseConfigured();
  const linkError = new URLSearchParams(window.location.hash.slice(1)).get(
    "error_description"
  );
  const [status, setStatus] = useState(
    isConfigured && !linkError ? "checking" : "invalid"
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(
    linkError ||
      (!isConfigured
        ? "The shared database is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
        : "")
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isConfigured || linkError) return undefined;
    let active = true;
    const client = getSupabase();

    async function verifyRecoverySession(session) {
      try {
        if (
          !session?.user?.email ||
          session.user.email.toLowerCase() !==
            getAdminLoginEmail().toLowerCase()
        ) {
          throw new Error("This reset link is not for the configured admin account.");
        }
        if (!(await checkPortalAdmin())) {
          throw new Error(
            "This account has not been granted school administrator access."
          );
        }
        if (active) {
          setError("");
          setStatus("ready");
        }
      } catch (verificationError) {
        if (active) {
          setError(
            verificationError instanceof Error
              ? verificationError.message
              : "Unable to verify this password reset link."
          );
          setStatus("invalid");
        }
      }
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        window.setTimeout(() => {
          if (active) void verifyRecoverySession(session);
        }, 0);
      }
    });

    client.auth
      .getSession()
      .then(({ data: sessionData, error: sessionError }) => {
        if (sessionError) throw sessionError;
        return verifyRecoverySession(sessionData.session);
      })
      .catch((sessionError) => {
        if (!active) return;
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to verify this password reset link."
        );
        setStatus("invalid");
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [isConfigured, linkError]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setNewPassword("");
      setConfirmPassword("");
      setMessage("Your admin password was updated in the shared database.");
      window.setTimeout(() => navigate("/admin-login", { replace: true }), 1800);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the admin password."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-page">
      <main className="admin-login-card">
        <div className="admin-title">
          <h1>HUMS</h1>
          <h2>Set a new admin password</h2>
          <p>Choose a new password for the administrator account.</p>
        </div>

        {status === "checking" && (
          <p role="status">Verifying your secure reset link…</p>
        )}
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

        {status === "ready" && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-admin-password">New password</label>
            <input
              id="new-admin-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <label htmlFor="confirm-admin-password">Confirm new password</label>
            <input
              id="confirm-admin-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Updating password…" : "Update password"}
            </button>
          </form>
        )}

        {status === "invalid" && (
          <p className="auth-message auth-warning" role="note">
            Request another reset link from the admin sign-in page.
          </p>
        )}
        <Link className="back-student" to="/admin-login">
          Back to admin sign-in
        </Link>
      </main>
    </div>
  );
}

export default AdminPasswordReset;
