/**
 * TaskFlow — script.js
 * Full todo app logic: add, edit, delete, complete, priority,
 * search, filter, sort, localStorage, dark/light theme, toast notifications
 */

'use strict';

/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
const state = {
  tasks: [],
  currentFilter: 'all',        // all | completed | pending
  currentPriority: 'all',      // all | high | medium | low
  currentSort: 'newest',       // newest | oldest | priority | name
  searchQuery: '',
  editingTaskId: null,
  theme: 'dark',
};

/* ═══════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════ */
const $ = id => document.getElementById(id);

const dom = {
  taskList:       $('taskList'),
  emptyState:     $('emptyState'),
  addTaskForm:    $('addTaskForm'),
  taskInput:      $('taskInput'),
  prioritySelect: $('prioritySelect'),
  charCounter:    $('charCounter'),
  searchInput:    $('searchInput'),
  searchClear:    $('searchClear'),
  themeToggle:    $('themeToggle'),
  totalCount:     $('totalCount'),
  completedCount: $('completedCount'),
  pendingCount:   $('pendingCount'),
  progressBar:    $('progressBar'),
  progressLabel:  $('progressLabel'),
  filterTabs:     document.querySelectorAll('.filter-tab'),
  priorityPills:  document.querySelectorAll('.priority-pill'),
  sortSelect:     $('sortSelect'),
  clearAllBtn:    $('clearAllBtn'),
  editModal:      $('editModal'),
  editInput:      $('editInput'),
  editPriority:   $('editPriority'),
  editCharCounter:$('editCharCounter'),
  modalClose:     $('modalClose'),
  cancelEdit:     $('cancelEdit'),
  saveEdit:       $('saveEdit'),
  toastContainer: $('toastContainer'),
};

/* ═══════════════════════════════════════
   UTILITIES
═══════════════════════════════════════ */
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ═══════════════════════════════════════
   LOCAL STORAGE
═══════════════════════════════════════ */
function saveTasks() {
  localStorage.setItem('taskflow_tasks', JSON.stringify(state.tasks));
}

function loadTasks() {
  const raw = localStorage.getItem('taskflow_tasks');
  if (raw) {
    const parsed = JSON.parse(raw);
    // Sanitize: remove any malformed tasks that have no text
    state.tasks = parsed.filter(t => t && t.id && typeof t.text === 'string' && t.text.trim() !== '');
  } else {
    state.tasks = [];
  }
}

function saveTheme() {
  localStorage.setItem('taskflow_theme', state.theme);
}

function loadTheme() {
  state.theme = localStorage.getItem('taskflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
}

/* ═══════════════════════════════════════
   TASK CRUD
═══════════════════════════════════════ */
function addTask(text, priority) {
  const task = {
    id:        generateId(),
    text:      text.trim(),
    priority:  priority,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  state.tasks.unshift(task);
  saveTasks();
  renderAll();
  showToast(`Task added successfully! ✅`, 'success');
}

function deleteTask(id) {
  const item = dom.taskList.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.classList.add('removing');
    item.addEventListener('animationend', () => {
      state.tasks = state.tasks.filter(t => t.id !== id);
      saveTasks();
      renderAll();
      showToast('Task deleted.', 'danger');
    }, { once: true });
  }
}

function toggleComplete(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderAll();
  showToast(task.completed ? 'Task marked complete! 🎉' : 'Task marked pending.', task.completed ? 'success' : 'warning');
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingTaskId = id;
  dom.editInput.value      = task.text;
  dom.editPriority.value   = task.priority;
  updateCharCounter(dom.editInput, dom.editCharCounter);
  dom.editModal.hidden = false;
  dom.editInput.focus();
}

function saveEditedTask() {
  const text = dom.editInput.value.trim();
  if (!text) { shakeEl(dom.editInput); return; }
  const task = state.tasks.find(t => t.id === state.editingTaskId);
  if (!task) return;
  task.text     = text;
  task.priority = dom.editPriority.value;
  saveTasks();
  closeEditModal();
  renderAll();
  showToast('Task updated! ✏️', 'success');
}

function closeEditModal() {
  dom.editModal.hidden = true;
  state.editingTaskId  = null;
}

function clearCompleted() {
  const completedCount = state.tasks.filter(t => t.completed).length;
  if (completedCount === 0) { showToast('No completed tasks to clear.', 'warning'); return; }
  state.tasks = state.tasks.filter(t => !t.completed);
  saveTasks();
  renderAll();
  showToast(`${completedCount} completed task(s) removed.`, 'danger');
}

/* ═══════════════════════════════════════
   FILTERING & SORTING
═══════════════════════════════════════ */
function getFilteredAndSortedTasks() {
  let tasks = [...state.tasks];

  // Search
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    tasks = tasks.filter(t => t.text.toLowerCase().includes(q));
  }

  // Status filter
  if (state.currentFilter === 'completed') tasks = tasks.filter(t => t.completed);
  if (state.currentFilter === 'pending')   tasks = tasks.filter(t => !t.completed);

  // Priority filter
  if (state.currentPriority !== 'all') tasks = tasks.filter(t => t.priority === state.currentPriority);

  // Sort
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  switch (state.currentSort) {
    case 'oldest':   tasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
    case 'priority': tasks.sort((a,b) => priorityOrder[a.priority] - priorityOrder[b.priority]); break;
    case 'name':     tasks.sort((a,b) => a.text.localeCompare(b.text)); break;
    default:         tasks.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest
  }

  return tasks;
}

