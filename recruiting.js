const STORAGE_KEY = "utah-flight-recruiting-profiles";
const PROFILE_PAGE = window.location.pathname.split("/").pop() || "recruiting-dashboard.html";
let currentUser = null;
let serverPlayers = [];
let pendingProfiles = [];

const basePlayers = [
  {
    id: "sam-davis",
    name: "Sam Davis",
    gradYear: "2026",
    school: "Cedar Valley High School",
    team: "Utah Flight 18s",
    location: "Eagle Mountain, UT",
    jersey: "3",
    positions: ["OH", "DS"],
    height: "5'10\"",
    weight: "160 lbs",
    gpa: "3.8",
    hand: "Right",
    email: "player@example.com",
    coachEmail: "coach@example.com",
    phone: "",
    photo: "assets/media/sam-davis-maxpreps-profile.jpg",
    highlightUrl: "assets/media/flight 2025 highlight video mtn view.mp4",
    hudlUrl: "https://www.hudl.com/profile/18922745/Sam-Davis",
    maxPrepsUrl: "https://www.maxpreps.com/ut/eagle-mountain/cedar-valley-aviators/athletes/sam-davis/volleyball/boys/stats/?careerid=uvm0k38lv1pue",
    bio: "Six-rotation outside and defensive specialist with varsity experience, consistent serve receive, and competitive club tournament results.",
    stats: {
      kills: "169",
      digs: "371",
      assists: "26",
      blocks: "30",
      aces: "54",
      hitting: ".131"
    },
    seasons: [
      { season: "2025-26", sp: "88", kills: "93", digs: "188", aces: "32", blocks: "18" },
      { season: "2024-25", sp: "108", kills: "76", digs: "183", aces: "22", blocks: "12" }
    ]
  },
  {
    id: "flight-2027-pin",
    name: "Utah Flight Prospect",
    gradYear: "2027",
    school: "Eagle Mountain Area",
    team: "Utah Flight 17s",
    location: "Utah County, UT",
    jersey: "12",
    positions: ["OPP", "OH"],
    height: "6'2\"",
    weight: "175 lbs",
    gpa: "3.6",
    hand: "Left",
    email: "",
    coachEmail: "coach@example.com",
    phone: "",
    photo: "assets/media/Utah Flight 2025 Mountain Peak tournament champs.JPEG",
    highlightUrl: "assets/media/flight 2025 highlight video mtn view.mp4",
    hudlUrl: "",
    maxPrepsUrl: "",
    bio: "Physical pin attacker with a strong approach, improving blocking footwork, and high interest in college volleyball opportunities.",
    stats: {
      kills: "118",
      digs: "96",
      assists: "11",
      blocks: "42",
      aces: "28",
      hitting: ".218"
    },
    seasons: [
      { season: "2025 Club", sp: "72", kills: "118", digs: "96", aces: "28", blocks: "42" }
    ]
  },
  {
    id: "flight-2028-libero",
    name: "Utah Flight Libero",
    gradYear: "2028",
    school: "Eagle Mountain Area",
    team: "Utah Flight 16s",
    location: "Eagle Mountain, UT",
    jersey: "8",
    positions: ["L", "DS"],
    height: "5'8\"",
    weight: "145 lbs",
    gpa: "3.9",
    hand: "Right",
    email: "",
    coachEmail: "coach@example.com",
    phone: "",
    photo: "assets/media/Utah Flight 2025 vortex runner up.JPEG",
    highlightUrl: "assets/media/flight 2025 highlight video mtn view.mp4",
    hudlUrl: "",
    maxPrepsUrl: "",
    bio: "High-energy ball control athlete with steady serve receive, aggressive floor defense, and strong communication habits.",
    stats: {
      kills: "4",
      digs: "244",
      assists: "48",
      blocks: "0",
      aces: "37",
      hitting: ".000"
    },
    seasons: [
      { season: "2025 Club", sp: "66", kills: "4", digs: "244", aces: "37", blocks: "0" }
    ]
  }
];

function $(id) {
  return document.getElementById(id);
}

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

