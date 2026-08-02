const $ = (id) => document.getElementById(id);

let crmStore = { players: [], unmatchedPayments: [] };
let activePlayerId = "";
let activeYear = "2027";
let activeSeason = "Fall";

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

async function uploadPayload(file) {
  if (!/\.xlsx$/i.test(file.name)) return { fileName: file.name, csv: await file.text() };
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The Excel file could not be read."));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, xlsxBase64: String(dataUrl).split(",")[1] || "" };
}

function seasonKey(year = activeYear, season = activeSeason) {
  return `${year}-${season}`;
}

function paymentPlanFor(player) {
  return player.usesCustomPaymentPlan ? (player.paymentPlan || []) : (crmStore.seasonPaymentPlans?.[seasonKey(player.year || "2026", player.season || "Fall")] || []);
}

function paymentSummary(player) {
  const payments = player.payments || [];
  const plan = paymentPlanFor(player);
  const paid = Number(player.sheetPaidAmount || 0) + payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dueToday = plan.filter((item) => item.dueDate <= new Date().toISOString().slice(0, 10)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const total = plan.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const status = player.feeWaived || (paid >= total && total) ? "paid" : !total ? "unconfigured" : !paid ? "past_due" : paid >= dueToday ? "on_track" : "past_due";
  return { paid, dueToday, total, balance: Math.max(total - paid, 0), status };
}

function statusLabel(player) {
  if (player.rosterStatus === "not_selected") return ["Not selected", "status-not-selected"];
  const status = paymentSummary(player).status;
  return status === "paid" ? ["Paid in full", "status-on-track"] : status === "on_track" ? ["On track", "status-on-track"] : status === "unconfigured" ? ["Set payment plan", "status-pending-payment"] : ["Past due", "status-past-due"];
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

function emailListUrl(players) {
  const parentEmails = [...new Set(players.flatMap((player) => recipients({ parentEmail: player.parentEmail }, "parent")))];
  const body = `Hello Utah Flight Families,\n\n\n\nThank you,\nUtah Flight Volleyball`;
  return `https://mail.google.com/mail/u/0/?view=cm&fs=1&bcc=${encodeURIComponent(parentEmails.join(","))}&su=${encodeURIComponent(`Utah Flight ${activeSeason} ${activeYear} Update`)}&body=${encodeURIComponent(body)}`;
}

function renderEmailListButton() {
  const parentRecipients = filteredPlayers().filter((player) => recipients({ parentEmail: player.parentEmail }, "parent").length);
  const button = $("email-list-button");
  button.href = emailListUrl(parentRecipients);
  button.setAttribute("aria-disabled", String(!parentRecipients.length));
  button.classList.toggle("is-disabled", !parentRecipients.length);
}

function currentYearPlayers() {
  return crmStore.players.filter((player) => (player.year || "2026") === activeYear && (player.season || "Fall") === activeSeason);
}

function renderMetrics() {
  const selected = currentYearPlayers().filter((player) => player.rosterStatus === "selected");
  $("metric-on-track").textContent = selected.filter((player) => ["on_track", "paid"].includes(paymentSummary(player).status)).length;
  $("metric-past-due").textContent = selected.filter((player) => paymentSummary(player).status === "past_due").length;
  $("metric-not-selected").textContent = currentYearPlayers().filter((player) => player.rosterStatus === "not_selected").length;
  $("metric-unmatched").textContent = (crmStore.unmatchedPayments || []).filter((payment) => (payment.year || "2026") === activeYear && (payment.season || "Fall") === activeSeason).length;
  $("crm-summary").textContent = `${selected.length} selected players. ${currentYearPlayers().length - selected.length} not selected.`;
}

function filteredPlayers() {
  const query = $("player-search").value.trim().toLowerCase();
  const roster = $("status-filter").value;
  const payment = $("payment-filter").value;
  return crmStore.players.filter((player) => {
    const matchesQuery = !query || [player.name, player.parentName, player.playerEmail, player.parentEmail, player.team].join(" ").toLowerCase().includes(query);
    return (player.year || "2026") === activeYear && (player.season || "Fall") === activeSeason && matchesQuery && (roster === "all" || player.rosterStatus === roster) && (payment === "all" || paymentSummary(player).status === payment);
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
  const player = crmStore.players.find((item) => item.id === activePlayerId && (item.year || "2026") === activeYear && (item.season || "Fall") === activeSeason);
  if (!player) { $("player-detail").innerHTML = "<p>Select a player to review their contacts and payment plan.</p>"; return; }
  const summary = paymentSummary(player);
  const [label, tone] = statusLabel(player);
  const activePlan = paymentPlanFor(player);
  const plans = activePlan.map((item, index) => `<div class="payment-plan-row ${summary.paid >= activePlan.slice(0, index + 1).reduce((sum, entry) => sum + Number(entry.amount), 0) ? "is-paid" : ""}"><span>${escapeHtml(item.dueDate)}</span><strong>${money(item.amount)}</strong></div>`).join("");
  const planText = activePlan.map((item) => `${item.dueDate}:${item.amount}`).join(", ");
  $("player-detail").innerHTML = `<p class="kicker">${player.rosterStatus === "selected" ? "Final Team" : "Tryout Record"}</p><h2>${escapeHtml(player.name)}</h2><span class="status-pill ${tone}">${label}</span><div class="crm-contact-grid"><div><span>Player</span><strong>${escapeHtml(player.playerEmail || "No email")}</strong></div><div><span>Parent</span><strong>${escapeHtml(player.parentName || "Not listed")}</strong><strong>${escapeHtml(player.parentEmail || "No email")}</strong></div><div><span>Team</span><strong>${escapeHtml(player.team || "TBD")}</strong></div><div><span>Phones</span><strong>${escapeHtml(player.playerPhone || "-")}</strong><strong>${escapeHtml(player.parentPhone || "-")}</strong></div></div><div class="crm-detail-actions"><a class="button button-small" target="_blank" rel="noopener" href="${gmailUrl(player, "both")}">Email Both</a><a class="button button-small button-ghost" target="_blank" rel="noopener" href="${gmailUrl(player, "parent")}">Email Parent</a><a class="button button-small button-ghost" target="_blank" rel="noopener" href="${gmailUrl(player, "player")}">Email Player</a></div>${player.rosterStatus === "selected" ? `<div class="crm-payment-grid"><div><span>Paid</span><strong>${money(summary.paid)} of ${money(summary.total)}</strong></div><div><span>Balance</span><strong>${money(summary.balance)}</strong></div></div><div class="payment-plan"><p class="panel-label">Payment plan</p>${plans}</div>` : ""}<details class="crm-edit"><summary>Edit player record</summary><form id="player-edit-form" class="login-form"><label><span>Team</span><input name="team" value="${escapeHtml(player.team)}" /></label><label><span>Roster status</span><select name="rosterStatus"><option value="selected" ${player.rosterStatus === "selected" ? "selected" : ""}>Made the team</option><option value="not_selected" ${player.rosterStatus === "not_selected" ? "selected" : ""}>Not selected</option></select></label><label><span>Player email</span><input name="playerEmail" value="${escapeHtml(player.playerEmail)}" /></label><label><span>Parent email</span><input name="parentEmail" value="${escapeHtml(player.parentEmail)}" /></label><label><span>Payment plan</span><select name="usesCustomPaymentPlan"><option value="false" ${player.usesCustomPaymentPlan ? "" : "selected"}>Season default</option><option value="true" ${player.usesCustomPaymentPlan ? "selected" : ""}>Custom player plan</option></select></label><label><span>Payment schedule</span><input name="paymentPlanText" value="${escapeHtml(planText)}" placeholder="2027-08-01:300, 2027-08-28:300" /></label><label><span>Notes</span><textarea name="notes" rows="3">${escapeHtml(player.notes || "")}</textarea></label><button class="button button-small" type="submit">Save changes</button></form></details>`;
  if (player.photo) $("player-detail").querySelector("h2").insertAdjacentHTML("beforebegin", `<img class="crm-player-photo" src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.name)}" />`);
  $("player-edit-form").addEventListener("submit", savePlayer);
}

async function savePlayer(event) {
  event.preventDefault();
  const player = crmStore.players.find((item) => item.id === activePlayerId && (item.year || "2026") === activeYear && (item.season || "Fall") === activeSeason);
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const planText = data.paymentPlanText;
  delete data.paymentPlanText;
  data.usesCustomPaymentPlan = data.usesCustomPaymentPlan === "true";
  if (data.usesCustomPaymentPlan && planText) {
    data.paymentPlan = planText.split(",").map((entry) => {
      const [dueDate, amount] = entry.trim().split(":");
      return { dueDate: dueDate.trim(), amount: Number(amount) || 0 };
    }).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) && item.amount > 0);
  } else if (!data.usesCustomPaymentPlan) {
    data.paymentPlan = [];
  }
  Object.assign(player, data);
  try { crmStore = await api(`/api/crm/players/${encodeURIComponent(player.id)}`, { method: "PUT", body: JSON.stringify({ player }) }); renderAll(); } catch (error) { $("import-status").textContent = error.message; }
}

function renderUnmatched() {
  const payments = (crmStore.unmatchedPayments || []).filter((payment) => (payment.year || "2026") === activeYear && (payment.season || "Fall") === activeSeason);
  $("unmatched-section").hidden = !payments.length;
  $("unmatched-list").innerHTML = payments.map((item) => `<article class="unmatched-row"><div><strong>${escapeHtml(item.from || "Unknown sender")}</strong><p>${escapeHtml(item.date || "")} &bull; ${escapeHtml(item.note || "No note")}</p></div><strong>${money(item.amount)}</strong></article>`).join("");
}

function renderYearControl() {
  const years = crmStore.years?.length ? crmStore.years : ["2027"];
  if (!years.includes(activeYear)) activeYear = years[0];
  $("year-select").innerHTML = years.slice().sort().map((year) => `<option value="${escapeHtml(year)}" ${year === activeYear ? "selected" : ""}>${escapeHtml(year)}</option>`).join("");
  const seasons = crmStore.seasonsByYear?.[activeYear]?.length ? crmStore.seasonsByYear[activeYear] : ["Fall"];
  if (!seasons.includes(activeSeason)) activeSeason = seasons[0];
  $("season-select").innerHTML = seasons.map((season) => `<option value="${escapeHtml(season)}" ${season === activeSeason ? "selected" : ""}>${escapeHtml(season)}</option>`).join("");
  $("clear-year-button").textContent = `Clear ${activeSeason} ${activeYear} Data`;
}

function renderSeasonPlanFields(plan = crmStore.seasonPaymentPlans?.[seasonKey()] || []) {
  const installments = plan.length ? plan : [{ dueDate: "", amount: "" }];
  $("season-plan-fields").innerHTML = installments.map((item, index) => `<div class="season-plan-row"><label><span>Due date</span><input name="dueDate" type="date" value="${escapeHtml(item.dueDate)}" required /></label><label><span>Amount</span><input name="amount" type="number" min="0" step="0.01" value="${escapeHtml(item.amount)}" required /></label><button class="button button-ghost button-small" type="button" data-remove-installment="${index}">Remove</button></div>`).join("");
  document.querySelectorAll("[data-remove-installment]").forEach((button) => button.addEventListener("click", () => {
    const nextPlan = [...document.querySelectorAll(".season-plan-row")].filter((_, index) => index !== Number(button.dataset.removeInstallment)).map((row) => ({ dueDate: row.querySelector('[name="dueDate"]').value, amount: row.querySelector('[name="amount"]').value }));
    renderSeasonPlanFields(nextPlan);
  }));
}

function addInstallment() {
  const currentPlan = [...document.querySelectorAll(".season-plan-row")].map((row) => ({ dueDate: row.querySelector('[name="dueDate"]').value, amount: row.querySelector('[name="amount"]').value }));
  renderSeasonPlanFields([...currentPlan, { dueDate: "", amount: "" }]);
}

async function saveSeasonPlan(event) {
  event.preventDefault();
  const plan = [...document.querySelectorAll(".season-plan-row")].map((row) => ({ dueDate: row.querySelector('[name="dueDate"]').value, amount: Number(row.querySelector('[name="amount"]').value) })).filter((item) => item.dueDate && item.amount > 0);
  try {
    crmStore = await api(`/api/crm/years/${encodeURIComponent(activeYear)}/seasons/${encodeURIComponent(activeSeason)}/payment-plan`, { method: "PUT", body: JSON.stringify({ plan }) });
    $("import-status").textContent = `${activeSeason} ${activeYear} payment plan saved.`;
    renderAll();
  } catch (error) { $("import-status").textContent = error.message; }
}

function renderAll() { renderYearControl(); renderSeasonPlanFields(); renderMetrics(); renderPlayers(); renderDetail(); renderUnmatched(); renderEmailListButton(); }

async function importVenmo(file) {
  if (!file) return;
  $("import-status").textContent = "Importing Venmo statement...";
  try { crmStore = await api("/api/crm/import-venmo", { method: "POST", body: JSON.stringify({ ...(await uploadPayload(file)), year: activeYear, season: activeSeason }) }); $("import-status").textContent = "Venmo payments imported. Review any unmatched payments below."; renderAll(); } catch (error) { $("import-status").textContent = error.message; }
  $("venmo-file").value = "";
}

async function importPaymentsSheet(file) {
  if (!file) return;
  $("import-status").textContent = "Importing the Payments tab...";
  try {
    crmStore = await api("/api/crm/import-payments-sheet", { method: "POST", body: JSON.stringify({ ...(await uploadPayload(file)), year: activeYear, season: activeSeason }) });
    $("import-status").textContent = "Payments tab imported. Earlier Venmo transactions will not be counted again.";
    renderAll();
  } catch (error) { $("import-status").textContent = error.message; }
  $("payments-file").value = "";
}

async function importTrelloPhotos(file) {
  if (!file) return;
  $("import-status").textContent = "Matching Trello photos to player records...";
  try {
    const trelloJson = await file.text();
    const data = await api("/api/crm/import-trello-photos", { method: "POST", body: JSON.stringify({ fileName: file.name, trelloJson, year: activeYear, season: activeSeason }) });
    crmStore = data;
    const { imported = 0, unmatched = [], failed = [] } = data.results || {};
    $("import-status").textContent = `${imported} player photo${imported === 1 ? "" : "s"} imported.${unmatched.length ? ` ${unmatched.length} card${unmatched.length === 1 ? "" : "s"} did not match a player.` : ""}${failed.length ? ` ${failed.length} photo${failed.length === 1 ? "" : "s"} could not be downloaded. First error: ${failed[0]}` : ""}`;
    renderAll();
  } catch (error) { $("import-status").textContent = error.message; }
  $("trello-file").value = "";
}

async function importRoster(file, endpoint, label) {
  if (!file) return;
  $("import-status").textContent = `Importing ${label}...`;
  try {
    crmStore = await api(endpoint, { method: "POST", body: JSON.stringify({ ...(await uploadPayload(file)), year: activeYear, season: activeSeason }) });
    $("import-status").textContent = `${label} imported. Review the roster and payment statuses.`;
    renderAll();
  } catch (error) { $("import-status").textContent = error.message; }
}

async function boot() {
  const session = await api("/api/session");
  if (!session.user || session.user.role !== "admin") { $("crm-login").hidden = false; $("crm-app").hidden = true; return; }
  $("crm-login").hidden = true; $("crm-app").hidden = false;
  crmStore = await api("/api/crm");
  activeYear = crmStore.activeYear || "2027";
  activeSeason = crmStore.activeSeason || "Fall";
  renderAll();
}

async function addYear() {
  const year = window.prompt("Enter the new season year, for example 2028.");
  if (!/^20\d{2}$/.test(year || "")) return;
  try { crmStore = await api("/api/crm/years", { method: "POST", body: JSON.stringify({ year }) }); activeYear = year; activeSeason = "Fall"; activePlayerId = ""; renderAll(); } catch (error) { $("import-status").textContent = error.message; }
}

async function addSeason() {
  const season = window.prompt("Enter Fall, Winter, Spring, or Summer.");
  if (!season) return;
  try { crmStore = await api(`/api/crm/years/${encodeURIComponent(activeYear)}/seasons`, { method: "POST", body: JSON.stringify({ season }) }); activeSeason = season[0].toUpperCase() + season.slice(1).toLowerCase(); activePlayerId = ""; renderAll(); } catch (error) { $("import-status").textContent = error.message; }
}

async function clearYear() {
  if (!window.confirm(`Clear every ${activeSeason} ${activeYear} roster and payment record? This cannot be undone.`)) return;
  try { crmStore = await api(`/api/crm/years/${encodeURIComponent(activeYear)}/seasons/${encodeURIComponent(activeSeason)}`, { method: "DELETE", body: "{}" }); activePlayerId = ""; $("import-status").textContent = `${activeSeason} ${activeYear} data cleared.`; renderAll(); } catch (error) { $("import-status").textContent = error.message; }
}

$("login-form").addEventListener("submit", async (event) => { event.preventDefault(); try { await api("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }); await boot(); } catch (error) { $("login-status").textContent = error.message; } });
$("logout-button").addEventListener("click", async () => { await api("/api/logout", { method: "POST", body: "{}" }); await boot(); });
$("player-search").addEventListener("input", () => { renderPlayers(); renderEmailListButton(); });
$("status-filter").addEventListener("change", () => { renderPlayers(); renderEmailListButton(); });
$("payment-filter").addEventListener("change", () => { renderPlayers(); renderEmailListButton(); });
$("email-list-button").addEventListener("click", (event) => { if ($("email-list-button").getAttribute("aria-disabled") === "true") event.preventDefault(); });
$("year-select").addEventListener("change", (event) => { activeYear = event.target.value; activePlayerId = ""; renderAll(); });
$("season-select").addEventListener("change", (event) => { activeSeason = event.target.value; activePlayerId = ""; renderAll(); });
$("add-year-button").addEventListener("click", addYear);
$("add-season-button").addEventListener("click", addSeason);
$("season-plan-form").addEventListener("submit", saveSeasonPlan);
$("add-installment-button").addEventListener("click", addInstallment);
$("clear-year-button").addEventListener("click", clearYear);
$("venmo-file").addEventListener("change", (event) => importVenmo(event.target.files[0]));
$("payments-file").addEventListener("change", (event) => importPaymentsSheet(event.target.files[0]));
$("trello-file").addEventListener("change", (event) => importTrelloPhotos(event.target.files[0]));
$("final-teams-file").addEventListener("change", (event) => importRoster(event.target.files[0], "/api/crm/import-final-teams", "Final Teams"));
$("tryouts-file").addEventListener("change", (event) => importRoster(event.target.files[0], "/api/crm/import-tryouts", "All Tryouts"));
boot().catch((error) => { $("login-status").textContent = error.message; });
