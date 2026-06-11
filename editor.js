const DRAFT_KEY = "utah-flight-site-draft";
const state = {
  content: null,
  mediaFolderHandle: null
};

const simpleBindings = [
  ["brand-name", ["brand", "name"]],
  ["brand-eyebrow", ["brand", "eyebrow"]],
  ["brand-logo", ["brand", "logo"]],
  ["color-background", ["brand", "colors", "background"]],
  ["color-backgroundSoft", ["brand", "colors", "backgroundSoft"]],
  ["color-card", ["brand", "colors", "card"]],
  ["color-accent", ["brand", "colors", "accent"]],
  ["color-accentSoft", ["brand", "colors", "accentSoft"]],
  ["color-text", ["brand", "colors", "text"]],
  ["color-muted", ["brand", "colors", "muted"]],
  ["hero-kicker", ["hero", "kicker"]],
  ["hero-title", ["hero", "title"]],
  ["hero-copy", ["hero", "copy"]],
  ["hero-primaryLabel", ["hero", "primaryLabel"]],
  ["hero-primaryHref", ["hero", "primaryHref"]],
  ["hero-secondaryLabel", ["hero", "secondaryLabel"]],
  ["hero-video", ["hero", "video"]],
  ["hero-poster", ["hero", "poster"]],
  ["about-title", ["about", "title"]],
  ["about-copy", ["about", "copy"]],
  ["about-quote", ["about", "quote"]],
  ["recruiting-title", ["recruiting", "title"]],
  ["recruiting-copy", ["recruiting", "copy"]],
  ["contact-title", ["contact", "title"]],
  ["contact-copy", ["contact", "copy"]],
  ["contact-emailLabel", ["contact", "emailLabel"]],
  ["contact-emailHref", ["contact", "emailHref"]],
  ["contact-facebookLabel", ["contact", "facebookLabel"]],
  ["contact-facebookHref", ["contact", "facebookHref"]],
  ["contact-instagramLabel", ["contact", "instagramLabel"]],
  ["contact-instagramHref", ["contact", "instagramHref"]],
  ["footer-copy", ["footer", "copy"]],
  ["references-facebookLabel", ["references", "facebookLabel"]],
  ["references-facebookHref", ["references", "facebookHref"]],
  ["references-instagramLabel", ["references", "instagramLabel"]],
  ["references-instagramHref", ["references", "instagramHref"]]
];

const repeaters = {
  heroStats: {
    containerId: "hero-stats-list",
    arrayPath: ["hero", "stats"],
    templateId: "hero-stat-template",
    emptyItem: () => ({ value: "00", label: "New stat" }),
    fields: ["value", "label"]
  },
  ribbon: {
    containerId: "ribbon-list",
    arrayPath: ["ribbon"],
    templateId: "string-item-template",
    emptyItem: () => "New ribbon item",
    fields: ["value"]
  },
  programs: {
    containerId: "programs-list",
    arrayPath: ["programs"],
    templateId: "program-template",
    emptyItem: () => ({ title: "New program", meta: "Ages", copy: "Describe this program here." }),
    fields: ["title", "meta", "copy"]
  },
  recruitingPoints: {
    containerId: "recruiting-points-list",
    arrayPath: ["recruiting", "points"],
    templateId: "string-item-template",
    emptyItem: () => "New point",
    fields: ["value"]
  },
  gallery: {
    containerId: "gallery-list",
    arrayPath: ["gallery"],
    templateId: "gallery-template",
    emptyItem: () => ({ title: "New image", image: "assets/media/your-image.jpg", copy: "Describe the image." }),
    fields: ["title", "image", "copy"]
  },
  timeline: {
    containerId: "timeline-list",
    arrayPath: ["timeline"],
    templateId: "timeline-template",
    emptyItem: () => ({ date: "Month", title: "New item", copy: "Describe the milestone." }),
    fields: ["date", "title", "copy"]
  }
};

function $(id) {
  return document.getElementById(id);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getAtPath(object, path) {
  return path.reduce((acc, key) => acc[key], object);
}

function setAtPath(object, path, value) {
  const parent = path.slice(0, -1).reduce((acc, key) => acc[key], object);
  parent[path[path.length - 1]] = value;
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content, null, 2));
}

function setStatus(message, isError = false) {
  const status = $("status-message");
  status.textContent = message;
  status.style.color = isError ? "#ffb3b3" : "var(--success)";
}

function updateMediaFolderStatus() {
  const status = $("media-folder-status");

  if (state.mediaFolderHandle) {
    status.textContent = `Connected media folder: ${state.mediaFolderHandle.name}`;
  } else {
    status.textContent = "Media folder not connected yet.";
  }
}

