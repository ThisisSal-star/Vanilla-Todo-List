const API_BASE = "http://localhost:3000";

let TODOS = [];
let NOTIFY_TIMERS = new Map();

/* =========================
   ELEMENTS
========================= */
const els = {
  list: document.getElementById("list"),
  empty: document.getElementById("emptyState"),
  createForm: document.getElementById("createForm"),
  titleInput: document.getElementById("titleInput"),
  descInput: document.getElementById("descInput"),
  dueInput: document.getElementById("dueInput"),
  formStatus: document.getElementById("formStatus"),
  saveBtn: document.getElementById("saveBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  themeBtn: document.getElementById("themeBtn"),
  searchInput: document.getElementById("searchInput"),
  filterSelect: document.getElementById("filterSelect"),
  sortSelect: document.getElementById("sortSelect"),
  clearCompletedBtn: document.getElementById("clearCompletedBtn"),
  toast: document.getElementById("toast"),
};

/* =========================
   UTILITIES
========================= */
const isOverdue = (t) => !t.completed && new Date(t.dueAt) < new Date();

const fmt = (v) =>
  new Date(v).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const showToast = (msg) => {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2200);
};

const setLoading = (state) => {
  document.querySelector(".app").classList.toggle("loading", state);
  document.documentElement.style.cursor = state ? "progress" : "default";
};

/* =========================
   SAFE FETCH (NO POPUPS 😌)
========================= */
async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("Request failed");
  return res.status === 204 ? null : res.json();
}

/* =========================
   API HELPERS
========================= */
const apiGet = () => safeFetch(`${API_BASE}/todos`);

const apiPost = (todo) =>
  safeFetch(`${API_BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });

const apiPut = (id, todo) =>
  safeFetch(`${API_BASE}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });

const apiDelete = (id) =>
  safeFetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });

/* =========================
   QUERY + RENDER
========================= */
function buildQuery() {
  let arr = [...TODOS];
  const q = els.searchInput.value.toLowerCase().trim();
  const f = els.filterSelect.value;
  const s = els.sortSelect.value;

  if (q) {
    arr = arr.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
  }

  if (f === "completed") arr = arr.filter((t) => t.completed);
  if (f === "pending") arr = arr.filter((t) => !t.completed && !isOverdue(t));
  if (f === "overdue") arr = arr.filter(isOverdue);

  arr.sort((a, b) => {
    if (s === "dueAsc") return new Date(a.dueAt) - new Date(b.dueAt);
    if (s === "dueDesc") return new Date(b.dueAt) - new Date(a.dueAt);
    if (s === "createdAsc")
      return new Date(a.createdAt) - new Date(b.createdAt);
    if (s === "createdDesc")
      return new Date(b.createdAt) - new Date(a.createdAt);
    return 0;
  });

  return arr;
}

function render() {
  const items = buildQuery();
  els.list.innerHTML = "";

  if (!items.length) {
    els.empty.hidden = false;
    return;
  }

  els.empty.hidden = true;

  for (const t of items) {
    const overdue = isOverdue(t);
    const card = document.createElement("div");
    card.className =
      "card " + (t.completed ? "struck " : "") + (overdue ? "overdue " : "");

    const checkbox = document.createElement("label");
    checkbox.className = "checkbox" + (t.completed ? " checked" : "");
    checkbox.innerHTML = `<input type="checkbox"><div class="dot"></div>`;
    checkbox.onclick = (e) => {
      e.preventDefault();
      toggleComplete(t);
    };

    const main = document.createElement("div");
    main.className = "todo";
    main.innerHTML = `
      <h3 class="todo-title">${t.title}</h3>
      ${t.description ? `<p class="todo-desc">${t.description}</p>` : ""}
    `;

    const meta = document.createElement("div");
    meta.className = "meta";

    const status = document.createElement("span");
    status.className =
      "chip " + (t.completed ? "complete" : overdue ? "overdue" : "due");
    status.textContent = t.completed
      ? "Completed"
      : overdue
      ? "Overdue"
      : "Due: " + fmt(t.dueAt);

    const created = document.createElement("span");
    created.className = "chip";
    created.textContent = "Created: " + fmt(t.createdAt);

    meta.append(status, created);
    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const edit = document.createElement("button");
    edit.textContent = "✏️ Edit";
    edit.onclick = () => openEdit(t);

    const del = document.createElement("button");
    del.textContent = "🗑 Delete";
    del.className = "btn btn-danger";
    del.onclick = async () => {
      setLoading(true);
      try {
        await apiDelete(t.id);
        TODOS = TODOS.filter((x) => x.id !== t.id);
        render();
        showToast("Deleted");
      } catch {
        showToast("Delete failed");
      } finally {
        setLoading(false);
      }
    };

    actions.append(edit, del);
    card.append(checkbox, main, actions);
    els.list.append(card);
  }
}

/* =========================
   CRUD ACTIONS
========================= */
async function load() {
  setLoading(true);
  try {
    TODOS = await apiGet();
    render();
  } catch {
    showToast("Server not running");
  } finally {
    setLoading(false);
  }
}

els.createForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = els.titleInput.value.trim();
  const due = els.dueInput.value;
  if (!title || !due) {
    showToast("Title & due date required");
    return;
  }

  setLoading(true);
  els.formStatus.textContent = "Saving…";

  try {
    const saved = await apiPost({
      title,
      description: els.descInput.value.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      dueAt: new Date(due).toISOString(),
    });

    TODOS.unshift(saved);
    els.createForm.reset();
    render();
    showToast("Added");
  } catch {
    showToast("Save failed");
  } finally {
    els.formStatus.textContent = "";
    setLoading(false);
  }
});

async function toggleComplete(t) {
  setLoading(true);
  try {
    const updated = await apiPut(t.id, {
      ...t,
      completed: !t.completed,
    });
    TODOS[TODOS.findIndex((x) => x.id === t.id)] = updated;
    render();
  } catch {
    showToast("Update failed");
  } finally {
    setLoading(false);
  }
}

function openEdit(t) {
  els.titleInput.value = t.title;
  els.descInput.value = t.description || "";
  els.dueInput.value = t.dueAt.slice(0, 16);
  els.saveBtn.textContent = "💾 Update Task";

  els.createForm.onsubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const up = await apiPut(t.id, {
        ...t,
        title: els.titleInput.value.trim(),
        description: els.descInput.value.trim(),
        dueAt: new Date(els.dueInput.value).toISOString(),
      });
      TODOS[TODOS.findIndex((x) => x.id === t.id)] = up;
      els.createForm.reset();
      els.createForm.onsubmit = null;
      els.saveBtn.textContent = "➕ Add Task";
      render();
      showToast("Updated");
    } catch {
      showToast("Update failed");
    } finally {
      setLoading(false);
    }
  };
}

/* =========================
   UI EVENTS
========================= */
els.reloadBtn.onclick = load;
els.themeBtn.onclick = () =>
  (document.body.dataset.theme =
    document.body.dataset.theme === "light" ? "dark" : "light");

els.searchInput.oninput = render;
els.filterSelect.onchange = render;
els.sortSelect.onchange = render;

els.clearCompletedBtn.onclick = async () => {
  const done = TODOS.filter((t) => t.completed);
  if (!done.length) return showToast("Nothing to clear");

  setLoading(true);
  try {
    for (const t of done) await apiDelete(t.id);
    TODOS = TODOS.filter((t) => !t.completed);
    render();
    showToast("Cleared completed");
  } catch {
    showToast("Clear failed");
  } finally {
    setLoading(false);
  }
};

/* =========================
   INIT
========================= */
load();
