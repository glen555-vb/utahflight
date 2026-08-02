const $ = (id) => document.getElementById(id);

let crmStore = { players: [], unmatchedPayments: [] };
let activePlayerId = "";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function paymentSummary(player) {
  const payments = player.payments || [];
  const plan = player.paymentPlan || [];
  const paid = Number(player.sheetPaidAmount || 0) + payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dueToday = plan.filter((item) => item.dueDate <= new Date().toISOString().slice(0, 10)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const total = plan.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const status = player.feeWaived || (paid >= total && total) ? "paid" : paid >= dueToday ? "on_track" : "past_due";
  return { paid, dueToday, total, balance: Math.max(total - paid, 0), status };
}

function statusLabel(player) {
  if (player.rosterStatus === "not_selected") return ["Not selected", "status-not-selected"];
  const status = paymentSummary(player).status;
  return status === "paid" ? ["Paid in full", "status-on-track"] : status === "on_track" ? ["On track", "status-on-track"] : ["Past due", "status-past-due"];
}

function recipients(player, target) {
  const split = (value) => String(value || "").split(/[;,/]/).map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  return [...new Set([...(target === "player" || target === "both" ? split(player.playerEmail) : []), ...(target === "parent" || target === "both" ? split(player.parentEmail) : [])])];
}

function gmailUrl(player, target) {
  const to = recipients(player, target).join(",");
  const summary = paymentSummary(player);
  const body = `Hi ${player.parentName || player.name},\n\n` + (player.rosterStatus === "selected" ? `We are excited to have ${player.name} with Utah Flight. Your current club fee balance is ${money(summary.balance)}.` : `Thank you for ${player.name}'s interest in Utah Flight.`) + "\n\nThank you,\nUtah Flight Volleyball";
  return `https://mail.google.com/mail/u/0/?view=cm&fs=1&bcc=${encodeURIComponent(to)}&su=${encodeURIComponent(`Utah Flight - ${player.name}`)}&body=${encodeURIComponent(body)}`;
}

function renderMetrics() {
  const selected = crmStore.players.filter((player) => player.rosterStatus === "selected");
  $("metric-on-track").textContent = selected.filter((player) => ["on_track", "paid"].includes(paymentSummary(player).status)).length;
  $("metric-past-due").textContent = selected.filter((player) => paymentSummary(player).status === "past_due").length;
  $("metric-not-selected").textContent = crmStore.players.filter((player) => player.rosterStatus === "not_selected").length;
  $("metric-unmatched").textContent = (crmStore.unmatchedPayments || []).length;
  $("crm-summary").textContent = `${selected.length} selected players. ${crmStore.players.length - selected.length} not selected.`;
}

function filteredPlayers() {
  const query = $("player-search").value.trim().toLowerCase();
  const roster = $("status-filter").value;
  const payment = $("payment-filter").value;
  return crmStore.players.filter((player) => {
    const matchesQuery = !query || [player.name, player.parentName, player.playerEmail, player.parentEmail, player.team].join(" ").toLowerCase().includes(query);
    return matchesQuery && (roster === "all" || player.rosterStatus === roster) && (payment === "all" || paymentSummary(player).status === payment);
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function renderPlayers() {
  const players = filteredPlayers();
  $("player-list").innerHTML = players.length ? players.map((player) => {
    const [label, tone] = statusLabel(player);
    const summary = paymentSummary(player);
    return `<article class="crm-player-row ${player.id === activePlayerId ? "is-active" : ""}" data-player-id="${escapeHtml(player.id)}"><div><h3>${escapeHtml(player.name)}</h3><p>${escapeHtml(player.team || "Team TBD")} &bull; ${escapeHtml(player.parentName || "Parent contact TBD")}</p><small>${player.rosterStatus === "selected" ? `${money(summary.paid)} paid of ${money(summary.total)}` : "Tryout record"}</small></div><span class="status-pill ${tone}">${label}</span></article>`;
  }).join("") : `<div class="empty-state">No players match these filters.</div>`;
  document.querySelectorAll("[data-player-id]").forEach((row) => row.addEventListener("click", () => { activePlayerId = row.dataset.playerId; renderPlayers(); renderDetail(); }));
}

function renderDetail() {
  const player = crmStore.players.find((item) => item.id === activePlayerId);
  if (!player) { $("player-detail").innerHTML = "<p>Select a player to review their contacts and payment plan.</p>"; return; }
  const summary = paymentSummary(player);
  const [label, tone] = statusLabel(player);
  const plans = (player.paymentPlan || []).map((item, index) => `<div class="payment-plan-row ${summary.paid >= (player.paymentPlan || []).slice(0, index + 1).reduce((sum, entry) => sum + Number(entry.amount), 0) ? "is-paid" : ""}"><span>${escapeHtml(item.dueDate)}</span><strong>${money(item.amount)}</strong></div>`).join("");
  const planText = (player.paymentPlan || []).map((item) => `${item.dueDate}:${item.amount}`).join(", ");
  $("player-detail").innerHTML = `<p class="kicker">${player.rosterStatus === "selected" ? "Final Team" : "Tryout Record"}</p><h2>${escapeHtml(player.name)}</h2><span class="status-pill ${tone}">${label}</span><div class="crm-contact-grid"><div><span>Player</span><strong>${escapeHtml(player.playerEmail || "No email")}</strong></div><div><span>Parent</span><strong>${escapeHtml(player.parentName || "Not listed")}</strong><strong>${escapeHtml(player.parentEmail || "No email")}</strong></div><div><span>Team</span><strong>${escapeHtml(player.team || "TBD")}</strong></div><div><span>Phones</span><strong>${escapeHtml(player.playerPhone || "-")}</strong><strong>${escapeHtml(player.parentPhone || "-")}</strong></div></div><div class="crm-detail-actions"><a class="button button-small" target="_blank" rel="noopener" href="${gmailUrl(player, "both")}">Email Both</a><a class="button button-small button-ghost" target="_blank" rel="noopener" href="${gmailUrl(player, "parent")}">Email Parent</a><a class="button button-small button-ghost" target="_blank" rel="noopener" href="${gmailUrl(player, "player")}">Email Player</a></div>${player.rosterStatus === "selected" ? `<div class="crm-payment-grid"><div><span>Paid</span><strong>${money(summary.paid)} of ${money(summary.total)}</strong></div><div><span>Balance</span><strong>${money(summary.balance)}</strong></div></div><div class="payment-plan"><p class="panel-label">Payment plan</p>${plans}</div>` : ""}<details class="crm-edit"><summary>Edit player record</summary><form id="player-edit-form" class="login-form"><label><span>Team</span><input name="team" value="${escapeHtml(player.team)}" /></label><label><span>Roster status</span><select name="rosterStatus"><option value="selected" ${player.rosterStatus === "selected" ? "selected" : ""}>Made the team</option><option value="not_selected" ${player.rosterStatus === "not_selected" ? "selected" : ""}>Not selected</option></select></label><label><span>Player email</span><input name="playerEmail" value="${escapeHtml(player.playerEmail)}" /></label><label><span>Parent email</span><input name="parentEmail" value="${escapeHtml(player.parentEmail)}" /></label><label><span>Payment schedule</span><input name="paymentPlanText" value="${escapeHtml(planText)}" placeholder="2026-08-01:300, 2026-08-28:300" /></label><label><span>Notes</span><textarea name="notes" rows="3">${escapeHtml(player.notes || "")}</textarea></label><button class="button button-small" type="submit">Save changes</button></form></details>`;
  $("player-edit-form").addEventListener("submit", savePlayer);
}

async function savePlayer(event) {
  event.preventDefault();
  const player = crmStore.players.find((item) => item.id === activePlayerId);
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const planText = data.paymentPlanText;
  delete data.paymentPlanText;
  if (planText) {
    data.paymentPlan = planText.split(",").map((entry) => {
      const [dueDate, amount] = entry.trim().split(":");
      return { dueDate: dueDate.trim(), amount: Number(amount) || 0 };
    }).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.amount > 0);
  }
  Object.assign(player, data);
  try { crmStore = await api(`/api/crm/players/${encodeURIComponent(player.id)}`, { method: "PUT", body: JSON.stringify({ player }) }); renderAll(); } catch (error) { $("import-status").textContent = error.message; }
}

function renderUnmatched() {
  const payments = crmStore.unmatchedPayments || [];
  $("unmatched-section").hidden = !payments.length;
  $("unmatched-list").innerHTML = payments.map((item) => `<article class="unmatched-row"><div><strong>${escapeHtml(item.from || "Unknown sender")}</strong><p>${escapeHtml(item.date || "")} &bull; ${escapeHtml(item.note || "No note")}</p></div><strong>${money(item.amount)}</strong></article>`).join("");
}

function renderAll() { renderMetrics(); renderPlayers(); renderDetail(); renderUnmatched(); }

async function importVenmo(file) {
  if (!file) return;
  $("import-status").textContent = "Importing Venmo statement...";
  try { crmStore = await api("/api/crm/import-venmo", { method: "POST", body: JSON.stringify({ fileName: file.name, csv: await file.text() }) }); $("import-status").textContent = "Venmo payments imported. Review any unmatched payments below."; renderAll(); } catch (error) { $("import-status").textContent = error.message; }
  $("venmo-file").value = "";
}

async function importPaymentsSheet(file) {
  if (!file) return;
  $("import-status").textContent = "Importing the Payments tab...";
  try {
    crmStore = await api("/api/crm/import-payments-sheet", { method: "POST", body: JSON.stringify({ fileName: file.name, csv: await file.text() }) });
    $("import-status").textContent = "Payments tab imported. Earlier Venmo transactions will not be counted again.";
    renderAll();
  } catch (error) { $("import-status").textContent = error.message; }
  $("payments-file").value = "";
}

async function importRoster(file, endpoint, label) {
  if (!file) return;
  $("import-status").textContent = `Importing ${label}...`;
  try {
    crmStore = await api(endpoint, { method: "POST", body: JSON.stringify({ fileName: file.name, csv: await file.text() }) });
    $("import-status").textContent = `${label} imported. Review the roster and payment statuses.`;
    renderAll();
  } catch (error) { $("import-status").textContent = error.message; }
}

async function boot() {
  const session = await api("/api/session");
  if (!session.user || session.user.role !== "admin") { $("crm-login").hidden = false; $("crm-app").hidden = true; return; }
  $("crm-login").hidden = true; $("crm-app").hidden = false;
  crmStore = await api("/api/crm");
  renderAll();
}

$("login-form").addEventListener("submit", async (event) => { event.preventDefault(); try { await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); await boot(); } catch (error) { $("login-status").textContent = error.message; } });
$("logout-button").addEventListener("click", async () => { await api("/api/logout", { method: "POST", body: "{}" }); await boot(); });
$("player-search").addEventListener("input", renderPlayers);
$("status-filter").addEventListener("change", renderPlayers);
$("payment-filter").addEventListener("change", renderPlayers);
$("venmo-file").addEventListener("change", (event) => importVenmo(event.target.files[0]));
$("payments-file").addEventListener("change", (event) => importPaymentsSheet(event.target.files[0]));
$("final-teams-file").addEventListener("change", (event) => importRoster(event.target.files[0], "/api/crm/import-final-teams", "Final Teams"));
$("tryouts-file").addEventListener("change", (event) => importRoster(event.target.files[0], "/api/crm/import-tryouts", "All Tryouts"));
boot().catch((error) => { $("login-status").textContent = error.message; });
