const EVENT_TYPES = [
  "TRIAL",
  "HEARING",
  "RESPONSE_DUE",
  "DISCOVERY_DUE",
  "AWAITING_RULING",
  "PENDING",
  "RESOLVED",
];

const UNDATED_ORDER = {
  PENDING: 1,
  AWAITING_RULING: 2,
  RESOLVED: 3,
};

const EVENT_COLORS = {
  TRIAL: "#FAD4D4",
  HEARING: "#DCEBFA",
  RESPONSE_DUE: "#FAF3C7",
  DISCOVERY_DUE: "#FBE4CC",
  AWAITING_RULING: "#EDE3D3",
  PENDING: "#E9DDF5",
  RESOLVED: "#E5E7EB",
};

const DEFAULT_USERS = [
  "Jay", "Don", "Jess", "Rachel", "Kathryn", "Amy", "Cindy", "Emma",
  "James", "Phil", "Stephen", "Riley", "Grant", "Abby", "Joe", "Jeff",
].sort((a, b) => a.localeCompare(b)).map((name, idx) => ({
  id: crypto.randomUUID(),
  name,
  email: `${name.toLowerCase()}@firm.com`,
  password: "password123",
  role: idx === 0 ? "ADMIN" : "USER",
}));

const defaultSeed = () => {
  const [abby, amy] = DEFAULT_USERS;
  const caseA = crypto.randomUUID();
  const caseB = crypto.randomUUID();
  return {
    users: DEFAULT_USERS,
    cases: [
      { id: caseA, caseName: "Anderson v. Northwind", causeNumber: "24-2-10001-1", leadAttorneyId: abby.id, linkUrl: "", tabsBillingCaseId: "" },
      { id: caseB, caseName: "Baker v. Contoso", causeNumber: "24-2-10002-8", leadAttorneyId: amy.id, linkUrl: "", tabsBillingCaseId: "" },
    ],
    events: [
      { id: crypto.randomUUID(), caseId: caseA, eventType: "DISCOVERY_DUE", eventAt: new Date(Date.now() + 86400000 * 20).toISOString() },
      { id: crypto.randomUUID(), caseId: caseA, eventType: "TRIAL", eventAt: new Date(Date.now() + 86400000 * 80).toISOString() },
      { id: crypto.randomUUID(), caseId: caseB, eventType: "PENDING", eventAt: null },
    ],
    notes: [],
  };
};

const store = {
  load() {
    const raw = localStorage.getItem("litigation_app_v1");
    if (!raw) {
      const seed = defaultSeed();
      this.save(seed);
      return seed;
    }
    return JSON.parse(raw);
  },
  save(state) {
    localStorage.setItem("litigation_app_v1", JSON.stringify(state));
  },
};

const ui = {
  app: document.getElementById("app"),
  state: {
    data: store.load(),
    userId: localStorage.getItem("litigation_user_id") || null,
    theme: localStorage.getItem("litigation_theme") || "light",
    routeCaseId: null,
    routePage: "dashboard",
    scope: "all",
    sortBy: "eventDate",
    sortDir: "desc",
  },
};

function saveAndRender() {
  store.save(ui.state.data);
  render();
}

function setTheme(theme) {
  ui.state.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("litigation_theme", theme);
}

function formatEventType(type) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function currentUser() {
  return ui.state.data.users.find((u) => u.id === ui.state.userId) || null;
}

function eventSortWeight(event) {
  if (event.eventAt) return 0;
  return UNDATED_ORDER[event.eventType] || 99;
}

function sortedRows() {
  const user = currentUser();
  const { cases, events, users } = ui.state.data;
  let rows = [];

  cases.forEach((c) => {
    const evts = events.filter((e) => e.caseId === c.id);
    if (evts.length === 0) {
      rows.push({ case: c, event: { id: null, eventType: "PENDING", eventAt: null }, attorney: users.find((u) => u.id === c.leadAttorneyId) });
    }
    evts.forEach((event) => {
      rows.push({ case: c, event, attorney: users.find((u) => u.id === c.leadAttorneyId) });
    });
  });

  if (ui.state.scope === "mine" && user) {
    rows = rows.filter((r) => r.case.leadAttorneyId === user.id);
  }

  const col = ui.state.sortBy;
  const dir = ui.state.sortDir === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    if (col === "eventDate") {
      const aHas = !!a.event.eventAt;
      const bHas = !!b.event.eventAt;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) {
        const diff = new Date(a.event.eventAt) - new Date(b.event.eventAt);
        if (diff !== 0) return diff * dir;
      }
      const undiff = eventSortWeight(a.event) - eventSortWeight(b.event);
      if (undiff !== 0) return undiff;
      return a.case.caseName.localeCompare(b.case.caseName);
    }
    if (col === "attorney") return a.attorney.name.localeCompare(b.attorney.name) * dir;
    if (col === "caseName") return a.case.caseName.localeCompare(b.case.caseName) * dir;
    if (col === "causeNumber") return a.case.causeNumber.localeCompare(b.case.causeNumber) * dir;
    if (col === "event") return formatEventType(a.event.eventType).localeCompare(formatEventType(b.event.eventType)) * dir;
    return 0;
  });

  return rows;
}