function getPlayers() {
  return [...basePlayers, ...serverPlayers];
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

function getEmbedUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video/${parsed.pathname.replace("/", "")}`;
    }
  } catch (error) {
    return url;
  }

  return url;
}

function isVideoFile(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || "");
}

function getHighlightUrls(player) {
  return (player.highlightUrls?.length ? player.highlightUrls : [player.highlightUrl])
    .filter(Boolean)
    .slice(0, 5);
}

function renderHighlightLinks(urls) {
  if (urls.length <= 1) {
    return "";
  }

  return `
    <div class="highlight-link-list">
      ${urls.map((url, index) => `
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Highlight ${index + 1}</a>
      `).join("")}
    </div>
  `;
}

function renderVideo(player) {
  const urls = getHighlightUrls(player);
  const url = urls[0];
  if (!url) {
    return `<div class="empty-state">No film link added yet.</div>`;
  }

  if (isVideoFile(url)) {
    return `<video controls src="${escapeHtml(url)}"></video>${renderHighlightLinks(urls)}`;
  }

  const embedUrl = getEmbedUrl(url);
  if (embedUrl.includes("/embed/") || embedUrl.includes("player.vimeo.com")) {
    return `<iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(player.name)} highlight video" allowfullscreen></iframe>${renderHighlightLinks(urls)}`;
  }

  return `<a class="button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open Highlight Film</a>${renderHighlightLinks(urls)}`;
}

function renderSummary(players) {
  const years = new Set(players.map((player) => player.gradYear).filter(Boolean));
  const videos = players.filter((player) => getHighlightUrls(player).length || player.hudlUrl).length;
  $("profile-count").textContent = players.length;
  $("grad-years").textContent = years.size;
  $("video-count").textContent = videos;
}

function populateFilters(players) {
  const years = [...new Set(players.map((player) => player.gradYear).filter(Boolean))].sort();
  const positions = [...new Set(players.flatMap((player) => player.positions || []))].sort();
  $("year-filter").innerHTML = `<option value="all">All years</option>${years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("")}`;
  $("position-filter").innerHTML = `<option value="all">All positions</option>${positions.map((position) => `<option value="${escapeHtml(position)}">${escapeHtml(position)}</option>`).join("")}`;
}

function renderPlayerCards(players) {
  const query = $("search-input").value.trim().toLowerCase();
  const year = $("year-filter").value;
  const position = $("position-filter").value;
  const filtered = players.filter((player) => {
    const haystack = [player.name, player.school, player.team, player.location, ...(player.positions || [])].join(" ").toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesYear = year === "all" || player.gradYear === year;
    const matchesPosition = position === "all" || (player.positions || []).includes(position);
    return matchesSearch && matchesYear && matchesPosition;
  });

  $("player-grid").innerHTML = filtered.length
    ? filtered.map(renderPlayerCard).join("")
    : `<div class="empty-state">No profiles match the current filters.</div>`;
}

function renderAuth() {
  const loginForm = $("login-form");
  const sessionPanel = $("session-panel");
  const adminReview = $("admin-review");

  loginForm.hidden = Boolean(currentUser);
  sessionPanel.hidden = !currentUser;
  adminReview.hidden = currentUser?.role !== "admin";

  if (currentUser) {
    $("session-user").textContent = `${currentUser.username} (${currentUser.role})`;
    $("session-copy").textContent = currentUser.role === "admin"
      ? "You can review, approve, or reject pending player profiles."
      : "You can submit player profile updates for admin approval.";
  }
}

