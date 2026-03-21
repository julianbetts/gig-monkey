const storageKey = "gig-monkey-state";
const songInputName = "song";

const defaultStageItems = [];

const defaultState = {
  setlists: [
    {
      id: crypto.randomUUID(),
      name: "Warehouse Warm-Up",
      date: "2026-03-26",
      songs: ["Night Bus", "Static Hearts", "Alibi", "Last Exit"],
    },
  ],
  gigNotes: [
    {
      id: crypto.randomUUID(),
      title: "The Blue Room",
      details: "Park in the alley after 5 PM. Soundcheck is at 6:15. Bring the DI box.",
    },
  ],
  practices: [],
  stageItems: defaultStageItems,
  defaultSetlistId: null,
};

const state = loadState();
let dragState = null;
let selectedSetlistId = state.defaultSetlistId ?? state.setlists[0]?.id ?? null;
let selectedStageItemId = null;
let selectedCalendarEventId = null;

if (!state.defaultSetlistId && selectedSetlistId) {
  state.defaultSetlistId = selectedSetlistId;
  persist();
}

const page = document.body.dataset.page || "dashboard";

const dashboardDefaultSetlistRoot = document.querySelector("#dashboard-default-setlist");
const dashboardPrintSetlistButton = document.querySelector("#dashboard-print-setlist");
const setlistForm = document.querySelector("#setlist-form");
const songFields = document.querySelector("#song-fields");
const addSongButton = document.querySelector("#add-song");
const cancelEditButton = document.querySelector("#cancel-edit");
const saveSetlistButton = document.querySelector("#save-setlist");
const selectedSetlistRoot = document.querySelector("#selected-setlist");
const printSetlistButton = document.querySelector("#print-setlist");
const deleteSetlistButton = document.querySelector("#delete-setlist");
const setDefaultButton = document.querySelector("#set-default-setlist");
const setlistsRoot = document.querySelector("#setlists");
const gigNoteForm = document.querySelector("#gig-note-form");
const practiceForm = document.querySelector("#practice-form");
const practiceTypeSelect = document.querySelector('#practice-form select[name="type"]');
const practiceOtherLabel = document.querySelector("#practice-other-label");
const practiceOtherInput = document.querySelector('#practice-form input[name="otherLabel"]');
const stageItemForm = document.querySelector("#stage-item-form");
const stageTypeSelect = document.querySelector('#stage-item-form select[name="type"]');
const stageRoleGroup = document.querySelector("#stage-role-group");
const stageRoleInput = document.querySelector('#stage-item-form input[name="role"]');
const stageNameLabel = document.querySelector("#stage-name-label");
const stageNameInput = document.querySelector('#stage-item-form input[name="name"]');
const resetStageButton = document.querySelector("#reset-stage");
const clearStageItemButton = document.querySelector("#clear-stage-item");
const gigNotesRoot = document.querySelector("#gig-notes");
const practicesRoot = document.querySelector("#practice-sessions");
const calendarMonthsRoot = document.querySelector("#calendar-months");
const calendarEventDetailRoot = document.querySelector("#calendar-event-detail");
const stageCanvas = document.querySelector("#stage-canvas");
const emptyStateTemplate = document.querySelector("#empty-state-template");

bindSharedEvents();
bindCalendarEvents();

if (page === "dashboard") {
  if (dashboardPrintSetlistButton) {
    dashboardPrintSetlistButton.addEventListener("click", () => {
      const setlist = getDefaultSetlist();
      if (setlist) {
        printSetlist(setlist);
      }
    });
  }

  renderDashboard();
}

if (page === "setlists") {
  bindSetlistManagerEvents();
  renderSetlistsPage();
}

function bindSharedEvents() {
  if (gigNoteForm) {
    gigNoteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(gigNoteForm);

      state.gigNotes.unshift({
        id: crypto.randomUUID(),
        title: formData.get("title").trim(),
        details: formData.get("details").trim(),
      });

      gigNoteForm.reset();
      persist();
      renderGigNotes();
    });
  }

