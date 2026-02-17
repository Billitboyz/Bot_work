import assert from 'node:assert/strict';
import { fetchDashboardData, validateDashboardPayload } from './api.js';
import { mockData } from './mock-data.js';
import { renderAgentList, renderCurrentTask, renderQueueSummary, renderStatusFeed } from './components.js';

function testValidatePayload() {
  assert.equal(validateDashboardPayload(mockData), true, 'mock data should be valid payload');
  assert.equal(validateDashboardPayload({}), false, 'empty object should be invalid');
  assert.equal(validateDashboardPayload({ ...mockData, queue: null }), false, 'missing queue object should be invalid');
  assert.equal(validateDashboardPayload({ ...mockData, queue: { ...mockData.queue, queued: '6' } }), false, 'queue counts must be numbers');
  assert.equal(validateDashboardPayload({ ...mockData, currentTask: { ...mockData.currentTask, progress: 145 } }), false, 'progress must be within 0-100');
}

function testRenderers() {
  const agentsHtml = renderAgentList(mockData.agents);
  assert.match(agentsHtml, /Main Agent/, 'agent list should render names');

  const queueHtml = renderQueueSummary(mockData.queue);
  assert.match(queueHtml, /In Progress/, 'queue summary should render labels');

  const unsafeQueueHtml = renderQueueSummary({ total: '<script>alert(1)</script>', inProgress: 1, queued: 2, blocked: 0 });
  assert.doesNotMatch(unsafeQueueHtml, /<script>/, 'queue summary should not render unsafe HTML');

  const taskHtml = renderCurrentTask(mockData.currentTask);
  assert.match(taskHtml, /Owner:/, 'task card should render owner');

  const feedHtml = renderStatusFeed(mockData.events);
  assert.match(feedHtml, /Task accepted/, 'status feed should include events');
}

async function testFetchDashboardData() {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => mockData
    });

    const apiResult = await fetchDashboardData({ endpoint: '/fake' });
    assert.equal(apiResult.source, 'api', 'valid API response should be marked as api');
    assert.equal(apiResult.error, null, 'valid API response should not include an error');
    assert.deepEqual(apiResult.data, mockData, 'valid API response should be returned as data');

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ agents: [] })
    });

    const fallbackResult = await fetchDashboardData({ endpoint: '/fake' });
    assert.equal(fallbackResult.source, 'mock', 'invalid API payload should fallback to mock data');
    assert.equal(validateDashboardPayload(fallbackResult.data), true, 'fallback payload should be valid');
    assert.ok(fallbackResult.error instanceof Error, 'fallback should include the triggering error');

    const noFallbackResult = await fetchDashboardData({ endpoint: '/fake', useMockOnError: false });
    assert.equal(noFallbackResult.data, null, 'no-fallback mode should return null data on error');
    assert.equal(noFallbackResult.source, 'none', 'no-fallback mode should report no data source');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function run() {
  testValidatePayload();
  testRenderers();
  await testFetchDashboardData();
  console.log('✅ Mission Control smoke tests passed');
}

await run();
