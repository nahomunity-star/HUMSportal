import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import UpdatePassword from "./pages/UpdatePassword.jsx";
import AdminPasswordReset from "./pages/AdminPasswordReset.jsx";
import Dashboard from "./pages/Dashboared.jsx";
import Scores from "./pages/Scores.jsx";
import Schedule from "./data/schedule.jsx";
import Announcements from "./data/announcements.jsx";
import Teachers from "./pages/Teachers.jsx";
import Profile from "./pages/Profile.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ManageStudents from "./pages/ManageStudents.jsx";
import ManageTeachers from "./pages/ManageTeachers.jsx";
import ManageClasses from "./pages/ManageClasses.jsx";
import ManageReports from "./pages/ManageReports.jsx";
import ManageAcademics from "./pages/ManageAcademics.jsx";
import ManageAnnouncements from "./pages/ManageAnnouncements.jsx";
import ManageSchedule from "./pages/ManageSchedule.jsx";
import { initializeDatabase } from "./data/database.js";
import {
  checkPortalAdmin,
  clearPortalCache,
  loadPortalData,
  syncLocalPortalData,
} from "./data/portalCloud.js";
import { getSupabase, isSupabaseConfigured } from "./data/supabaseClient.js";

function reportCloudError(error) {
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected cloud database error occurred.";
  window.dispatchEvent(new CustomEvent("hums-cloud-error", { detail: message }));
}

function AdminRoute({ children }) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      try {
        const { data, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (!data.session || !(await checkPortalAdmin())) {
          if (active) setStatus("unauthorized");
          return;
        }
        if (localStorage.getItem("humsImportIncomplete") === "true") {
          await syncLocalPortalData();
        } else {
          await loadPortalData();
        }
        if (active) setStatus("authorized");
      } catch (error) {
        reportCloudError(error);
        if (active) setStatus("error");
      }
    }

    verifyAdmin();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return <p role="status">Checking administrator access…</p>;
  }
  if (status === "unauthorized") {
    return <Navigate to="/admin-login" replace />;
  }
  if (status === "error") {
    return (
      <p role="alert">
        Could not verify administrator access. Check the database setup and try
        again.
      </p>
    );
  }
  return children;
}

function StudentRoute({ children }) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function verifyStudent() {
      try {
        const { data, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (!data.session) {
          if (active) setStatus("unauthorized");
          return;
        }
        if (await checkPortalAdmin()) {
          if (active) setStatus("admin");
          return;
        }
        const rows = await loadPortalData();
        const student = rows.find((row) => row.record_type === "students");
        if (!student) {
          await getSupabase().auth.signOut();
          await clearPortalCache();
          if (active) setStatus("unauthorized");
          return;
        }
        localStorage.setItem(
          "humsStudent",
          JSON.stringify({ id: student.record_id, grade: String(student.grade) })
        );
        if (active) setStatus("authorized");
      } catch (error) {
        reportCloudError(error);
        if (active) setStatus("error");
      }
    }

    verifyStudent();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return <p role="status">Loading your school account…</p>;
  }
  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }
  if (status === "admin") {
    return <Navigate to="/admin" replace />;
  }
  if (status === "error") {
    return (
      <p role="alert">
        Could not load your shared school account. Try again later.
      </p>
    );
  }
  return children;
}

function CloudSync() {
  const [message, setMessage] = useState("");
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let timer;
    let refreshInProgress = false;
    let syncInProgress = false;
    let syncAgain = false;
    let syncedTimer;

    const showError = (event) => {
      setSynced(false);
      setMessage(String(event.detail));
    };
    const showSynced = () => {
      setMessage("");
      setSynced(true);
      window.clearTimeout(syncedTimer);
      syncedTimer = window.setTimeout(() => setSynced(false), 3500);
    };
    const syncRecords = (event) => {
      if (event.detail?.remote) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        timer = undefined;
        if (syncInProgress) {
          syncAgain = true;
          return;
        }
        syncInProgress = true;
        try {
          await syncLocalPortalData();
        } catch (error) {
          reportCloudError(error);
        } finally {
          syncInProgress = false;
          if (syncAgain) {
            syncAgain = false;
            syncRecords({});
          }
        }
      }, 250);
    };
    const refreshFromCloud = async () => {
      if (
        !isSupabaseConfigured() ||
        refreshInProgress ||
        syncInProgress ||
        timer !== undefined ||
        localStorage.getItem("humsImportIncomplete") === "true"
      ) {
        return;
      }
      refreshInProgress = true;
      try {
        const { data, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (data.session) await loadPortalData();
      } catch (error) {
        reportCloudError(error);
      } finally {
        refreshInProgress = false;
      }
    };

    const { data: authData } = isSupabaseConfigured()
      ? getSupabase().auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") void clearPortalCache();
        })
      : { data: { subscription: null } };

    window.addEventListener("hums-cloud-error", showError);
    window.addEventListener("hums-cloud-synced", showSynced);
    window.addEventListener("hums-records-updated", syncRecords);
    window.addEventListener("hums-announcements-updated", syncRecords);
    window.addEventListener("hums-schedule-updated", syncRecords);
    window.addEventListener("focus", refreshFromCloud);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(syncedTimer);
      authData?.subscription?.unsubscribe();
      window.removeEventListener("hums-cloud-error", showError);
      window.removeEventListener("hums-cloud-synced", showSynced);
      window.removeEventListener("hums-records-updated", syncRecords);
      window.removeEventListener("hums-announcements-updated", syncRecords);
      window.removeEventListener("hums-schedule-updated", syncRecords);
      window.removeEventListener("focus", refreshFromCloud);
    };
  }, []);

  return message ? (
    <div className="cloud-error-banner" role="alert">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setMessage("")}
        aria-label="Dismiss database error"
      >
        ×
      </button>
    </div>
  ) : synced ? (
    <div className="cloud-success-banner" role="status">
      Saved to the shared school database.
    </div>
  ) : null;
}

function App() {
  initializeDatabase();

  return (
    <BrowserRouter>
      <CloudSync />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin-reset-password" element={<AdminPasswordReset />} />
        <Route
          path="/update-password"
          element={
            <StudentRoute>
              <UpdatePassword />
            </StudentRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <StudentRoute>
              <Dashboard />
            </StudentRoute>
          }
        />
        <Route
          path="/scores"
          element={
            <StudentRoute>
              <Scores />
            </StudentRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <StudentRoute>
              <Schedule />
            </StudentRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <StudentRoute>
              <Announcements />
            </StudentRoute>
          }
        />
        <Route
          path="/teachers"
          element={
            <StudentRoute>
              <Teachers />
            </StudentRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <StudentRoute>
              <Profile />
            </StudentRoute>
          }
        />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <AdminRoute>
              <ManageStudents />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/teachers"
          element={
            <AdminRoute>
              <ManageTeachers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/classes"
          element={
            <AdminRoute>
              <ManageClasses />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <AdminRoute>
              <ManageReports />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/academics"
          element={
            <AdminRoute>
              <ManageAcademics />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/announcements"
          element={
            <AdminRoute>
              <ManageAnnouncements />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/schedule"
          element={
            <AdminRoute>
              <ManageSchedule />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