if (practiceForm) {
  syncPracticeFormFields();

  if (practiceTypeSelect) {
    practiceTypeSelect.addEventListener("change", () => {
      syncPracticeFormFields();
    });
  }

  practiceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(practiceForm);
    const type = normalizeEventType(formData.get("type"));
    const customLabel = type === "other" ? formData.get("otherLabel").trim() : "";

    state.practices.unshift({
      id: crypto.randomUUID(),
      date: formData.get("date"),
      time: formData.get("time"),
      type,
      customLabel,
    });

    practiceForm.reset();
    practiceForm.elements.type.value = "rehearsal";
    syncPracticeFormFields();
    persist();
    renderPractices();
    renderCalendar();
  });
}

  if (stageItemForm) {
    updateStageFormFields();

    if (stageTypeSelect) {
      stageTypeSelect.addEventListener("change", () => {
        updateStageFormFields();
      });
    }

    stageItemForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(stageItemForm);
      const type = formData.get("type");

      const id = crypto.randomUUID();

      state.stageItems.push({
        id,
        name: formData.get("name").trim(),
        role: type === "member" ? formData.get("role").trim() : "",
        type,
        x: 50,
        y: 50,
      });

      selectedStageItemId = id;
      stageItemForm.reset();
      updateStageFormFields();
      persist();
      renderStage();
    });
  }

  if (clearStageItemButton) {
    clearStageItemButton.addEventListener("click", () => {
      if (!selectedStageItemId) {
        return;
      }

      state.stageItems = state.stageItems.filter((item) => item.id !== selectedStageItemId);
      selectedStageItemId = null;
      persist();
      renderStage();
    });
  }

  if (resetStageButton) {
    resetStageButton.addEventListener("click", () => {
      state.stageItems = structuredClone(defaultStageItems);
      selectedStageItemId = null;
      persist();
      renderStage();
    });
  }

  if (stageCanvas) {
    stageCanvas.addEventListener("pointerdown", (event) => {
      const item = event.target.closest(".stage-item");
      if (!item) {
        selectedStageItemId = null;
        renderStage();
        return;
      }

      selectedStageItemId = item.dataset.id;

      const canvasRect = stageCanvas.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      dragState = {
        id: item.dataset.id,
        offsetX: event.clientX - itemRect.left,
        offsetY: event.clientY - itemRect.top,
        canvasRect,
        pointerId: event.pointerId,
      };

      stageCanvas.setPointerCapture(event.pointerId);
    });

    stageCanvas.addEventListener("pointermove", (event) => {
      if (!dragState) {
        return;
      }

      const item = state.stageItems.find((entry) => entry.id === dragState.id);
      if (!item) {
        return;
      }

      const width = dragState.canvasRect.width;
      const height = dragState.canvasRect.height;
      const x = ((event.clientX - dragState.canvasRect.left - dragState.offsetX) / width) * 100;
      const y = ((event.clientY - dragState.canvasRect.top - dragState.offsetY) / height) * 100;

      item.x = clamp(x, 0, 86);
      item.y = clamp(y, 0, 82);
      renderStage();
    });

    stageCanvas.addEventListener("pointerup", () => {
      if (!dragState) {
        return;
      }

      if (stageCanvas.hasPointerCapture(dragState.pointerId)) {
        stageCanvas.releasePointerCapture(dragState.pointerId);
      }

      dragState = null;
      persist();
    });

    stageCanvas.addEventListener("pointercancel", () => {
      if (dragState && stageCanvas.hasPointerCapture(dragState.pointerId)) {
        stageCanvas.releasePointerCapture(dragState.pointerId);
      }

      dragState = null;
    });
  }
}

function bindSetlistManagerEvents() {
  addSongButton.addEventListener("click", () => {
    const nextInput = appendSongField();
    nextInput.focus();
  });

  cancelEditButton.addEventListener("click", () => {
    clearSetlistEditor();
  });

  printSetlistButton.addEventListener("click", () => {
    const setlist = getSelectedSetlist();
    if (setlist) {
      printSetlist(setlist);
    }
  });

  deleteSetlistButton.addEventListener("click", () => {
    const setlist = getSelectedSetlist();
    if (!setlist) {
      return;
    }

    state.setlists = state.setlists.filter((entry) => entry.id !== setlist.id);

    if (state.defaultSetlistId === setlist.id) {
      state.defaultSetlistId = state.setlists[0]?.id ?? null;
    }

    selectedSetlistId = state.defaultSetlistId ?? state.setlists[0]?.id ?? null;
    clearSetlistEditor();
    persist();
    renderSetlists();
    renderSelectedSetlist();
  });

  setDefaultButton.addEventListener("click", () => {
    const setlist = getSelectedSetlist();
    if (!setlist) {
      return;
    }

    state.defaultSetlistId = setlist.id;
    persist();
    renderSetlists();
    renderSelectedSetlist();
  });

  setlistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(setlistForm);
    const songs = formData
      .getAll(songInputName)
      .map((song) => song.trim())
      .filter(Boolean);

    if (songs.length === 0) {
      const firstSongInput = songFields.querySelector("input");
      if (firstSongInput) {
        firstSongInput.focus();
        firstSongInput.reportValidity();
      }
      return;
    }

    const existingId = formData.get("setlistId");
    const payload = {
      id: existingId || crypto.randomUUID(),
      name: formData.get("name").trim(),
      date: formData.get("date"),
      songs,
    };

    if (existingId) {
      state.setlists = state.setlists.map((entry) =>
        entry.id === existingId ? payload : entry
      );
    } else {
      state.setlists.unshift(payload);
    }

    if (!state.defaultSetlistId) {
      state.defaultSetlistId = payload.id;
    }

    selectedSetlistId = payload.id;
    clearSetlistEditor();
    persist();
    renderSetlists();
    renderSelectedSetlist();
  });
}

