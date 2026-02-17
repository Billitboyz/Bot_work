export const mockData = {
  agents: [
    { id: 'agent-main', name: 'Main Agent', status: 'working', task: 'Mission Control dashboard (frontend)' },
    { id: 'agent-coder-1', name: 'Coder Subagent #1', status: 'working', task: 'Build agent list and task panels' },
    { id: 'agent-coder-2', name: 'Coder Subagent #2', status: 'idle', task: 'Awaiting assignment' },
    { id: 'agent-ops', name: 'Ops Watcher', status: 'blocked', task: 'Waiting for data source token' }
  ],
  queue: { total: 12, inProgress: 5, queued: 6, blocked: 1 },
  currentTask: {
    title: 'Frontend shell: agents, queue, current task, status feed',
    owner: 'Main Agent',
    eta: '15m',
    progress: 48,
    notes: 'Chunk 1 complete; wiring simulated data renderer.'
  },
  events: [
    { level: 'ok', time: '23:00 UTC', text: 'Task accepted: Mission Control dashboard build started.' },
    { level: 'info', time: '23:01 UTC', text: 'Layout scaffolded and componentized.' },
    { level: 'ok', time: '23:02 UTC', text: 'Mock-backed API wiring is active.' },
    { level: 'warn', time: '23:03 UTC', text: 'Ops Watcher blocked: missing external token.' }
  ]
};
