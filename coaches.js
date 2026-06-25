const coaches = [
  {
    name: "Coach Name",
    role: "Club Director",
    teams: ["18s", "Program Lead"],
    photo: "assets/media/utah-flight-2026-logo.png",
    bio: "Add a short bio here about coaching background, volleyball experience, and what this person brings to Utah Flight."
  },
  {
    name: "Coach Name",
    role: "Head Coach",
    teams: ["High School Club"],
    photo: "assets/media/utah-flight-2026-logo.png",
    bio: "Use this space for a coach spotlight, coaching philosophy, certifications, playing background, or team responsibilities."
  },
  {
    name: "Staff Name",
    role: "Team Staff",
    teams: ["Operations", "Families"],
    photo: "assets/media/utah-flight-2026-logo.png",
    bio: "Add staff details here, including how this person supports athletes, coaches, tournaments, communication, or club operations."
  }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCoaches() {
  const grid = document.getElementById("coach-grid");
  grid.innerHTML = coaches.map((coach) => `
    <article class="coach-card">
      <img src="${escapeHtml(coach.photo)}" alt="${escapeHtml(coach.name)}" />
      <div class="coach-card-body">
        <p class="coach-role">${escapeHtml(coach.role)}</p>
        <h3>${escapeHtml(coach.name)}</h3>
        <div class="coach-meta">
          ${(coach.teams || []).map((team) => `<span class="coach-pill">${escapeHtml(team)}</span>`).join("")}
        </div>
        <p>${escapeHtml(coach.bio)}</p>
      </div>
    </article>
  `).join("");
}

renderCoaches();
