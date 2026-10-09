const STORAGE_KEY = 'wxo-stage-demo-state';

const state = {
  config: [],
  runs: loadState(),
  running: false
};

const stageContainer = document.getElementById('stageContainer');
const stageTemplate = document.getElementById('stageTemplate');
const globalPrompt = document.getElementById('globalPrompt');
const statusBanner = document.getElementById('statusBanner');
const runAllButton = document.getElementById('runAllButton');
const clearButton = document.getElementById('clearButton');

init();

async function init() {
  attachGlobalHandlers();

  try {
    const response = await fetch('/api/config');
    const payload = await response.json();

    if (!payload.success) {
      throw new Error(payload.error || 'Failed to load config');
    }

    state.config = payload.stages;
    renderStages();
    statusBanner.textContent = payload.serviceConfigured
      ? 'Connected configuration loaded. Stage outputs are persisted in this browser.'
      : 'Service credentials are missing on the server. Add .env values before running stages.';
  } catch (error) {
    statusBanner.textContent = error.message;
  }
}

function attachGlobalHandlers() {
  runAllButton.addEventListener('click', runAllStages);
  clearButton.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    state.runs = {};
    renderStages();
    statusBanner.textContent = 'Saved browser data cleared.';
  });
}

function renderStages() {
  stageContainer.innerHTML = '';

  state.config.forEach((stage, index) => {
    const fragment = stageTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.stage-card');
    const stageData = state.runs[stage.key] || {};

    card.dataset.stageKey = stage.key;
    fragment.querySelector('.stage-kicker').textContent = `Stage ${index + 1}`;
    fragment.querySelector('.stage-title').textContent = stage.label;
    fragment.querySelector('.agent-id').textContent = `Agent ID: ${stage.agentId}`;
    fragment.querySelector('.instruction').textContent = stage.instruction;
    fragment.querySelector('.stage-state').textContent = stageData.loading ? 'Running' : (stageData.run?.status || 'Idle');

    const promptField = fragment.querySelector('.stage-prompt');
    promptField.value = stageData.prompt || '';
    promptField.placeholder = `Optional override for ${stage.label}`;
    promptField.addEventListener('input', (event) => {
      ensureStageState(stage.key).prompt = event.target.value;
      saveState();
    });

    fragment.querySelector('.run-stage-button').addEventListener('click', () => runStage(stage.key));
    fragment.querySelector('.thread-id').textContent = stageData.run?.threadId || '—';
    fragment.querySelector('.run-id').textContent = stageData.run?.runId || '—';
    fragment.querySelector('.analytic-status').textContent = stageData.run?.analytics?.status || '—';
    fragment.querySelector('.analytic-duration').textContent = formatDuration(stageData.run?.analytics?.durationMs);
    fragment.querySelector('.analytic-tools').textContent = stageData.run?.analytics?.toolCalls ?? '—';
    fragment.querySelector('.analytic-traces').textContent = stageData.run?.analytics?.traceCount ?? '—';
    fragment.querySelector('.output-panel').textContent = stageData.run?.outputText || 'No output yet.';
    fragment.querySelector('.trace-panel').textContent = stageData.run?.traces?.length
      ? JSON.stringify(stageData.run.traces, null, 2)
      : 'No traces returned by the run yet.';

    stageContainer.appendChild(fragment);
  });
}

async function runAllStages() {
  if (state.running) {
    return;
  }

  state.running = true;
  runAllButton.disabled = true;
  statusBanner.textContent = 'Running all stages in sequence…';

  try {
    for (const stage of state.config) {
      await runStage(stage.key, true);
    }

    statusBanner.textContent = 'All stages completed.';
  } catch (error) {
    statusBanner.textContent = error.message;
  } finally {
    state.running = false;
    runAllButton.disabled = false;
  }
}

async function runStage(stageKey, preserveStatus) {
  const stage = state.config.find((item) => item.key === stageKey);

  if (!stage) {
    return;
  }

  const stageState = ensureStageState(stageKey);
  const inheritedPrompt = buildPromptForStage(stageKey);
  const prompt = stageState.prompt?.trim() || inheritedPrompt;

  if (!prompt) {
    statusBanner.textContent = `Add a scenario prompt before running ${stage.label}.`;
    return;
  }

  stageState.loading = true;
  saveState();
  renderStages();

  if (!preserveStatus) {
    statusBanner.textContent = `Running ${stage.label}…`;
  }

  try {
    const response = await fetch(`/api/stages/${stageKey}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || `Failed to run ${stage.label}`);
    }

    state.runs[stageKey] = {
      prompt,
      loading: false,
      run: payload.run
    };
    saveState();
    renderStages();

    if (!preserveStatus) {
      statusBanner.textContent = `${stage.label} completed.`;
    }
  } catch (error) {
    stageState.loading = false;
    saveState();
    renderStages();
    throw error;
  }
}

function buildPromptForStage(stageKey) {
  const basePrompt = globalPrompt.value.trim();
  const previousOutput = getPreviousOutput(stageKey);

  if (!previousOutput) {
    return basePrompt;
  }

  return `${basePrompt}\n\nPrevious stage output:\n${previousOutput}`.trim();
}

function getPreviousOutput(stageKey) {
  const currentIndex = state.config.findIndex((item) => item.key === stageKey);

  if (currentIndex <= 0) {
    return '';
  }

  const previousStage = state.config[currentIndex - 1];
  return state.runs[previousStage.key]?.run?.outputText || '';
}

function ensureStageState(stageKey) {
  if (!state.runs[stageKey]) {
    state.runs[stageKey] = {};
  }

  return state.runs[stageKey];
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Only restore prompts — never persist run IDs, thread IDs, or trace data
    return Object.fromEntries(
      Object.entries(stored).map(([k, v]) => [k, { prompt: v.prompt || '' }])
    );
  } catch (error) {
    return {};
  }
}

function saveState() {
  // Persist only prompt text — omit runIds, threadIds, traces, and outputText
  const safe = Object.fromEntries(
    Object.entries(state.runs).map(([k, v]) => [k, { prompt: v.prompt || '' }])
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

function formatDuration(durationMs) {
  if (typeof durationMs !== 'number') {
    return '—';
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}