function renderDashboard() {
  renderDashboardDefaultSetlist();
  renderGigNotes();
  renderPractices();
  renderCalendar();
  renderCalendarEventDetail();
  renderStage();
}

function renderSetlistsPage() {
  resetSongFields();
  renderSetlists();
  renderSelectedSetlist();
}

function renderDashboardDefaultSetlist() {
  if (!dashboardDefaultSetlistRoot) {
    return;
  }

  const setlist = getDefaultSetlist();
  dashboardDefaultSetlistRoot.innerHTML = "";

  if (!setlist) {
    dashboardDefaultSetlistRoot.className = "selected-card empty-state";
    dashboardDefaultSetlistRoot.innerHTML = "<p>No default setlist yet. Create one on the setlists page.</p>";
    if (dashboardPrintSetlistButton) {
      dashboardPrintSetlistButton.disabled = true;
    }
    return;
  }

  dashboardDefaultSetlistRoot.className = "selected-card item-card dashboard-card";
  dashboardDefaultSetlistRoot.innerHTML = `
    <p class="meta">Default Setlist${setlist.date ? ` · ${formatDate(setlist.date)}` : ""}</p>
    <h3>${escapeHtml(setlist.name)}</h3>
    <ol class="song-list">
      ${setlist.songs.map((song) => `<li>${escapeHtml(song)}</li>`).join("")}
    </ol>
  `;

  if (dashboardPrintSetlistButton) {
    dashboardPrintSetlistButton.disabled = false;
  }
}