function bindSimpleFields() {
  simpleBindings.forEach(([id, path]) => {
    const input = $(id);
    input.value = getAtPath(state.content, path) ?? "";
    input.oninput = () => {
      setAtPath(state.content, path, input.value);
      saveDraft();
      setStatus("Draft updated.");
    };
  });
}

function revokePreviewUrl(wrapper) {
  if (wrapper.dataset.objectUrl) {
    URL.revokeObjectURL(wrapper.dataset.objectUrl);
    delete wrapper.dataset.objectUrl;
  }
}

function renderPreview(wrapper, src = "", overrideObjectUrl = null) {
  const preview = wrapper.querySelector("[data-preview]");
  const kind = wrapper.dataset.kind;
  const activeSrc = overrideObjectUrl || src.trim();

  revokePreviewUrl(wrapper);

  if (overrideObjectUrl) {
    wrapper.dataset.objectUrl = overrideObjectUrl;
  }

  preview.innerHTML = "";

  if (!activeSrc) {
    preview.innerHTML = `<p class="preview-empty">No media selected yet.</p>`;
    return;
  }

  if (kind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.src = activeSrc;
    preview.appendChild(video);
    return;
  }

  const image = document.createElement("img");
  image.alt = "Media preview";
  image.src = activeSrc;
  image.onerror = () => {
    if (!overrideObjectUrl) {
      preview.innerHTML = `<p class="preview-empty">Preview unavailable for <code>${src}</code>.</p>`;
    }
  };
  preview.appendChild(image);
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function getAcceptForKind(kind) {
  return kind === "video" ? "video/*" : "image/*";
}

function getPickerAccept(kind) {
  if (kind === "video") {
    return {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"],
      "video/webm": [".webm"],
      "video/x-m4v": [".m4v"]
    };
  }

  return {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"]
  };
}

async function pickLocalFile(kind) {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: kind === "video" ? "Video files" : "Image files",
          accept: getPickerAccept(kind)
        }
      ]
    });
    return handle ? handle.getFile() : null;
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = getAcceptForKind(kind);
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

async function ensureReadWritePermission(handle) {
  if (!handle || !handle.requestPermission) {
    return true;
  }

  const options = { mode: "readwrite" };
  const current = await handle.queryPermission(options);

  if (current === "granted") {
    return true;
  }

  return (await handle.requestPermission(options)) === "granted";
}

async function connectMediaFolder() {
  if (!window.showDirectoryPicker) {
    setStatus("This browser does not support connecting a media folder. Use Download or Save To File instead.", true);
    return;
  }

  const handle = await window.showDirectoryPicker();
  const permitted = await ensureReadWritePermission(handle);

  if (!permitted) {
    setStatus("Media folder permission was not granted.", true);
    return;
  }

  state.mediaFolderHandle = handle;
  updateMediaFolderStatus();
  setStatus("Media folder connected. Imported files can be written directly into it.");
}

function clearMediaFolder() {
  state.mediaFolderHandle = null;
  updateMediaFolderStatus();
  setStatus("Cleared the connected media folder.");
}

async function saveFileIntoConnectedFolder(file, filename) {
  const permitted = await ensureReadWritePermission(state.mediaFolderHandle);

  if (!permitted) {
    throw new Error("Media folder permission was not granted.");
  }

  const destination = await state.mediaFolderHandle.getFileHandle(filename, { create: true });
  const writable = await destination.createWritable();
  await writable.write(file);
  await writable.close();
}

async function fallbackSaveFile(file, filename, kind) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
      {
        description: kind === "video" ? "Video files" : "Image files",
        accept: getPickerAccept(kind)
      }
    ]
  });

    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return "saved";
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

async function importMedia(wrapper) {
  const input = wrapper.querySelector('input[type="text"]');
  const kind = wrapper.dataset.kind;

  try {
    const file = await pickLocalFile(kind);

    if (!file) {
      return;
    }

    const safeName = sanitizeFileName(file.name);
    const relativePath = `assets/media/${safeName}`;
    const objectUrl = URL.createObjectURL(file);

    if (state.mediaFolderHandle) {
      await saveFileIntoConnectedFolder(file, safeName);
      setStatus(`Imported ${safeName} into the connected media folder.`);
    } else {
      const method = await fallbackSaveFile(file, safeName, kind);
      setStatus(
        method === "saved"
          ? `Saved ${safeName}. Put it in assets/media if you did not save it there already.`
          : `Downloaded ${safeName}. Move it into assets/media so the path works after refresh.`
      );
    }

    input.value = relativePath;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    renderPreview(wrapper, relativePath, objectUrl);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    console.error(error);
    setStatus("Media import failed.", true);
  }
}

function initializeMediaControl(wrapper) {
  if (wrapper.dataset.initialized === "1") {
    return;
  }

  const input = wrapper.querySelector('input[type="text"]');

  wrapper.querySelector('[data-action="import-media"]').onclick = () => {
    importMedia(wrapper);
  };

  wrapper.querySelector('[data-action="refresh-preview"]').onclick = () => {
    renderPreview(wrapper, input.value);
  };

  input.addEventListener("input", () => {
    renderPreview(wrapper, input.value);
  });

  renderPreview(wrapper, input.value);
  wrapper.dataset.initialized = "1";
}

