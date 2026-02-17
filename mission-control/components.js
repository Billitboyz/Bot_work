const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderNotice(message, type = 'info') {
  return `<div class="notice ${type === 'error' ? 'error' : ''}">${esc(message)}</div>`;
}

export function renderAgentList(agents = []) {
  if (!agents.length) return renderNotice('No active agents yet.');
  return agents.map((a) => `
    <div class="agent" data-agent-id="${esc(a.id)}">
      <div class="meta">
        <div class="name">${esc(a.name)}</div>
        <div class="task">${esc(a.task)}</div>
      </div>
      <span class="badge ${esc(a.status)}">${esc(a.status)}</span>
    </div>
  `).join('');
}

export function renderQueueSummary(queue = {}) {
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

  return `
    <div class="metric"><div class="label">Total</div><div class="value">${esc(safe.total)}</div></div>
    <div class="metric"><div class="label">In Progress</div><div class="value">${esc(safe.inProgress)}</div></div>
    <div class="metric"><div class="label">Queued</div><div class="value">${esc(safe.queued)}</div></div>
    <div class="metric"><div class="label">Blocked</div><div class="value">${esc(safe.blocked)}</div></div>
  `;
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

export function renderStatusFeed(events = []) {
  if (!events.length) return renderNotice('No status events recorded yet.');
  return events.map((e) => `
    <div class="event ${esc(e.level || 'info')}">
      <div>${esc(e.text)}</div>
      <div class="time">${esc(e.time)}</div>
    </div>
  `).join('');
}