/* ═══════════════════════════════════════
   RENDER
═══════════════════════════════════════ */
function renderAll() {
  updateStats();
  renderTasks();
}

function updateStats() {
  const total     = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);

  dom.totalCount.textContent     = total;
  dom.completedCount.textContent = completed;
  dom.pendingCount.textContent   = pending;
  dom.progressBar.style.width    = `${pct}%`;
  dom.progressBar.setAttribute('aria-valuenow', pct);
  dom.progressLabel.textContent  = `${pct}% complete`;
}

function renderTasks() {
  const tasks = getFilteredAndSortedTasks();

  if (tasks.length === 0) {
    dom.taskList.innerHTML  = '';
    dom.emptyState.hidden   = false;
    return;
  }

  dom.emptyState.hidden = true;
  dom.taskList.innerHTML = tasks.map(buildTaskHTML).join('');
}

function buildTaskHTML(task) {
  const badgeClass = `badge-${task.priority}`;
  const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[task.priority] || '';
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  const completedClass = task.completed ? 'completed' : '';
  const checkedAttr    = task.completed ? 'checked' : '';

  return `
    <li class="task-item ${completedClass}" data-id="${task.id}" data-priority="${task.priority}">
      <input
        type="checkbox"
        class="task-checkbox"
        aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}"
        data-action="toggle"
        data-id="${task.id}"
        ${checkedAttr}
      />
      <div class="task-content">
        <p class="task-text">${escapeHtml(task.text)}</p>
        <div class="task-meta">
          <span class="task-priority-badge ${badgeClass}" aria-label="Priority: ${priorityLabel}">
            ${priorityEmoji} ${priorityLabel}
          </span>
          <span class="task-date">${formatDate(task.createdAt)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn edit-btn" aria-label="Edit task" data-action="edit" data-id="${task.id}" title="Edit">✏️</button>
        <button class="action-btn delete-btn" aria-label="Delete task" data-action="delete" data-id="${task.id}" title="Delete">🗑️</button>
      </div>
    </li>
  `;
}

/* ═══════════════════════════════════════
   CHAR COUNTER
═══════════════════════════════════════ */
function updateCharCounter(input, counterEl) {
  const len = input.value.length;
  const max = parseInt(input.getAttribute('maxlength')) || 150;
  counterEl.textContent = `${len} / ${max}`;
  counterEl.classList.toggle('near-limit', len >= max * 0.8 && len < max);
  counterEl.classList.toggle('at-limit',   len >= max);
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2800);
}