function renderPendingProfiles() {
  const grid = $("pending-grid");
  if (!grid) {
    return;
  }

  grid.innerHTML = pendingProfiles.length
    ? pendingProfiles.map((profile) => {
      const stats = profile.stats || {};
      return `
        <article class="review-card">
          <div>
            <p class="profile-meta">${escapeHtml(profile.gradYear || "Grad Year TBD")} • Submitted by ${escapeHtml(profile.submittedBy || "unknown")}</p>
            <h3>${escapeHtml(profile.name)}</h3>
            <p>${escapeHtml(profile.school || "School TBD")} • ${escapeHtml(profile.location || "Location TBD")}</p>
            <div class="badge-list">
              ${(profile.positions || []).map((position) => `<span class="badge">${escapeHtml(position)}</span>`).join("")}
              <span class="badge">#${escapeHtml(profile.jersey || "-")}</span>
              <span class="badge">${escapeHtml(profile.height || "Height TBD")}</span>
            </div>
          </div>
          <div class="card-stats">
            <div class="mini-stat"><strong>${escapeHtml(stats.kills || "0")}</strong><span>Kills</span></div>
            <div class="mini-stat"><strong>${escapeHtml(stats.digs || "0")}</strong><span>Digs</span></div>
            <div class="mini-stat"><strong>${escapeHtml(stats.aces || "0")}</strong><span>Aces</span></div>
          </div>
          <div class="review-actions">
            <button class="button" type="button" data-action="approve" data-id="${escapeHtml(profile.id)}">Approve</button>
            <button class="button button-ghost" type="button" data-action="edit" data-id="${escapeHtml(profile.id)}">Edit In Form</button>
            <button class="button button-ghost" type="button" data-action="reject" data-id="${escapeHtml(profile.id)}">Reject</button>
          </div>
        </article>
      `;
    }).join("")
    : `<div class="empty-state">No pending profiles right now.</div>`;
}

function renderPlayerCard(player) {
  const stats = player.stats || {};
  return `
    <article class="player-card">
      <img src="${escapeHtml(player.photo || "assets/media/gallery-placeholder.svg")}" alt="${escapeHtml(player.name)}" />
      <div class="player-card-body">
        <div class="player-card-header">
          <div>
            <p class="profile-meta">${escapeHtml(player.gradYear)} Graduate</p>
            <h3>${escapeHtml(player.name)}</h3>
          </div>
          <span class="badge">#${escapeHtml(player.jersey || "-")}</span>
        </div>
        <div class="badge-list">
          ${(player.positions || []).map((position) => `<span class="badge">${escapeHtml(position)}</span>`).join("")}
          <span class="badge">${escapeHtml(player.height || "Height TBD")}</span>
          <span class="badge">${escapeHtml(player.school || "School TBD")}</span>
        </div>
        <div class="card-stats">
          <div class="mini-stat"><strong>${escapeHtml(stats.kills || "0")}</strong><span>Kills</span></div>
          <div class="mini-stat"><strong>${escapeHtml(stats.digs || "0")}</strong><span>Digs</span></div>
          <div class="mini-stat"><strong>${escapeHtml(stats.aces || "0")}</strong><span>Aces</span></div>
        </div>
        <a class="button button-ghost" href="${PROFILE_PAGE}?player=${encodeURIComponent(player.id)}#profile">View Profile</a>
      </div>
    </article>
  `;
}

