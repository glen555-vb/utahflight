const $ = (id) => document.getElementById(id);

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
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
  setField(form, "statsSummary", stats.summary);
  setField(form, "kills", stats.kills);
  setField(form, "digs", stats.digs);
  setField(form, "assists", stats.assists);
  setField(form, "blocks", stats.blocks);
  setField(form, "aces", stats.aces);
  setField(form, "hitting", stats.hitting);
  setField(form, "seasonsJson", JSON.stringify(profile.seasons || []));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

async function uploadSelectedFile(fileInput, kind) {
  const file = fileInput.files?.[0];
  if (!file) {
    return "";
  }

  const dataUrl = await readFileAsDataUrl(file);
  const data = await apiRequest("/api/uploads", {
    method: "POST",
    body: JSON.stringify({
      kind,
      fileName: file.name,
      dataUrl
    })
  });
  return data.url;
}

async function uploadFormFiles(form) {
  const photoInput = $("profile-photo-file");
  const status = $("upload-status");
  const hasPhoto = Boolean(photoInput.files?.[0]);

  if (!hasPhoto) {
    return;
  }

  status.textContent = "Uploading profile photo...";

  const photoUrl = await uploadSelectedFile(photoInput, "photo");
  form.elements.photo.value = photoUrl;

  status.textContent = "Photo uploaded. Submitting profile...";
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
      const data = await apiRequest(`/api/import-maxpreps?url=${encodeURIComponent(url)}`);
      fillFormFromProfile(data.profile);
      status.textContent = `${data.profile.name || "Player"} was imported. Review the fields, then submit the profile for approval.`;
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
    const submitButton = form.querySelector('button[type="submit"]');
    const status = $("form-status");
    submitButton.disabled = true;
    status.textContent = "Submitting profile for review...";

    try {
      await uploadFormFiles(form);
      const data = await apiRequest("/api/profiles", {
        method: "POST",
        body: JSON.stringify({ profile: profileFromForm(form) })
      });
      form.reset();
      $("upload-status").textContent = "";
      status.textContent = data.message || "Profile submitted for admin approval.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}

bindMaxPrepsImport();
bindForm();
