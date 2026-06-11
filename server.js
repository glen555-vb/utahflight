const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(rootDir, "data");
const uploadsDir = path.join(rootDir, "uploads", "recruiting");
const profilesPath = path.join(dataDir, "recruiting-profiles.json");
const seedProfilesPath = path.join(rootDir, "recruiting-seed.json");
const sessions = new Map();
const oauthStates = new Map();
const credentials = {
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "flight-admin"
  },
  player: {
    username: process.env.PLAYER_USERNAME || "player",
    password: process.env.PLAYER_PASSWORD || "flight-player"
  }
};
const googleOAuth = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  adminEmails: (process.env.GOOGLE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm"
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${req.headers.host}`;
}

function getGoogleRedirectUri(req) {
  return googleOAuth.redirectUri || `${getOrigin(req)}/auth/google/callback`;
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((item) => {
    const [key, ...value] = item.trim().split("=");
    return [key, decodeURIComponent(value.join("=") || "")];
  }).filter(([key]) => key));
}

function getSession(req) {
  const token = parseCookies(req).utah_flight_session;
  return token ? sessions.get(token) : null;
}

function requireSession(req, res, role) {
  const session = getSession(req);
  if (!session || (role && session.role !== role)) {
    sendJson(res, 401, { error: "Login required." });
    return null;
  }

  return session;
}

function readBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, JSON.stringify({ profiles: [] }, null, 2));
  }
}

function readProfileStore() {
  ensureDataFile();
  const seedStore = readSeedProfileStore();
  try {
    return mergeProfileStores(seedStore, JSON.parse(fs.readFileSync(profilesPath, "utf8")));
  } catch (error) {
    return seedStore;
  }
}

function readSeedProfileStore() {
  try {
    return JSON.parse(fs.readFileSync(seedProfilesPath, "utf8"));
  } catch (error) {
    return { profiles: [] };
  }
}

function mergeProfileStores(seedStore, localStore) {
  const byId = new Map();
  [...(seedStore.profiles || []), ...(localStore.profiles || [])].forEach((profile) => {
    if (profile?.id) {
      byId.set(profile.id, profile);
    }
  });
  return { profiles: [...byId.values()] };
}

function writeProfileStore(store) {
  ensureDataFile();
  fs.writeFileSync(profilesPath, JSON.stringify(store, null, 2));
}

function safeFileName(value) {
  const ext = path.extname(value || "").toLowerCase();
  const base = path.basename(value || "upload", ext);
  return `${slugify(base) || "upload"}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
}