function getRepeaterValue(item, field) {
  return field === "value" && typeof item === "string" ? item : item[field] ?? "";
}

function setRepeaterValue(items, index, field, value) {
  if (field === "value" && typeof items[index] === "string") {
    items[index] = value;
  } else {
    items[index][field] = value;
  }
}

function renderRepeater(config) {
  const container = $(config.containerId);
  const template = $(config.templateId);
  const items = getAtPath(state.content, config.arrayPath);

  container.innerHTML = "";

  items.forEach((item, index) => {
    const node = template.content.firstElementChild.cloneNode(true);

    config.fields.forEach((field) => {
      const input = node.querySelector(`[data-field="${field}"]`);
      input.value = getRepeaterValue(item, field);
      input.oninput = () => {
        setRepeaterValue(items, index, field, input.value);
        saveDraft();
        setStatus("Draft updated.");
      };
    });

    node.querySelector('[data-action="remove"]').onclick = () => {
      items.splice(index, 1);
      saveDraft();
      renderAllRepeaters();
      setStatus("Item removed from draft.");
    };

    container.appendChild(node);
  });
}

function renderAllRepeaters() {
  Object.values(repeaters).forEach(renderRepeater);
  initializeAllMediaControls();
}

function attachAddButtons() {
  $("add-hero-stat").onclick = () => addRepeaterItem("heroStats");
  $("add-ribbon-item").onclick = () => addRepeaterItem("ribbon");
  $("add-program").onclick = () => addRepeaterItem("programs");
  $("add-recruiting-point").onclick = () => addRepeaterItem("recruitingPoints");
  $("add-gallery-item").onclick = () => addRepeaterItem("gallery");
  $("add-timeline-item").onclick = () => addRepeaterItem("timeline");
}

function addRepeaterItem(key) {
  const config = repeaters[key];
  const items = getAtPath(state.content, config.arrayPath);
  items.push(config.emptyItem());
  saveDraft();
  renderAllRepeaters();
  setStatus("Item added to draft.");
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state.content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "content.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded content.json.");
}

async function copyJson() {
  await navigator.clipboard.writeText(JSON.stringify(state.content, null, 2));
  setStatus("JSON copied to clipboard.");
}

async function saveJsonToFile() {
  if (!window.showSaveFilePicker) {
    downloadJson();
    setStatus("Direct save is not supported here, so the JSON was downloaded instead.");
    return;
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: "content.json",
    types: [
      {
        description: "JSON files",
        accept: { "application/json": [".json"] }
      }
    ]
  });

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(state.content, null, 2));
  await writable.close();
  setStatus("Saved content.json to disk.");
}

function openDraftPreview() {
  saveDraft();
  window.open("index.html?draft=1", "_blank", "noopener,noreferrer");
}

async function loadPublishedContent() {
  const response = await fetch("content.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load content.json (${response.status})`);
  }

  return response.json();
}

function resetFromContent(content) {
  state.content = clone(content);
  bindSimpleFields();
  renderAllRepeaters();
  saveDraft();
}

async function reloadPublishedContent() {
  const published = await loadPublishedContent();
  resetFromContent(published);
  setStatus("Reloaded the published content.json file.");
}

function wireActions() {
  $("reload-content").onclick = reloadPublishedContent;
  $("connect-media-folder").onclick = () => {
    connectMediaFolder().catch((error) => {
      console.error(error);
      setStatus("Could not connect the media folder.", true);
    });
  };
  $("clear-media-folder").onclick = clearMediaFolder;
  $("preview-draft").onclick = openDraftPreview;
  $("download-json").onclick = downloadJson;
  $("copy-json").onclick = () => {
    copyJson().catch((error) => {
      console.error(error);
      setStatus("Clipboard copy failed in this browser.", true);
    });
  };
  $("save-json").onclick = () => {
    saveJsonToFile().catch((error) => {
      console.error(error);
      setStatus("Save failed. You can still use Download content.json.", true);
    });
  };
}

function initializeAllMediaControls() {
  document.querySelectorAll(".media-control").forEach(initializeMediaControl);
}

async function init() {
  attachAddButtons();
  wireActions();
  updateMediaFolderStatus();

  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    const published = await loadPublishedContent();
    const initial = draft ? JSON.parse(draft) : published;
    resetFromContent(initial);
    initializeAllMediaControls();
    setStatus(draft ? "Loaded your saved browser draft." : "Loaded published content.json.");
  } catch (error) {
    console.error(error);
    setStatus("Could not load the editor content.", true);
  }
}

init();