function renderProfile(player) {
  const stats = player.stats || {};
  $("profile").hidden = false;
  $("profile-view").innerHTML = `
    <div class="profile-hero">
      <img class="profile-photo" src="${escapeHtml(player.photo || "assets/media/gallery-placeholder.svg")}" alt="${escapeHtml(player.name)}" />
      <div class="profile-panel">
        <div>
          <p class="profile-meta">${escapeHtml(player.gradYear)} Graduate • ${escapeHtml(player.team || "Utah Flight")}</p>
          <div class="profile-title">
            <h2>${escapeHtml(player.name)}</h2>
            <span class="profile-number">${escapeHtml(player.jersey || "-")}</span>
          </div>
          <div class="badge-list">
            ${(player.positions || []).map((position) => `<span class="badge">${escapeHtml(position)}</span>`).join("")}
            <span class="badge">${escapeHtml(player.height || "Height TBD")}</span>
            <span class="badge">${escapeHtml(player.weight || "Weight TBD")}</span>
            <span class="badge">${escapeHtml(player.hand || "Hand TBD")}</span>
            <span class="badge">GPA ${escapeHtml(player.gpa || "TBD")}</span>
          </div>
          <p>${escapeHtml(player.school || "School TBD")} • ${escapeHtml(player.location || "Location TBD")}</p>
        </div>
        <div class="profile-actions">
          ${player.email ? `<a class="button" href="mailto:${escapeHtml(player.email)}">Email Player</a>` : ""}
          ${player.coachEmail ? `<a class="button button-ghost" href="mailto:${escapeHtml(player.coachEmail)}">Email Coach</a>` : ""}
          ${player.hudlUrl ? `<a class="button button-ghost" href="${escapeHtml(player.hudlUrl)}" target="_blank" rel="noreferrer">Hudl</a>` : ""}
          ${player.maxPrepsUrl ? `<a class="button button-ghost" href="${escapeHtml(player.maxPrepsUrl)}" target="_blank" rel="noreferrer">MaxPreps</a>` : ""}
        </div>
      </div>
    </div>

    <div class="profile-grid">
      <div class="video-panel">
        <p class="panel-label">Highlight Film</p>
        <div class="video-frame">${renderVideo(player)}</div>
      </div>
      <div class="notes-panel">
        <p class="panel-label">Recruiting Notes</p>
        <p>${escapeHtml(player.bio || "No recruiting notes added yet.")}</p>
      </div>
    </div>

    <div class="profile-grid">
      <div class="profile-panel">
        <p class="panel-label">Top Stats</p>
        <div class="profile-stats">
          <div class="stat-card"><strong>${escapeHtml(stats.kills || "0")}</strong><span>Kills</span></div>
          <div class="stat-card"><strong>${escapeHtml(stats.digs || "0")}</strong><span>Digs</span></div>
          <div class="stat-card"><strong>${escapeHtml(stats.assists || "0")}</strong><span>Assists</span></div>
          <div class="stat-card"><strong>${escapeHtml(stats.blocks || "0")}</strong><span>Blocks</span></div>
          <div class="stat-card"><strong>${escapeHtml(stats.aces || "0")}</strong><span>Aces</span></div>
          <div class="stat-card"><strong>${escapeHtml(stats.hitting || ".000")}</strong><span>Hitting %</span></div>
        </div>
      </div>
      <div class="profile-panel">
        <p class="panel-label">Season Table</p>
        <table class="stat-table">
          <thead>
            <tr>
              <th>Season</th>
              <th>SP</th>
              <th>K</th>
              <th>D</th>
              <th>Aces</th>
              <th>Blocks</th>
            </tr>
          </thead>
          <tbody>
            ${(player.seasons || []).map((season) => `
              <tr>
                <td>${escapeHtml(season.season)}</td>
                <td>${escapeHtml(season.sp)}</td>
                <td>${escapeHtml(season.kills)}</td>
                <td>${escapeHtml(season.digs)}</td>
                <td>${escapeHtml(season.aces)}</td>
                <td>${escapeHtml(season.blocks)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
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

async function loadSession() {
  const data = await apiRequest("/api/session");
  currentUser = data.user;
  renderAuth();
  const params = new URLSearchParams(window.location.search);
  if (params.get("login") === "google-failed") {
    $("login-status").textContent = "Google login could not be completed. Check the OAuth settings and redirect URI.";
  }
  if (params.get("login") === "google-unconfigured") {
    $("login-status").textContent = "Google login is not configured yet. Add the Google OAuth environment variables first.";
  }
}

async function loadServerProfiles() {
  const data = await apiRequest("/api/profiles");
  serverPlayers = data.profiles || [];
}

async function loadAdminProfiles() {
  if (currentUser?.role !== "admin") {
    pendingProfiles = [];
    renderPendingProfiles();
    return;
  }

  const data = await apiRequest("/api/admin/profiles");
  pendingProfiles = data.pending || [];
  renderPendingProfiles();
}

function setField(form, name, value) {
  const field = form.elements[name];
  if (!field || value === undefined || value === null || value === "") {
    return;
  }

  field.value = Array.isArray(value) ? value.join(", ") : value;
}

function fillFormFromMaxPreps(profile) {
  fillFormFromProfile(profile);
}

function fillFormFromProfile(profile) {
  const form = $("player-form");
  const stats = profile.stats || {};
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
  setField(form, "bio", profile.bio);
  setField(form, "photo", profile.photo);
  const highlightUrls = profile.highlightUrls?.length ? profile.highlightUrls : [profile.highlightUrl].filter(Boolean);
  setField(form, "highlightUrl", highlightUrls[0]);
  setField(form, "highlightUrl2", highlightUrls[1]);
  setField(form, "highlightUrl3", highlightUrls[2]);
  setField(form, "highlightUrl4", highlightUrls[3]);
  setField(form, "highlightUrl5", highlightUrls[4]);
  setField(form, "maxPrepsUrl", profile.maxPrepsUrl);
  setField(form, "kills", stats.kills);
  setField(form, "digs", stats.digs);
  setField(form, "assists", stats.assists);
  setField(form, "blocks", stats.blocks);
  setField(form, "aces", stats.aces);
  setField(form, "hitting", stats.hitting);
  setField(form, "seasonsJson", JSON.stringify(profile.seasons || []));
}

function bindMaxPrepsImport() {
  const button = $("maxpreps-import-button");
  const input = $("maxpreps-import-url");
  const status = $("import-status");

  button.addEventListener("click", async () => {
    const url = input.value.trim();
    if (!url) {
      status.textContent = "Paste a MaxPreps player URL first.";
      return;
    }

    button.disabled = true;
    status.textContent = "Importing MaxPreps profile...";

    try {
      const response = await fetch(`/api/import-maxpreps?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to import MaxPreps profile.");
      }

      fillFormFromMaxPreps(data.profile);
      status.textContent = `${data.profile.name || "Player"} was imported. Review the fields, then save the profile draft.`;
    } catch (error) {
      status.textContent = error.message || "Unable to import MaxPreps profile.";
    } finally {
      button.disabled = false;
    }
  });
}

function bindForm() {
  const form = $("player-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) {
      $("form-status").textContent = "Please login before submitting a player profile.";
      $("login").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const profile = profileFromForm(form);
    try {
      const data = await apiRequest("/api/profiles", {
        method: "POST",
        body: JSON.stringify({ profile })
      });
      form.reset();
      $("form-status").textContent = data.message;
      await boot();
      if (data.status === "approved") {
        history.replaceState(null, "", `${PROFILE_PAGE}?player=${encodeURIComponent(data.profile.id)}#profile`);
        renderProfile(data.profile);
        $("profile").scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        $("admin-review").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (error) {
      $("form-status").textContent = error.message;
    }
  });
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
      $("login-status").textContent = "Logged in.";
      await boot();
      $("submit").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      $("login-status").textContent = error.message;
    }
  });

  $("logout-button").addEventListener("click", async () => {
    await apiRequest("/api/logout", { method: "POST", body: "{}" });
    currentUser = null;
    $("login-status").textContent = "Logged out.";
    await boot();
  });
}

function bindAdminReview() {
  $("pending-grid").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    if (action === "edit") {
      const profile = pendingProfiles.find((item) => item.id === id);
      if (profile) {
        fillFormFromProfile(profile);
        $("form-status").textContent = "Pending profile loaded. Edit the fields, then save to publish as admin.";
        $("submit").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    try {
      const data = await apiRequest(`/api/admin/profiles/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        body: "{}"
      });
      $("login-status").textContent = data.message;
      await boot();
    } catch (error) {
      $("login-status").textContent = error.message;
    }
  });
}

function bindFilters() {
  ["search-input", "year-filter", "position-filter"].forEach((id) => {
    $(id).addEventListener("input", () => renderPlayerCards(getPlayers()));
  });
}

async function boot() {
  await loadSession();
  await loadServerProfiles();
  await loadAdminProfiles();
  const players = getPlayers();
  renderSummary(players);
  populateFilters(players);
  renderPlayerCards(players);

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("player");
  const player = players.find((item) => item.id === requestedId);
  if (player) {
    renderProfile(player);
  }
}

bindForm();
bindLogin();
bindAdminReview();
bindMaxPrepsImport();
boot();
bindFilters();
