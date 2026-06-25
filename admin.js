const $ = (id) => document.getElementById(id);

let currentUser = null;
let pendingProfiles = [];
let approvedProfiles = [];
let activeProfile = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "player")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function getProfileStatus(profile) {
  return profile.status === "approved" ? "Live" : "Need approve";
}

function getAllProfiles() {
  return [
    ...pendingProfiles.map((profile) => ({ ...profile, status: "pending" })),
    ...approvedProfiles.map((profile) => ({ ...profile, status: "approved" }))
  ];
}

function setView(view) {
  $("admin-login").hidden = view !== "login";
  $("admin-list").hidden = view !== "list";
  $("admin-review").hidden = view !== "review";
}

function showLoginMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "google-failed") {
    $("login-status").textContent = "Google login could not be completed. Check the OAuth settings and redirect URI.";
  }
  if (params.get("login") === "google-unconfigured") {
    $("login-status").textContent = "Google login is not configured yet. Add the Google OAuth environment variables first.";
  }
}

async function loadSession() {
  const data = await apiRequest("/api/session");
  currentUser = data.user;
  if (!currentUser) {
    setView("login");
    showLoginMessage();
    return false;
  }
  if (currentUser.role !== "admin") {
    setView("login");
    $("login-status").textContent = "This page requires an admin login.";
    return false;
  }
  return true;
}

async function loadProfiles() {
  const data = await apiRequest("/api/admin/profiles");
  pendingProfiles = data.pending || [];
  approvedProfiles = data.approved || [];
}

function renderSubmissionsList() {
  const profiles = getAllProfiles().sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }
    return String(b.updatedAt || b.submittedAt || "").localeCompare(String(a.updatedAt || a.submittedAt || ""));
  });
  const pendingCount = pendingProfiles.length;
  const liveCount = approvedProfiles.length;

  $("admin-summary").textContent = `${pendingCount} need approval. ${liveCount} live.`;
  $("submissions-list").innerHTML = profiles.length
    ? profiles.map((profile) => {
      const status = getProfileStatus(profile);
      return `
        <article class="admin-submission-row">
          <img src="${escapeHtml(profile.photo || "assets/media/gallery-placeholder.svg")}" alt="${escapeHtml(profile.name)}" />
          <div>
            <div class="admin-submission-title">
              <h3>${escapeHtml(profile.name)}</h3>
              <span class="status-pill ${profile.status === "approved" ? "status-live" : "status-pending"}">${escapeHtml(status)}</span>
            </div>
            <p>${escapeHtml(profile.gradYear || "Grad year TBD")} • ${escapeHtml(profile.school || "School TBD")} • ${escapeHtml(profile.team || "Utah Flight")}</p>
            <p class="profile-meta">Submitted by ${escapeHtml(profile.submittedBy || "unknown")}</p>
          </div>
          <a class="button button-ghost" href="admin.html?profile=${encodeURIComponent(profile.id)}">${profile.status === "approved" ? "Review / Edit" : "Review / Approve"}</a>
        </article>
      `;
    }).join("")
    : `<div class="empty-state">No submissions yet.</div>`;
}

function profileFromForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  let seasons = [];
  try {
    seasons = data.seasonsJson ? JSON.parse(data.seasonsJson) : [];
  } catch (error) {
    seasons = [];
  }

  return {
    id: data.id || slugify(`${data.name}-${data.gradYear}`),
    name: data.name,
    gradYear: data.gradYear,
    school: data.school,
    team: data.team || "Utah Flight",
    location: data.location,
    jersey: data.jersey,
    positions: data.positions.split(",").map((item) => item.trim()).filter(Boolean),
    height: data.height,
    weight: data.weight,
    gpa: data.gpa,
    hand: data.hand,
    email: data.email,
    coachEmail: data.coachEmail,
    phone: data.phone,
    photo: data.photo || "assets/media/gallery-placeholder.svg",
    highlightUrl: data.highlightUrl,
    highlightUrls: [
      data.highlightUrl,
      data.highlightUrl2,
      data.highlightUrl3,
      data.highlightUrl4,
      data.highlightUrl5
    ].map((item) => item.trim()).filter(Boolean).slice(0, 5),
    hudlUrl: data.hudlUrl,
    maxPrepsUrl: data.maxPrepsUrl,
    bio: data.bio,
    stats: {
      summary: data.statsSummary,
      kills: data.kills || "0",
      digs: data.digs || "0",
      assists: data.assists || "0",
      blocks: data.blocks || "0",
      aces: data.aces || "0",
      hitting: data.hitting || ".000"
    },
    seasons: seasons.length ? seasons : [
      {
        season: "Current",
        sp: "-",
        kills: data.kills || "0",
        digs: data.digs || "0",
        aces: data.aces || "0",
        blocks: data.blocks || "0"
      }
    ]
  };
}