function renderSetlists() {
  if (!setlistsRoot) {
    return;
  }

  setlistsRoot.innerHTML = "";

  if (state.setlists.length === 0) {
    setlistsRoot.append(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  state.setlists.forEach((setlist) => {
    const article = document.createElement("article");
    const isSelected = setlist.id === selectedSetlistId;
    const isDefault = setlist.id === state.defaultSetlistId;

    article.className = `item-card${isSelected ? " is-selected" : ""}`;
    article.innerHTML = `
      <p class="meta">
        ${isDefault ? "Default Setlist" : "Setlist"}${setlist.date ? ` · ${formatDate(setlist.date)}` : ""}
      </p>
      <h3>${escapeHtml(setlist.name)}</h3>
      <ol class="song-list">
        ${setlist.songs.map((song) => `<li>${escapeHtml(song)}</li>`).join("")}
      </ol>
    `;
    article.addEventListener("click", () => {
      selectSetlist(setlist.id);
    });
    setlistsRoot.append(article);
  });
}

function renderSelectedSetlist() {
  if (!selectedSetlistRoot) {
    return;
  }

  const setlist = getSelectedSetlist();
  const hasSetlist = Boolean(setlist);

  printSetlistButton.disabled = !hasSetlist;
  deleteSetlistButton.disabled = !hasSetlist;
  setDefaultButton.disabled = !hasSetlist || setlist.id === state.defaultSetlistId;

  if (!setlist) {
    selectedSetlistRoot.className = "selected-card empty-state";
    selectedSetlistRoot.innerHTML = "<p>Select a setlist to edit, print, delete, or make it the default.</p>";
    return;
  }

  selectedSetlistRoot.className = "selected-card item-card";
  selectedSetlistRoot.innerHTML = `
    ${setlist.date ? `<p class="meta">${formatDate(setlist.date)}</p>` : ""}
    <h3>${escapeHtml(setlist.name)}</h3>
    <ol class="song-list">
      ${setlist.songs.map((song) => `<li>${escapeHtml(song)}</li>`).join("")}
    </ol>
  `;
}

function renderGigNotes() {
  if (!gigNotesRoot) {
    return;
  }

  gigNotesRoot.innerHTML = "";

  if (state.gigNotes.length === 0) {
    gigNotesRoot.append(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  state.gigNotes.forEach((note) => {
    const article = document.createElement("article");
    article.className = "item-row";
    article.innerHTML = `
      <h3>${escapeHtml(note.title)}</h3>
      <p class="detail-copy">${escapeHtml(note.details)}</p>
    `;
    gigNotesRoot.append(article);
  });
}

function renderPractices() {
  if (!practicesRoot) {
    return;
  }

  practicesRoot.innerHTML = "";

  if (state.practices.length === 0) {
    practicesRoot.append(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  state.practices
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .forEach((session) => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <p class="meta">${formatDate(session.date)} at ${formatTime(session.time)}</p>
        <h3>${escapeHtml(getEventLabel(session))}</h3>
      `;
      practicesRoot.append(row);
    });
}

function renderCalendar() {
  if (!calendarMonthsRoot) {
    return;
  }

  calendarMonthsRoot.innerHTML = "";

  const practiceMonths = groupPracticesByMonth();
  const allSessions = practiceMonths.flatMap(({ sessions }) => sessions);

  if (selectedCalendarEventId && !allSessions.some((session) => session.id === selectedCalendarEventId)) {
    selectedCalendarEventId = null;
  }

  if (!selectedCalendarEventId && allSessions.length > 0) {
    selectedCalendarEventId = allSessions[0].id;
  }

  if (practiceMonths.length === 0) {
    const emptyState = document.createElement("article");
    emptyState.className = "empty-state";
    emptyState.innerHTML = "<p>No practice dates yet. Add a session above and it will appear here.</p>";
    calendarMonthsRoot.append(emptyState);
    return;
  }

  practiceMonths.forEach(({ key, sessions }) => {
    const [year, month] = key.split("-").map(Number);
    const card = document.createElement("article");
    card.className = "calendar-card";

    const heading = document.createElement("h3");
    heading.textContent = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    card.append(heading);

    const weekdayRow = document.createElement("div");
    weekdayRow.className = "calendar-weekdays";
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      const label = document.createElement("span");
      label.textContent = day;
      weekdayRow.append(label);
    });
    card.append(weekdayRow);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const sessionsByDay = sessions.reduce((map, session) => {
      const day = new Date(`${session.date}T12:00:00`).getDate();
      if (!map.has(day)) {
        map.set(day, []);
      }
      map.get(day).push(session);
      return map;
    }, new Map());

    for (let index = 0; index < firstDay; index += 1) {
      const filler = document.createElement("div");
      filler.className = "calendar-filler";
      grid.append(filler);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayCell = document.createElement("div");
      const daySessions = (sessionsByDay.get(day) || []).sort((a, b) =>
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
      );
      const typeClass = daySessions.length > 0
        ? ` has-events has-${normalizeEventType(daySessions[0].type)}`
        : "";

      dayCell.className = `calendar-day${typeClass}`;

      const dayNumber = document.createElement("div");
      dayNumber.className = "calendar-day-number";
      dayNumber.textContent = String(day);
      dayCell.append(dayNumber);

      if (daySessions.length > 0) {
        const events = document.createElement("div");
        events.className = "calendar-events";

        daySessions.forEach((session) => {
          const type = normalizeEventType(session.type);
          const eventCard = document.createElement("button");
          eventCard.type = "button";
          eventCard.className = `calendar-event is-${type}${session.id === selectedCalendarEventId ? " is-selected" : ""}`;
          eventCard.dataset.eventId = session.id;
          eventCard.setAttribute("aria-label", `${getEventLabel(session)} on ${formatDate(session.date)} at ${formatTime(session.time)}`);
          eventCard.innerHTML = `
            <span class="calendar-event-time">${escapeHtml(formatTime(session.time))}</span>
            <span class="calendar-event-focus">${escapeHtml(getEventLabel(session))}</span>
          `;
          events.append(eventCard);
        });

        dayCell.append(events);
      }

      grid.append(dayCell);
    }

    card.append(grid);
    calendarMonthsRoot.append(card);
  });
}

function renderCalendarEventDetail() {
  if (!calendarEventDetailRoot) {
    return;
  }

  const session = state.practices.find((entry) => entry.id === selectedCalendarEventId) ?? null;

  if (!session) {
    calendarEventDetailRoot.className = "calendar-detail empty-state";
    calendarEventDetailRoot.innerHTML = "<p>Tap an event to view its details.</p>";
    return;
  }

  calendarEventDetailRoot.className = "calendar-detail item-row";
  calendarEventDetailRoot.innerHTML = `
    <p class="meta">${formatDate(session.date)} at ${formatTime(session.time)}</p>
    <h3>${escapeHtml(getEventLabel(session))}</h3>
    <p class="detail-copy">${escapeHtml(formatEventType(normalizeEventType(session.type)))}</p>
  `;
}

function groupPracticesByMonth() {
  const sessions = state.practices
    .slice()
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const months = new Map();

  sessions.forEach((session) => {
    const date = new Date(`${session.date}T12:00:00`);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!months.has(key)) {
      months.set(key, []);
    }

    months.get(key).push(session);
  });

  return Array.from(months.entries()).map(([key, monthSessions]) => ({
    key,
    sessions: monthSessions,
  }));
}

function bindCalendarEvents() {
  if (!calendarMonthsRoot) {
    return;
  }

  calendarMonthsRoot.addEventListener("click", (event) => {
    const eventCard = event.target.closest(".calendar-event");
    if (!eventCard) {
      return;
    }

    selectedCalendarEventId = eventCard.dataset.eventId;
    renderCalendar();
    renderCalendarEventDetail();
  });
}

function renderStage() {
  if (!stageCanvas) {
    return;
  }

  if (selectedStageItemId && !state.stageItems.some((item) => item.id === selectedStageItemId)) {
    selectedStageItemId = null;
  }

  if (clearStageItemButton) {
    clearStageItemButton.disabled = !selectedStageItemId;
  }

  stageCanvas.innerHTML = "";

  state.stageItems.forEach((item) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `stage-item${item.id === selectedStageItemId ? " is-selected" : ""}`;
    element.dataset.id = item.id;
    element.dataset.type = item.type;
    element.style.left = `${item.x}%`;
    element.style.top = `${item.y}%`;
    element.innerHTML = `
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.type === "member" ? item.role || "Band Member" : "Gear")}</span>
    `;
    stageCanvas.append(element);
  });
}

function updateStageFormFields() {
  if (!stageTypeSelect || !stageRoleGroup || !stageRoleInput || !stageNameLabel || !stageNameInput) {
    return;
  }

  const isMember = stageTypeSelect.value === "member";
  stageNameLabel.firstChild.textContent = isMember ? "Member name" : "Item name";
  stageNameInput.placeholder = isMember ? "" : "Bass Rig";
  stageRoleGroup.classList.toggle("hidden", !isMember);
  stageRoleInput.required = isMember;

  if (!isMember) {
    stageRoleInput.value = "";
  }
}

function resetSongFields() {
  if (!songFields) {
    return;
  }

  songFields.innerHTML = "";
  appendSongField();
}

function appendSongField() {
  const input = document.createElement("input");
  input.type = "text";
  input.name = songInputName;
  input.placeholder = "Song title";
  input.autocomplete = "off";

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!input.value.trim()) {
      return;
    }

    const nextInput = appendSongField();
    nextInput.focus();
  });

  input.addEventListener("input", () => {
    syncSongFieldRequirements();
  });

  songFields.append(input);
  syncSongFieldRequirements();
  return input;
}

function syncSongFieldRequirements() {
  if (!songFields) {
    return;
  }

  const inputs = songFields.querySelectorAll("input");
  const hasValue = Array.from(inputs).some((input) => input.value.trim());

  inputs.forEach((input, index) => {
    input.required = !hasValue && index === 0;
  });
}

function clearSetlistEditor() {
  if (!setlistForm) {
    return;
  }

  setlistForm.reset();
  setlistForm.elements.setlistId.value = "";
  saveSetlistButton.textContent = "Save setlist";
  cancelEditButton.classList.add("hidden");
  resetSongFields();
}

function selectSetlist(id) {
  const setlist = state.setlists.find((entry) => entry.id === id);
  if (!setlist || !setlistForm) {
    return;
  }

  selectedSetlistId = id;
  setlistForm.elements.setlistId.value = setlist.id;
  setlistForm.elements.name.value = setlist.name;
  setlistForm.elements.date.value = setlist.date || "";
  saveSetlistButton.textContent = "Update setlist";
  cancelEditButton.classList.remove("hidden");

  songFields.innerHTML = "";
  setlist.songs.forEach((song) => {
    const input = appendSongField();
    input.value = song;
  });
  appendSongField();
  syncSongFieldRequirements();

  renderSetlists();
  renderSelectedSetlist();
}

function getSelectedSetlist() {
  return state.setlists.find((entry) => entry.id === selectedSetlistId) ?? null;
}

function getDefaultSetlist() {
  return state.setlists.find((entry) => entry.id === state.defaultSetlistId) ?? null;
}

function printSetlist(setlist) {
  const printWindow = window.open("", "_blank", "width=720,height=900");
  if (!printWindow) {
    return;
  }

  const title = escapeHtml(setlist.name);
  const dateMarkup = setlist.date
    ? `<p>${escapeHtml(formatDate(setlist.date))}</p>`
    : "";
  const songsMarkup = setlist.songs
    .map((song) => `<li>${escapeHtml(song)}</li>`)
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 32px 24px 40px;
            color: #111;
            text-align: center;
          }
          h1 {
            margin: 0 0 12px;
            font-size: 38px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          p {
            margin: 0 0 20px;
            color: #444;
            font-size: 20px;
            font-weight: 700;
          }
          ol {
            margin: 0 auto;
            padding-left: 0;
            list-style-position: inside;
            line-height: 1.9;
            font-size: 28px;
            font-weight: 800;
            max-width: 720px;
          }
          li {
            margin-bottom: 6px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${dateMarkup}
        <ol>${songsMarkup}</ol>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function loadState() {
  const saved = localStorage.getItem(storageKey);

  if (!saved) {
    const nextState = structuredClone(defaultState);
    nextState.defaultSetlistId = nextState.setlists[0]?.id ?? null;
    return nextState;
  }

  try {
    const parsed = JSON.parse(saved);
    const nextState = {
      ...structuredClone(defaultState),
      ...parsed,
    };
    const isLegacyPractice = (session) =>
      session?.date === "2026-03-22" &&
      session?.time === "19:00" &&
      session?.focus === "Tighten endings and transitions between songs 3 to 5.";

    if (!Array.isArray(nextState.setlists)) {
      nextState.setlists = structuredClone(defaultState.setlists);
    }

    if (!Array.isArray(nextState.gigNotes)) {
      nextState.gigNotes = structuredClone(defaultState.gigNotes);
    }

    if (!Array.isArray(nextState.practices)) {
      nextState.practices = structuredClone(defaultState.practices);
    }

nextState.practices = nextState.practices
  .filter((session) => !isLegacyPractice(session))
  .map((session) => ({
    ...session,
    type: normalizeEventType(session.type),
    customLabel: typeof session.customLabel === "string" ? session.customLabel.trim() : "",
  }));

    if (!Array.isArray(nextState.stageItems) || nextState.stageItems.length === 0) {
      nextState.stageItems = structuredClone(defaultStageItems);
    }

    nextState.stageItems = nextState.stageItems.map((item) => ({
      ...item,
      role: item.type === "member" ? item.role || item.name : "",
    }));

    if (!nextState.defaultSetlistId || !nextState.setlists.some((entry) => entry.id === nextState.defaultSetlistId)) {
      nextState.defaultSetlistId = nextState.setlists[0]?.id ?? null;
    }

    return nextState;
  } catch (error) {
    console.error("Unable to parse saved state", error);
    const nextState = structuredClone(defaultState);
    nextState.defaultSetlistId = nextState.setlists[0]?.id ?? null;
    return nextState;
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function formatDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(hours, minutes);

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function syncPracticeFormFields() {
  if (!practiceTypeSelect || !practiceOtherLabel || !practiceOtherInput) {
    return;
  }

  const isOther = normalizeEventType(practiceTypeSelect.value) === "other";
  practiceOtherLabel.classList.toggle("hidden", !isOther);
  practiceOtherInput.required = isOther;

  if (!isOther) {
    practiceOtherInput.value = "";
  }
}

function normalizeEventType(type) {
  const value = typeof type === "string" ? type.toLowerCase() : "";

  if (["rehearsal", "gig", "recording", "other"].includes(value)) {
    return value;
  }

  return "other";
}

function formatEventType(type) {
  const normalizedType = normalizeEventType(type);
  return normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
}

function getEventLabel(session) {
  const type = normalizeEventType(session.type);

  if (type === "other" && typeof session.customLabel === "string" && session.customLabel.trim()) {
    return session.customLabel.trim();
  }

  return formatEventType(type);
}

function clamp
(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
