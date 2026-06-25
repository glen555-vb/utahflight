const PROFILE_PAGE = window.location.pathname.split("/").pop() || "recruiting.html";
let publicPlayers = [];

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

async function apiRequest(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function isVideoFile(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || "");
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

  return `
    <div class="highlight-link-card">
      <a class="button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open Highlight Film</a>
      ${renderHighlightLinks(urls)}
    </div>
  `;
}

function renderSummary(players) {
  if (!$("profile-count")) {
    return;
  }

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

function renderPlayerCard(player) {
  const stats = player.stats || {};
  return `
    <article class="player-card">
      <img src="${escapeHtml(player.photo || "assets/media/gallery-placeholder.svg")}" alt="${escapeHtml(player.name)}" />
      <div class="player-card-body">
        <div class="player-card-header">
          <div>
            <p class="profile-meta">${escapeHtml(player.gradYear || "Grad Year TBD")} Graduate</p>
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
    : `<div class="empty-state">No approved profiles are published yet.</div>`;
}

function renderProfile(player) {
  const stats = player.stats || {};
  const statsLabel = stats.summary ? `Top Stats - ${stats.summary}` : "Top Stats";
  $("profile").hidden = false;
  $("profile-view").innerHTML = `
    <div class="profile-hero">
      <img class="profile-photo" src="${escapeHtml(player.photo || "assets/media/gallery-placeholder.svg")}" alt="${escapeHtml(player.name)}" />
      <div class="profile-panel">
        <div>
          <p class="profile-meta">${escapeHtml(player.gradYear || "Grad Year TBD")} Graduate • ${escapeHtml(player.team || "Utah Flight")}</p>
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
        <p class="panel-label">${escapeHtml(statsLabel)}</p>
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
            <tr><th>Season</th><th>SP</th><th>K</th><th>D</th><th>Aces</th><th>Blocks</th></tr>
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

function bindFilters() {
  ["search-input", "year-filter", "position-filter"].forEach((id) => {
    $(id).addEventListener("input", () => renderPlayerCards(publicPlayers));
  });
}

async function boot() {
  const data = await apiRequest("/api/profiles");
  publicPlayers = data.profiles || [];
  renderSummary(publicPlayers);
  populateFilters(publicPlayers);
  renderPlayerCards(publicPlayers);

  const params = new URLSearchParams(window.location.search);
  const player = publicPlayers.find((item) => item.id === params.get("player"));
  if (player) {
    renderProfile(player);
  }
}

bindFilters();
boot().catch((error) => {
  $("player-grid").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