function setField(form, name, value) {
  const field = form.elements[name];
  if (!field || value === undefined || value === null || value === "") {
    return;
  }
  field.value = Array.isArray(value) ? value.join(", ") : value;
}

function fillForm(profile) {
  const form = $("admin-profile-form");
  const stats = profile.stats || {};
  const highlightUrls = profile.highlightUrls?.length ? profile.highlightUrls : [profile.highlightUrl].filter(Boolean);

  form.reset();
  setField(form, "id", profile.id);
  setField(form, "name", profile.name);
  setField(form, "gradYear", profile.gradYear);
  setField(form, "school", profile.school);
  setField(form, "team", profile.team || "Utah Flight");
  setField(form, "location", profile.location);
  setField(form, "jersey", profile.jersey);
  setField(form, "positions", profile.positions);
  setField(form, "height", profile.height);
  setField(form, "weight", profile.weight);
  setField(form, "gpa", profile.gpa);
  setField(form, "hand", profile.hand);
  setField(form, "email", profile.email);
  setField(form, "coachEmail", profile.coachEmail);
  setField(form, "phone", profile.phone);
  setField(form, "bio", profile.bio);
  setField(form, "photo", profile.photo);
  setField(form, "highlightUrl", highlightUrls[0]);
  setField(form, "highlightUrl2", highlightUrls[1]);
  setField(form, "highlightUrl3", highlightUrls[2]);
  setField(form, "highlightUrl4", highlightUrls[3]);
  setField(form, "highlightUrl5", highlightUrls[4]);
  setField(form, "hudlUrl", profile.hudlUrl);
  setField(form, "maxPrepsUrl", profile.maxPrepsUrl);
  setField(form, "statsSummary", stats.summary);
  setField(form, "kills", stats.kills);
  setField(form, "digs", stats.digs);
  setField(form, "assists", stats.assists);
  setField(form, "blocks", stats.blocks);
  setField(form, "aces", stats.aces);
  setField(form, "hitting", stats.hitting);
  setField(form, "seasonsJson", JSON.stringify(profile.seasons || []));
}

function renderReview(profile) {
  activeProfile = profile;
  $("review-title").textContent = profile.name || "Athlete Profile";
  $("review-status").textContent = `${getProfileStatus(profile)} • Submitted by ${profile.submittedBy || "unknown"}`;
  $("reject-button").hidden = profile.status === "approved";
  $("form-status").textContent = "";
  fillForm(profile);
  setView("review");
}

function bindLogin() {
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify(body)
      });
      currentUser = data.user;
      form.reset();
      await boot();
    } catch (error) {
      $("login-status").textContent = error.message;
    }
  });
}

function bindLogout() {
  $("logout-button").addEventListener("click", async () => {
    await apiRequest("/api/logout", { method: "POST", body: "{}" });
    currentUser = null;
    pendingProfiles = [];
    approvedProfiles = [];
    history.replaceState(null, "", "admin.html");
    setView("login");
  });
}

function bindReviewForm() {
  $("admin-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = profileFromForm(event.currentTarget);
    try {
      const data = await apiRequest("/api/profiles", {
        method: "POST",
        body: JSON.stringify({ profile })
      });
      $("form-status").textContent = data.message || "Profile saved and published.";
      await loadProfiles();
      renderSubmissionsList();
      history.replaceState(null, "", "admin.html");
      setView("list");
    } catch (error) {
      $("form-status").textContent = error.message;
    }
  });

  $("reject-button").addEventListener("click", async () => {
    if (!activeProfile) {
      return;
    }
    try {
      const data = await apiRequest(`/api/admin/profiles/${encodeURIComponent(activeProfile.id)}/reject`, {
        method: "POST",
        body: "{}"
      });
      $("form-status").textContent = data.message || "Profile rejected.";
      await loadProfiles();
      renderSubmissionsList();
      history.replaceState(null, "", "admin.html");
      setView("list");
    } catch (error) {
      $("form-status").textContent = error.message;
    }
  });
}

async function boot() {
  const canContinue = await loadSession();
  if (!canContinue) {
    return;
  }

  await loadProfiles();
  renderSubmissionsList();

  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("profile");
  if (profileId) {
    const profile = getAllProfiles().find((item) => item.id === profileId);
    if (profile) {
      renderReview(profile);
      return;
    }
  }

  setView("list");
}

bindLogin();
bindLogout();
bindReviewForm();
boot();