function slugify(value) {
  return String(value || "player")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeProfile(profile, status, submittedBy) {
  const now = new Date().toISOString();
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  return {
    id: safeProfile.id || slugify(`${safeProfile.name || "player"}-${safeProfile.gradYear || Date.now()}`),
    name: safeProfile.name || "Unnamed Player",
    gradYear: safeProfile.gradYear || "",
    school: safeProfile.school || "",
    team: safeProfile.team || "Utah Flight",
    location: safeProfile.location || "",
    jersey: safeProfile.jersey || "",
    positions: Array.isArray(safeProfile.positions) ? safeProfile.positions : [],
    height: safeProfile.height || "",
    weight: safeProfile.weight || "",
    gpa: safeProfile.gpa || "",
    hand: safeProfile.hand || "",
    email: safeProfile.email || "",
    coachEmail: safeProfile.coachEmail || "",
    phone: safeProfile.phone || "",
    photo: safeProfile.photo || "assets/media/gallery-placeholder.svg",
    highlightUrl: safeProfile.highlightUrl || "",
    highlightUrls: Array.isArray(safeProfile.highlightUrls)
      ? safeProfile.highlightUrls.filter(Boolean).slice(0, 5)
      : [safeProfile.highlightUrl].filter(Boolean),
    hudlUrl: safeProfile.hudlUrl || "",
    maxPrepsUrl: safeProfile.maxPrepsUrl || "",
    bio: safeProfile.bio || "",
    stats: safeProfile.stats || {},
    seasons: Array.isArray(safeProfile.seasons) ? safeProfile.seasons : [],
    status,
    submittedBy,
    submittedAt: safeProfile.submittedAt || now,
    updatedAt: now
  };
}

function publicProfile(profile) {
  const { status, submittedBy, submittedAt, updatedAt, ...safeProfile } = profile;
  return safeProfile;
}

async function handleLogin(req, res) {
  try {
    const body = await readBody(req);
    const match = Object.entries(credentials).find(([, credential]) => (
      credential.username === body.username && credential.password === body.password
    ));

    if (!match) {
      sendJson(res, 401, { error: "Invalid username or password." });
      return;
    }

    const [role, credential] = match;
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, {
      role,
      username: credential.username,
      createdAt: Date.now()
    });
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `utah_flight_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
    });
    res.end(JSON.stringify({ user: { role, username: credential.username } }));
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function handleLogout(req, res) {
  const token = parseCookies(req).utah_flight_session;
  if (token) {
    sessions.delete(token);
  }
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Set-Cookie": "utah_flight_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  });
  res.end(JSON.stringify({ ok: true }));
}

function handleSession(req, res) {
  const session = getSession(req);
  sendJson(res, 200, { user: session ? { role: session.role, username: session.username } : null });
}

function createSession(res, user) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    role: user.role,
    username: user.username,
    email: user.email || "",
    createdAt: Date.now()
  });
  res.setHeader("Set-Cookie", `utah_flight_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
}

function handleGoogleStart(req, res) {
  if (!googleOAuth.clientId || !googleOAuth.clientSecret) {
    res.writeHead(302, { Location: "/admin.html?login=google-unconfigured" });
    res.end();
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now());
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleOAuth.clientId);
  authUrl.searchParams.set("redirect_uri", getGoogleRedirectUri(req));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}

async function handleGoogleCallback(req, res, requestUrl) {
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const stateCreatedAt = oauthStates.get(state);
  oauthStates.delete(state);

  if (!code || !stateCreatedAt || Date.now() - stateCreatedAt > 10 * 60 * 1000) {
    res.writeHead(302, { Location: "/admin.html?login=google-failed" });
    res.end();
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleOAuth.clientId,
        client_secret: googleOAuth.clientSecret,
        redirect_uri: getGoogleRedirectUri(req),
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed.");
    }

    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userResponse.json();
    if (!userResponse.ok || !googleUser.email) {
      throw new Error("Google profile lookup failed.");
    }

    const email = googleUser.email.toLowerCase();
    const role = googleOAuth.adminEmails.includes(email) ? "admin" : "player";
    createSession(res, {
      role,
      username: googleUser.name || email,
      email
    });
    res.writeHead(302, { Location: "/admin.html" });
    res.end();
  } catch (error) {
    res.writeHead(302, { Location: "/admin.html?login=google-failed" });
    res.end();
  }
}

function handlePublicProfiles(req, res) {
  const store = readProfileStore();
  sendJson(res, 200, {
    profiles: store.profiles
      .filter((profile) => profile.status === "approved")
      .map(publicProfile)
  });
}

