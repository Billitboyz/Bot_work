import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outPath = path.join(__dirname, 'live-data.json');

const KNOWN_AGENTS = {
  main: { name: 'Main Agent', projects: ['Mission Control', 'Daily orchestration'] },
  coder: { name: 'Coder Subagent', projects: ['Mission Control backend', 'Integration', 'Tests'] },
  caretaker: { name: 'Caretaker Subagent', projects: ['Optimization', 'Housekeeping', 'Stability checks'] },
  leads: { name: 'Leads Subagent', projects: ['Lead tracking', 'Outreach pipeline', 'Sales workflows'] },
  bb: { name: 'BB Subagent', projects: ['BB command responses', 'Ops responses'] }
};

function utcTime(ms = Date.now()) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function statusFromAgeMs(ageMs) {
  if (ageMs <= 5 * 60_000) return 'working';
  if (ageMs <= 60 * 60_000) return 'idle';
  return 'offline';
}

function inferLabel(session) {
  const key = session.key || '';
  if (key === 'agent:main:main') return 'main';
  if (key.includes(':subagent:')) {
    if ((session.task || '').toLowerCase().includes('caretaker')) return 'caretaker';
    if ((session.task || '').toLowerCase().includes('coder')) return 'coder';
  }
  return null;
}

function loadSessions() {
  const json = execSync('openclaw sessions --json', { encoding: 'utf8' });
  const parsed = JSON.parse(json);
  return Array.isArray(parsed.sessions) ? parsed.sessions : [];
}

function buildData() {
  const now = Date.now();
  const sessions = loadSessions();

  const observed = new Map();

  for (const s of sessions) {
    const key = s.key || '';
    const ageMs = typeof s.ageMs === 'number' ? s.ageMs : Math.max(0, now - (s.updatedAt || now));

    if (key === 'agent:main:main') {
      observed.set('main', {
        id: 'agent-main',
        name: KNOWN_AGENTS.main.name,
        status: statusFromAgeMs(ageMs),
        task: 'Main session orchestration',
        projects: KNOWN_AGENTS.main.projects,
        updatedAt: utcTime(now - ageMs)
      });
      continue;
    }

    if (!key.includes(':subagent:')) continue;
    if (ageMs > 6 * 60 * 60_000) continue; // keep dashboard focused on recent work

    const label = inferLabel(s) || `subagent-${(s.sessionId || 'unknown').slice(0, 6)}`;
    const known = KNOWN_AGENTS[label];
    observed.set(label, {
      id: `agent-${label}`,
      name: known?.name || `Subagent ${label}`,
      status: statusFromAgeMs(ageMs),
      task: ageMs <= 5 * 60_000 ? 'Recently active' : 'No recent activity',
      projects: known?.projects || ['Unmapped project'],
      updatedAt: utcTime(now - ageMs)
    });
  }

  // Always include important named agents even if currently idle/offline.
  for (const [label, cfg] of Object.entries(KNOWN_AGENTS)) {
    if (label === 'main') continue;
    if (observed.has(label)) continue;
    observed.set(label, {
      id: `agent-${label}`,
      name: cfg.name,
      status: 'offline',
      task: 'No recent session activity detected',
      projects: cfg.projects,
      updatedAt: utcTime(now)
    });
  }

  const agents = Array.from(observed.values()).sort((a, b) => {
    const rank = { working: 0, idle: 1, blocked: 2, offline: 3 };
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name);
  });

  const queue = {
    total: agents.length,
    inProgress: agents.filter((a) => a.status === 'working').length,
    queued: agents.filter((a) => a.status === 'idle').length,
    blocked: agents.filter((a) => a.status === 'blocked' || a.status === 'offline').length
  };

  const lead = agents.find((a) => a.status === 'working') || agents[0] || null;
  const currentTask = lead
    ? {
        title: lead.task,
        owner: lead.name,
        eta: lead.status === 'working' ? 'active' : 'n/a',
        progress: lead.status === 'working' ? 55 : 0,
        notes: lead.projects?.length ? `Projects: ${lead.projects.join(', ')}` : 'No project tags.'
      }
    : {
        title: 'No active tasks',
        owner: 'System',
        eta: 'n/a',
        progress: 0,
        notes: 'No agents found.'
      };

  const events = [
    { level: 'info', time: utcTime(now), text: `Live sync complete: ${agents.length} agents tracked.` },
    { level: queue.inProgress ? 'ok' : 'warn', time: utcTime(now), text: `${queue.inProgress} agent(s) currently working.` },
    { level: 'info', time: utcTime(now), text: `Idle: ${queue.queued} • Offline/Blocked: ${queue.blocked}` }
  ];

  return { agents, queue, currentTask, events };
}

const data = buildData();
fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outPath}`);