function renderLogin() {
  ui.app.innerHTML = `
    <section class="container">
      <div class="header"><h1>Cases</h1><button id="themeBtn" class="pill-btn">Theme</button></div>
      <p class="small">Sign in to continue. Demo password for all users: <strong>password123</strong></p>
      <div class="form-grid">
        <label>Email <input id="loginEmail" type="email" placeholder="abby@firm.com" /></label>
        <label>Password <input id="loginPw" type="password" /></label>
      </div>
      <div class="controls"><button id="loginBtn">Login</button></div>
      <p class="small">Available attorneys are tied to user accounts and appear alphabetically in the case form.</p>
    </section>
  `;

  document.getElementById("themeBtn").onclick = () => {
    setTheme(ui.state.theme === "light" ? "dark" : "light");
    render();
  };

  document.getElementById("loginBtn").onclick = () => {
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pw = document.getElementById("loginPw").value;
    const user = ui.state.data.users.find((u) => u.email.toLowerCase() === email && u.password === pw);
    if (!user) return alert("Invalid credentials");
    ui.state.userId = user.id;
    localStorage.setItem("litigation_user_id", user.id);
    render();
  };
}

function renderDashboard() {
  const user = currentUser();
  const rows = sortedRows();

  ui.app.innerHTML = `
    <section class="container">
      <div class="header">
        <h1>Cases</h1>
        <button id="settingsBtn" class="pill-btn">Settings</button>
      </div>
      <div class="controls">
        <button id="scopeAll">All Cases</button>
        <button id="scopeMine">My Cases</button>
        <button id="addCase">Add Case</button>
        <button id="logout">Logout (${user.name})</button>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th><button data-sort="attorney">Attorney</button></th>
            <th><button data-sort="caseName">Case Name</button></th>
            <th><button data-sort="causeNumber">Cause Number</button></th>
            <th><button data-sort="eventDate">Event Date</button></th>
            <th><button data-sort="event">Event</button></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="clickable-row" data-case-id="${r.case.id}">
              <td>${r.attorney.name}</td>
              <td><strong>${r.case.caseName}</strong></td>
              <td>${r.case.causeNumber}</td>
              <td>${formatDate(r.event.eventAt)}</td>
              <td><span class="event-chip" style="background:${EVENT_COLORS[r.event.eventType] || "#eee"}">${formatEventType(r.event.eventType)}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;

  document.getElementById("scopeAll").onclick = () => { ui.state.scope = "all"; render(); };
  document.getElementById("scopeMine").onclick = () => { ui.state.scope = "mine"; render(); };
  document.getElementById("addCase").onclick = () => {
    const userId = ui.state.data.users[0]?.id;
    const c = { id: crypto.randomUUID(), caseName: "New Case", causeNumber: `CN-${Date.now()}`, leadAttorneyId: userId, linkUrl: "", tabsBillingCaseId: "" };
    ui.state.data.cases.push(c);
    saveAndRender();
  };
  document.getElementById("settingsBtn").onclick = () => {
    ui.state.routeCaseId = null;
    ui.state.routePage = "settings";
    render();
  };
  document.getElementById("logout").onclick = () => {
    ui.state.userId = null;
    ui.state.routePage = "dashboard";
    localStorage.removeItem("litigation_user_id");
    render();
  };

  document.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.onclick = (e) => {
      const next = e.target.getAttribute("data-sort");
      if (ui.state.sortBy === next) ui.state.sortDir = ui.state.sortDir === "asc" ? "desc" : "asc";
      else {
        ui.state.sortBy = next;
        ui.state.sortDir = next === "eventDate" ? "desc" : "asc";
      }
      render();
    };
  });

  document.querySelectorAll("[data-case-id]").forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest("button")) return;
      ui.state.routeCaseId = row.getAttribute("data-case-id");
      ui.state.routePage = "dashboard";
      render();
    };
  });

}

function renderCasePage() {
  const { cases, users, events, notes } = ui.state.data;
  const caseItem = cases.find((c) => c.id === ui.state.routeCaseId);
  if (!caseItem) {
    ui.state.routeCaseId = null;
    return render();
  }

  const caseEvents = events.filter((e) => e.caseId === caseItem.id);
  const caseNotes = notes.filter((n) => n.caseId === caseItem.id);

  ui.app.innerHTML = `
    <section class="container">
      <div class="header">
        <h2>Case Page</h2>
        <div class="controls">
          <button id="saveCasePage" class="save-btn">Save</button>
          <button id="backBtn" class="back-btn">Back to Dashboard</button>
        </div>
      </div>
      <div class="form-grid">
        <label>Attorney
          <select id="caseAttorney">
            ${users.slice().sort((a, b) => a.name.localeCompare(b.name)).map((u) => `<option value="${u.id}" ${u.id === caseItem.leadAttorneyId ? "selected" : ""}>${u.name}</option>`).join("")}
          </select>
        </label>
        <label>Case Name <input id="caseName" value="${caseItem.caseName}" /></label>
        <label>Cause Number <input id="causeNumber" value="${caseItem.causeNumber}" /></label>
      </div>
      <div class="link-form">
        <button id="openCaseLinkBtn" type="button">Open Link</button>
        <label>Case Link URL
          <input id="caseLinkUrl" type="url" placeholder="https://shared-drive.example.com/case-folder" value="${escapeHtml(caseItem.linkUrl || "")}" />
        </label>
      </div>
      <div class="billing-form">
        <button id="copyTabsBillingCaseIdBtn" type="button">Copy ID</button>
        <label>TABS Billing Case ID
          <input id="tabsBillingCaseId" placeholder="100.000001" value="${escapeHtml(caseItem.tabsBillingCaseId || "")}" />
        </label>
      </div>
      <div class="section">
        <h2>Events</h2>
        <table class="table">
          <thead><tr><th>Event</th><th>Event Date/Time</th><th>Actions</th></tr></thead>
          <tbody>
            ${caseEvents.map((e) => `
              <tr>
                <td>
                  <select data-event-type="${e.id}">
                    ${EVENT_TYPES.map((t) => `<option value="${t}" ${t === e.eventType ? "selected" : ""}>${formatEventType(t)}</option>`).join("")}
                  </select>
                </td>
                <td>
                  <input data-event-at="${e.id}" type="datetime-local" value="${e.eventAt ? toDatetimeLocal(e.eventAt) : ""}" ${isUndatedType(e.eventType) ? "disabled" : ""}/>
                </td>
                <td class="row-actions"><button data-del-event="${e.id}">Delete</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="controls"><button id="addEvent">Add Event</button></div>
      </div>

      <div class="section">
        <h2>Notes</h2>
        <textarea id="newNote" placeholder="Add a shared note..."></textarea>
        <div class="controls"><button id="addNote">Add Note</button></div>
        ${caseNotes.map((n) => `
          <div>
            <p>${escapeHtml(n.body)}</p>
            <p class="small">${new Date(n.createdAt).toLocaleString()}</p>
            <button data-del-note="${n.id}">Delete</button>
          </div>
        `).join("")}
      </div>
      <div class="case-footer-actions">
        <button id="deleteCaseBtn" class="danger-btn">Delete Case</button>
      </div>
    </section>
  `;

  document.getElementById("backBtn").onclick = () => { ui.state.routeCaseId = null; render(); };
  document.getElementById("saveCasePage").onclick = () => {
    caseItem.leadAttorneyId = document.getElementById("caseAttorney").value;
    caseItem.caseName = document.getElementById("caseName").value.trim() || caseItem.caseName;
    caseItem.causeNumber = document.getElementById("causeNumber").value.trim() || caseItem.causeNumber;
    caseItem.linkUrl = document.getElementById("caseLinkUrl").value.trim();
    caseItem.tabsBillingCaseId = document.getElementById("tabsBillingCaseId").value.trim();

    document.querySelectorAll("[data-event-type]").forEach((input) => {
      const id = input.getAttribute("data-event-type");
      const evt = ui.state.data.events.find((e) => e.id === id);
      const dateInput = document.querySelector(`[data-event-at='${id}']`);
      evt.eventType = input.value;
      evt.eventAt = isUndatedType(input.value) || !dateInput.value
        ? null
        : new Date(dateInput.value).toISOString();
    });

    saveAndRender();
  };

  document.getElementById("openCaseLinkBtn").onclick = () => {
    const rawUrl = document.getElementById("caseLinkUrl").value.trim();
    if (!rawUrl) return alert("Please enter a link URL first.");
    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl) return alert("Please enter a valid URL.");
    window.open(normalizedUrl, "_blank", "noopener");
  };

  document.getElementById("copyTabsBillingCaseIdBtn").onclick = async () => {
    const billingId = document.getElementById("tabsBillingCaseId").value.trim();
    if (!billingId) return alert("Please enter a TABS Billing Case ID first.");
    try {
      await navigator.clipboard.writeText(billingId);
      alert("TABS Billing Case ID copied to clipboard.");
    } catch {
      alert("Unable to copy automatically. Please copy manually.");
    }
  };

  document.getElementById("addEvent").onclick = () => {
    ui.state.data.events.push({ id: crypto.randomUUID(), caseId: caseItem.id, eventType: "HEARING", eventAt: new Date().toISOString() });
    saveAndRender();
  };

  document.querySelectorAll("[data-event-type]").forEach((el) => {
    el.onchange = () => {
      const id = el.getAttribute("data-event-type");
      const input = document.querySelector(`[data-event-at='${id}']`);
      if (isUndatedType(el.value)) {
        input.value = "";
        input.disabled = true;
      } else {
        input.disabled = false;
      }
    };
  });

  document.querySelectorAll("[data-del-event]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-del-event");
      ui.state.data.events = ui.state.data.events.filter((e) => e.id !== id);
      saveAndRender();
    };
  });

  document.getElementById("addNote").onclick = () => {
    const text = document.getElementById("newNote").value.trim();
    if (!text) return;
    ui.state.data.notes.unshift({
      id: crypto.randomUUID(),
      caseId: caseItem.id,
      body: text,
      createdAt: new Date().toISOString(),
      createdByUserId: ui.state.userId,
    });
    saveAndRender();
  };

  document.querySelectorAll("[data-del-note]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-del-note");
      ui.state.data.notes = ui.state.data.notes.filter((n) => n.id !== id);
      saveAndRender();
    };
  });

  document.getElementById("deleteCaseBtn").onclick = () => {
    ui.state.data.cases = ui.state.data.cases.filter((c) => c.id !== caseItem.id);
    ui.state.data.events = ui.state.data.events.filter((e) => e.caseId !== caseItem.id);
    ui.state.data.notes = ui.state.data.notes.filter((n) => n.caseId !== caseItem.id);
    ui.state.routeCaseId = null;
    saveAndRender();
  };
}

