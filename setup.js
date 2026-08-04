"use strict";

let currentEditTag = null;
let readonlyMode = false;

function initSetup() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  readonlyMode = params.get("rewrite") === "1";

  if (editId) {
    currentEditTag = getTag(editId);
    if (!currentEditTag) {
      window.location.href = "index.html";
      return;
    }
    document.getElementById("page-title").textContent = readonlyMode
      ? "Erneut auf Tag schreiben"
      : "Tag bearbeiten";
    fillForm(currentEditTag);
    if (readonlyMode) {
      lockFormFields();
    }
  }

  setupTypeToggle();

  if (!isWebNfcSupported()) {
    document.getElementById("nfc-unsupported-banner").hidden = false;
    document.getElementById("submit-btn").disabled = true;
  }

  document.getElementById("tag-form").addEventListener("submit", handleSubmit);

  const notifyCheckbox = document.getElementById("field-notify");
  notifyCheckbox.addEventListener("change", () => {
    document.getElementById("notify-hint").hidden = !notifyCheckbox.checked;
  });
}

function setupTypeToggle() {
  const radios = document.querySelectorAll('input[name="tagType"]');
  radios.forEach((radio) => {
    radio.addEventListener("change", updateTypeFields);
  });
  updateTypeFields();
}

function updateTypeFields() {
  const selected = document.querySelector('input[name="tagType"]:checked');
  const type = selected ? selected.value : null;

  const timerFields = document.getElementById("timer-fields");
  const contactFields = document.getElementById("contact-fields");

  timerFields.hidden = type !== "timer";
  contactFields.hidden = type !== "contact";

  document.getElementById("field-minutes").required = type === "timer";
  document.getElementById("field-timer-label").required = type === "timer";
  document.getElementById("field-name").required = type === "contact";
  document.getElementById("field-tel").required = type === "contact";
}

function fillForm(tag) {
  const radio = document.querySelector(`input[name="tagType"][value="${tag.type}"]`);
  if (radio) {
    radio.checked = true;
  }
  if (tag.type === "timer") {
    document.getElementById("field-minutes").value = tag.minutes;
    document.getElementById("field-timer-label").value = tag.label;
  } else if (tag.type === "contact") {
    document.getElementById("field-name").value = tag.name;
    document.getElementById("field-tel").value = tag.tel;
    document.getElementById("field-msg").value = tag.msg || "";
    document.getElementById("field-notify").checked = !!tag.notify;
    document.getElementById("notify-hint").hidden = !tag.notify;
  }
  updateTypeFields();
}

function lockFormFields() {
  document.querySelectorAll("#tag-form input, #tag-form textarea").forEach((el) => {
    el.disabled = true;
  });
  document.getElementById("submit-btn").textContent = "Auf NFC-Tag schreiben";
}

function collectFormData() {
  const type = document.querySelector('input[name="tagType"]:checked').value;

  if (type === "timer") {
    return {
      id: currentEditTag ? currentEditTag.id : randomId("timer"),
      type: "timer",
      minutes: Number(document.getElementById("field-minutes").value),
      label: document.getElementById("field-timer-label").value.trim(),
      createdAt: currentEditTag ? currentEditTag.createdAt : new Date().toISOString(),
    };
  }

  const notify = document.getElementById("field-notify").checked;
  return {
    id: currentEditTag ? currentEditTag.id : randomId("contact"),
    type: "contact",
    name: document.getElementById("field-name").value.trim(),
    label: document.getElementById("field-name").value.trim(),
    tel: document.getElementById("field-tel").value.trim(),
    msg: document.getElementById("field-msg").value.trim(),
    notify,
    topic: notify
      ? currentEditTag && currentEditTag.topic
        ? currentEditTag.topic
        : randomId("nfc")
      : null,
    createdAt: currentEditTag ? currentEditTag.createdAt : new Date().toISOString(),
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  const telField = document.getElementById("field-tel");
  if (telField.required && !isValidPhone(telField.value)) {
    telField.setCustomValidity("Bitte eine gültige Telefonnummer eingeben (z.B. +49 151 23456789).");
    telField.reportValidity();
    return;
  }
  telField.setCustomValidity("");

  const config = readonlyMode ? currentEditTag : collectFormData();
  const url = buildTagUrl(config);
  const statusEl = document.getElementById("write-status");
  const submitBtn = document.getElementById("submit-btn");

  submitBtn.disabled = true;
  statusEl.textContent = "Bitte Tag jetzt ans Handy halten…";
  statusEl.className = "";

  try {
    await writeNfcTag(url);
    if (!readonlyMode) {
      saveTag(config);
    }
    statusEl.textContent = "✅ Tag erfolgreich beschrieben!";
    statusEl.className = "banner banner-success";
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
  } catch (err) {
    statusEl.textContent = `❌ Schreiben fehlgeschlagen: ${err.message || err}. Bitte erneut versuchen.`;
    statusEl.className = "banner banner-error";
  } finally {
    submitBtn.disabled = false;
  }
}

function isValidPhone(value) {
  return /^\+?[0-9\s\-/]{6,20}$/.test(value.trim());
}
