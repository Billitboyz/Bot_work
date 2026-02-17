import { mockData } from './mock-data.js';

function hasKeys(obj, keys) {
  return obj && typeof obj === 'object' && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isString(value) {
  return typeof value === 'string';
}

export function validateDashboardPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;

  if (!Array.isArray(payload.agents)) return false;
  if (!payload.agents.every((a) => hasKeys(a, ['id', 'name', 'status', 'task']) && [a.id, a.name, a.status, a.task].every(isString))) {
    return false;
  }

  if (!hasKeys(payload.queue, ['total', 'inProgress', 'queued', 'blocked'])) return false;
  if (![payload.queue.total, payload.queue.inProgress, payload.queue.queued, payload.queue.blocked].every(isNonNegativeNumber)) {
    return false;
  }

  if (!hasKeys(payload.currentTask, ['title', 'owner', 'eta', 'progress', 'notes'])) return false;
  if (![payload.currentTask.title, payload.currentTask.owner, payload.currentTask.eta, payload.currentTask.notes].every(isString)) {
    return false;
  }
  if (!isNonNegativeNumber(payload.currentTask.progress) || payload.currentTask.progress > 100) return false;

  if (!Array.isArray(payload.events)) return false;
  if (!payload.events.every((e) => hasKeys(e, ['time', 'text']) && isString(e.time) && isString(e.text) && (e.level === undefined || isString(e.level)))) {
    return false;
  }

  return true;
}

export async function fetchDashboardData(options = {}) {
  const { endpoint = '/api/mission-control/dashboard', useMockOnError = true } = options;

  try {
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    if (!validateDashboardPayload(data)) {
      throw new Error('API payload shape invalid');
    }
    return { data, source: 'api', error: null };
  } catch (error) {
    if (!useMockOnError) {
      return { data: null, source: 'none', error };
    }
    return { data: mockData, source: 'mock', error };
  }
}
