"use strict";

const TYPE_META = {
  timer: { icon: "⏱", label: "Timer" },
  contact: { icon: "📇", label: "Kontakt" },
};

function initDashboard() {
  renderDashboard();
}

function renderDashboard() {
  const tags = getTags().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = document.getElementById("tag-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";

  if (tags.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const tag of tags) {
    list.appendChild(renderTagCard(tag));
  }
}

function renderTagCard(tag) {
  const meta = TYPE_META[tag.type] || { icon: "🏷", label: tag.type };
  const card = document.createElement("div");
  card.className = "tag-card";

  const head = document.createElement("div");
  head.className = "tag-card-head";

  const icon = document.createElement("span");
  icon.className = "tag-icon";
  icon.textContent = meta.icon;

  const label = document.createElement("span");
  label.className = "tag-label";
  label.textContent = tag.label;

  head.append(icon, label);

  const sub = document.createElement("p");
  sub.className = "tag-meta";
  sub.textContent = meta.label;

  const row = document.createElement("div");
  row.className = "btn-row";

  const editBtn = document.createElement("a");
  editBtn.className = "btn btn-secondary";
  editBtn.href = `setup.html?edit=${encodeURIComponent(tag.id)}`;
  editBtn.textContent = "Bearbeiten";

  const rewriteBtn = document.createElement("a");
  rewriteBtn.className = "btn btn-secondary";
  rewriteBtn.href = `setup.html?edit=${encodeURIComponent(tag.id)}&rewrite=1`;
  rewriteBtn.textContent = "Erneut auf Tag schreiben";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "Löschen";
  deleteBtn.addEventListener("click", () => {
    if (confirm(`"${tag.label}" wirklich löschen? Der physische Tag wird dadurch nicht gelöscht.`)) {
      deleteTag(tag.id);
      renderDashboard();
    }
  });

  row.append(editBtn, rewriteBtn, deleteBtn);
  card.append(head, sub, row);
  return card;
}
