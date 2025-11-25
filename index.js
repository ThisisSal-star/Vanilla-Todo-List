const API_BASE = "http://localhost:3000";
let TODOS = [],
  NOTIFY_TIMERS = new Map();

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

const isOverdue = (t) => !t.completed && new Date(t.dueAt) < new Date();

const fmt = (v) =>
  new Date(v).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const showToast = (m) => {
  els.toast.textContent = m;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2200);
};

const setLoading = (s) => {
  document.querySelector(".app").classList.toggle("loading", s);
  document.documentElement.style.cursor = s ? "progress" : "default";
};

function buildQuery() {
  const q = els.searchInput.value.trim().toLowerCase();
  const f = els.filterSelect.value;
  const s = els.sortSelect.value;
  let arr = TODOS.slice();
  if (q)
    arr = arr.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
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

function scheduleNotification(t) {
  if (NOTIFY_TIMERS.has(t.id)) {
    clearTimeout(NOTIFY_TIMERS.get(t.id));
    NOTIFY_TIMERS.delete(t.id);
  }
  if (t.completed) return;
  const ms = new Date(t.dueAt).getTime() - Date.now();
  if (ms <= 0) return;
  const timer = setTimeout(() => {
    showToast(`⏰ Task due now: ${t.title}`);
    NOTIFY_TIMERS.delete(t.id);
  }, ms);
  NOTIFY_TIMERS.set(t.id, timer);
}

function scheduleAll() {
  NOTIFY_TIMERS.forEach(clearTimeout);
  NOTIFY_TIMERS.clear();
  TODOS.forEach(scheduleNotification);
}

function render() {
  const items = buildQuery();
  els.list.innerHTML = "";
  if (items.length === 0) {
    els.empty.hidden = false;
    return;
  }
  els.empty.hidden = true;
  for (const t of items) {
    const overdue = isOverdue(t);
    const c = document.createElement("div");
    c.className =
      "card " + (t.completed ? "struck " : "") + (overdue ? "overdue " : "");

    const cb = document.createElement("label");
    cb.className = "checkbox" + (t.completed ? " checked" : "");
    cb.innerHTML = '<input type="checkbox"/><div class="dot"></div>';
    cb.addEventListener("click", (e) => {
      e.preventDefault();
      toggleComplete(t);
    });

    const main = document.createElement("div");
    main.className = "todo";
    main.innerHTML = `<h3 class="todo-title">${t.title}</h3>
          ${t.description ? `<p class="todo-desc">${t.description}</p>` : ""}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    const chip1 = document.createElement("span");
    chip1.className =
      "chip " + (t.completed ? "complete" : overdue ? "overdue" : "due");
    chip1.textContent = t.completed
      ? "Completed"
      : overdue
      ? "Overdue"
      : "Due: " + fmt(t.dueAt);
    const chip2 = document.createElement("span");
    chip2.className = "chip";
    chip2.textContent = "Created: " + fmt(t.createdAt);
    meta.append(chip1, chip2);
    main.append(meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const edit = document.createElement("button");
    edit.textContent = "✏️ Edit";
    edit.className = "btn";
    edit.type = "button";
    edit.addEventListener("click", () => openEdit(t));

    const del = document.createElement("button");
    del.textContent = "🗑 Delete";
    del.className = "btn btn-danger";
    del.type = "button";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete "${t.title}"?`)) return;
      setLoading(true);
      try {
        await apiDelete(t.id);
        TODOS = TODOS.filter((x) => x.id !== t.id);
        render();
        showToast("Deleted");
      } catch (e) {
        alert("Delete failed");
        console.error(e);
      } finally {
        setLoading(false);
      }
    });

    actions.append(edit, del);
    c.append(cb, main, actions);
    els.list.append(c);
  }
  scheduleAll();
}

