import { fetchDashboardData } from './api.js';
import {
  renderAgentList,
  renderQueueSummary,
  renderCurrentTask,
  renderTaskQueue,
  renderStatusFeed,
  renderNotice
} from './components.js';

const state = {
  status: 'loading', // loading | ready | error
  data: null,
  error: null,
  source: null,
  refreshInFlight: false,
  queueFilter: 'all',
  sideTab: 'tasks'
};

const nowUtc = () => new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const tabMeta = {
  tasks: { title: 'Mission Control', subtitle: 'Task operations and live execution queue' },
  content: { title: 'Content', subtitle: 'Content-oriented task lane (wire actions next)' },
  approvals: { title: 'Approvals', subtitle: 'Approval queue and pending confirmations' },
  calendar: { title: 'Calendar', subtitle: 'Scheduled work and timeline view' },
  projects: { title: 'Projects', subtitle: 'Project-level grouping and ownership' },
  memory: { title: 'Memory', subtitle: 'Memory health and optimisation lane' },
  docs: { title: 'Docs', subtitle: 'Documentation and runbook tasks' },
  office: { title: 'Office', subtitle: 'AI operations office • live view' }
};

function alertAndLogImpossible(task) {
  const entry = {
    id: task.id,
    title: task.title,
    owner: task.owner || 'Unassigned',
    project: task.project || 'General',
    time: nowUtc()
  };
  try {
    const key = 'mission-control-impossible-log';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(entry);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));
  } catch {}

  console.error('[Mission Control] Escalated impossible task', entry);
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`Mission Control alert: impossible task escalated\n${entry.title} (${entry.owner})`);
  }
}

function stampUpdateTime() {
  document.getElementById('lastUpdated').textContent = `Last update: ${nowUtc()}`;
}

function deriveTasks(data) {
  if (Array.isArray(data.tasks) && data.tasks.length) return data.tasks;
  return (data.agents || []).map((a, i) => ({
    id: `task-${a.id || i}`,
    title: a.task || 'Untitled task',
    owner: a.name || 'Unknown',
    project: Array.isArray(a.projects) && a.projects[0] ? a.projects[0] : 'General',
    status: a.status === 'working' ? 'working' : 'queued',
    progress: a.status === 'working' ? 55 : 0
  }));
}

function recalcDerivedData(data) {
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];

  // Policy: blocked/paused tasks should be resolved to completed unless impossible.
  for (const t of tasks) {
    if ((t.status === 'blocked' || t.status === 'paused') && t.impossible === true) {
      t.status = 'escalated';
      t.hiddenEscalated = true;
      alertAndLogImpossible(t);
    } else if (t.status === 'blocked' || t.status === 'paused') {
      t.status = 'completed';
      t.progress = 100;
    }
  }

  const visibleTasks = tasks.filter((t) => t.hiddenEscalated !== true);
  const activeTasks = visibleTasks.filter((t) => t.status !== 'completed');
  const completedTasks = visibleTasks.filter((t) => t.status === 'completed');

  data.tasks = visibleTasks;
  data.queue = {
    total: activeTasks.length,
    inProgress: activeTasks.filter((t) => t.status === 'working').length,
    queued: activeTasks.filter((t) => t.status === 'queued').length,
    completed: completedTasks.length
  };

  const lead = activeTasks.find((t) => t.status === 'working') || activeTasks.find((t) => t.status === 'queued') || null;
  data.currentTask = lead
    ? {
        title: lead.title,
        owner: lead.owner || 'Unassigned',
        eta: lead.status === 'working' ? 'active' : 'queued',
        progress: Number.isFinite(lead.progress) ? lead.progress : (lead.status === 'working' ? 55 : 0),
        notes: `${lead.project || 'General'} • status: ${lead.status}`
      }
    : {
        title: 'No active tasks',
        owner: 'System',
        eta: 'n/a',
        progress: 0,
        notes: 'Queue is empty.'
      };
}

function pushEvent(level, text) {
  if (!state.data) return;
  const events = Array.isArray(state.data.events) ? state.data.events : [];
  events.unshift({ level, text, time: nowUtc() });
  state.data.events = events.slice(0, 60);
}

function applyTaskAction(action, taskId) {
  if (!state.data?.tasks) return;
  const tasks = state.data.tasks;
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return;

  const task = tasks[idx];
  if (action === 'delete') {
    tasks.splice(idx, 1);
    pushEvent('warn', `Deleted task: ${task.title}`);
  } else if (action === 'start') {
    task.status = 'working';
    task.progress = Math.min(100, Math.max(5, Number(task.progress || 0) + 10));
    pushEvent('ok', `Started task: ${task.title}`);
  } else if (action === 'pause') {
    task.status = 'completed';
    task.progress = 100;
    pushEvent('ok', `Auto-resolved paused task to completed: ${task.title}`);
  } else if (action === 'complete' || action === 'resolve') {
    task.status = 'completed';
    task.progress = 100;
    pushEvent('ok', `Completed task: ${task.title}`);
  }

  recalcDerivedData(state.data);
  render();
}

