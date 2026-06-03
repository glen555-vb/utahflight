let content;
const DRAFT_KEY = "utah-flight-site-draft";
const DEFAULT_ABOUT = {
  title: "Competitive volleyball rooted in growth, character, and strong team culture.",
  copy: "Utah Flight gives athletes a clean, positive environment where they can develop skills, compete hard, and build strong friendships along the way.",
  quote: "We believe great teams are built through effort, character, and the way players treat each other."
};
const DEFAULT_RECRUITING = {
  title: "A positive club environment with real competitive goals",
  copy: "Families want a place where athletes improve, support one another, and enjoy the process. Utah Flight is built to develop strong players and strong teammates.",
  points: [
    "Skill development with purpose",
    "A clean and encouraging team culture",
    "Competitive teams that keep improving",
    "Friendships built through shared work"
  ]
};

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = $(id);
  if (!node) {
    return;
  }

  node.textContent = value ?? "";
}

function setHref(id, value) {
  const node = $(id);
  if (!node) {
    return;
  }

  node.href = value || "#";
}

function setSrc(id, value) {
  const node = $(id);
  if (!node) {
    return;
  }

  if (value) {
    node.src = value;
  } else {
    node.removeAttribute("src");
  }
}

function toggleBlock(node, shouldShow) {
  if (!node) {
    return;
  }

  node.style.display = shouldShow ? "" : "none";
}

function toggleSectionFromChild(id, shouldShow) {
  const node = $(id);
  const section = node?.closest("section");
  toggleBlock(section, shouldShow);
}

function toggleLinkByHash(hash, shouldShow) {
  const link = document.querySelector(`a[href="${hash}"]`);
  toggleBlock(link, shouldShow);
}

function getDraftModeContent() {
  const params = new URLSearchParams(window.location.search);
  const isDraftMode = params.get("draft") === "1";

  if (!isDraftMode) {
    return null;
  }

  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    return draft ? JSON.parse(draft) : null;
  } catch (error) {
    console.error("Unable to read draft preview content.", error);
    return null;
  }
}

function setRootTheme() {
  const { colors } = content.brand;
  const root = document.documentElement;
  root.style.setProperty("--bg", colors.background);
  root.style.setProperty("--bg-soft", colors.backgroundSoft);
  root.style.setProperty("--card", colors.card);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-soft", colors.accentSoft);
  root.style.setProperty("--text", colors.text);
  root.style.setProperty("--muted", colors.muted);
}

function fillBasics() {
  document.title = `${content.brand.name} Volleyball Club`;
  setSrc("brand-logo", content.brand.logo);
  setText("brand-eyebrow", content.brand.eyebrow);
  setText("brand-name", content.brand.name);
  setText("nav-cta", content.hero.primaryLabel);
  setHref("nav-cta", content.hero.primaryHref || "#contact");
  setText("hero-kicker", content.hero.kicker);
  setText("hero-title", content.hero.title);
  setText("hero-copy", content.hero.copy);
  setText("hero-primary", content.hero.primaryLabel);
  setHref("hero-primary", content.hero.primaryHref || "#contact");
  setText("hero-secondary", content.hero.secondaryLabel);

  const about = {
    ...DEFAULT_ABOUT,
    ...(content.about || {})
  };
  toggleSectionFromChild("about-title", true);
  toggleLinkByHash("#about", true);
  setText("about-title", about.title);
  setText("about-copy", about.copy);
  setText("about-quote", about.quote);

  const recruiting = {
    ...DEFAULT_RECRUITING,
    ...(content.recruiting || {})
  };
  toggleSectionFromChild("recruiting-title", true);
  setText("recruiting-title", recruiting.title);
  setText("recruiting-copy", recruiting.copy);

  const contact = content.contact || {};
  setText("contact-title", contact.title);
  setText("contact-copy", contact.copy);
  setText("contact-tryout", content.hero.primaryLabel || "Tryout Interest");
  setHref("contact-tryout", content.hero.primaryHref || "#contact");
  setText("contact-email", contact.emailLabel || "Email Us");
  setHref("contact-email", contact.emailHref);
  setText("contact-facebook", contact.facebookLabel || "Facebook");
  setHref("contact-facebook", contact.facebookHref);

  setText("footer-name", content.brand.name);
  setText("footer-copy", content.footer?.copy);
}