async function handleProfileSubmit(req, res) {
  try {
    const body = await readBody(req);
    const session = getSession(req);
    const status = session?.role === "admin" ? "approved" : "pending";
    const submittedBy = session?.email || session?.username || body.profile?.email || body.profile?.coachEmail || "public submission";
    const profile = normalizeProfile(body.profile, status, submittedBy);
    const store = readProfileStore();
    store.profiles = store.profiles.filter((item) => {
      if (item.id !== profile.id) {
        return true;
      }
      return status === "pending" ? item.status !== "pending" : false;
    });
    store.profiles.push(profile);
    writeProfileStore(store);
    sendJson(res, 200, {
      profile: publicProfile(profile),
      status,
      message: status === "approved" ? "Profile saved and published." : "Profile submitted for admin approval."
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

async function handleUpload(req, res) {
  try {
    const body = await readBody(req, 110_000_000);
    const kind = "photo";
    const dataUrl = String(body.dataUrl || "");
    const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
    if (!match) {
      sendJson(res, 400, { error: "Upload data is missing or invalid." });
      return;
    }

    const mimeType = match[1].toLowerCase();
    const allowed = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp"
    };

    if (!allowed[mimeType]) {
      sendJson(res, 400, { error: "Use a JPG, PNG, or WebP image." });
      return;
    }

    const file = Buffer.from(match[2], "base64");
    const maxBytes = 25_000_000;
    if (!file.length || file.length > maxBytes) {
      sendJson(res, 400, { error: "Profile photos must be under 25 MB." });
      return;
    }

    ensureUploadsDir();
    const originalName = String(body.fileName || `recruiting-${kind}${allowed[mimeType]}`);
    const nameWithExt = path.extname(originalName) ? originalName : `${originalName}${allowed[mimeType]}`;
    const fileName = safeFileName(nameWithExt).replace(/\.[^.]+$/, allowed[mimeType]);
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file);

    sendJson(res, 200, {
      url: `/uploads/recruiting/${fileName}`,
      kind,
      mimeType
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function handleAdminProfiles(req, res) {
  if (!requireSession(req, res, "admin")) {
    return;
  }

  const store = readProfileStore();
  sendJson(res, 200, {
    pending: store.profiles.filter((profile) => profile.status === "pending"),
    approved: store.profiles.filter((profile) => profile.status === "approved")
  });
}

function handleAdminDecision(req, res, requestUrl, decision) {
  if (!requireSession(req, res, "admin")) {
    return;
  }

  const id = requestUrl.pathname.split("/").at(-2);
  const store = readProfileStore();
  const profile = store.profiles.find((item) => item.id === id && item.status === "pending");
  if (!profile) {
    sendJson(res, 404, { error: "Pending profile not found." });
    return;
  }

  if (decision === "approve") {
    const approved = normalizeProfile(profile, "approved", profile.submittedBy);
    store.profiles = store.profiles.filter((item) => !(item.id === id && ["pending", "approved"].includes(item.status)));
    store.profiles.push(approved);
    writeProfileStore(store);
    sendJson(res, 200, { profile: publicProfile(approved), message: "Profile approved and published." });
    return;
  }

  store.profiles = store.profiles.filter((item) => !(item.id === id && item.status === "pending"));
  writeProfileStore(store);
  sendJson(res, 200, { message: "Profile rejected." });
}

function isSafeMaxPrepsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)maxpreps\.com$/i.test(url.hostname);
  } catch (error) {
    return false;
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getNextData(html) {
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) {
    return null;
  }

  return JSON.parse(decodeHtml(match[1]));
}

function walk(value, visitor) {
  if (!value || typeof value !== "object") {
    return;
  }

  visitor(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }

  Object.values(value).forEach((item) => walk(item, visitor));
}

function findFirstValue(data, keys) {
  let found = "";
  walk(data, (node) => {
    if (found || Array.isArray(node)) {
      return;
    }

    for (const key of keys) {
      if (node[key]) {
        found = node[key];
        return;
      }
    }
  });
  return found;
}

function findCareerRollup(data) {
  let rollup = null;
  walk(data, (node) => {
    if (!rollup && node.careerRollup?.groups) {
      rollup = node.careerRollup;
    }
  });
  return rollup;
}

function findFeaturedStats(data) {
  let stats = [];
  walk(data, (node) => {
    if (!stats.length && Array.isArray(node.featuredStatsHeaderData?.stats)) {
      stats = node.featuredStatsHeaderData.stats;
    }
  });
  return stats;
}

function findSeasonPills(data) {
  let pills = [];
  walk(data, (node) => {
    if (!pills.length && Array.isArray(node.seasonPills)) {
      pills = node.seasonPills;
    }
  });
  return pills;
}

function statValue(stats, names, headers) {
  const stat = stats.find((item) => (
    names.includes(item.name) || headers.includes(String(item.header || "").toLowerCase())
  ));
  return stat?.value || "";
}

function seasonStatValue(row, names, headers) {
  return statValue(row.stats || [], names, headers);
}

function buildSeasonRows(careerRollup) {
  if (!careerRollup?.groups) {
    return [];
  }

  const attacking = careerRollup.groups.find((group) => group.name === "Attacking");
  const serving = careerRollup.groups.find((group) => group.name === "Serving");
  const blocking = careerRollup.groups.find((group) => group.name === "Blocking");
  const digging = careerRollup.groups.find((group) => group.name === "Digging");

  const attackRows = attacking?.subgroups?.[0]?.stats || [];
  const rowsByYear = new Map();

  attackRows.forEach((row) => {
    const key = `${row.year || ""}-${row.teamLevel || ""}`;
    rowsByYear.set(key, {
      season: `${row.year || "Season"} ${row.teamLevel || ""}`.trim(),
      sp: seasonStatValue(row, ["MatchGamesPlayed"], ["sp"]),
      kills: seasonStatValue(row, ["AttacksKills"], ["k"]),
      digs: "",
      aces: "",
      blocks: ""
    });
  });

  [
    { group: serving, target: "aces", names: ["ServingAces"], headers: ["a"] },
    { group: blocking, target: "blocks", names: ["TotalBlocks"], headers: ["tot blks", "tb"] },
    { group: digging, target: "digs", names: ["Digs"], headers: ["d"] }
  ].forEach(({ group, target, names, headers }) => {
    (group?.subgroups?.[0]?.stats || []).forEach((row) => {
      const key = `${row.year || ""}-${row.teamLevel || ""}`;
      const existing = rowsByYear.get(key);
      if (existing) {
        existing[target] = seasonStatValue(row, names, headers);
      }
    });
  });

  return [...rowsByYear.values()];
}

function parseGradYear(seasonPills, html) {
  const newestYear = seasonPills?.[0]?.year;
  const classYear = seasonPills?.[0]?.classYear;
  if (classYear === "Sr." && newestYear) {
    const endYear = newestYear.split("-")[1];
    return endYear ? `20${endYear}` : "";
  }

  const match = html.match(/\b(Senior|Junior|Sophomore|Freshman)\s+•\s+(20\d{2})/);
  return match?.[2] || "";
}

function parseProfileFromMaxPreps(html, sourceUrl) {
  const data = getNextData(html);
  if (!data) {
    throw new Error("MaxPreps profile data was not found.");
  }

  const pageProps = data.props?.pageProps || {};
  const careerContext = pageProps.careerContext || {};
  const careerData = careerContext.careerData || {};
  const careerPlayerData = careerContext.careerPlayerData || {};
  const recentSchool = careerContext.recentSchool || {};
  const careerSport = careerPlayerData.careerSports?.[0] || {};
  const featuredStats = findFeaturedStats(data);
  const careerRollup = findCareerRollup(data);
  const seasonPills = findSeasonPills(data);
  const athleteName = findFirstValue(data, ["athleteName"]) || `${careerData.firstName || careerPlayerData.firstName || ""} ${careerData.lastName || careerPlayerData.lastName || ""}`.trim();
  const photoUrl = careerPlayerData.photoUrl || findFirstValue(data, ["photoUrl"]) || html.match(/property="og:image" content="([^"]+)"/)?.[1] || "";
  const canonicalUrl = careerPlayerData.careerCanonicalUrl || findFirstValue(data, ["careerCanonicalUrl"]) || sourceUrl;
  const height = careerData.heightFeet && Number.isFinite(Number(careerData.heightInches))
    ? `${careerData.heightFeet}'${careerData.heightInches}"`
    : "";
  const schoolName = careerPlayerData.schoolName
    ? careerPlayerData.schoolName.replace(/\s+\(.+\)$/, " High School")
    : recentSchool.name
      ? `${recentSchool.name} High School`
      : "";
  const location = [recentSchool.city || recentSchool.mailingCity, recentSchool.state || recentSchool.stateCode]
    .filter(Boolean)
    .join(", ");

  return {
    name: athleteName,
    gradYear: String(careerData.graduatingClass || parseGradYear(seasonPills, html) || ""),
    school: schoolName,
    team: "Utah Flight",
    location,
    jersey: careerData.jersey || careerSport.jersey || "",
    positions: careerSport.positions || [careerData.primaryPosition].filter(Boolean),
    height,
    weight: careerData.weight ? `${careerData.weight} lbs` : "",
    bio: careerData.bio || "",
    photo: decodeHtml(photoUrl),
    maxPrepsUrl: decodeHtml(canonicalUrl || sourceUrl),
    stats: {
      kills: statValue(featuredStats, ["AttacksKills"], ["k"]),
      digs: statValue(featuredStats, ["Digs"], ["d"]),
      assists: statValue(featuredStats, ["Assists"], ["ast"]),
      blocks: statValue(featuredStats, ["TotalBlocks"], ["tb", "tot blks"]),
      aces: statValue(featuredStats, ["ServingAces"], ["a"]),
      hitting: statValue(featuredStats, ["HittingPercentage"], ["pct", "hit %"])
    },
    seasons: buildSeasonRows(careerRollup)
  };
}

async function handleMaxPrepsImport(req, res, requestUrl) {
  const targetUrl = requestUrl.searchParams.get("url");
  if (!isSafeMaxPrepsUrl(targetUrl)) {
    sendJson(res, 400, { error: "Enter a valid https://www.maxpreps.com URL." });
    return;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "UtahFlightRecruiting/1.0 (+https://utahflight.com)"
      }
    });
    if (!response.ok) {
      throw new Error(`MaxPreps returned ${response.status}`);
    }

    const html = await response.text();
    sendJson(res, 200, { profile: parseProfileFromMaxPreps(html, targetUrl) });
  } catch (error) {
    sendJson(res, 502, { error: error.message || "Unable to import MaxPreps profile." });
  }
}