function render() {
  const agentList = document.getElementById('agentList');
  const queueSummary = document.getElementById('queueSummary');
  const currentTask = document.getElementById('currentTask');
  const taskQueue = document.getElementById('taskQueue');
  const statusFeed = document.getElementById('statusFeed');
  const sourceIndicator = document.getElementById('dataSource');
  const sideTaskList = document.getElementById('sideTaskList');
  const workspaceTitle = document.getElementById('workspaceTitle');
  const workspaceSubtitle = document.getElementById('workspaceSubtitle');

  if (!agentList || !queueSummary || !currentTask || !taskQueue || !statusFeed || !sourceIndicator || !sideTaskList || !workspaceTitle || !workspaceSubtitle) {
    throw new Error('Mission Control mount points are missing in DOM');
  }

  if (state.status === 'loading') {
    const loadingHtml = renderNotice('Loading dashboard data...');
    agentList.innerHTML = loadingHtml;
    queueSummary.innerHTML = loadingHtml;
    currentTask.innerHTML = loadingHtml;
    taskQueue.innerHTML = loadingHtml;
    statusFeed.innerHTML = loadingHtml;
    sideTaskList.innerHTML = loadingHtml;
    sourceIndicator.textContent = 'Source: loading';
    const meta = tabMeta[state.sideTab] || tabMeta.tasks;
    workspaceTitle.textContent = meta.title;
    workspaceSubtitle.textContent = meta.subtitle;
    return;
  }

  if (state.status === 'error') {
    const msg = `Failed to load dashboard data: ${state.error?.message || 'Unknown error'}`;
    const errHtml = renderNotice(msg, 'error');
    agentList.innerHTML = errHtml;
    queueSummary.innerHTML = errHtml;
    currentTask.innerHTML = errHtml;
    taskQueue.innerHTML = errHtml;
    statusFeed.innerHTML = errHtml;
    sideTaskList.innerHTML = errHtml;
    sourceIndicator.textContent = 'Source: unavailable';
    const meta = tabMeta[state.sideTab] || tabMeta.tasks;
    workspaceTitle.textContent = meta.title;
    workspaceSubtitle.textContent = meta.subtitle;
    return;
  }

  agentList.innerHTML = renderAgentList(state.data.agents);
  queueSummary.innerHTML = renderQueueSummary(state.data.queue, state.queueFilter);
  currentTask.innerHTML = renderCurrentTask(state.data.currentTask);
  taskQueue.innerHTML = renderTaskQueue(state.data.tasks, state.queueFilter);
  statusFeed.innerHTML = renderStatusFeed(state.data.events);
  sourceIndicator.textContent = `Source: ${state.source}`;

  const activeTasks = (state.data.tasks || []).filter((t) => t.status !== 'completed').slice(0, 8);
  sideTaskList.innerHTML = activeTasks.length
    ? activeTasks.map((t) => `<button class="side-task" data-task-action="start" data-task-id="${t.id}">${t.title}</button>`).join('')
    : renderNotice('No active tasks.');

  const meta = tabMeta[state.sideTab] || tabMeta.tasks;
  workspaceTitle.textContent = meta.title;
  workspaceSubtitle.textContent = meta.subtitle;
  document.querySelectorAll('.side-tab').forEach((btn) => {
    const on = btn.getAttribute('data-side-tab') === state.sideTab;
    btn.classList.toggle('active', on);
  });
}

async function loadDashboard() {
  if (state.refreshInFlight) return;
  state.refreshInFlight = true;

  state.status = state.data ? state.status : 'loading';
  render();

  try {
    const result = await fetchDashboardData();

    if (!result.data) {
      state.status = 'error';
      state.error = result.error;
      render();
      return;
    }

    result.data.tasks = deriveTasks(result.data);
    recalcDerivedData(result.data);

    state.status = 'ready';
    state.data = result.data;
    state.source = result.source;
    state.error = result.error;
    render();
    stampUpdateTime();
  } finally {
    state.refreshInFlight = false;
  }
}

function bindUiEvents() {
  document.addEventListener('click', (event) => {
    const actionBtn = event.target.closest('[data-task-action]');
    if (actionBtn) {
      const action = actionBtn.getAttribute('data-task-action');
      const taskId = actionBtn.getAttribute('data-task-id');
      if (action && taskId) applyTaskAction(action, taskId);
      return;
    }

    const filterBtn = event.target.closest('[data-queue-filter]');
    if (filterBtn) {
      state.queueFilter = filterBtn.getAttribute('data-queue-filter') || 'all';
      render();
      return;
    }

    const sideTabBtn = event.target.closest('[data-side-tab]');
    if (sideTabBtn) {
      state.sideTab = sideTabBtn.getAttribute('data-side-tab') || 'tasks';
      render();
    }
  });
}

async function init() {
  bindUiEvents();
  await loadDashboard();
  setInterval(stampUpdateTime, 30000);
  setInterval(loadDashboard, 60000);
}

init().catch((error) => {
  console.error('Mission Control failed to initialize:', error);
});