function renderList(targetId, items, renderer) {
  const target = $(targetId);
  if (!target) {
    return;
  }
  target.innerHTML = "";
  items.forEach((item) => target.appendChild(renderer(item)));
}

function renderHeroStats() {
  const items = Array.isArray(content.hero.stats) ? content.hero.stats : [];
  toggleBlock($("hero-stats"), items.length > 0);
  renderList("hero-stats", items, (item) => {
    const stat = document.createElement("div");
    stat.className = "stat-card";
    stat.innerHTML = `<strong>${item.value}</strong><span>${item.label}</span>`;
    return stat;
  });
}

function renderRibbon() {
  const items = Array.isArray(content.ribbon) ? content.ribbon : [];
  toggleSectionFromChild("feature-ribbon", items.length > 0);
  renderList("feature-ribbon", items, (item) => {
    const node = document.createElement("div");
    node.className = "ribbon-item";
    node.textContent = item;
    return node;
  });
}

function renderPrograms() {
  const items = Array.isArray(content.programs) ? content.programs : [];
  toggleSectionFromChild("program-grid", items.length > 0);
  toggleLinkByHash("#programs", items.length > 0);
  renderList("program-grid", items, (item) => {
    const card = document.createElement("article");
    card.className = "program-card";
    card.innerHTML = `
      <p class="program-meta">${item.meta}</p>
      <h3>${item.title}</h3>
      <p>${item.copy}</p>
    `;
    return card;
  });
}

function renderRecruitingPoints() {
  const items = Array.isArray(content.recruiting?.points) && content.recruiting.points.length
    ? content.recruiting.points
    : DEFAULT_RECRUITING.points;
  renderList("recruiting-points", items, (item) => {
    const point = document.createElement("div");
    point.className = "point-card";
    point.innerHTML = `<span></span><p>${item}</p>`;
    return point;
  });
}

function renderGallery() {
  const items = Array.isArray(content.gallery) ? content.gallery : [];
  toggleSectionFromChild("gallery-grid", items.length > 0);
  toggleLinkByHash("#gallery", items.length > 0);
  renderList("gallery-grid", items, (item) => {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.innerHTML = `
      <img src="${item.image}" alt="${item.title}" />
      <div class="gallery-copy">
        <h3>${item.title}</h3>
        <p>${item.copy}</p>
      </div>
    `;
    return card;
  });
}

function renderTimeline() {
  const items = Array.isArray(content.timeline) ? content.timeline : [];
  toggleSectionFromChild("timeline", items.length > 0);
  renderList("timeline", items, (item) => {
    const entry = document.createElement("article");
    entry.className = "timeline-entry";
    entry.innerHTML = `
      <p class="timeline-date">${item.date}</p>
      <div>
        <h3>${item.title}</h3>
        <p>${item.copy}</p>
      </div>
    `;
    return entry;
  });
}

function configureHeroMedia() {
  const video = $("hero-video");
  video.poster = content.hero.poster || "";

  if (content.hero.video) {
    video.innerHTML = "";
    const source = document.createElement("source");
    source.src = content.hero.video;
    source.type = "video/mp4";
    video.appendChild(source);
  } else {
    video.classList.add("is-hidden");
  }

  video.addEventListener("error", () => {
    video.classList.add("is-hidden");
  });
}

function renderPage() {
  setRootTheme();
  fillBasics();
  renderHeroStats();
  renderRibbon();
  renderPrograms();
  renderRecruitingPoints();
  renderGallery();
  renderTimeline();
  configureHeroMedia();
}

async function loadContent() {
  const draftContent = getDraftModeContent();

  if (draftContent) {
    content = draftContent;
    return;
  }

  const response = await fetch("content.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load content.json (${response.status})`);
  }

  content = await response.json();
}

async function initSite() {
  try {
    await loadContent();
    renderPage();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <main style="padding: 2rem; font-family: Inter, sans-serif; color: #f5f7fb; background: #08111f; min-height: 100vh;">
        <h1 style="font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase;">Content Load Error</h1>
        <p>The site could not load <code>content.json</code>. Start it from a local web server and check that the JSON file is valid.</p>
      </main>
    `;
  }
}

initSite();
