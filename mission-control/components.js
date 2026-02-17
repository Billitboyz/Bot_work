const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderNotice(message, type = 'info') {
  return `<div class="notice ${type === 'error' ? 'error' : ''}">${esc(message)}</div>`;
}

export function renderAgentList(agents = []) {
  if (!agents.length) return renderNotice('No active agents yet.');
  return agents.map((a) => {
    const projects = Array.isArray(a.projects) ? a.projects : [];
    const detailsId = `agent-${esc(a.id)}`;
    const projectsHtml = projects.length
      ? `<ul class="projects">${projects.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
      : '<div class="task">No project tags yet.</div>';

    return `
      <details class="agent expandable" data-agent-id="${esc(a.id)}" open>
        <summary>
          <div class="meta">
            <div class="name">${esc(a.name)}</div>
            <div class="task">${esc(a.task)}</div>
          </div>
          <span class="badge ${esc(a.status)}">${esc(a.status)}</span>
        </summary>
        <div class="agent-details" id="${detailsId}">
          <div class="task"><strong>Projects</strong></div>
          ${projectsHtml}
          ${a.updatedAt ? `<div class="task">Updated: ${esc(a.updatedAt)}</div>` : ''}
        </div>
      </details>
    `;
  }).join('');
}

export function renderQueueSummary(queue = {}, activeFilter = 'all') {
  const toCount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
  };

  const safe = {
    total: toCount(queue.total),
    inProgress: toCount(queue.inProgress),
    queued: toCount(queue.queued),
    blocked: toCount(queue.blocked)
  };

  const metric = (label, value, filter) => `
    <button class="metric metric-btn ${activeFilter === filter ? 'active' : ''}" data-queue-filter="${esc(filter)}">
      <div class="label">${esc(label)}</div>
      <div class="value">${esc(value)}</div>
    </button>
  `;

  return [
    metric('Total', safe.total, 'all'),
    metric('In Progress', safe.inProgress, 'working'),
    metric('Queued', safe.queued, 'queued'),
    metric('Blocked/Paused', safe.blocked, 'blocked')
  ].join('');
}

export function renderCurrentTask(task) {
  if (!task) return renderNotice('No current task.');
  const progress = Number.isFinite(task.progress) ? Math.min(Math.max(task.progress, 0), 100) : 0;
  return `
    <div class="task-title">${esc(task.title)}</div>
    <div class="task-meta">Owner: ${esc(task.owner)} • ETA: ${esc(task.eta)}</div>
    <div class="task-meta" style="margin-top:4px">${esc(task.notes)}</div>
    <div class="progress"><div style="width:${progress}%"></div></div>
  `;
}

export function renderTaskQueue(tasks = [], filter = 'all') {
  if (!tasks.length) return renderNotice('No tasks in queue.');

  const matches = (task) => {
    if (filter === 'all') return true;
    if (filter === 'blocked') return task.status === 'blocked' || task.status === 'paused';
    return task.status === filter;
  };

  const filtered = tasks.filter(matches);
  if (!filtered.length) return renderNotice(`No tasks for filter: ${filter}`);

  return filtered.map((t) => `
    <div class="task-row" data-task-id="${esc(t.id)}">
      <div class="task-main">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${esc(t.owner || 'Unassigned')} • ${esc(t.project || 'General')}</div>
      </div>
      <div class="task-controls">
        <span class="badge ${esc(t.status)}">${esc(t.status)}</span>
        <button class="task-btn" data-task-action="start" data-task-id="${esc(t.id)}">Start</button>
        <button class="task-btn" data-task-action="pause" data-task-id="${esc(t.id)}">Pause</button>
        <button class="task-btn danger" data-task-action="delete" data-task-id="${esc(t.id)}">Delete</button>
      </div>
    </div>
  `).join('');
}

export function renderStatusFeed(events = []) {
  if (!events.length) return renderNotice('No status events recorded yet.');
  return events.map((e) => `
    <div class="event ${esc(e.level || 'info')}">
      <div>${esc(e.text)}</div>
      <div class="time">${esc(e.time)}</div>
    </div>
  `).join('');
}