/* ═══════════════════════════════════════
   SHAKE ANIMATION (VALIDATION)
═══════════════════════════════════════ */
function shakeEl(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

// Inject shake keyframes
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-6px); }
  80%      { transform: translateX(6px); }
}`;
document.head.appendChild(shakeStyle);

/* ═══════════════════════════════════════
   THEME
═══════════════════════════════════════ */
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  saveTheme();
}

/* ═══════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════ */

// Add task
dom.addTaskForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = dom.taskInput.value.trim();
  if (!text) { shakeEl(dom.taskInput); showToast('Please enter a task description.', 'warning'); return; }
  addTask(text, dom.prioritySelect.value);
  dom.taskInput.value = '';
  updateCharCounter(dom.taskInput, dom.charCounter);
  dom.taskInput.focus();
});

// Char counter for add input
dom.taskInput.addEventListener('input', () => updateCharCounter(dom.taskInput, dom.charCounter));

// Task list delegation (toggle, edit, delete)
dom.taskList.addEventListener('click', e => {
  const action = e.target.closest('[data-action]');
  if (!action) return;
  const id = action.dataset.id;
  switch (action.dataset.action) {
    case 'toggle': toggleComplete(id); break;
    case 'edit':   openEditModal(id);  break;
    case 'delete': deleteTask(id);     break;
  }
});

// Task list keyboard accessible checkboxes
dom.taskList.addEventListener('change', e => {
  if (e.target.classList.contains('task-checkbox')) {
    toggleComplete(e.target.dataset.id);
  }
});

// Search — use raw value so partial/trailing-space queries work naturally
dom.searchInput.addEventListener('input', () => {
  state.searchQuery = dom.searchInput.value;
  dom.searchClear.hidden = state.searchQuery.trim() === '';
  renderTasks();
});

dom.searchClear.addEventListener('click', () => {
  dom.searchInput.value = '';
  state.searchQuery = '';
  dom.searchClear.hidden = true;
  renderTasks();
  dom.searchInput.focus();
});

// Filter tabs
dom.filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.filterTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    state.currentFilter = tab.dataset.filter;
    renderTasks();
  });
});

// Priority pills
dom.priorityPills.forEach(pill => {
  pill.addEventListener('click', () => {
    dom.priorityPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.currentPriority = pill.dataset.priority;
    renderTasks();
  });
});

// Sort
dom.sortSelect.addEventListener('change', () => {
  state.currentSort = dom.sortSelect.value;
  renderTasks();
});

// Clear completed
dom.clearAllBtn.addEventListener('click', clearCompleted);

// Theme toggle
dom.themeToggle.addEventListener('click', toggleTheme);

// Edit modal — char counter
dom.editInput.addEventListener('input', () => updateCharCounter(dom.editInput, dom.editCharCounter));

// Edit modal — save
dom.saveEdit.addEventListener('click', saveEditedTask);

// Edit modal — keyboard submit
dom.editInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEditedTask();
});

// Edit modal — close
dom.modalClose.addEventListener('click', closeEditModal);
dom.cancelEdit.addEventListener('click', closeEditModal);

// Close modal on overlay click
dom.editModal.addEventListener('click', e => {
  if (e.target === dom.editModal) closeEditModal();
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !dom.editModal.hidden) closeEditModal();
});

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
function init() {
  loadTheme();
  loadTasks();
  renderAll();
  updateCharCounter(dom.taskInput, dom.charCounter);

  // Seed demo tasks if empty
  if (state.tasks.length === 0) {
    const demos = [
      { text: 'Welcome to TaskFlow! 🎉 Click the checkbox to complete a task.', priority: 'high' },
      { text: 'Try editing this task by hovering and clicking the ✏️ button.', priority: 'medium' },
      { text: 'Use the search bar and filters to organize your tasks.', priority: 'low' },
    ];
    demos.forEach(d => {
      state.tasks.push({
        id: generateId(),
        text: d.text,
        priority: d.priority,
        completed: false,
        createdAt: new Date().toISOString(),
      });
    });
    saveTasks();
    renderAll();
  }
}

init();
