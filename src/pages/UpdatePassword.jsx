import { useState } from "react";
import { Link } from "react-router-dom";
import { readLoggedInStudent } from "../data/studentRecords.js";
import { getSupabase, studentLoginEmail } from "../data/supabaseClient.js";

function UpdatePassword() {
  const student = readLoggedInStudent();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const client = getSupabase();
      const { error: verificationError } = await client.auth.signInWithPassword({
        email: studentLoginEmail(student.id),
        password: currentPassword,
      });
      if (verificationError) {
        throw new Error("The current password is incorrect.");
      }
      const { error: updateError } = await client.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated in the shared database.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update the password."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <Link to="/profile">Back to profile</Link>
      <h1>Change password</h1>
      <p>This change updates your account for all devices.</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}

export default UpdatePassword;