const apiGet = () => fetch(`${API_BASE}/todos`).then((r) => r.json());
const apiPost = (t) =>
  fetch(`${API_BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t),
  }).then((r) => r.json());

const apiPut = (id, t) =>
  fetch(`${API_BASE}/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t),
  }).then((r) => r.json());

const apiDelete = (id) =>
  fetch(`${API_BASE}/todos/${id}`, { method: "DELETE" });

async function load() {
  setLoading(true);
  try {
    TODOS = await apiGet();
    render();
  } catch (e) {
    alert("Failed to load todos");
    console.error(e);
  } finally {
    setLoading(false);
  }
}

els.createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = els.titleInput.value.trim();
  const desc = els.descInput.value.trim();
  const due = els.dueInput.value;
  if (!title || !due) {
    alert("Title and due date required");
    return;
  }
  const newTodo = {
    title,
    description: desc,
    completed: false,
    createdAt: new Date().toISOString(),
    dueAt: new Date(due).toISOString(),
  };
  setLoading(true);
  els.formStatus.textContent = "Saving…";
  try {
    const saved = await apiPost(newTodo);
    TODOS.unshift(saved);
    els.createForm.reset();
    render();
    showToast("Added");
  } catch (err) {
    alert("Save failed");
    console.error(err);
  } finally {
    els.formStatus.textContent = "";
    setLoading(false);
  }
});

async function toggleComplete(t) {
  setLoading(true);
  try {
    const up = await apiPut(t.id, { ...t, completed: !t.completed });
    TODOS[TODOS.findIndex((x) => x.id === t.id)] = up;
    render();
    showToast(up.completed ? "Marked complete" : "Marked incomplete");
  } catch (e) {
    alert("Update failed");
  } finally {
    setLoading(false);
  }
}

function openEdit(t) {
  els.titleInput.value = t.title;
  els.descInput.value = t.description || "";
  const d = new Date(t.dueAt);
  const p = (n) => String(n).padStart(2, "0");
  els.dueInput.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(
    d.getDate()
  )}T${p(d.getHours())}:${p(d.getMinutes())}`;
  els.saveBtn.textContent = "💾 Update Task";
  els.formStatus.textContent = "Editing…";
  els.createForm.onsubmit = async (e) => {
    e.preventDefault();
    const title = els.titleInput.value.trim();
    const desc = els.descInput.value.trim();
    const due = els.dueInput.value;
    if (!title || !due) {
      alert("Title and due date required");
      return;
    }
    setLoading(true);
    els.formStatus.textContent = "Updating…";
    try {
      const up = await apiPut(t.id, {
        ...t,
        title,
        description: desc,
        dueAt: new Date(due).toISOString(),
      });
      TODOS[TODOS.findIndex((x) => x.id === t.id)] = up;
      render();
      showToast("Updated");
      els.createForm.reset();
      els.saveBtn.textContent = "➕ Add Task";
      els.formStatus.textContent = "";
      els.createForm.onsubmit = null;
    } catch (err) {
      alert("Update failed");
    } finally {
      setLoading(false);
    }
  };
}

els.reloadBtn.addEventListener("click", load);
els.themeBtn.addEventListener("click", () => {
  document.body.dataset.theme =
    document.body.dataset.theme === "light" ? "dark" : "light";
});
els.searchInput.addEventListener("input", render);
els.filterSelect.addEventListener("change", render);
els.sortSelect.addEventListener("change", render);

els.clearCompletedBtn.addEventListener("click", async () => {
  const done = TODOS.filter((t) => t.completed);
  if (!done.length) {
    showToast("Nothing to clear");
    return;
  }
  if (!confirm(`Clear ${done.length} completed task(s)?`)) return;
  setLoading(true);
  try {
    for (const t of done) {
      await apiDelete(t.id);
    }
    TODOS = TODOS.filter((t) => !t.completed);
    render();
    showToast("Cleared completed tasks");
  } catch (err) {
    alert("Clear failed");
    console.error(err);
  } finally {
    setLoading(false);
  }
});

load(); // Initial load
