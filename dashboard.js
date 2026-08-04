"use strict";

let floatingMenuPanel = null;
let floatingMenuTagId = null;

function initDashboard() {
  renderDashboard();
  document.addEventListener("click", closeAllCardMenus);
  window.addEventListener("scroll", closeAllCardMenus, true);
  window.addEventListener("resize", closeAllCardMenus);
}

function renderDashboard() {
  const tags = getTags().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = document.getElementById("tag-list");
  const empty = document.getElementById("empty-state");
  list.innerHTML = "";
  closeAllCardMenus();

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

  const menuWrap = document.createElement("div");
  menuWrap.className = "card-menu";

  const menuBtn = document.createElement("button");
  menuBtn.className = "card-menu-btn";
  menuBtn.setAttribute("aria-label", "Optionen");
  menuBtn.innerHTML = `<span class="icon">${ICONS.kebab}</span>`;
  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const wasOpenForThisTag = !getFloatingMenuPanel().hidden && floatingMenuTagId === tag.id;
    closeAllCardMenus();
    if (!wasOpenForThisTag) {
      openCardMenu(tag, menuBtn);
    }
  });

  menuWrap.append(menuBtn);
  head.append(icon, titleBlock, menuWrap);
  card.append(head);
  return card;
}

/* Das Aktionsmenü wird NICHT als Kind der Sticker-Karte gerendert - die hat
   overflow:hidden wegen der abgerundeten Ecken/Lochung und würde das Menü
   abschneiden. Stattdessen ein einzelnes, freischwebendes Panel direkt an
   document.body gehängt und per Klick-Koordinaten positioniert. */
function getFloatingMenuPanel() {
  if (!floatingMenuPanel) {
    floatingMenuPanel = document.createElement("div");
    floatingMenuPanel.className = "card-menu-panel";
    floatingMenuPanel.hidden = true;
    document.body.appendChild(floatingMenuPanel);
  }
  return floatingMenuPanel;
}

function openCardMenu(tag, anchorBtn) {
  const panel = getFloatingMenuPanel();
  panel.innerHTML = "";
  floatingMenuTagId = tag.id;

  const editBtn = document.createElement("a");
  editBtn.className = "btn";
  editBtn.href = `setup.html?edit=${encodeURIComponent(tag.id)}`;
  editBtn.textContent = "Bearbeiten";

  const rewriteBtn = document.createElement("a");
  rewriteBtn.className = "btn";
  rewriteBtn.href = `setup.html?edit=${encodeURIComponent(tag.id)}&rewrite=1`;
  rewriteBtn.textContent = "Erneut auf Tag schreiben";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn";
  removeBtn.textContent = "Aus der Liste entfernen";
  removeBtn.addEventListener("click", () => {
    if (
      confirm(
        `"${tag.label}" nur aus dieser Liste entfernen? Der physische Tag bleibt unverändert und löst beim Scannen weiterhin die bisherige Aktion aus.`
      )
    ) {
      deleteTag(tag.id);
      renderDashboard();
    }
  });

  const eraseBtn = document.createElement("button");
  eraseBtn.className = "btn danger";
  eraseBtn.textContent = "Tag physisch leeren";
  eraseBtn.addEventListener("click", () => {
    closeAllCardMenus();
    openEraseModal(tag);
  });

  panel.append(editBtn, rewriteBtn, removeBtn, eraseBtn);

  const rect = anchorBtn.getBoundingClientRect();
  panel.style.top = `${rect.bottom + 6}px`;
  panel.style.right = `${window.innerWidth - rect.right}px`;
  panel.style.left = "auto";
  panel.hidden = false;
}

function closeAllCardMenus() {
  if (floatingMenuPanel) {
    floatingMenuPanel.hidden = true;
  }
  floatingMenuTagId = null;
}