function serveStatic(req, res, requestUrl) {
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(rootDir, `.${requestedPath}`);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname === "/auth/google") {
    handleGoogleStart(req, res);
    return;
  }
  if (requestUrl.pathname === "/auth/google/callback") {
    handleGoogleCallback(req, res, requestUrl);
    return;
  }
  if (requestUrl.pathname === "/api/login" && req.method === "POST") {
    handleLogin(req, res);
    return;
  }
  if (requestUrl.pathname === "/api/logout" && req.method === "POST") {
    handleLogout(req, res);
    return;
  }
  if (requestUrl.pathname === "/api/session") {
    handleSession(req, res);
    return;
  }
  if (requestUrl.pathname === "/api/profiles" && req.method === "GET") {
    handlePublicProfiles(req, res);
    return;
  }
  if (requestUrl.pathname === "/api/profiles" && req.method === "POST") {
    handleProfileSubmit(req, res);
    return;
  }
  if (requestUrl.pathname === "/api/uploads" && req.method === "POST") {
    handleUpload(req, res);
    return;
  }
  if (requestUrl.pathname === "/api/admin/profiles") {
    handleAdminProfiles(req, res);
    return;
  }
  if (/^\/api\/admin\/profiles\/[^/]+\/approve$/.test(requestUrl.pathname) && req.method === "POST") {
    handleAdminDecision(req, res, requestUrl, "approve");
    return;
  }
  if (/^\/api\/admin\/profiles\/[^/]+\/reject$/.test(requestUrl.pathname) && req.method === "POST") {
    handleAdminDecision(req, res, requestUrl, "reject");
    return;
  }
  if (requestUrl.pathname === "/api/import-maxpreps") {
    handleMaxPrepsImport(req, res, requestUrl);
    return;
  }

  serveStatic(req, res, requestUrl);
});

if (require.main === module) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Utah Flight site listening on port ${port}`);
  });
}

module.exports = {
  parseProfileFromMaxPreps
};
