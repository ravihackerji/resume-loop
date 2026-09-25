import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const STUDENT_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "resume", label: "My Resume", icon: "▣" },
  { id: "review", label: "Peer Review", icon: "✓" },
  { id: "feedback", label: "Feedback", icon: "◈" },
  { id: "profile", label: "Profile", icon: "○" },
];

const ADMIN_NAV = [
  { id: "admin-dashboard", label: "Overview", icon: "⌂" },
  { id: "admin-students", label: "Students", icon: "♙" },
  { id: "admin-manage-students", label: "Manage Students", icon: "⚙" },
  { id: "admin-resumes", label: "Resumes", icon: "▣" },
  { id: "admin-reviews", label: "Reviews", icon: "✓" },
  { id: "admin-reports", label: "Reports", icon: "⚑" },
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");

  const [isAdmin, setIsAdmin] = useState(false);

  const [adminStats, setAdminStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const [adminStudents, setAdminStudents] = useState([]);
  const [adminStudentsLoading, setAdminStudentsLoading] =
    useState(false);

  const [adminResumes, setAdminResumes] = useState([]);
  const [adminResumesLoading, setAdminResumesLoading] =
    useState(false);

  const [adminReviews, setAdminReviews] = useState([]);
  const [adminReviewsLoading, setAdminReviewsLoading] =
    useState(false);

  const [selectedAdminReview, setSelectedAdminReview] =
    useState(null);

  const [adminReports, setAdminReports] = useState([]);
  const [adminReportsLoading, setAdminReportsLoading] =
    useState(false);

  const [selectedAdminReport, setSelectedAdminReport] =
    useState(null);

  const [dashboardStats, setDashboardStats] = useState({
    current_resume_version: 0,
    reviews_given: 0,
    feedback_received: 0,
    pending_reviews: 0,
  });

  const [resumes, setResumes] = useState([]);
  const [feedback, setFeedback] = useState([]);

  const [currentAssignment, setCurrentAssignment] =
    useState(null);

  const [assignmentLoading, setAssignmentLoading] =
    useState(false);

  const [resumeLoading, setResumeLoading] = useState(false);
  const [pendingResumeFile, setPendingResumeFile] = useState(null);

  const [profileSaving, setProfileSaving] = useState(false);

  const [reviewSubmitting, setReviewSubmitting] =
    useState(false);

  const [message, setMessage] = useState(null);

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    roll_number: "",
    branch: "",
    target_role: "",
  });

  const [reviewForm, setReviewForm] = useState({
    formatting_rating: 0,
    grammar_rating: 0,
    skills_rating: 0,
    projects_rating: 0,
    experience_rating: 0,
    strengths: "",
    improvements: "",
    top_improvements: "",
  });

  useEffect(() => {
    initializeApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);

        if (newSession?.user) {
          await loadUserData(newSession.user.id);
        } else {
          resetApp();
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function initializeApp() {
    setLoading(true);

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    setSession(currentSession);

    if (currentSession?.user) {
      await loadUserData(currentSession.user.id);
    }

    setLoading(false);
  }

  function resetApp() {
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setAdminStats(null);
    setAdminStudents([]);
    setAdminResumes([]);
    setAdminReviews([]);
    setSelectedAdminReview(null);
    setAdminReports([]);
    setSelectedAdminReport(null);
    setPendingResumeFile(null);
    setActivePage("dashboard");
  }

  async function loadUserData(userId) {
    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile loading error:", error);
      return;
    }

    setProfile(student);

    if (student) {
      setProfileForm({
        full_name: student.full_name || "",
        roll_number: student.roll_number || "",
        branch: student.branch || "",
        target_role: student.target_role || "",
      });
    }

    const admin = await checkAdminAccess();

    await Promise.all([
      loadDashboardStats(),
      loadResumes(userId),
      loadFeedback(),
    ]);

    if (admin) {
      await Promise.all([
        refreshAdminStudents(),
        refreshAdminResumes(),
        refreshAdminReviews(),
        refreshAdminReports(),
      ]);
    }
  }

  async function checkAdminAccess() {
    const { data, error } = await supabase.rpc(
      "is_current_user_admin"
    );

    if (error) {
      console.error("Admin check failed:", error);
      setIsAdmin(false);
      return false;
    }

    const admin = Boolean(data);

    setIsAdmin(admin);

    if (admin) {
      setActivePage("admin-dashboard");
      await loadAdminStats();
    }

    return admin;
  }

  async function loadAdminStats() {
    setAdminLoading(true);

    const { data, error } = await supabase.rpc(
      "get_admin_dashboard_stats"
    );

    if (error) {
      console.error("Admin stats error:", error);
      setAdminStats(null);
    } else {
      setAdminStats(data?.[0] || null);
    }

    setAdminLoading(false);
  }

  async function loadAdminStudents() {
    const { data, error } = await supabase.rpc("get_admin_students");

    if (error) {
      console.error("Admin students error:", error);
      return [];
    }

    return data || [];
  }

  async function refreshAdminStudents() {
    setAdminStudentsLoading(true);

    const students = await loadAdminStudents();

    setAdminStudents(students);
    setAdminStudentsLoading(false);
  }

  async function updateStudentAdminStatus(studentId, makeAdmin) {
    if (!studentId) return;

    const action = makeAdmin ? "make this student an admin" : "remove admin access";

    const confirmed = window.confirm(
      makeAdmin
        ? "Make this student an administrator? They will be able to access the full Admin Dashboard."
        : "Remove this student's administrator access?"
    );

    if (!confirmed) return;

    const { error } = await supabase.rpc(
      "set_student_admin_status",
      {
        target_student_id: studentId,
        make_admin: makeAdmin,
      }
    );

    if (error) {
      console.error("Admin status update error:", error);
      showMessage(
        "error",
        error.message || `Could not ${action}.`
      );
      return;
    }

    await refreshAdminStudents();
    showMessage(
      "success",
      makeAdmin
        ? "Student is now an administrator."
        : "Administrator access removed."
    );
  }

  async function updateStudentProfile(studentId, form) {
    if (!studentId) return false;

    const { error } = await supabase.rpc(
      "admin_update_student_profile",
      {
        target_student_id: studentId,
        new_full_name: form.full_name,
        new_roll_number: form.roll_number,
        new_branch: form.branch,
        new_target_role: form.target_role,
      }
    );

    if (error) {
      console.error("Admin student update error:", error);
      showMessage(
        "error",
        error.message || "Could not update student data."
      );
      return false;
    }

    await refreshAdminStudents();
    showMessage("success", "Student data updated successfully.");
    return true;
  }

  async function deleteAdminStudent(student) {
    if (!student?.id) return;

    const confirmed = window.confirm(
      `Permanently delete ${student.full_name || "this student"}?\n\nThis will delete their account, profile, resumes, review assignments, reviews, and related student data. This action cannot be undone.`
    );

    if (!confirmed) return;

    // Remove private Storage objects first. The database delete will cascade
    // the related resume/assignment/review records afterwards.
    const { data: studentResumes, error: resumeLookupError } =
      await supabase
        .from("resumes")
        .select("file_path")
        .eq("student_id", student.id);

    if (resumeLookupError) {
      console.error("Student resume lookup error:", resumeLookupError);
      showMessage(
        "error",
        resumeLookupError.message || "Could not prepare student deletion."
      );
      return;
    }

    const paths = (studentResumes || [])
      .map((item) => item.file_path)
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove(paths);

      if (storageError) {
        console.error("Student resume storage deletion error:", storageError);
        showMessage(
          "error",
          storageError.message || "Could not delete the student's resume files."
        );
        return;
      }
    }

    const { error } = await supabase.rpc(
      "admin_delete_student",
      { target_student_id: student.id }
    );

    if (error) {
      console.error("Admin student deletion error:", error);
      showMessage(
        "error",
        error.message || "Could not delete the student account."
      );
      return;
    }

    await Promise.all([
      refreshAdminStudents(),
      refreshAdminResumes(),
      refreshAdminReviews(),
      refreshAdminReports(),
      loadAdminStats(),
    ]);

    showMessage("success", "Student account and related data deleted.");
  }

  async function deleteAdminResume(resume) {
    if (!resume?.id) return;

    const confirmed = window.confirm(
      `Permanently delete Resume V${resume.version} uploaded by ${
        resume.students?.full_name || "this student"
      }?\n\nThis will also remove related assignment/review records. This action cannot be undone.`
    );

    if (!confirmed) return;

    if (resume.file_path) {
      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([resume.file_path]);

      if (storageError) {
        console.error("Admin resume storage deletion error:", storageError);
        showMessage(
          "error",
          storageError.message || "Could not delete the resume file."
        );
        return;
      }
    }

    const { error } = await supabase.rpc(
      "admin_delete_resume",
      { target_resume_id: resume.id }
    );

    if (error) {
      console.error("Admin resume deletion error:", error);
      showMessage(
        "error",
        error.message || "Could not delete the resume."
      );
      return;
    }

    await Promise.all([
      refreshAdminResumes(),
      refreshAdminStudents(),
      refreshAdminReviews(),
      refreshAdminReports(),
      loadAdminStats(),
    ]);

    showMessage("success", "Resume deleted successfully.");
  }

  async function loadAdminResumes() {
    const { data, error } = await supabase
      .from("resumes")
      .select(
        `
        id,
        student_id,
        version,
        file_name,
        file_path,
        file_size,
        status,
        uploaded_at,
        students (
          full_name,
          roll_number,
          branch
        )
        `
      )
      .order("uploaded_at", {
        ascending: false,
      });

    if (error) {
      console.error("Admin resumes error:", error);
      return [];
    }

    return data || [];
  }

  async function refreshAdminResumes() {
    setAdminResumesLoading(true);

    const resumes = await loadAdminResumes();

    setAdminResumes(resumes);
    setAdminResumesLoading(false);
  }

  async function loadAdminReviews() {
    const { data, error } = await supabase.rpc(
      "get_admin_reviews"
    );

    if (error) {
      console.error("Admin reviews error:", error);
      return [];
    }

    return data || [];
  }

  async function refreshAdminReviews() {
    setAdminReviewsLoading(true);

    const reviews = await loadAdminReviews();

    setAdminReviews(reviews);
    setAdminReviewsLoading(false);
  }

  async function loadAdminReports() {
    const { data, error } = await supabase.rpc(
      "get_admin_reports"
    );

    if (error) {
      console.error("Admin reports error:", error);
      return [];
    }

    return data || [];
  }

  async function refreshAdminReports() {
    setAdminReportsLoading(true);

    const reports = await loadAdminReports();

    setAdminReports(reports);
    setAdminReportsLoading(false);
  }

  async function updateAdminReportStatus(reportId, status) {
    const { error } = await supabase.rpc(
      "update_admin_report_status",
      {
        report_id_input: reportId,
        new_status_input: status,
      }
    );

    if (error) {
      console.error("Admin report status error:", error);

      showMessage(
        "error",
        error.message || "Could not update report status."
      );

      return;
    }

    await refreshAdminReports();
    await loadAdminStats();

    setSelectedAdminReport((current) =>
      current ? { ...current, status } : null
    );

    showMessage("success", `Report marked as ${status}.`);
  }

  function openReportedReview(reviewId) {
    if (!reviewId) return;

    const review = adminReviews.find(
      (item) => item.review_id === reviewId
    );

    if (review) {
      setSelectedAdminReport(null);
      setSelectedAdminReview(review);
      setActivePage("admin-reviews");
    }
  }

  async function openAdminResume(resume) {
    if (!resume?.file_path) {
      showMessage(
        "error",
        "Resume file path is unavailable."
      );
      return;
    }

    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(resume.file_path, 60 * 10);

    if (error) {
      console.error("Admin resume URL error:", error);

      showMessage(
        "error",
        "Could not open this resume."
      );

      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function loadDashboardStats() {
    const { data, error } = await supabase.rpc(
      "get_my_dashboard_stats"
    );

    if (error) {
      console.error("Dashboard stats error:", error);
      return;
    }

    if (data?.[0]) {
      setDashboardStats(data[0]);
    }
  }

  async function loadResumes(userId = session?.user?.id) {
    if (!userId) {
      setResumes([]);
      return;
    }

    const { data, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("student_id", userId)
      .order("version", {
        ascending: false,
      });

    if (error) {
      console.error("Resume loading error:", error);
      return;
    }

    setResumes(data || []);
  }

  async function loadFeedback() {
    const { data, error } = await supabase.rpc(
      "get_my_received_reviews"
    );

    if (error) {
      console.error("Feedback loading error:", error);
      return;
    }

    setFeedback(data || []);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    resetApp();
  }

  function handleResumeFileSelected(file) {
    if (!file || !session?.user) {
      return;
    }

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!validTypes.includes(file.type)) {
      showMessage(
        "error",
        "Please select a PDF or DOCX file."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage(
        "error",
        "Resume size must be 5 MB or smaller."
      );
      return;
    }

    setPendingResumeFile(file);
  }

  function cancelResumeSelection() {
    setPendingResumeFile(null);
  }

  async function handleUploadResume() {
    const file = pendingResumeFile;

    if (!file || !session?.user) {
      return;
    }

    setResumeLoading(true);

    try {
      const nextVersion =
        resumes.length > 0
          ? Math.max(...resumes.map((r) => r.version)) + 1
          : 1;

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "pdf";

      const filePath = `${session.user.id}/${Date.now()}-v${nextVersion}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: recordError } = await supabase
        .from("resumes")
        .insert({
          student_id: session.user.id,
          version: nextVersion,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          status: "active",
        });

      if (recordError) {
        // If the database record fails, remove the uploaded object so
        // we do not leave an orphaned resume file in Storage.
        await supabase.storage
          .from("resumes")
          .remove([filePath]);
        throw recordError;
      }

      setPendingResumeFile(null);

      showMessage(
        "success",
        `Resume V${nextVersion} uploaded successfully.`
      );

      await loadResumes();
      await loadDashboardStats();

      if (isAdmin) {
        await refreshAdminResumes();
        await loadAdminStats();
      }
    } catch (error) {
      console.error(error);

      showMessage(
        "error",
        error.message || "Resume upload failed."
      );
    } finally {
      setResumeLoading(false);
    }
  }

  async function downloadOwnResume(resume) {
    if (!resume?.file_path) {
      showMessage(
        "error",
        "Resume file path is unavailable."
      );
      return;
    }

    if (resume.student_id !== session?.user?.id) {
      showMessage(
        "error",
        "You can only open your own resume."
      );
      return;
    }

    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(resume.file_path, 60 * 10);

    if (error) {
      console.error("Resume download URL error:", error);

      showMessage(
        "error",
        "Could not open your resume."
      );

      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function getNextAssignment() {
    setAssignmentLoading(true);
    setCurrentAssignment(null);

    const { data, error } = await supabase.rpc(
      "get_next_review_assignment"
    );

    if (error) {
      console.error("Assignment error:", error);

      showMessage(
        "error",
        error.message ||
          "Could not get a review assignment."
      );

      setAssignmentLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      showMessage(
        "info",
        "No new peer review is available right now."
      );

      setAssignmentLoading(false);
      return;
    }

    setCurrentAssignment(data[0]);

    await loadDashboardStats();

    setAssignmentLoading(false);
  }

  async function openAssignedResume() {
    if (!currentAssignment?.file_path) {
      return;
    }

    const { data, error } = await supabase.storage
      .from("resumes")
      .createSignedUrl(
        currentAssignment.file_path,
        60 * 10
      );

    if (error) {
      console.error(error);

      showMessage(
        "error",
        "Could not open the resume."
      );

      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function submitReview(event) {
    event.preventDefault();

    if (!currentAssignment) {
      return;
    }

    const ratings = [
      reviewForm.formatting_rating,
      reviewForm.grammar_rating,
      reviewForm.skills_rating,
      reviewForm.projects_rating,
      reviewForm.experience_rating,
    ];

    if (ratings.some((rating) => !rating)) {
      showMessage(
        "error",
        "Please provide all five ratings."
      );
      return;
    }

    if (!reviewForm.strengths.trim()) {
      showMessage(
        "error",
        "Please add at least one strength."
      );
      return;
    }

    if (!reviewForm.improvements.trim()) {
      showMessage(
        "error",
        "Please add improvement suggestions."
      );
      return;
    }

    setReviewSubmitting(true);

    const { error } = await supabase.rpc(
      "submit_peer_review",
      {
        p_assignment_id:
          currentAssignment.assignment_id,
        p_formatting_rating:
          reviewForm.formatting_rating,
        p_grammar_rating:
          reviewForm.grammar_rating,
        p_skills_rating:
          reviewForm.skills_rating,
        p_projects_rating:
          reviewForm.projects_rating,
        p_experience_rating:
          reviewForm.experience_rating,
        p_strengths:
          reviewForm.strengths,
        p_improvements:
          reviewForm.improvements,
        p_top_improvements:
          reviewForm.top_improvements,
      }
    );

    if (error) {
      console.error("Review submission error:", error);

      showMessage(
        "error",
        error.message ||
          "Review submission failed."
      );

      setReviewSubmitting(false);
      return;
    }

    setCurrentAssignment(null);

    setReviewForm({
      formatting_rating: 0,
      grammar_rating: 0,
      skills_rating: 0,
      projects_rating: 0,
      experience_rating: 0,
      strengths: "",
      improvements: "",
      top_improvements: "",
    });

    await loadDashboardStats();

    if (isAdmin) {
      await loadAdminStats();
      await refreshAdminReviews();
    }

    showMessage(
      "success",
      "Your peer review has been submitted."
    );

    setReviewSubmitting(false);
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!session?.user) {
      return;
    }

    if (
      !profileForm.full_name.trim() ||
      !profileForm.roll_number.trim() ||
      !profileForm.branch.trim() ||
      !profileForm.target_role.trim()
    ) {
      showMessage(
        "error",
        "Please fill in all required profile fields."
      );
      return;
    }

    setProfileSaving(true);

    const profileData = {
      full_name: profileForm.full_name.trim(),
      roll_number: profileForm.roll_number.trim(),
      branch: profileForm.branch.trim(),
      target_role: profileForm.target_role.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;

    if (profile) {
      ({ error } = await supabase
        .from("students")
        .update(profileData)
        .eq("id", session.user.id));
    } else {
      ({ error } = await supabase
        .from("students")
        .insert({
          id: session.user.id,
          ...profileData,
        }));
    }

    if (error) {
      console.error("Profile save error:", error);

      if (error.code === "23505") {
        showMessage(
          "error",
          "That roll number is already registered. Please use your own roll number."
        );
      } else {
        showMessage(
          "error",
          error.message ||
            "Could not save your profile."
        );
      }

      setProfileSaving(false);
      return;
    }

    await loadUserData(session.user.id);

    showMessage(
      "success",
      profile
        ? "Profile updated successfully."
        : "Profile created successfully."
    );

    setProfileSaving(false);
  }

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });

    setTimeout(() => {
      setMessage(null);
    }, 4000);
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!profile) {
    return (
      <ProfileSetupScreen
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        onSave={saveProfile}
        loading={profileSaving}
        email={session.user.email}
      />
    );
  }

  const displayName =
    profile.full_name ||
    session.user.email?.split("@")[0] ||
    "Student";

  const adminMode =
    isAdmin && activePage.startsWith("admin-");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b14] text-white">
      <style>{`
        html { scroll-behavior: smooth; }
        body { background: #050b14; }
        ::selection { background: rgba(96,165,250,.28); color: #fff; }
        * { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,.35) transparent; }
        button, input, textarea, select { font-family: inherit; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-1/3 h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>
      <div className="flex min-h-screen">
        <Sidebar
          isAdmin={isAdmin}
          activePage={activePage}
          setActivePage={setActivePage}
          displayName={displayName}
          email={session.user.email}
          onLogout={handleLogout}
        />

        <main className="min-w-0 flex-1">
          <MobileHeader
            isAdmin={isAdmin}
            activePage={activePage}
            setActivePage={setActivePage}
            onLogout={handleLogout}
          />

          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8 xl:px-10">
            {message && (
              <Message
                type={message.type}
                text={message.text}
              />
            )}

            {adminMode ? (
              <>
                {activePage === "admin-dashboard" && (
                  <AdminDashboard
                    stats={adminStats}
                    loading={adminLoading}
                    refresh={loadAdminStats}
                  />
                )}

                {activePage === "admin-students" && (
                  <AdminStudents
                    students={adminStudents}
                    loading={adminStudentsLoading}
                    refresh={refreshAdminStudents}
                  />
                )}

                {activePage === "admin-manage-students" && (
                  <AdminManageStudents
                    students={adminStudents}
                    loading={adminStudentsLoading}
                    refresh={refreshAdminStudents}
                    onUpdateAdminStatus={updateStudentAdminStatus}
                    onUpdateStudent={updateStudentProfile}
                    onDeleteStudent={deleteAdminStudent}
                  />
                )}

                {activePage === "admin-resumes" && (
                  <AdminResumes
                    resumes={adminResumes}
                    loading={adminResumesLoading}
                    refresh={refreshAdminResumes}
                    onOpenResume={openAdminResume}
                    onDeleteResume={deleteAdminResume}
                  />
                )}

                {activePage === "admin-reviews" && (
                  <AdminReviews
                    reviews={adminReviews}
                    loading={adminReviewsLoading}
                    refresh={refreshAdminReviews}
                    selectedReview={
                      selectedAdminReview
                    }
                    setSelectedReview={
                      setSelectedAdminReview
                    }
                  />
                )}

                {activePage === "admin-reports" && (
                  <AdminReports
                    reports={adminReports}
                    loading={adminReportsLoading}
                    refresh={refreshAdminReports}
                    selectedReport={selectedAdminReport}
                    setSelectedReport={setSelectedAdminReport}
                    onUpdateStatus={updateAdminReportStatus}
                    onOpenReview={openReportedReview}
                  />
                )}
              </>
            ) : (
              <>
                {activePage === "dashboard" && (
                  <StudentDashboard
                    displayName={displayName}
                    stats={dashboardStats}
                    setActivePage={setActivePage}
                  />
                )}

                {activePage === "resume" && (
                  <ResumePage
                    resumes={resumes}
                    loading={resumeLoading}
                    pendingFile={pendingResumeFile}
                    onFileSelected={handleResumeFileSelected}
                    onUpload={handleUploadResume}
                    onCancelSelection={cancelResumeSelection}
                    onDownloadResume={downloadOwnResume}
                  />
                )}

                {activePage === "review" && (
                  <PeerReviewPage
                    currentAssignment={
                      currentAssignment
                    }
                    assignmentLoading={
                      assignmentLoading
                    }
                    onGetAssignment={
                      getNextAssignment
                    }
                    onOpenResume={
                      openAssignedResume
                    }
                    reviewForm={reviewForm}
                    setReviewForm={setReviewForm}
                    onSubmit={submitReview}
                    submitting={reviewSubmitting}
                  />
                )}

                {activePage === "feedback" && (
                  <FeedbackPage
                    feedback={feedback}
                  />
                )}

                {activePage === "profile" && (
                  <ProfilePage
                    profileForm={profileForm}
                    setProfileForm={setProfileForm}
                    onSave={saveProfile}
                    email={session.user.email}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
        <p className="text-slate-400">
          Loading ResumeLoop...
        </p>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendMagicLink(event) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#050b14] px-5 py-8 text-white">
      <div className="pointer-events-none absolute -left-32 top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-600/12 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div className="hidden lg:block">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 backdrop-blur-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-black">R</span>
            <span className="text-xs font-semibold text-slate-300">ResumeLoop · Student workspace</span>
          </div>
          <h1 className="max-w-xl text-5xl font-bold leading-[1.05] tracking-[-0.045em] xl:text-6xl">
            Build a stronger resume with people who are on the same journey.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-500">
            Share your resume, review a peer's work, and turn practical feedback into your next better version.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["01", "Upload", "Your latest resume"],
              ["02", "Review", "A peer's resume"],
              ["03", "Improve", "Apply useful feedback"],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-xl">
                <p className="text-[10px] font-bold tracking-[0.15em] text-blue-400">{number}</p>
                <p className="mt-4 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-black shadow-xl shadow-blue-950/40">R</div>
            <h1 className="text-3xl font-bold tracking-tight">ResumeLoop</h1>
            <p className="mt-2 text-sm text-slate-500">Give feedback. Get feedback. Improve.</p>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-[#0a1422]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8">
            {sent ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/10 bg-emerald-500/10 text-2xl text-emerald-300">✓</div>
                <h2 className="text-2xl font-bold tracking-tight">Check your inbox</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  We sent a secure login link to <span className="font-medium text-slate-200">{email}</span>.
                </p>
                <button onClick={() => setSent(false)} className="mt-7 rounded-xl border border-white/[0.07] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.04] hover:text-white">
                  Use another email
                </button>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Welcome back</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">Sign in to ResumeLoop</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">We'll send a secure magic link. No password required.</p>
                </div>
                <form onSubmit={sendMagicLink} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-blue-400/40 focus:bg-blue-500/[0.03] focus:ring-4 focus:ring-blue-500/5"
                    />
                  </div>
                  {error && <p className="rounded-xl border border-red-400/10 bg-red-500/5 px-3 py-2.5 text-sm text-red-300">{error}</p>}
                  <button disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3.5 text-sm font-bold shadow-xl shadow-blue-950/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                    {loading ? "Sending secure link..." : "Continue with email →"}
                  </button>
                </form>
                <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">Secure authentication powered by Supabase Auth.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSetupScreen({
  profileForm,
  setProfileForm,
  onSave,
  loading,
  email,
}) {
  return (
    <div className="min-h-screen bg-[#07111f] px-5 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-2xl">
            ✓
          </div>

          <h1 className="text-2xl font-bold">
            Complete your profile
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Your account is authenticated. Add your student
            details once to start using ResumeLoop.
          </p>

          {email && (
            <p className="mt-2 text-xs text-slate-500">
              Signed in as {email}
            </p>
          )}
        </div>

        <form
          onSubmit={onSave}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6 shadow-xl"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Full Name *"
              value={profileForm.full_name}
              onChange={(value) =>
                setProfileForm((prev) => ({
                  ...prev,
                  full_name: value,
                }))
              }
            />

            <InputField
              label="Roll Number *"
              value={profileForm.roll_number}
              onChange={(value) =>
                setProfileForm((prev) => ({
                  ...prev,
                  roll_number: value,
                }))
              }
            />

            <InputField
              label="Branch *"
              value={profileForm.branch}
              onChange={(value) =>
                setProfileForm((prev) => ({
                  ...prev,
                  branch: value,
                }))
              }
              placeholder="e.g. Information Technology"
            />

            <InputField
              label="Target Role *"
              value={profileForm.target_role}
              onChange={(value) =>
                setProfileForm((prev) => ({
                  ...prev,
                  target_role: value,
                }))
              }
              placeholder="e.g. Software Engineer"
            />
          </div>

          <div className="mt-6 rounded-xl border border-white/[0.07] bg-slate-900/40 p-4">
            <p className="text-xs leading-5 text-slate-400">
              Your email is used only for secure login. Your name, roll
              number, branch, and target role are used for your profile.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating Profile..."
              : "Create Student Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Sidebar({
  isAdmin,
  activePage,
  setActivePage,
  displayName,
  email,
  onLogout,
}) {
  const items = isAdmin ? ADMIN_NAV : STUDENT_NAV;

  return (
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-white/[0.06] bg-[#07101d]/90 backdrop-blur-2xl lg:flex lg:flex-col">
      <div className="border-b border-white/[0.06] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-lg font-black shadow-lg shadow-blue-950/40">
            R
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-cyan-300/80 blur-[2px]" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight">ResumeLoop</h1>
            <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              {isAdmin ? "Admin workspace" : "Student workspace"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
          {isAdmin ? "Administration" : "Workspace"}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-blue-600/20 to-indigo-600/10 text-white shadow-inner shadow-blue-500/5"
                  : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-100"
              }`}
            >
              {active && <span className="absolute left-0 h-6 w-0.5 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,.8)]" />}
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition ${active ? "bg-blue-500/15 text-blue-300" : "bg-white/[0.025] text-slate-500 group-hover:text-slate-300"}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-sm font-bold text-slate-200">
              {(displayName?.[0] || "U").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500">{email}</p>
            </div>
          </div>
          {isAdmin && (
            <span className="mt-3 inline-flex rounded-full border border-violet-400/15 bg-violet-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-violet-300">
              Administrator
            </span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <span>↪</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileHeader({
  isAdmin,
  activePage,
  setActivePage,
  onLogout,
}) {
  const items = isAdmin ? ADMIN_NAV : STUDENT_NAV;

  return (
    <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07101d]/85 p-4 backdrop-blur-2xl lg:hidden">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 font-black shadow-lg shadow-blue-950/30">R</div>
          <div>
            <span className="block text-sm font-bold">ResumeLoop</span>
            <span className="block text-[9px] uppercase tracking-[0.15em] text-slate-600">{isAdmin ? "Admin" : "Student"}</span>
          </div>
        </div>
        <button onClick={onLogout} className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white">
          Sign out
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activePage === item.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                : "border border-white/[0.05] bg-white/[0.03] text-slate-500 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StudentDashboard({
  displayName,
  stats,
  setActivePage,
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Student Dashboard"
        title={`Welcome back, ${
          displayName.split(" ")[0]
        }`}
        description="Track your resume progress and contribute useful feedback to your peers."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Current Resume"
          value={`V${
            stats.current_resume_version || 0
          }`}
          description="Latest uploaded version"
          icon="▣"
        />

        <StatCard
          label="Reviews Given"
          value={stats.reviews_given || 0}
          description="Completed peer reviews"
          icon="✓"
        />

        <StatCard
          label="Feedback Received"
          value={stats.feedback_received || 0}
          description="Reviews on your resumes"
          icon="◈"
        />

        <StatCard
          label="Pending Reviews"
          value={stats.pending_reviews || 0}
          description="Assignments waiting"
          icon="◷"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold">
            Improve your resume
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Upload your latest resume and get constructive
            feedback from another student.
          </p>

          <button
            onClick={() => setActivePage("resume")}
            className="mt-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500"
          >
            Manage Resume
          </button>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold">
            Give feedback
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Review another student's resume using the
            structured peer-review system.
          </p>

          <button
            onClick={() => setActivePage("review")}
            className="mt-5 rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:bg-slate-800"
          >
            Start Peer Review
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
        <p className="text-sm font-semibold text-blue-400">
          ResumeLoop principle
        </p>

        <p className="mt-2 text-lg font-medium">
          Give feedback → Get feedback → Improve your resume
        </p>
      </div>
    </div>
  );
}

function AdminDashboard({
  stats,
  loading,
  refresh,
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title="Admin Overview"
        description="Monitor the ResumeLoop platform and review activity."
        action={
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        }
      />

      {loading && !stats ? (
        <LoadingCard text="Loading admin statistics..." />
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AdminStatCard
              label="Total Students"
              value={stats.total_students}
              icon="♙"
            />

            <AdminStatCard
              label="Total Resumes"
              value={stats.total_resumes}
              icon="▣"
            />

            <AdminStatCard
              label="Reviews Submitted"
              value={stats.total_reviews}
              icon="✓"
            />

            <AdminStatCard
              label="Pending Reviews"
              value={stats.pending_reviews}
              icon="◷"
            />

            <AdminStatCard
              label="Pending Reports"
              value={stats.pending_reports}
              icon="⚑"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Platform Activity
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                ResumeLoop Overview
              </h2>

              <div className="mt-6 space-y-4">
                <ActivityRow
                  label="Students registered"
                  value={stats.total_students}
                />

                <ActivityRow
                  label="Resumes uploaded"
                  value={stats.total_resumes}
                />

                <ActivityRow
                  label="Reviews completed"
                  value={stats.total_reviews}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Requires Attention
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Moderation Queue
              </h2>

              <div className="mt-6 space-y-4">
                <QueueRow
                  label="Pending peer reviews"
                  value={stats.pending_reviews}
                  icon="◷"
                />

                <QueueRow
                  label="Pending reports"
                  value={stats.pending_reports}
                  icon="⚑"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <ErrorCard text="Could not load admin statistics." />
      )}
    </div>
  );
}

function AdminStudents({
  students,
  loading,
  refresh,
}) {
  const administrators = students.filter(
    (student) => student.is_admin
  ).length;

  const regularStudents = students.filter(
    (student) => !student.is_admin
  ).length;

  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title="Students"
        description="Overview of registered ResumeLoop students and account information."
        action={
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminStatCard
          label="Registered Students"
          value={students.length}
          icon="♙"
        />

        <AdminStatCard
          label="Administrators"
          value={administrators}
          icon="◆"
        />

        <AdminStatCard
          label="Students"
          value={regularStudents}
          icon="○"
        />
      </div>

      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-5">
        <p className="text-sm font-semibold text-white">
          Student Overview
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Use <span className="font-medium text-slate-300">Manage Students</span> in the admin menu when you need to edit accounts, manage administrator access, or delete student data.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
        {loading ? (
          <LoadingCard text="Loading students..." />
        ) : students.length === 0 ? (
          <EmptyCard
            title="No students found"
            description="Registered students will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="border-b border-white/[0.06] bg-white/[0.025]">
                <tr>
                  <TableHeader>Student</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Roll Number</TableHeader>
                  <TableHeader>Branch</TableHeader>
                  <TableHeader>Target Role</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="transition hover:bg-slate-900/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {student.full_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(student.created_at).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.email || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.roll_number || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.branch || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.target_role || "—"}
                    </td>

                    <td className="px-5 py-4">
                      {student.is_admin ? (
                        <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                          Admin
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                          Student
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminManageStudents({
  students,
  loading,
  refresh,
  onUpdateAdminStatus,
  onUpdateStudent,
  onDeleteStudent,
}) {
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    roll_number: "",
    branch: "",
    target_role: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEditing(student) {
    setEditingStudent(student);
    setEditForm({
      full_name: student.full_name || "",
      roll_number: student.roll_number || "",
      branch: student.branch || "",
      target_role: student.target_role || "",
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editingStudent) return;

    setSavingEdit(true);
    const saved = await onUpdateStudent(
      editingStudent.id,
      editForm
    );
    setSavingEdit(false);

    if (saved) {
      setEditingStudent(null);
    }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title="Manage Students"
        description="Edit student data, manage administrator access, and delete accounts."
        action={
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        }
      />

      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-5">
        <p className="text-sm font-semibold text-white">
          Student Data Management
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Make changes only when needed. Deleting a student permanently removes their account and related data.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
        {loading ? (
          <LoadingCard text="Loading students..." />
        ) : students.length === 0 ? (
          <EmptyCard
            title="No students found"
            description="Registered students will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
              <thead className="border-b border-white/[0.06] bg-white/[0.025]">
                <tr>
                  <TableHeader>Student</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Roll Number</TableHeader>
                  <TableHeader>Branch</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Admin Access</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="transition hover:bg-slate-900/40"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {student.full_name}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.email || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.roll_number || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-400">
                      {student.branch || "—"}
                    </td>

                    <td className="px-5 py-4">
                      {student.is_admin ? (
                        <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                          Admin
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                          Student
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {student.is_admin ? (
                        <button
                          onClick={() =>
                            onUpdateAdminStatus(student.id, false)
                          }
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            onUpdateAdminStatus(student.id, true)
                          }
                          className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-400 hover:bg-purple-500/20"
                        >
                          Make Admin
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => startEditing(student)}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                        >
                          Edit
                        </button>

                        {!student.is_admin && (
                          <button
                            onClick={() => onDeleteStudent(student)}
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#0b1728] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Manage Student
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Edit {editingStudent.full_name || "Student"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Email: {editingStudent.email || "—"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEdit} className="mt-6 space-y-4">
              <AdminEditField
                label="Full Name"
                value={editForm.full_name}
                onChange={(value) =>
                  setEditForm((prev) => ({ ...prev, full_name: value }))
                }
              />

              <AdminEditField
                label="Roll Number"
                value={editForm.roll_number}
                onChange={(value) =>
                  setEditForm((prev) => ({ ...prev, roll_number: value }))
                }
              />

              <AdminEditField
                label="Branch"
                value={editForm.branch}
                onChange={(value) =>
                  setEditForm((prev) => ({ ...prev, branch: value }))
                }
              />

              <AdminEditField
                label="Target Role"
                value={editForm.target_role}
                onChange={(value) =>
                  setEditForm((prev) => ({ ...prev, target_role: value }))
                }
              />

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminEditField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
      />
    </label>
  );
}

function AdminResumes({
  resumes,
  loading,
  refresh,
  onOpenResume,
  onDeleteResume,
}) {
  const totalSize = resumes.reduce(
    (sum, resume) =>
      sum + Number(resume.file_size || 0),
    0
  );

  const activeCount = resumes.filter(
    (resume) => resume.status === "active"
  ).length;

  const archivedCount = resumes.filter(
    (resume) => resume.status === "archived"
  ).length;

  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title="Resumes"
        description="View and securely open resumes uploaded by students."
        action={
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminStatCard
          label="Total Resume Records"
          value={resumes.length}
          icon="▣"
        />

        <AdminStatCard
          label="Active Resumes"
          value={activeCount}
          icon="●"
        />

        <AdminStatCard
          label="Archived Resumes"
          value={archivedCount}
          icon="◌"
        />
      </div>

      <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Total Stored Resume Size
        </p>

        <p className="mt-2 text-2xl font-bold">
          {formatFileSize(totalSize)}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
        {loading ? (
          <LoadingCard text="Loading resumes..." />
        ) : resumes.length === 0 ? (
          <EmptyCard
            title="No resumes found"
            description="Uploaded resumes will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="border-b border-white/[0.06] bg-white/[0.025]">
                <tr>
                  <TableHeader>Student</TableHeader>
                  <TableHeader>Resume</TableHeader>
                  <TableHeader>Version</TableHeader>
                  <TableHeader>Branch</TableHeader>
                  <TableHeader>Size</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Uploaded</TableHeader>
                  <TableHeader>Action</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {resumes.map((resume) => {
                  const student = resume.students;

                  return (
                    <tr
                      key={resume.id}
                      className="transition hover:bg-slate-900/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {student?.full_name ||
                            "Unknown Student"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {student?.roll_number || "—"}
                        </p>
                      </td>

                      <td className="max-w-[220px] px-5 py-4">
                        <p
                          className="truncate text-sm text-slate-300"
                          title={resume.file_name}
                        >
                          {resume.file_name}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold">
                          V{resume.version}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-400">
                        {student?.branch || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-400">
                        {formatFileSize(
                          resume.file_size
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={resume.status}
                        />
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {new Date(
                          resume.uploaded_at
                        ).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              onOpenResume(resume)
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500"
                          >
                            Open
                          </button>

                          <button
                            onClick={() =>
                              onDeleteResume(resume)
                            }
                            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminReviews({
  reviews,
  loading,
  refresh,
  selectedReview,
  setSelectedReview,
}) {
  const average =
    reviews.length > 0
      ? reviews.reduce(
          (sum, review) =>
            sum + getAverageRating(review),
          0
        ) / reviews.length
      : 0;

  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title="Reviews"
        description="Monitor peer reviews submitted across ResumeLoop."
        action={
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AdminStatCard
          label="Total Reviews"
          value={reviews.length}
          icon="✓"
        />

        <AdminStatCard
          label="Average Rating"
          value={`${average.toFixed(1)}/5`}
          icon="★"
        />

        <AdminStatCard
          label="Latest Review"
          value={
            reviews.length > 0
              ? new Date(
                  reviews[0].submitted_at
                ).toLocaleDateString()
              : "—"
          }
          icon="◷"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
        {loading ? (
          <LoadingCard text="Loading reviews..." />
        ) : reviews.length === 0 ? (
          <EmptyCard
            title="No reviews found"
            description="Submitted peer reviews will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-white/[0.06] bg-white/[0.025]">
                <tr>
                  <TableHeader>Reviewer</TableHeader>
                  <TableHeader>Resume Owner</TableHeader>
                  <TableHeader>Resume</TableHeader>
                  <TableHeader>Ratings</TableHeader>
                  <TableHeader>Average</TableHeader>
                  <TableHeader>Submitted</TableHeader>
                  <TableHeader>Action</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {reviews.map((review) => {
                  const averageRating =
                    getAverageRating(review);

                  return (
                    <tr
                      key={review.review_id}
                      className="transition hover:bg-slate-900/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {review.reviewer_name ||
                            "Unknown"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {review.reviewer_roll_number ||
                            "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {review.owner_name ||
                            "Unknown"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {review.owner_roll_number ||
                            "—"}
                        </p>
                      </td>

                      <td className="max-w-[190px] px-5 py-4">
                        <p
                          className="truncate text-sm text-slate-300"
                          title={review.file_name}
                        >
                          {review.file_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          V{review.resume_version}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          <MiniRating
                            label="F"
                            value={
                              review.formatting_rating
                            }
                          />

                          <MiniRating
                            label="G"
                            value={
                              review.grammar_rating
                            }
                          />

                          <MiniRating
                            label="S"
                            value={
                              review.skills_rating
                            }
                          />

                          <MiniRating
                            label="P"
                            value={
                              review.projects_rating
                            }
                          />

                          <MiniRating
                            label="E"
                            value={
                              review.experience_rating
                            }
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-400">
                          {averageRating.toFixed(1)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {new Date(
                          review.submitted_at
                        ).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            setSelectedReview(
                              review
                            )
                          }
                          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedReview && (
        <ReviewDetailsModal
          review={selectedReview}
          onClose={() =>
            setSelectedReview(null)
          }
        />
      )}
    </div>
  );
}


function AdminReports({
  reports,
  loading,
  refresh,
  selectedReport,
  setSelectedReport,
  onUpdateStatus,
  onOpenReview,
}) {
  const pendingCount = reports.filter(
    (report) => report.status === "pending"
  ).length;

  const reviewedCount = reports.filter(
    (report) => report.status === "reviewed"
  ).length;

  const resolvedCount = reports.filter(
    (report) =>
      report.status === "resolved" ||
      report.status === "dismissed"
  ).length;

  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title="Reports"
        description="Review user reports, inspect related feedback, and manage report status."
        action={
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <AdminStatCard label="Total Reports" value={reports.length} icon="⚑" />
        <AdminStatCard label="Pending" value={pendingCount} icon="◷" />
        <AdminStatCard label="Reviewed" value={reviewedCount} icon="✓" />
        <AdminStatCard label="Resolved / Dismissed" value={resolvedCount} icon="◆" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl">
        {loading ? (
          <LoadingCard text="Loading reports..." />
        ) : reports.length === 0 ? (
          <EmptyCard
            title="No reports found"
            description="User reports will appear here when submitted."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-white/[0.06] bg-white/[0.025]">
                <tr>
                  <TableHeader>Reporter</TableHeader>
                  <TableHeader>Reported User</TableHeader>
                  <TableHeader>Reason</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Created</TableHeader>
                  <TableHeader>Action</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {reports.map((report) => (
                  <tr key={report.report_id} className="transition hover:bg-slate-900/40">
                    <td className="px-5 py-4">
                      <p className="font-medium">{report.reporter_name || "Unknown"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {report.reporter_roll_number || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium">{report.reported_user_name || "Unknown"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {report.reported_user_roll_number || "—"}
                      </p>
                    </td>

                    <td className="max-w-[260px] px-5 py-4">
                      <p className="truncate text-sm text-slate-300">{report.reason}</p>
                      {report.description && (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {report.description}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <ReportStatusBadge status={report.status} />
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(report.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdateStatus={onUpdateStatus}
          onOpenReview={onOpenReview}
        />
      )}
    </div>
  );
}

function ReportDetailsModal({
  report,
  onClose,
  onUpdateStatus,
  onOpenReview,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b1728] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Report Details
            </p>
            <h2 className="mt-1 text-xl font-bold">{report.reason}</h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <PersonCard
              title="Reporter"
              name={report.reporter_name}
              roll={report.reporter_roll_number}
            />

            <PersonCard
              title="Reported User"
              name={report.reported_user_name}
              roll={report.reported_user_roll_number}
            />

            <div className="rounded-xl bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
              <div className="mt-2">
                <ReportStatusBadge status={report.status} />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {new Date(report.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Report Reason
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{report.reason}</p>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-blue-400">
              Description
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
              {report.description || "No additional description provided."}
            </p>
          </div>

          {report.review_id && (
            <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Related Review
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    This report is linked to a peer review.
                  </p>
                </div>

                <button
                  onClick={() => onOpenReview(report.review_id)}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold hover:bg-blue-500"
                >
                  Open Review
                </button>
              </div>

              {(report.review_strengths || report.review_improvements) && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <FeedbackBox
                    title="Review Strengths"
                    text={report.review_strengths}
                  />
                  <FeedbackBox
                    title="Review Improvements"
                    text={report.review_improvements}
                  />
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-5">
            <p className="text-sm font-semibold">Update Report Status</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {["pending", "reviewed", "resolved", "dismissed"].map((status) => (
                <button
                  key={status}
                  onClick={() => onUpdateStatus(report.report_id, status)}
                  disabled={report.status === status}
                  className={`rounded-lg px-4 py-2.5 text-xs font-semibold capitalize transition ${
                    report.status === status
                      ? "cursor-not-allowed bg-slate-800 text-slate-600"
                      : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportStatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-500/10 text-amber-400",
    reviewed: "bg-blue-500/10 text-blue-400",
    resolved: "bg-emerald-500/10 text-emerald-400",
    dismissed: "bg-slate-800 text-slate-500",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-slate-800 text-slate-400"
      }`}
    >
      {status || "unknown"}
    </span>
  );
}

function ReviewDetailsModal({
  review,
  onClose,
}) {
  const average = getAverageRating(review);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b1728] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Review Details
            </p>

            <h2 className="mt-1 text-xl font-bold">
              {review.file_name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <PersonCard
              title="Reviewer"
              name={review.reviewer_name}
              roll={review.reviewer_roll_number}
            />

            <PersonCard
              title="Resume Owner"
              name={review.owner_name}
              roll={review.owner_roll_number}
            />

            <div className="rounded-xl bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Resume
              </p>

              <p className="mt-2 font-semibold">
                Version {review.resume_version}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {new Date(
                  review.submitted_at
                ).toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">
                Ratings
              </h3>

              <span className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-400">
                Average {average.toFixed(1)}/5
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              <RatingCard
                label="Formatting"
                value={review.formatting_rating}
              />

              <RatingCard
                label="Grammar"
                value={review.grammar_rating}
              />

              <RatingCard
                label="Skills"
                value={review.skills_rating}
              />

              <RatingCard
                label="Projects"
                value={review.projects_rating}
              />

              <RatingCard
                label="Experience"
                value={review.experience_rating}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FeedbackBox
              title="Strengths"
              text={review.strengths}
            />

            <FeedbackBox
              title="Improvements"
              text={review.improvements}
            />

            <FeedbackBox
              title="Top Improvements"
              text={review.top_improvements}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonCard({
  title,
  name,
  roll,
}) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <p className="mt-2 font-semibold">
        {name || "Unknown"}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {roll || "—"}
      </p>
    </div>
  );
}

function MiniRating({
  label,
  value,
}) {
  return (
    <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
      {label}:{value || 0}
    </span>
  );
}

function getAverageRating(review) {
  const values = [
    review.formatting_rating,
    review.grammar_rating,
    review.skills_rating,
    review.projects_rating,
    review.experience_rating,
  ].map((value) => Number(value || 0));

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / 5
  );
}

function AdminPlaceholder({
  title,
  description,
  icon,
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Administration"
        title={title}
        description={description}
      />

      <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1728] p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl text-blue-400">
          {icon}
        </div>

        <h2 className="mt-5 text-xl font-semibold">
          Coming next
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          This administration module will be implemented in
          the next step.
        </p>
      </div>
    </div>
  );
}

function ResumePage({
  resumes,
  loading,
  pendingFile,
  onFileSelected,
  onUpload,
  onCancelSelection,
  onDownloadResume,
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Your Resume"
        title="My Resume"
        description="Upload and manage your resume versions."
      />

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">
              Upload new version
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              PDF or DOCX · Maximum 5 MB
            </p>

            {pendingFile && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Selected resume
                </p>

                <p className="mt-1 truncate text-sm font-medium text-slate-200">
                  {pendingFile.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {(pendingFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-center text-sm font-semibold hover:border-slate-600 hover:bg-slate-900">
              {pendingFile ? "Change Resume" : "Choose Resume"}

              <input
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(event) => {
                  onFileSelected(event.target.files?.[0]);
                  event.target.value = "";
                }}
                disabled={loading}
              />
            </label>

            {pendingFile && (
              <>
                <button
                  type="button"
                  onClick={onUpload}
                  disabled={loading}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Uploading..." : "Upload Selected Resume"}
                </button>

                <button
                  type="button"
                  onClick={onCancelSelection}
                  disabled={loading}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            My uploaded resumes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Only resumes uploaded by you are shown here.
          </p>
        </div>

        <div className="space-y-3">
          {resumes.length === 0 ? (
            <EmptyCard
              title="No resume uploaded yet"
              description="Choose a PDF or DOCX above to upload your first resume."
            />
          ) : (
            resumes.map((resume) => (
              <div
                key={resume.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">
                      Resume V{resume.version}
                    </h3>

                    <StatusBadge
                      status={resume.status}
                    />
                  </div>

                  <p className="mt-1 truncate text-sm text-slate-500">
                    {resume.file_name}
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Uploaded {""}
                    {new Date(
                      resume.uploaded_at
                    ).toLocaleDateString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onDownloadResume(resume)}
                  className="shrink-0 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                >
                  Open / Download
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PeerReviewPage({
  currentAssignment,
  assignmentLoading,
  onGetAssignment,
  onOpenResume,
  reviewForm,
  setReviewForm,
  onSubmit,
  submitting,
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Peer Review"
        title="Review a Resume"
        description="Help another student improve their resume with specific, constructive feedback."
      />

      {!currentAssignment ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl text-blue-400">
            ✓
          </div>

          <h2 className="mt-5 text-xl font-semibold">
            Ready to help a peer?
          </h2>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            You will receive another student's latest resume.
          </p>

          <button
            onClick={onGetAssignment}
            disabled={assignmentLoading}
            className="mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
          >
            {assignmentLoading
              ? "Finding a resume..."
              : "Get Resume to Review"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Assigned Resume
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Peer Resume
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                    {currentAssignment.branch}
                  </span>

                  {currentAssignment.target_role && (
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                      {currentAssignment.target_role}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={onOpenResume}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Open Resume
              </button>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold">
                Rate the Resume
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Rate each category from 1 to 5.
              </p>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <RatingField
                  label="Formatting"
                  value={reviewForm.formatting_rating}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      formatting_rating: value,
                    }))
                  }
                />

                <RatingField
                  label="Grammar"
                  value={reviewForm.grammar_rating}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      grammar_rating: value,
                    }))
                  }
                />

                <RatingField
                  label="Skills"
                  value={reviewForm.skills_rating}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      skills_rating: value,
                    }))
                  }
                />

                <RatingField
                  label="Projects"
                  value={reviewForm.projects_rating}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      projects_rating: value,
                    }))
                  }
                />

                <RatingField
                  label="Experience"
                  value={reviewForm.experience_rating}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      experience_rating: value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold">
                Written Feedback
              </h2>

              <div className="mt-6 space-y-5">
                <TextAreaField
                  label="Strengths"
                  placeholder="What does this resume do well?"
                  value={reviewForm.strengths}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      strengths: value,
                    }))
                  }
                />

                <TextAreaField
                  label="Improvements"
                  placeholder="What could be improved?"
                  value={reviewForm.improvements}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      improvements: value,
                    }))
                  }
                />

                <TextAreaField
                  label="Top Improvements"
                  placeholder="What are the 1–3 most important changes?"
                  value={reviewForm.top_improvements}
                  onChange={(value) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      top_improvements: value,
                    }))
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 px-6 py-3.5 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting
                ? "Submitting Review..."
                : "Submit Peer Review"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function FeedbackPage({ feedback }) {
  return (
    <div>
      <SectionHeader
        eyebrow="Feedback"
        title="Feedback Received"
        description="See what your peers think about your resume."
      />

      {feedback.length === 0 ? (
        <EmptyCard
          title="No feedback yet"
          description="Once another student reviews your resume, their feedback will appear here."
        />
      ) : (
        <div className="space-y-5">
          {feedback.map((review) => (
            <div
              key={review.review_id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold">
                    Resume V{review.resume_version}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(
                      review.submitted_at
                    ).toLocaleDateString()}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400">
                  Avg.{" "}
                  {getAverageRating(review).toFixed(1)}
                  /5
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-5">
                <RatingCard
                  label="Formatting"
                  value={review.formatting_rating}
                />

                <RatingCard
                  label="Grammar"
                  value={review.grammar_rating}
                />

                <RatingCard
                  label="Skills"
                  value={review.skills_rating}
                />

                <RatingCard
                  label="Projects"
                  value={review.projects_rating}
                />

                <RatingCard
                  label="Experience"
                  value={review.experience_rating}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <FeedbackBox
                  title="Strengths"
                  text={review.strengths}
                />

                <FeedbackBox
                  title="Improvements"
                  text={review.improvements}
                />

                <FeedbackBox
                  title="Top Improvements"
                  text={review.top_improvements}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfilePage({
  profileForm,
  setProfileForm,
  onSave,
  email,
}) {
  return (
    <div>
      <SectionHeader
        eyebrow="Account"
        title="Profile"
        description="Keep your student information up to date."
      />

      <form
        onSubmit={onSave}
        className="max-w-3xl rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl p-6"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <InputField
            label="Full Name"
            value={profileForm.full_name}
            onChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                full_name: value,
              }))
            }
          />

          <InputField
            label="Email"
            value={email || ""}
            disabled
            onChange={() => {}}
          />

          <InputField
            label="Roll Number"
            value={profileForm.roll_number}
            disabled
            onChange={() => {}}
          />

          <InputField
            label="Branch"
            value={profileForm.branch}
            onChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                branch: value,
              }))
            }
          />

          <InputField
            label="Target Role *"
            value={profileForm.target_role}
            onChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                target_role: value,
              }))
            }
            placeholder="e.g. Software Engineer"
          />
        </div>

        <button
          type="submit"
          className="mt-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="min-w-0">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/10 bg-blue-500/[0.06] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,.9)]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">{eyebrow}</p>
        </div>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StatCard({ label, value, description, icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-xl shadow-black/10 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/15 hover:bg-white/[0.035]">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition group-hover:bg-blue-500/15" />
      <div className="relative flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-500/10 text-lg text-blue-300">{icon}</div>
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
      </div>
      <p className="relative mt-5 text-sm font-semibold text-slate-200">{label}</p>
      <p className="relative mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function AdminStatCard({ label, value, icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-xl shadow-black/10 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/15">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/10 bg-indigo-500/10 text-lg text-indigo-300">{icon}</div>
        <span className="text-2xl font-bold tracking-tight">{value ?? 0}</span>
      </div>
      <p className="relative mt-5 text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}

function ActivityRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.07] pb-3 last:border-0">
      <span className="text-sm text-slate-400">
        {label}
      </span>

      <span className="font-semibold">
        {value ?? 0}
      </span>
    </div>
  );
}

function QueueRow({
  label,
  value,
  icon,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-4">
      <div className="flex items-center gap-3">
        <span className="text-lg text-slate-400">
          {icon}
        </span>

        <span className="text-sm text-slate-300">
          {label}
        </span>
      </div>

      <span className="rounded-lg bg-slate-800 px-3 py-1 text-sm font-bold">
        {value ?? 0}
      </span>
    </div>
  );
}

function TableHeader({ children }) {
  return (
    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

function LoadingCard({ text }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />

      <p className="text-sm text-slate-400">
        {text}
      </p>
    </div>
  );
}

function EmptyCard({
  title,
  description,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
      <p className="font-medium">
        {title}
      </p>

      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ErrorCard({ text }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
      <p className="font-semibold text-red-400">
        {text}
      </p>
    </div>
  );
}

function RatingField({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-medium text-slate-300">
        {label}
      </label>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            type="button"
            key={rating}
            onClick={() => onChange(rating)}
            className={`h-10 w-10 rounded-lg text-sm font-semibold ${
              value === rating
                ? "bg-blue-600 text-white"
                : "bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingCard({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-3 text-center">
      <p className="text-[11px] text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold">
        {value}/5
      </p>
    </div>
  );
}

function FeedbackBox({
  title,
  text,
}) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
        {title}
      </p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
        {text || "No feedback provided."}
      </p>
    </div>
  );
}

function TextAreaField({
  label,
  placeholder,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        rows={5}
        className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
      />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : ""
        }`}
      />
    </div>
  );
}

function Message({
  type,
  text,
}) {
  const styles = {
    success:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    error:
      "border-red-500/20 bg-red-500/10 text-red-400",
    info:
      "border-blue-500/20 bg-blue-500/10 text-blue-400",
  };

  return (
    <div
      className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
        styles[type] || styles.info
      }`}
    >
      {text}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active:
      "bg-emerald-500/10 text-emerald-400",
    archived:
      "bg-slate-800 text-slate-500",
    under_review:
      "bg-amber-500/10 text-amber-400",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] ||
        "bg-slate-800 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);

  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.floor(
    Math.log(value) / Math.log(1024)
  );

  return `${(
    value /
    Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 2)} ${
    units[index] || "GB"
  }`;
}

export default App;