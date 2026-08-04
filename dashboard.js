"use strict";

const TYPE_META = {
  timer: { icon: "clock", label: "Timer" },
  contact: { icon: "contact", label: "Kontakt" },
};

function initDashboard() {
  renderDashboard();
  document.addEventListener("click", closeAllCardMenus);
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

function tagMetaText(tag) {
  if (tag.type === "timer") {
    return `Timer · ${tag.minutes} min`;
  }
  return `Kontakt · ${tag.notify ? "Push aktiv" : "Kein Push"}`;
}

function renderTagCard(tag) {
  const meta = TYPE_META[tag.type] || { icon: "contact", label: tag.type };

  const card = document.createElement("div");
  card.className = `sticker-card type-${tag.type}`;

  const head = document.createElement("div");
  head.className = "tag-card-head";

  const icon = document.createElement("span");
  icon.className = "tag-icon";
  icon.innerHTML = ICONS[meta.icon] || "";

  const titleBlock = document.createElement("div");
  titleBlock.className = "tag-title-block";

  const label = document.createElement("span");
  label.className = "tag-label";
  label.textContent = tag.label;

  const sub = document.createElement("span");
  sub.className = "tag-meta";
  sub.textContent = tagMetaText(tag);

  titleBlock.append(label, sub);

  const menu = renderCardMenu(tag);

  head.append(icon, titleBlock, menu);
  card.append(head);
  return card;
}

function renderCardMenu(tag) {
  const wrap = document.createElement("div");
  wrap.className = "card-menu";

  const btn = document.createElement("button");
  btn.className = "card-menu-btn";
  btn.setAttribute("aria-label", "Optionen");
  btn.innerHTML = `<span class="icon">${ICONS.kebab}</span>`;

  const panel = document.createElement("div");
  panel.className = "card-menu-panel";
  panel.hidden = true;

  const editBtn = document.createElement("a");
  editBtn.className = "btn";
  editBtn.href = `setup.html?edit=${encodeURIComponent(tag.id)}`;
  editBtn.textContent = "Bearbeiten";

  const rewriteBtn = document.createElement("a");
  rewriteBtn.className = "btn";
  rewriteBtn.href = `setup.html?edit=${encodeURIComponent(tag.id)}&rewrite=1`;
  rewriteBtn.textContent = "Erneut auf Tag schreiben";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn danger";
  deleteBtn.textContent = "Löschen";
  deleteBtn.addEventListener("click", () => {
    if (confirm(`"${tag.label}" wirklich löschen? Der physische Tag wird dadurch nicht gelöscht.`)) {
      deleteTag(tag.id);
      renderDashboard();
    }
  });

  panel.append(editBtn, rewriteBtn, deleteBtn);

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    const wasHidden = panel.hidden;
    closeAllCardMenus();
    panel.hidden = !wasHidden;
  });

  wrap.append(btn, panel);
  return wrap;
}

function closeAllCardMenus() {
  document.querySelectorAll(".card-menu-panel").forEach((panel) => {
    panel.hidden = true;
  });
}
