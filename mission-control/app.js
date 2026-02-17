import { fetchDashboardData } from './api.js';
import {
  renderAgentList,
  renderQueueSummary,
  renderCurrentTask,
  renderStatusFeed,
  renderNotice
} from './components.js';

const state = {
  status: 'loading', // loading | ready | error
  data: null,
  error: null,
  source: null,
  refreshInFlight: false
};

function stampUpdateTime() {
  const now = new Date();
  const utc = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  document.getElementById('lastUpdated').textContent = `Last update: ${utc}`;
}

function render() {
  const agentList = document.getElementById('agentList');
  const queueSummary = document.getElementById('queueSummary');
  const currentTask = document.getElementById('currentTask');
  const statusFeed = document.getElementById('statusFeed');
  const sourceIndicator = document.getElementById('dataSource');

  if (!agentList || !queueSummary || !currentTask || !statusFeed || !sourceIndicator) {
    throw new Error('Mission Control mount points are missing in DOM');
  }

  if (state.status === 'loading') {
    const loadingHtml = renderNotice('Loading dashboard data...');
    agentList.innerHTML = loadingHtml;
    queueSummary.innerHTML = loadingHtml;
    currentTask.innerHTML = loadingHtml;
    statusFeed.innerHTML = loadingHtml;
    sourceIndicator.textContent = 'Source: loading';
    return;
  }

  if (state.status === 'error') {
    const msg = `Failed to load dashboard data: ${state.error?.message || 'Unknown error'}`;
    const errHtml = renderNotice(msg, 'error');
    agentList.innerHTML = errHtml;
    queueSummary.innerHTML = errHtml;
    currentTask.innerHTML = errHtml;
    statusFeed.innerHTML = errHtml;
    sourceIndicator.textContent = 'Source: unavailable';
    return;
  }

  agentList.innerHTML = renderAgentList(state.data.agents);
  queueSummary.innerHTML = renderQueueSummary(state.data.queue);
  currentTask.innerHTML = renderCurrentTask(state.data.currentTask);
  statusFeed.innerHTML = renderStatusFeed(state.data.events);
  sourceIndicator.textContent = `Source: ${state.source}`;
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

async function init() {
  await loadDashboard();
  setInterval(stampUpdateTime, 30000);
  setInterval(loadDashboard, 60000);
}

init().catch((error) => {
  console.error('Mission Control failed to initialize:', error);
});