function renderSettingsPage() {
  ui.app.innerHTML = `
    <section class="container">
      <div class="header">
        <h2>Settings</h2>
      </div>
      <div class="section">
        <h2>Theme</h2>
        <div class="controls">
          <button id="normalThemeBtn" class="${ui.state.theme === "light" ? "save-btn" : ""}">Normal</button>
          <button id="darkThemeBtn" class="${ui.state.theme === "dark" ? "save-btn" : ""}">Dark Mode</button>
        </div>
      </div>
      <div class="section">
        <button id="returnDashboardBtn" class="back-btn">Return to Dashboard</button>
      </div>
    </section>
  `;

  document.getElementById("normalThemeBtn").onclick = () => { setTheme("light"); render(); };
  document.getElementById("darkThemeBtn").onclick = () => { setTheme("dark"); render(); };
  document.getElementById("returnDashboardBtn").onclick = () => {
    ui.state.routeCaseId = null;
    ui.state.routePage = "dashboard";
    render();
  };
}

function isUndatedType(type) {
  return ["PENDING", "AWAITING_RULING", "RESOLVED"].includes(type);
}

function toDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUrl(url) {
  try {
    return new URL(url).toString();
  } catch {
    try {
      return new URL(`https://${url}`).toString();
    } catch {
      return null;
    }
  }
}

function render() {
  setTheme(ui.state.theme);
  if (!currentUser()) return renderLogin();
  if (ui.state.routePage === "settings") return renderSettingsPage();
  if (ui.state.routeCaseId) return renderCasePage();
  return renderDashboard();
}

render();
