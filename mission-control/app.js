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
  content: { title: 'Content', subtitle: 'Content ideas from BB and related backlog' },
  approvals: { title: 'Approvals', subtitle: 'Tasks/projects waiting for your approval' },
  calendar: { title: 'Calendar', subtitle: 'Scheduled items and upcoming timeline' },
  projects: { title: 'Projects', subtitle: 'Ongoing projects broken into tasks' },
  memory: { title: 'Memory', subtitle: 'Suggestions for memory optimisation and upkeep' },
  docs: { title: 'Docs', subtitle: 'Relevant documents: mockups, sales strategies, and references' },
  office: { title: 'Office', subtitle: 'Currently active agents working right now' }
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

function renderList(items = [], empty = 'No items yet.') {
  if (!items.length) return renderNotice(empty);
  return `<div class="task-queue">${items.map((x) => `<div class="task-row"><div class="task-main"><div class="task-title">${x.title}</div><div class="task-meta">${x.meta || ''}</div></div></div>`).join('')}</div>`;
}

function renderByTab() {
  const tasks = state.data.tasks || [];
  const events = state.data.events || [];
  const agents = state.data.agents || [];
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  if (state.sideTab === 'tasks') {
    return {
      left: renderAgentList(agents),
      rightTop: renderQueueSummary(state.data.queue, state.queueFilter),
      rightMid: renderCurrentTask(state.data.currentTask),
      rightMain: renderTaskQueue(tasks, state.queueFilter),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Agent List', right: 'Current Task + Queue Summary', main: 'Task Queue (clickable)', bottom: 'Status Feed' },
      side: activeTasks.slice(0, 8)
    };
  }

  if (state.sideTab === 'office') {
    const workingAgents = agents.filter((a) => a.status === 'working');
    return {
      left: renderAgentList(workingAgents),
      rightTop: renderNotice(`Active agents: ${workingAgents.length}`),
      rightMid: renderNotice('Office view focuses on who is actively working right now.'),
      rightMain: renderTaskQueue(activeTasks.filter((t) => t.status === 'working'), 'working'),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Agents Working Now', right: 'Office Summary', main: 'Working Tasks', bottom: 'Status Feed' },
      side: activeTasks.slice(0, 8)
    };
  }

  if (state.sideTab === 'content') {
    const contentIdeas = tasks.filter((t) => /bb/i.test(`${t.owner || ''} ${t.project || ''} ${t.title || ''}`));
    return {
      left: renderList(contentIdeas.map((t) => ({ title: t.title, meta: `${t.owner || 'Unassigned'} • ${t.project || 'General'}` })), 'No BB content ideas yet.'),
      rightTop: renderNotice('Content ideas sourced from BB-tagged tasks.'),
      rightMid: renderNotice('Later we can wire this to a dedicated BB content source.'),
      rightMain: renderTaskQueue(contentIdeas, 'all'),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Content Ideas (BB)', right: 'Content Summary', main: 'Idea Backlog', bottom: 'Status Feed' },
      side: contentIdeas.slice(0, 8)
    };
  }

  if (state.sideTab === 'approvals') {
    const approvals = tasks.filter((t) => t.needsApproval === true || t.status === 'approval');
    return {
      left: renderList(approvals.map((t) => ({ title: t.title, meta: `${t.owner || 'Unassigned'} • ${t.project || 'General'}` })), 'No approvals pending.'),
      rightTop: renderNotice(`Pending approvals: ${approvals.length}`),
      rightMid: renderNotice('Approval actions will be wired in next.'),
      rightMain: renderList(approvals.map((t) => ({ title: t.title, meta: 'Awaiting your decision' })), 'Nothing to approve.'),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Approval Queue', right: 'Approval Summary', main: 'Items Requiring Approval', bottom: 'Status Feed' },
      side: approvals.slice(0, 8)
    };
  }

  if (state.sideTab === 'calendar') {
    const scheduled = events.filter((e) => /schedule|calendar|remind|cron/i.test(e.text || '')).map((e) => ({ title: e.text, meta: e.time }));
    return {
      left: renderList(scheduled, 'No scheduled items detected yet.'),
      rightTop: renderNotice(`Scheduled items: ${scheduled.length}`),
      rightMid: renderNotice('Calendar bindings can be plugged in next.'),
      rightMain: renderList(scheduled, 'No upcoming scheduled items.'),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Scheduled Items', right: 'Calendar Summary', main: 'Timeline', bottom: 'Status Feed' },
      side: scheduled.slice(0, 8)
    };
  }

  if (state.sideTab === 'projects') {
    const projectMap = new Map();
    for (const t of tasks) {
      const key = t.project || 'General';
      if (!projectMap.has(key)) projectMap.set(key, []);
      projectMap.get(key).push(t);
    }
    const projects = Array.from(projectMap.entries()).map(([name, items]) => ({ title: name, meta: `${items.length} task(s)` }));
    const projectTasks = Array.from(projectMap.entries()).map(([name, items]) => ({ title: `${name}: ${items.map((i) => i.title).join(' • ')}`, meta: '' }));
    return {
      left: renderList(projects, 'No projects yet.'),
      rightTop: renderNotice(`Active projects: ${projects.length}`),
      rightMid: renderNotice('Project view groups ongoing work into task bundles.'),
      rightMain: renderList(projectTasks, 'No project tasks yet.'),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Projects', right: 'Project Summary', main: 'Projects → Tasks', bottom: 'Status Feed' },
      side: tasks.slice(0, 8)
    };
  }

  if (state.sideTab === 'memory') {
    const suggestions = [
      { title: 'Run memory-maintenance on schedule', meta: 'Already scheduled every 4 hours' },
      { title: 'Cap large daily memory note size', meta: 'Avoid oversized context files' },
      { title: 'Keep latest dumps and prune old', meta: 'Retention script in place' },
      { title: 'Escalate memory search quota errors quickly', meta: 'Fallback to local files when API is limited' }
    ];
    return {
      left: renderList(suggestions, 'No memory suggestions yet.'),
      rightTop: renderNotice('Memory optimisation recommendations.'),
      rightMid: renderNotice('Focus: token efficiency, crash prevention, and timeout safety.'),
      rightMain: renderList(suggestions, 'No memory suggestions available.'),
      rightBottom: renderStatusFeed(events),
      labels: { left: 'Memory Suggestions', right: 'Memory Summary', main: 'Recommended Actions', bottom: 'Status Feed' },
      side: suggestions
    };
  }

  const area = 'Balham';
  const leadDocs = [
    {
      title: 'Hanoi Eats & Boba',
      meta: 'mockups/balham/leads/hanoi-eats-boba/hanoi-eats-boba-mockup.html • docs/lead-strategies/hanoi-eats-boba.md'
    },
    {
      title: "Panda's Coffee House",
      meta: 'mockups/balham/leads/pandas-coffee-house/pandas-coffee-house-mockup.html • docs/lead-strategies/pandas-coffee-house.md'
    },
    {
      title: 'Parish Coffee',
      meta: 'mockups/balham/leads/parish-coffee/parish-coffee-mockup.html • docs/lead-strategies/parish-coffee.md'
    },
    {
      title: 'The Apple Blue',
      meta: 'mockups/balham/leads/the-apple-blue/the-apple-blue-mockup.html • docs/lead-strategies/the-apple-blue.md'
    }
  ];

  return {
    left: renderList(leadDocs, `No lead docs found for ${area}.`),
    rightTop: renderNotice(`Area folder: ${area}`),
    rightMid: renderNotice('Each lead includes both a mockup and a strategy doc.'),
    rightMain: renderList(leadDocs, 'No lead docs available.'),
    rightBottom: renderStatusFeed(events),
    labels: { left: `Lead Docs (${area})`, right: 'Docs Summary', main: 'Per-Lead Mockup + Strategy', bottom: 'Status Feed' },
    side: leadDocs
  };
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
  const leftSectionTitle = document.getElementById('leftSectionTitle');
  const rightSectionTitle = document.getElementById('rightSectionTitle');
  const mainSectionTitle = document.getElementById('mainSectionTitle');
  const bottomSectionTitle = document.getElementById('bottomSectionTitle');

  if (!agentList || !queueSummary || !currentTask || !taskQueue || !statusFeed || !sourceIndicator || !sideTaskList || !workspaceTitle || !workspaceSubtitle || !leftSectionTitle || !rightSectionTitle || !mainSectionTitle || !bottomSectionTitle) {
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

  const view = renderByTab();
  agentList.innerHTML = view.left;
  queueSummary.innerHTML = view.rightTop;
  currentTask.innerHTML = view.rightMid;
  taskQueue.innerHTML = view.rightMain;
  statusFeed.innerHTML = view.rightBottom;
  sourceIndicator.textContent = `Source: ${state.source}`;

  leftSectionTitle.textContent = view.labels.left;
  rightSectionTitle.textContent = view.labels.right;
  mainSectionTitle.textContent = view.labels.main;
  bottomSectionTitle.textContent = view.labels.bottom;

  sideTaskList.innerHTML = view.side?.length
    ? view.side.map((t) => `<button class="side-task" ${t.id ? `data-task-action="start" data-task-id="${t.id}"` : ''}>${t.title}</button>`).join('')
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
