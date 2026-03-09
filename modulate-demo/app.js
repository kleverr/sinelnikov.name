const modelEl = document.getElementById('model');
const fileEl = document.getElementById('file');
const recordZoneEl = document.getElementById('record-zone');
const recordToggleBtnEl = document.getElementById('record-toggle-btn');
const recordStatusEl = document.getElementById('record-status');
const outputEl = document.getElementById('output');
const previewOutputEl = document.getElementById('preview-output');
const copyPreviewBtnEl = document.getElementById('copy-preview');
const copyJsonBtnEl = document.getElementById('copy-json');
const toggleViewBtnEl = document.getElementById('toggle-view');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPreviewEl = document.getElementById('tab-preview');
const tabJsonEl = document.getElementById('tab-json');
const featureNoteEl = document.getElementById('feature-note');
const optSpeakerDiarizationEl = document.getElementById('opt-speaker-diarization');
const optEmotionSignalEl = document.getElementById('opt-emotion-signal');
const optAccentSignalEl = document.getElementById('opt-accent-signal');
const optPiiPhiTaggingEl = document.getElementById('opt-pii-phi-tagging');
const optionInputs = [optSpeakerDiarizationEl, optEmotionSignalEl, optAccentSignalEl, optPiiPhiTaggingEl];

const metaStatusEl = document.getElementById('meta-status');
const metaFailureTypeEl = document.getElementById('meta-failure-type');
const metaFailureNameEl = document.getElementById('meta-failure-name');
const rowFailureTypeEl = document.getElementById('row-failure-type');
const rowFailureNameEl = document.getElementById('row-failure-name');
const metaModelEl = document.getElementById('meta-model');
const metaOptionsEl = document.getElementById('meta-options');
const metaFileNameEl = document.getElementById('meta-file-name');
const metaFileTypeEl = document.getElementById('meta-file-type');
const metaFileSizeEl = document.getElementById('meta-file-size');
const metaDurationMinEl = document.getElementById('meta-duration-min');
const metaProcessingEl = document.getElementById('meta-processing');
const metaRtfEl = document.getElementById('meta-rtf');
const metaHttpEl = document.getElementById('meta-http');
const metaEndpointEl = document.getElementById('meta-endpoint');
const metaRequestIdEl = document.getElementById('meta-request-id');
const metaRateEl = document.getElementById('meta-rate');
const metaCostEl = document.getElementById('meta-cost');
const metaTokensEl = document.getElementById('meta-tokens');
const metaTranscriptCharsEl = document.getElementById('meta-transcript-chars');
const metaTranscriptWordsEl = document.getElementById('meta-transcript-words');
const metaUtterancesEl = document.getElementById('meta-utterances');
const metaSpeakersEl = document.getElementById('meta-speakers');
const metaLanguagesEl = document.getElementById('meta-languages');
const metaEmotionsEl = document.getElementById('meta-emotions');
const metaAccentsEl = document.getElementById('meta-accents');
const metaPiiTagsEl = document.getElementById('meta-pii-tags');
const metaResponseBytesEl = document.getElementById('meta-response-bytes');
const audioPlayerWrapEl = document.getElementById('audio-player-wrap');
const audioPlayerEl = document.getElementById('audio-player');
const autoscrollEl = document.getElementById('autoscroll');
const panelNewUploadEl = document.getElementById('panel-new-upload');
const panelChooseBtnEl = document.getElementById('panel-choose-btn');
const viewerShellEl = document.getElementById('viewer-shell');

const API_BASE_URL = 'https://modulate-developer-apis.com';
const API_WS_BASE_URL = API_BASE_URL.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
const API_KEY = '30b0ea76-da9d-424f-9fd7-423bc74a1184';

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });
function langCodeToName(code) {
  try { return LANGUAGE_NAMES.of(code) || code; } catch { return code; }
}

const EMOTION_COLORS = {
  angry: '#ff3554', contemptuous: '#ff3554', disgusted: '#ff3554', ashamed: '#ff3554',
  afraid: '#b464c8', anxious: '#b464c8', stressed: '#b464c8',
  surprised: '#b464c8', frustrated: '#b464c8',
  excited: '#ff7850', hopeful: '#ff7850', proud: '#ff7850', curious: '#ff7850', amused: '#ff7850',
  sad: '#0078c8', disappointed: '#0078c8', bored: '#0078c8',
  tired: '#0078c8', concerned: '#0078c8', confused: '#0078c8',
  calm: '#6e8cbe', confident: '#6e8cbe', interested: '#6e8cbe',
  neutral: '#5a5a6e', unknown: '#5a5a6e',
};
function emotionColor(name) {
  return EMOTION_COLORS[name.toLowerCase()] || null;
}

const MODEL_CONFIG = {
  'batch-fast': {
    fullName: 'velma-2-stt-batch-english-vfast',
    endpoint: '/api/velma-2-stt-batch-english-vfast',
    ratePerHourUsd: 0.025,
    mode: 'batch',
    speedFactor: 250,
    unsupported: new Set(['utterances', 'speakers', 'languages', 'emotions', 'accents', 'pii_tags', 'options']),
  },
  batch: {
    fullName: 'velma-2-stt-batch',
    endpoint: '/api/velma-2-stt-batch',
    ratePerHourUsd: 0.03,
    mode: 'batch',
    speedFactor: 10,
    unsupported: new Set(),
  },
  streaming: {
    fullName: 'velma-2-stt-streaming',
    endpoint: '/api/velma-2-stt-streaming',
    ratePerHourUsd: null,
    mode: 'streaming',
    speedFactor: null,
    unsupported: new Set(),
  },
};

let latestPayload = null;
let audioObjectUrl = null;
let activeUtteranceEl = null;
let latestPreviewText = '';
let progressEstimatedMs = null;
let mediaRecorder = null;
let mediaStream = null;
let recordedChunks = [];
let recordingStartedAt = 0;
let recordingTimerId = null;
let shouldSubmitRecording = false;

// ── Multi-file state ──────────────────────────────────────────────────────────
const fileTabsBarEl = document.getElementById('file-tabs-bar');
let files = [];       // FileEntry[]
let activeFileIndex = -1;

function createFileEntry(file) {
  return {
    file,
    status: 'pending',    // 'pending' | 'processing' | 'done' | 'error'
    estimatedMs: null,
    audioUrl: null,
    normalizedResponse: null,
    rawPayload: null,
    previewText: '',
    model: modelEl.value,
    options: getRequestedOptions(),
  };
}

function computePreviewText(payload) {
  const utterances = Array.isArray(payload?.result?.utterances) ? payload.result.utterances : [];
  if (utterances.length) return buildTranscriptCopyFromUtterances(utterances);
  return extractTranscriptText(payload) || '';
}

function renderFileTabs() {
  fileTabsBarEl.innerHTML = '';
  files.forEach((entry, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'file-tab' + (i === activeFileIndex ? ' active' : '');
    tab.dataset.status = entry.status;
    tab.addEventListener('click', () => setActiveFileIndex(i));

    const dot = document.createElement('span');
    dot.className = 'file-tab-dot';

    const name = document.createElement('span');
    name.className = 'file-tab-name';
    const fn = entry.file.name;
    name.textContent = fn.length > 16 ? fn.slice(0, 15) + '…' : fn;
    name.title = fn;

    const close = document.createElement('span');
    close.className = 'file-tab-close';
    close.textContent = '×';
    close.title = 'Remove';
    close.addEventListener('click', (e) => { e.stopPropagation(); removeFile(i); });

    const progress = document.createElement('div');
    progress.className = 'file-tab-progress';
    if (entry.status === 'processing' && entry.estimatedMs) {
      const dur = (entry.estimatedMs / 1000).toFixed(1);
      progress.style.animation = `progress-fill ${dur}s cubic-bezier(0.25,0.46,0.45,0.94) forwards`;
    }
    // done/error: no fill — tab returns to normal background

    tab.append(progress, dot, name, close);
    fileTabsBarEl.appendChild(tab);
  });
  if (files.length < 5) {
    const newTab = document.createElement('button');
    newTab.type = 'button';
    newTab.className = 'file-tab new-tab' + (activeFileIndex === -1 ? ' active' : '');
    newTab.dataset.newTab = 'true';
    newTab.addEventListener('click', () => setActiveFileIndex(-1));
    const newTabName = document.createElement('span');
    newTabName.textContent = 'New transcription';
    newTab.appendChild(newTabName);
    fileTabsBarEl.appendChild(newTab);
  }
}

function updateTabStatus(i) {
  const tab = fileTabsBarEl.querySelectorAll('.file-tab')[i];
  if (!tab) return;
  const entry = files[i];
  if (!entry) return;
  tab.dataset.status = entry.status;
  const progress = tab.querySelector('.file-tab-progress');
  if (!progress) return;
  if (entry.status === 'processing' && entry.estimatedMs) {
    const dur = (entry.estimatedMs / 1000).toFixed(1);
    progress.style.animation = `progress-fill ${dur}s cubic-bezier(0.25,0.46,0.45,0.94) forwards`;
  } else if (entry.status !== 'processing') {
    progress.style.animation = 'none';
    progress.style.width = '0';
  }
}

function setActiveFileIndex(i) {
  activeFileIndex = i;
  // Update active class in-place so processing animations are not interrupted
  let fileIdx = 0;
  for (const t of fileTabsBarEl.querySelectorAll('.file-tab')) {
    if (t.dataset.newTab) {
      t.classList.toggle('active', i === -1);
    } else {
      t.classList.toggle('active', fileIdx === i);
      fileIdx++;
    }
  }
  if (i === -1) {
    panelNewUploadEl.hidden = false;
    viewerShellEl.hidden = true;
  } else {
    panelNewUploadEl.hidden = true;
    viewerShellEl.hidden = false;
    displayFile(files[i]);
  }
}

function removeFile(i) {
  files.splice(i, 1);
  if (files.length === 0) {
    activeFileIndex = -1;
    latestPayload = null;
    latestPreviewText = '';
    audioPlayerWrapEl.hidden = true;
    renderFileTabs();
    panelNewUploadEl.hidden = false;
    viewerShellEl.hidden = true;
  } else {
    if (activeFileIndex >= files.length) activeFileIndex = files.length - 1;
    else if (activeFileIndex > i) activeFileIndex--;
    renderFileTabs();
    if (activeFileIndex === -1) {
      panelNewUploadEl.hidden = false;
      viewerShellEl.hidden = true;
    } else {
      panelNewUploadEl.hidden = true;
      viewerShellEl.hidden = false;
      displayFile(files[activeFileIndex]);
    }
  }
}

function displayFile(entry) {
  if (!entry) return;

  if (entry.status === 'pending') {
    metaStatusEl.textContent = 'Waiting';
    metaStatusEl.className = 'status';
    rowFailureTypeEl.hidden = true;
    rowFailureNameEl.hidden = true;
    metaFileNameEl.textContent = entry.file.name;
    metaFileSizeEl.textContent = formatMb(entry.file.size);
    metaFileTypeEl.textContent = deriveClientFileType(entry.file);
    metaModelEl.textContent = '—';
    metaOptionsEl.textContent = '—';
    metaDurationMinEl.textContent = '—';
    metaProcessingEl.textContent = '—';
    metaRtfEl.textContent = '—';
    metaHttpEl.textContent = '—';
    metaEndpointEl.textContent = '—';
    metaRequestIdEl.textContent = '—';
    metaRateEl.textContent = '—';
    metaCostEl.textContent = '—';
    metaTokensEl.textContent = '—';
    metaTranscriptCharsEl.textContent = '—';
    metaTranscriptWordsEl.textContent = '—';
    metaUtterancesEl.textContent = '—';
    metaSpeakersEl.textContent = '—';
    metaLanguagesEl.textContent = '—';
    metaEmotionsEl.textContent = '—';
    metaAccentsEl.textContent = '—';
    metaPiiTagsEl.textContent = '—';
    metaResponseBytesEl.textContent = '—';
    previewOutputEl.innerHTML = '<span class="empty-hint">Queued — will start processing shortly…</span>';
    audioPlayerWrapEl.hidden = true;
    latestPayload = null;
    latestPreviewText = '';
    renderJson({});
    return;
  }

  if (entry.status === 'processing') {
    resetMeta(entry.file);
    progressEstimatedMs = entry.estimatedMs;
    updatePreview({ status: 'processing' });
    if (entry.audioUrl) {
      if (audioObjectUrl && audioObjectUrl !== entry.audioUrl) URL.revokeObjectURL(audioObjectUrl);
      audioObjectUrl = entry.audioUrl;
      audioPlayerEl.src = entry.audioUrl;
      audioPlayerWrapEl.hidden = false;
    } else {
      audioPlayerWrapEl.hidden = true;
    }
    latestPayload = null;
    latestPreviewText = '';
    renderJson({ status: 'processing', file: { name: entry.file.name }, model: entry.model });
    return;
  }

  // done or error
  const p = entry.normalizedResponse;
  latestPayload = entry.rawPayload;
  latestPreviewText = entry.previewText;
  renderJson(entry.rawPayload);
  updateMetaFromResponse(p, entry.model);
  progressEstimatedMs = null;
  updatePreview(p);
  if (entry.audioUrl) {
    if (audioObjectUrl && audioObjectUrl !== entry.audioUrl) URL.revokeObjectURL(audioObjectUrl);
    audioObjectUrl = entry.audioUrl;
    audioPlayerEl.src = entry.audioUrl;
    audioPlayerWrapEl.hidden = false;
  } else {
    audioPlayerWrapEl.hidden = true;
  }
}

function addFiles(fileList) {
  const toAdd = Array.from(fileList);
  if (!toAdd.length) return;

  if (files.length >= 5) {
    const replaceIdx = activeFileIndex >= 0 ? activeFileIndex : 0;
    const currentName = files[replaceIdx]?.file.name ?? 'the current tab';
    const shortName = currentName.length > 40 ? currentName.slice(0, 39) + '…' : currentName;
    const ok = window.confirm(`All 5 slots are in use.\n\nReplace "${shortName}" with the new file?`);
    if (!ok) return;
    files[replaceIdx] = createFileEntry(toAdd[0]);
    renderFileTabs();
    setActiveFileIndex(replaceIdx);
    processAllFiles();
    return;
  }

  const remaining = 5 - files.length;
  const toAddSliced = toAdd.slice(0, remaining);
  const firstNewIndex = files.length;
  toAddSliced.forEach(f => files.push(createFileEntry(f)));
  renderFileTabs();
  if (activeFileIndex < 0) setActiveFileIndex(firstNewIndex);
  processAllFiles();
}

function processAllFiles() {
  files.forEach((entry, i) => {
    if (entry.status === 'pending') void runWithFileAtIndex(i);
  });
}

async function runWithFileAtIndex(i) {
  const entry = files[i];
  if (!entry || entry.status !== 'pending') return;

  const { file } = entry;
  const model = entry.model;
  const config = MODEL_CONFIG[model] || MODEL_CONFIG.batch;
  const options = entry.options;
  const startedAt = Date.now();

  // Probe duration for progress estimate
  if (config.speedFactor) {
    const dur = await probeFileDuration(file).catch(() => null);
    if (dur) entry.estimatedMs = dur / config.speedFactor;
  }

  // Create audio URL upfront
  if (!entry.audioUrl) entry.audioUrl = URL.createObjectURL(file);

  entry.status = 'processing';
  updateTabStatus(i);
  if (i === activeFileIndex) {
    resetMeta(file);
    progressEstimatedMs = entry.estimatedMs;
    updatePreview({ status: 'processing' });
    audioObjectUrl = entry.audioUrl;
    audioPlayerEl.src = entry.audioUrl;
    audioPlayerWrapEl.hidden = false;
    renderJson({ status: 'processing', file: { name: file.name }, model, options });
  }

  const finalize = (payload, status) => {
    entry.status = status;
    entry.normalizedResponse = payload;
    entry.rawPayload = payload;
    entry.previewText = computePreviewText(payload);
    updateTabStatus(i);
    if (i === activeFileIndex) {
      latestPayload = payload;
      latestPreviewText = entry.previewText;
      renderJson(payload);
      updateMetaFromResponse(payload, model);
      progressEstimatedMs = null;
      updatePreview(payload);
    }
  };

  if (!API_KEY) {
    const processingMs = Date.now() - startedAt;
    const payload = normalizeApiResponse({ modelKey: model, file, options, config, statusCode: 401, statusText: 'Missing API Key', parsed: { message: 'Missing API key in app.js' }, rawText: '{"message":"Missing API key in app.js"}', processingMs, ok: false });
    payload.error = { type: 'Configuration Error', message: 'Missing API key in app.js', detail: 'Set API_KEY before deploying.' };
    finalize(payload, 'error');
    fileEl.value = '';
    return;
  }

  try {
    const transport = config.mode === 'streaming'
      ? await requestStreamingTranscription({ file, options, config })
      : await requestBatchTranscription({ file, options, config });
    const processingMs = Date.now() - startedAt;
    const payload = normalizeApiResponse({ modelKey: model, file, options, config, statusCode: transport.statusCode, statusText: transport.statusText, parsed: transport.parsed, rawText: transport.rawText, processingMs, ok: transport.ok });
    finalize(payload, payload.success ? 'done' : 'error');
  } catch (error) {
    const processingMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const payload = normalizeApiResponse({ modelKey: model, file, options, config, statusCode: null, statusText: config.mode === 'streaming' ? 'Streaming Error' : 'Network Error', parsed: { message: errorMessage }, rawText: JSON.stringify({ message: errorMessage }), processingMs, ok: false });
    payload.error = { type: config.mode === 'streaming' ? 'Streaming Error' : 'Network Error', message: errorMessage, detail: config.mode === 'streaming' ? 'WebSocket streaming failed.' : 'Request failed.' };
    finalize(payload, 'error');
  } finally {
    fileEl.value = '';
    if (model === 'streaming' && mediaRecorder?.state !== 'recording') {
      recordStatusEl.textContent = 'Ready to record';
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function probeFileDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onloadedmetadata = () => { cleanup(); resolve(audio.duration * 1000); };
    audio.onerror = () => { cleanup(); reject(); };
    audio.src = url;
    setTimeout(() => { cleanup(); reject(); }, 4000);
  });
}

const INT_FMT = new Intl.NumberFormat('en-US');
const DEC3_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const DEC2_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEC1_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const BATCH_ONLY_TOOLTIP = 'Available in Batch or Streaming model.';

const UNSUPPORTED_BY_MODEL = Object.fromEntries(
  Object.entries(MODEL_CONFIG).map(([modelKey, config]) => [modelKey, config.unsupported || new Set()]),
);

function toText(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function formatCount(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${INT_FMT.format(value)} ${unit}`;
}

function formatMb(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  return `${DEC3_FMT.format(bytes / (1024 * 1024))} MB`;
}

function formatResponseBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${INT_FMT.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${DEC2_FMT.format(bytes / 1024)} KB`;
  return `${DEC2_FMT.format(bytes / (1024 * 1024))} MB`;
}

function formatDurationMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  return `${INT_FMT.format(Math.round(ms))} ms`;
}

function formatSecondsFromMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  return `${DEC1_FMT.format(ms / 1000)} s`;
}

function formatMinutes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${DEC1_FMT.format(value)} min`;
}

function formatAdaptive(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';

  const abs = Math.abs(value);
  if (abs >= 100) return INT_FMT.format(Math.round(value));
  if (abs >= 10) return DEC1_FMT.format(value);
  if (abs >= 1) return DEC2_FMT.format(value);
  if (abs >= 0.1) return value.toFixed(3);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toFixed(5);
}

function formatProcessingFactor(data) {
  const processingMs = data?.speed?.processingMs;
  const audioDurationMs = data?.meta?.audioDurationMs ?? data?.speed?.audioDurationMs;

  if (typeof processingMs !== 'number' || !Number.isFinite(processingMs) || processingMs <= 0) {
    return 'N/A';
  }

  if (typeof audioDurationMs !== 'number' || !Number.isFinite(audioDurationMs) || audioDurationMs <= 0) {
    return 'N/A';
  }

  // Use the same 1-decimal values shown in the table to keep factor visually consistent.
  const shownMinutes = Number((audioDurationMs / 60000).toFixed(1));
  const shownSeconds = Number((processingMs / 1000).toFixed(1));
  const durationSecondsForFactor = shownMinutes * 60;
  const processingSecondsForFactor = shownSeconds > 0 ? shownSeconds : processingMs / 1000;

  if (!Number.isFinite(durationSecondsForFactor) || durationSecondsForFactor <= 0) {
    return 'N/A';
  }

  if (!Number.isFinite(processingSecondsForFactor) || processingSecondsForFactor <= 0) {
    return 'N/A';
  }

  const fasterMultiplier = durationSecondsForFactor / processingSecondsForFactor;

  if (fasterMultiplier >= 1) {
    return `×${formatAdaptive(fasterMultiplier)} faster`;
  }

  const slowerMultiplier = processingMs / audioDurationMs;
  return `x${formatAdaptive(slowerMultiplier)} slower`;
}

function setStatus(label, state = 'neutral') {
  metaStatusEl.classList.remove('ok', 'fail', 'processing');

  if (state === 'processing') {
    metaStatusEl.classList.add('processing');
    metaStatusEl.innerHTML = `${label}<span class="dots"><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>`;
    return;
  }

  metaStatusEl.textContent = label;
  if (state === 'ok') metaStatusEl.classList.add('ok');
  if (state === 'fail') metaStatusEl.classList.add('fail');
}

function formatRate(cost) {
  if (!cost) return '—';

  if (typeof cost.ratePerHourUsd === 'number' && cost.ratePerHourUsd > 0) {
    return `$${cost.ratePerHourUsd}/hour`;
  }

  return 'N/A';
}

function formatCost(cost) {
  if (!cost) return '—';

  if (typeof cost.estimatedUsd === 'number') {
    return `$${cost.estimatedUsd.toFixed(6)} USD`;
  }

  return 'N/A';
}

function formatTokens(tokens) {
  if (!tokens) return 'N/A';

  const parts = [];

  if (typeof tokens.totalTokens === 'number') parts.push(`total: ${INT_FMT.format(tokens.totalTokens)} tokens`);
  if (typeof tokens.inputTokens === 'number') parts.push(`input: ${INT_FMT.format(tokens.inputTokens)} tokens`);
  if (typeof tokens.outputTokens === 'number') parts.push(`output: ${INT_FMT.format(tokens.outputTokens)} tokens`);

  return parts.length ? parts.join(' | ') : 'N/A';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syntaxHighlightJson(jsonText) {
  const escaped = escapeHtml(jsonText);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"\s*:?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (match.startsWith('"')) {
        if (match.endsWith(':')) {
          return `<span class="json-key">${match}</span>`;
        }
        return `<span class="json-string">${match}</span>`;
      }
      if (match === 'true' || match === 'false') {
        return `<span class="json-boolean">${match}</span>`;
      }
      if (match === 'null') {
        return `<span class="json-null">${match}</span>`;
      }
      return `<span class="json-number">${match}</span>`;
    },
  );
}

function renderJson(payload) {
  const pretty = JSON.stringify(payload, null, 2);
  outputEl.innerHTML = syntaxHighlightJson(pretty);

  latestPayload = payload;
  updatePreview(payload);
}

function extractTranscriptText(payload) {
  const result = payload?.result;

  if (result && typeof result.text === 'string' && result.text.trim()) {
    return stripSignalTags(result.text).trim();
  }

  if (result && Array.isArray(result.utterances) && result.utterances.length) {
    const lines = result.utterances
      .map((utterance) => (utterance && typeof utterance.text === 'string' ? stripSignalTags(utterance.text).trim() : ''))
      .filter(Boolean);

    if (lines.length) return lines.join('\n');
  }

  return '';
}

function getRequestedOptions() {
  return {
    speaker_diarization: !!optSpeakerDiarizationEl?.checked,
    emotion_signal: !!optEmotionSignalEl?.checked,
    accent_signal: !!optAccentSignalEl?.checked,
    pii_phi_tagging: !!optPiiPhiTaggingEl?.checked,
  };
}

function updateFeatureControlsForModel(modelKey) {
  const supportsOptions = modelKey !== 'batch-fast';

  for (const input of optionInputs) {
    input.disabled = !supportsOptions;
    const label = input.closest('.feature-item');
    if (label) {
      label.classList.toggle('disabled', !supportsOptions);
      label.title = supportsOptions ? '' : BATCH_ONLY_TOOLTIP;
    }
  }

  const autoscrollLabel = autoscrollEl?.closest('.autoscroll-label');
  if (autoscrollEl) {
    autoscrollEl.disabled = !supportsOptions;
    if (autoscrollLabel) {
      autoscrollLabel.classList.toggle('disabled', !supportsOptions);
      autoscrollLabel.title = supportsOptions ? '' : BATCH_ONLY_TOOLTIP;
    }
  }

  if (featureNoteEl) featureNoteEl.textContent = '';
}

function formatRequestedOptions(options, modelKey) {
  if (modelKey === 'batch-fast') return 'N/A';

  const opts = options || getRequestedOptions();
  const on = [
    opts.speaker_diarization && 'Diarization',
    opts.emotion_signal && 'Emotion',
    opts.accent_signal && 'Accent',
    opts.pii_phi_tagging && 'PII/PHI',
  ].filter(Boolean);
  return on.length ? on.join(', ') : 'none';
}

function toSpeakerLabel(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (!raw) return 'Speaker';

  if (/^speaker\b/i.test(raw)) {
    return raw.replace(/^speaker/i, 'Speaker');
  }

  if (/^\d+$/.test(raw)) {
    return `Speaker ${raw}`;
  }

  return raw;
}

function formatTimestampMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function collectSignalStats(result) {
  const utterances = Array.isArray(result?.utterances) ? result.utterances : [];
  const emotions = new Map();
  const accents = new Map();
  let piiTagCount = 0;

  for (const utterance of utterances) {
    if (!utterance || typeof utterance !== 'object') continue;

    if (typeof utterance.emotion === 'string' && utterance.emotion.trim()) {
      const key = utterance.emotion.trim();
      emotions.set(key, (emotions.get(key) || 0) + 1);
    }

    if (typeof utterance.accent === 'string' && utterance.accent.trim()) {
      const key = utterance.accent.trim();
      accents.set(key, (accents.get(key) || 0) + 1);
    }

    if (typeof utterance.text === 'string') {
      const piiMatches = utterance.text.match(/<\/?(?:pii|phi)\b[^>]*>/gi);
      piiTagCount += piiMatches ? piiMatches.length : 0;
    }
  }

  return { emotions, accents, piiTagCount };
}

function formatSignalMap(map) {
  if (!(map instanceof Map) || !map.size) return 'N/A';

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => `${label} (${count})`)
    .join(', ');
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function getFailureInfo(data) {
  if (data?.success) {
    return { type: 'N/A', name: 'N/A' };
  }

  const error = data?.error || {};
  const detail = error?.detail;
  const statusCode = data?.api?.statusCode;
  const statusText = typeof data?.api?.statusText === 'string' ? data.api.statusText.trim() : '';

  let detailText = null;
  if (typeof detail === 'string' && detail.trim()) {
    detailText = detail.trim();
  } else if (detail && typeof detail === 'object') {
    detailText = firstNonEmptyString(detail.detail, detail.message, detail.error, detail.raw);
    if (!detailText) {
      try {
        detailText = JSON.stringify(detail);
      } catch {
        detailText = null;
      }
    }
  }

  const statusSummary = statusCode
    ? `HTTP ${statusCode}${statusText ? ` ${statusText}` : ''}`
    : statusText
      ? `HTTP ${statusText}`
      : null;

  return {
    type: firstNonEmptyString(error.type, error.code, statusSummary, 'Request Failure') || 'Request Failure',
    name: firstNonEmptyString(detailText, error.message, statusText, 'Unknown error') || 'Unknown error',
  };
}

function stripSignalTags(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/<(pii|phi):([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1:\2>/gi, '$3');
}

function renderTranscriptTextWithMaskedTags(container, text) {
  container.textContent = '';
  if (typeof text !== 'string' || !text) return;

  const tagRegex = /<(pii|phi):([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1:\2>/gi;
  let cursor = 0;
  let matched = false;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    matched = true;

    if (match.index > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    }

    const value = typeof match[3] === 'string' ? match[3] : '';
    const typeLabel = `${String(match[1]).toUpperCase()}:${String(match[2])}`;
    const token = document.createElement('button');
    token.type = 'button';
    token.className = 'pii-token';
    token.textContent = value;
    token.title = `${typeLabel} (click to reveal)`;
    token.addEventListener('click', () => {
      token.classList.toggle('revealed');
    });
    container.appendChild(token);

    cursor = tagRegex.lastIndex;
  }

  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }

  if (!matched) {
    container.textContent = text;
  }
}

function buildTranscriptCopyFromUtterances(utterances) {
  const lines = [];

  for (const utterance of utterances) {
    if (!utterance || typeof utterance !== 'object') continue;

    const text = stripSignalTags(typeof utterance.text === 'string' ? utterance.text : '').trim();
    if (!text) continue;

    const speakerRaw = utterance.speaker ?? utterance.speaker_id ?? utterance.speakerId;
    const speaker = speakerRaw !== undefined && speakerRaw !== null ? toSpeakerLabel(speakerRaw) : '';
    const ts = formatTimestampMs(utterance.start_ms);
    const prefixParts = [ts, speaker].filter(Boolean);
    const prefix = prefixParts.length ? `${prefixParts.join(' ')} ` : '';
    lines.push(`${prefix}${text}`);
  }

  return lines.join('\n');
}

function renderUtterancePreview(utterances) {
  previewOutputEl.textContent = '';
  const list = document.createElement('div');
  list.className = 'speaker-preview';

  for (const utterance of utterances) {
    if (!utterance || typeof utterance !== 'object') continue;

    const rawText = typeof utterance.text === 'string' ? utterance.text : '';
    const text = stripSignalTags(rawText).trim();
    if (!text) continue;

    const row = document.createElement('div');
    row.className = 'speaker-turn';
    if (typeof utterance.start_ms === 'number') {
      row.dataset.startMs = utterance.start_ms;
      row.addEventListener('click', () => {
        audioPlayerEl.currentTime = utterance.start_ms / 1000;
        if (audioPlayerEl.paused) audioPlayerEl.play();
      });
    }
    if (typeof utterance.start_ms === 'number' && typeof utterance.duration_ms === 'number') {
      row.dataset.endMs = utterance.start_ms + utterance.duration_ms;
    }
    const meta = document.createElement('div');
    meta.className = 'utterance-meta';

    const ts = formatTimestampMs(utterance.start_ms);
    if (ts) {
      const timeEl = document.createElement('span');
      timeEl.className = 'utterance-time';
      timeEl.textContent = ts;
      meta.appendChild(timeEl);
    }

    const speakerRaw = utterance.speaker ?? utterance.speaker_id ?? utterance.speakerId;
    if (speakerRaw !== undefined && speakerRaw !== null && String(speakerRaw).trim()) {
      const chip = document.createElement('span');
      chip.className = 'speaker-chip';
      chip.textContent = toSpeakerLabel(speakerRaw);
      meta.appendChild(chip);
    }

    if (typeof utterance.emotion === 'string' && utterance.emotion.trim()) {
      const name = utterance.emotion.trim();
      const color = emotionColor(name);
      const emotionEl = document.createElement('span');
      if (color) {
        emotionEl.className = 'signal-pill emotion';
        emotionEl.style.background = color + '28';
        emotionEl.style.color = color;
      } else {
        emotionEl.className = 'signal-pill neutral';
      }
      emotionEl.textContent = name;
      meta.appendChild(emotionEl);
    }

    if (typeof utterance.language === 'string' && utterance.language.trim()) {
      const langEl = document.createElement('span');
      langEl.className = 'signal-pill neutral';
      langEl.textContent = langCodeToName(utterance.language.trim());
      meta.appendChild(langEl);
    }

    if (typeof utterance.accent === 'string' && utterance.accent.trim()) {
      const accentEl = document.createElement('span');
      accentEl.className = 'signal-pill neutral';
      accentEl.textContent = utterance.accent.trim() + ' accent';
      meta.appendChild(accentEl);
    }

    const bubble = document.createElement('p');
    bubble.className = 'speaker-bubble';
    renderTranscriptTextWithMaskedTags(bubble, rawText);

    if (meta.childNodes.length) row.appendChild(meta);
    row.appendChild(bubble);
    list.appendChild(row);
  }

  previewOutputEl.appendChild(list);
}

function updatePreview(payload) {
  if (payload?.status === 'processing') {
    latestPreviewText = '';
    // Don't reset the animation if the processing indicator is already showing
    if (previewOutputEl.querySelector('.processing-progress, .preview-processing')) return;
    if (progressEstimatedMs) {
      const totalS = progressEstimatedMs / 1000;
      const roundedS = Math.max(5, Math.round(totalS / 5) * 5);
      const label = roundedS >= 60
        ? `About ${Math.round(roundedS / 60)} min to process`
        : `About ${roundedS}s to process`;
      previewOutputEl.innerHTML =
        `<div class="processing-progress">` +
        `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="animation-duration:${totalS.toFixed(1)}s"></div></div>` +
        `<div class="processing-progress-label">${label}</div>` +
        `</div>`;
    } else {
      previewOutputEl.innerHTML =
        '<span class="preview-processing">Processing<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>';
    }
    return;
  }

  const utterances = Array.isArray(payload?.result?.utterances) ? payload.result.utterances : [];

  if (utterances.length) {
    latestPreviewText = buildTranscriptCopyFromUtterances(utterances);
    renderUtterancePreview(utterances);
    return;
  }

  const transcriptText = extractTranscriptText(payload);

  latestPreviewText = transcriptText;
  if (transcriptText) {
    previewOutputEl.textContent = transcriptText;
  } else {
    previewOutputEl.innerHTML = payload?.success ? 'No transcript returned.' : '<span class="empty-hint">Drop a file above to transcribe it.</span>';
  }
}

function setActiveTab(tabName) {
  const isPreview = tabName === 'preview';

  tabPreviewEl.classList.toggle('active', isPreview);
  tabJsonEl.classList.toggle('active', !isPreview);
  copyPreviewBtnEl.hidden = !isPreview;
  copyJsonBtnEl.hidden = isPreview;
  if (toggleViewBtnEl) toggleViewBtnEl.textContent = isPreview ? 'Show API Response' : 'Show Transcript';

  for (const button of tabButtons) {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('active', active);
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* fall through to execCommand */ }
  }

  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = text;
  tempTextArea.style.position = 'fixed';
  tempTextArea.style.opacity = '0';
  document.body.appendChild(tempTextArea);
  tempTextArea.focus();
  tempTextArea.select();
  const ok = document.execCommand('copy');
  tempTextArea.remove();
  if (!ok) throw new Error('copy failed');
}

function showAudioPlayer(file) {
  if (audioObjectUrl) {
    URL.revokeObjectURL(audioObjectUrl);
  }
  audioObjectUrl = URL.createObjectURL(file);
  audioPlayerEl.src = audioObjectUrl;
  audioPlayerWrapEl.hidden = false;
}

function getAudioDurationMs(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : null);
    });
    audio.addEventListener('error', () => { cleanup(); resolve(null); });
    audio.src = url;
  });
}

async function showPreEstimate(file) {
  const modelKey = modelEl.value;
  const config = MODEL_CONFIG[modelKey];
  if (!config || config.ratePerHourUsd === null) return;
  const durationMs = await getAudioDurationMs(file);
  if (durationMs === null) return;
  const estimatedUsd = (durationMs / 3600000) * config.ratePerHourUsd;
  metaCostEl.textContent = `~$${estimatedUsd.toFixed(6)} USD (est.)`;
  metaCostEl.classList.add('cost-estimate');
}

function deriveClientFileType(file) {
  if (!file) return '—';

  if (file.type) return file.type;

  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  return ext ? `.${ext}` : 'unknown';
}

function toFixedNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function findFirstNumericValueByKey(input, keys) {
  const queue = [input];
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (normalizedKeys.has(key.toLowerCase()) && typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return null;
}

function findFirstStringValueByKey(input, keys) {
  const queue = [input];
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (normalizedKeys.has(key.toLowerCase()) && typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return null;
}

function extractTokenUsage(resultData) {
  if (!resultData || typeof resultData !== 'object') return null;

  const inputTokens = findFirstNumericValueByKey(resultData, ['input_tokens', 'prompt_tokens', 'inputTokens', 'promptTokens']);
  const outputTokens = findFirstNumericValueByKey(resultData, [
    'output_tokens',
    'completion_tokens',
    'outputTokens',
    'completionTokens',
  ]);
  const totalTokens = findFirstNumericValueByKey(resultData, [
    'total_tokens',
    'token_count',
    'tokens',
    'totalTokens',
    'tokenCount',
  ]);

  if (inputTokens === null && outputTokens === null && totalTokens === null) return null;
  return { inputTokens, outputTokens, totalTokens };
}

function extractTranscriptMeta(resultData) {
  if (!resultData || typeof resultData !== 'object') {
    return {
      requestId: null,
      transcriptChars: null,
      transcriptWords: null,
      utteranceCount: null,
      speakerCount: null,
      languageCount: null,
      languages: [],
    };
  }

  const utterances = Array.isArray(resultData.utterances) ? resultData.utterances : [];
  let transcriptText = typeof resultData.text === 'string' ? resultData.text.trim() : '';

  if (!transcriptText && utterances.length) {
    transcriptText = utterances
      .map((utterance) => (typeof utterance?.text === 'string' ? utterance.text.trim() : ''))
      .filter(Boolean)
      .join(' ');
  }

  const transcriptChars = transcriptText ? transcriptText.length : null;
  const transcriptWords = transcriptText ? transcriptText.split(/\s+/).filter(Boolean).length : null;
  const speakers = new Set();
  const languages = new Set();

  for (const utterance of utterances) {
    if (!utterance || typeof utterance !== 'object') continue;

    if (utterance.speaker !== undefined && utterance.speaker !== null && String(utterance.speaker).trim()) {
      speakers.add(String(utterance.speaker).trim());
    }

    if (typeof utterance.language === 'string' && utterance.language.trim()) {
      languages.add(utterance.language.trim());
    }
  }

  const requestId = findFirstStringValueByKey(resultData, ['request_id', 'requestId', 'transcription_id', 'transcriptionId']);

  return {
    requestId,
    transcriptChars,
    transcriptWords,
    utteranceCount: utterances.length || null,
    speakerCount: speakers.size || null,
    languageCount: languages.size || null,
    languages: Array.from(languages),
  };
}

function getStreamingDurationFromUtterances(utterances) {
  if (!Array.isArray(utterances) || !utterances.length) return null;

  let maxEndMs = 0;
  for (const utterance of utterances) {
    if (!utterance || typeof utterance !== 'object') continue;
    const startMs = typeof utterance.start_ms === 'number' ? utterance.start_ms : null;
    const durationMs = typeof utterance.duration_ms === 'number' ? utterance.duration_ms : null;
    if (startMs === null || durationMs === null) continue;
    maxEndMs = Math.max(maxEndMs, startMs + durationMs);
  }

  return maxEndMs > 0 ? maxEndMs : null;
}

function normalizeApiResponse({ modelKey, file, options, config, statusCode, statusText, parsed, rawText, processingMs, ok }) {
  const durationMs =
    typeof parsed?.duration_ms === 'number'
      ? parsed.duration_ms
      : findFirstNumericValueByKey(parsed, ['duration_ms', 'audio_duration_ms', 'durationMs']);
  const audioMinutes = durationMs !== null && durationMs !== undefined ? toFixedNumber(durationMs / 60000, 3) : null;
  const transcriptMeta = extractTranscriptMeta(parsed);
  const tokens = extractTokenUsage(parsed);
  const ratePerHourUsd = typeof config.ratePerHourUsd === 'number' ? config.ratePerHourUsd : null;
  const ratePerMinuteUsd = ratePerHourUsd !== null ? ratePerHourUsd / 60 : null;
  const estimatedUsd =
    durationMs !== null && durationMs !== undefined && ratePerMinuteUsd !== null
      ? Number(((durationMs / 60000) * ratePerMinuteUsd).toFixed(6))
      : null;

  const payload = {
    success: !!ok,
    failure: !ok,
    model: modelKey,
    modelFullName: config.fullName,
    options: {
      ...options,
      appliedByModel: modelKey !== 'batch-fast',
    },
    meta: {
      fileName: file?.name || 'upload.audio',
      fileMimeType: file?.type || null,
      fileSizeBytes: typeof file?.size === 'number' ? file.size : null,
      fileSizeMb: typeof file?.size === 'number' ? toFixedNumber(file.size / (1024 * 1024), 3) : null,
      responseBytes: typeof rawText === 'string' ? rawText.length : null,
      audioDurationMs: durationMs ?? null,
      audioMinutes,
      requestId: transcriptMeta.requestId,
      transcriptChars: transcriptMeta.transcriptChars,
      transcriptWords: transcriptMeta.transcriptWords,
      utteranceCount: transcriptMeta.utteranceCount,
      speakerCount: transcriptMeta.speakerCount,
      languageCount: transcriptMeta.languageCount,
      languages: transcriptMeta.languages,
    },
    speed: {
      processingMs,
      audioDurationMs: durationMs ?? null,
      realtimeFactor: durationMs && durationMs > 0 ? Number((processingMs / durationMs).toFixed(3)) : null,
    },
    cost: {
      currency: 'USD',
      ratePerHourUsd,
      ratePerMinuteUsd,
      estimatedUsd,
      estimatedFromAudioDuration: durationMs !== null && durationMs !== undefined,
      tokens,
    },
    api: {
      baseUrl: config.mode === 'streaming' ? API_WS_BASE_URL : API_BASE_URL,
      endpoint: config.endpoint,
      statusCode,
      statusText,
    },
    result: parsed,
  };

  if (!ok) {
    payload.error = {
      type: statusCode ? `HTTP ${statusCode}` : 'Request Failure',
      message: 'Modulate API request failed.',
      detail: parsed,
    };
  }

  return payload;
}

async function readMessageDataAsText(data) {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (data instanceof Blob) {
    return await data.text();
  }
  return String(data ?? '');
}

async function requestBatchTranscription({ file, options, config }) {
  const formData = new FormData();
  formData.append('upload_file', file, file.name || 'upload.audio');

  if (config.mode !== 'streaming' && config.endpoint !== '/api/velma-2-stt-batch-english-vfast') {
    formData.append('speaker_diarization', String(options.speaker_diarization));
    formData.append('emotion_signal', String(options.emotion_signal));
    formData.append('accent_signal', String(options.accent_signal));
    formData.append('pii_phi_tagging', String(options.pii_phi_tagging));
  }

  const response = await fetch(`${API_BASE_URL}${config.endpoint}`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: formData,
  });

  const rawText = await response.text();
  let parsed = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { raw: rawText };
  }

  return {
    ok: response.ok,
    statusCode: response.status,
    statusText: response.statusText,
    parsed,
    rawText,
  };
}

async function requestStreamingTranscription({ file, options, config }) {
  const audioBuffer = new Uint8Array(await file.arrayBuffer());

  const params = new URLSearchParams({
    api_key: API_KEY,
    speaker_diarization: String(options.speaker_diarization),
    emotion_signal: String(options.emotion_signal),
    accent_signal: String(options.accent_signal),
    pii_phi_tagging: String(options.pii_phi_tagging),
  });

  const wsUrl = `${API_WS_BASE_URL}${config.endpoint}?${params.toString()}`;

  return await new Promise((resolve, reject) => {
    let opened = false;
    let settled = false;
    let streamError = null;
    let doneDurationMs = null;
    const utterances = [];

    const ws = new WebSocket(wsUrl);

    const settleResolve = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };
    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    ws.addEventListener('open', () => {
      opened = true;
      const chunkSize = 32 * 1024;
      for (let offset = 0; offset < audioBuffer.length; offset += chunkSize) {
        ws.send(audioBuffer.slice(offset, offset + chunkSize));
      }
      ws.send('');
    });

    ws.addEventListener('message', async (event) => {
      let payloadText = '';
      try {
        payloadText = await readMessageDataAsText(event.data);
      } catch {
        return;
      }

      if (!payloadText) return;
      let payload;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        return;
      }

      if (payload?.type === 'utterance' && payload.utterance && typeof payload.utterance === 'object') {
        utterances.push(payload.utterance);
      } else if (payload?.type === 'done' && typeof payload.duration_ms === 'number') {
        doneDurationMs = payload.duration_ms;
      } else if (payload?.type === 'error') {
        streamError = typeof payload.error === 'string' ? payload.error : 'Streaming transcription error';
      }
    });

    ws.addEventListener('error', () => {
      settleReject(new Error('Streaming WebSocket connection error'));
    });

    ws.addEventListener('close', (event) => {
      if (settled) return;

      if (!opened) {
        const reason = event.reason ? ` ${event.reason}` : '';
        settleReject(new Error(`Streaming connection rejected (${event.code})${reason}`));
        return;
      }

      if (streamError) {
        settleReject(new Error(streamError));
        return;
      }

      if (event.code !== 1000 && event.code !== 1005) {
        const reason = event.reason ? ` ${event.reason}` : '';
        settleReject(new Error(`Streaming connection closed unexpectedly (${event.code})${reason}`));
        return;
      }

      const durationMs = doneDurationMs ?? getStreamingDurationFromUtterances(utterances);
      const parsed = {
        text: utterances
          .map((utterance) => (typeof utterance?.text === 'string' ? utterance.text.trim() : ''))
          .filter(Boolean)
          .join(' '),
        duration_ms: durationMs,
        utterances,
      };
      const rawText = JSON.stringify(parsed);

      settleResolve({
        ok: true,
        statusCode: 200,
        statusText: 'OK',
        parsed,
        rawText,
      });
    });
  });
}

function isStreamingModel(modelKey = modelEl.value) {
  return modelKey === 'streaming';
}

function stopMediaTracks() {
  if (!mediaStream) return;
  for (const track of mediaStream.getTracks()) {
    track.stop();
  }
  mediaStream = null;
}

function clearRecordingTimer() {
  if (recordingTimerId) {
    clearInterval(recordingTimerId);
    recordingTimerId = null;
  }
}

function startRecordingTimer() {
  clearRecordingTimer();
  recordingStartedAt = Date.now();
  recordingTimerId = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - recordingStartedAt) / 1000);
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(elapsedSec % 60).padStart(2, '0');
    recordStatusEl.textContent = `Recording ${mm}:${ss}`;
  }, 200);
}

function updateRecordingUiState() {
  const isRecording = mediaRecorder?.state === 'recording';
  recordToggleBtnEl.classList.toggle('recording', !!isRecording);
  recordToggleBtnEl.textContent = isRecording ? 'Stop recording' : 'Start recording';
  if (!isRecording) {
    recordStatusEl.textContent = 'Ready to record';
  }
}

function createRecordedFileFromChunks() {
  const mimeType = mediaRecorder?.mimeType || 'audio/webm';
  const blob = new Blob(recordedChunks, { type: mimeType });
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
  return new File([blob], `mic-recording-${Date.now()}.${ext}`, { type: mimeType });
}

async function startRecording() {
  if (!isStreamingModel()) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    recordStatusEl.textContent = 'Microphone not supported';
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    const mimeType = mimeCandidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
    mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);

    recordedChunks = [];
    shouldSubmitRecording = true;

    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener('stop', () => {
      clearRecordingTimer();
      updateRecordingUiState();

      const submit = shouldSubmitRecording;
      shouldSubmitRecording = false;
      stopMediaTracks();
      mediaRecorder = null;

      if (!submit) {
        recordedChunks = [];
        return;
      }

      const recordedFile = createRecordedFileFromChunks();
      recordedChunks = [];
      if (recordedFile.size <= 0) {
        recordStatusEl.textContent = 'No audio captured';
        return;
      }
      recordStatusEl.textContent = 'Processing recording...';
      // Reset files for recording (single-file streaming flow)
      files = []; activeFileIndex = -1;
      addFiles([recordedFile]);
    });

    mediaRecorder.start(200);
    startRecordingTimer();
    updateRecordingUiState();
  } catch (error) {
    recordStatusEl.textContent = error instanceof Error ? error.message : 'Microphone permission failed';
    stopMediaTracks();
  }
}

function stopRecording(cancel = false) {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    if (cancel) {
      shouldSubmitRecording = false;
      clearRecordingTimer();
      updateRecordingUiState();
      stopMediaTracks();
    }
    return;
  }

  shouldSubmitRecording = !cancel;
  mediaRecorder.stop();
}

function updateInputWidgetForModel(modelKey) {
  const streaming = isStreamingModel(modelKey);

  recordZoneEl.hidden = !streaming;
  recordZoneEl.style.display = streaming ? 'grid' : 'none';

  if (!streaming) {
    stopRecording(true);
    recordStatusEl.textContent = 'Ready to record';
  }
}

function resetMeta(file) {
  const modelKey = modelEl.value;
  const options = getRequestedOptions();
  const supportsSignals = modelKey !== 'batch-fast';
  setStatus('Processing', 'processing');
  metaFailureTypeEl.textContent = '';
  metaFailureNameEl.textContent = '';
  rowFailureTypeEl.hidden = true;
  rowFailureNameEl.hidden = true;
  metaModelEl.textContent = toText(modelEl.selectedOptions[0]?.textContent, modelEl.value);
  metaOptionsEl.textContent = formatRequestedOptions(options, modelKey);
  metaFileNameEl.textContent = file?.name || '—';
  metaFileTypeEl.textContent = deriveClientFileType(file);
  metaFileSizeEl.textContent = formatMb(file?.size);
  metaDurationMinEl.textContent = '—';
  metaProcessingEl.textContent = '—';
  metaRtfEl.textContent = '—';
  metaHttpEl.textContent = '—';
  metaEndpointEl.textContent = '—';
  metaRequestIdEl.textContent = '—';
  metaRateEl.textContent = '—';
  metaCostEl.textContent = '—';
  metaTokensEl.textContent = '—';
  metaTranscriptCharsEl.textContent = '—';
  metaTranscriptWordsEl.textContent = '—';
  metaUtterancesEl.textContent = '—';
  metaSpeakersEl.textContent = supportsSignals && options.speaker_diarization ? '—' : 'N/A';
  metaLanguagesEl.textContent = '—';
  metaEmotionsEl.textContent = supportsSignals && options.emotion_signal ? '—' : 'N/A';
  metaAccentsEl.textContent = supportsSignals && options.accent_signal ? '—' : 'N/A';
  metaPiiTagsEl.textContent = supportsSignals && options.pii_phi_tagging ? '—' : 'N/A';
  metaResponseBytesEl.textContent = '—';
}

function updateMetaFromResponse(data, fallbackModel) {
  const processingText = formatSecondsFromMs(data?.speed?.processingMs);
  const factor = formatProcessingFactor(data);
  const modelKey = data?.model || fallbackModel;
  const isUnsupported = (field) => UNSUPPORTED_BY_MODEL[modelKey]?.has(field);
  const options = data?.options || getRequestedOptions();
  const diarizationEnabled = !isUnsupported('speakers') && !!options.speaker_diarization;
  const emotionEnabled = !isUnsupported('emotions') && !!options.emotion_signal;
  const accentEnabled = !isUnsupported('accents') && !!options.accent_signal;
  const piiEnabled = !isUnsupported('pii_tags') && !!options.pii_phi_tagging;

  if (data?.success) {
    setStatus(`SUCCESS (${processingText})`, 'ok');
  } else {
    setStatus(`FAILURE (${processingText})`, 'fail');
  }
  const failureInfo = getFailureInfo(data);
  const hasFailure = failureInfo.type && failureInfo.type !== 'N/A';
  metaFailureTypeEl.textContent = hasFailure ? failureInfo.type : '';
  metaFailureNameEl.textContent = hasFailure ? failureInfo.name : '';
  rowFailureTypeEl.hidden = !hasFailure;
  rowFailureNameEl.hidden = !hasFailure;

  metaModelEl.textContent = toText(data?.modelFullName, toText(data?.model, fallbackModel));
  metaOptionsEl.textContent = isUnsupported('options') ? 'N/A' : formatRequestedOptions(options, modelKey);
  metaFileNameEl.textContent = toText(data?.meta?.fileName);
  metaFileTypeEl.textContent = toText(data?.meta?.fileMimeType, metaFileTypeEl.textContent || '—');
  metaFileSizeEl.textContent = typeof data?.meta?.fileSizeBytes === 'number' ? formatMb(data.meta.fileSizeBytes) : '—';
  metaDurationMinEl.textContent = formatMinutes(data?.meta?.audioMinutes);

  metaProcessingEl.textContent = processingText;
  metaRtfEl.textContent = factor;

  const httpParts = [];
  if (data?.api?.statusCode !== null && data?.api?.statusCode !== undefined && data.api.statusCode !== '') {
    httpParts.push(String(data.api.statusCode));
  }
  if (typeof data?.api?.statusText === 'string' && data.api.statusText.trim()) {
    httpParts.push(data.api.statusText.trim());
  }
  metaHttpEl.textContent = httpParts.length ? httpParts.join(' ') : '—';
  metaEndpointEl.textContent = toText(data?.api?.endpoint);
  metaRequestIdEl.textContent = toText(data?.meta?.requestId);

  metaRateEl.textContent = formatRate(data?.cost);
  metaCostEl.textContent = formatCost(data?.cost);
  metaCostEl.classList.remove('cost-estimate');
  metaTokensEl.textContent = formatTokens(data?.cost?.tokens);

  metaTranscriptCharsEl.textContent = formatCount(data?.meta?.transcriptChars, 'chars');
  metaTranscriptWordsEl.textContent = formatCount(data?.meta?.transcriptWords, 'words');
  metaUtterancesEl.textContent = isUnsupported('utterances')
    ? 'N/A'
    : formatCount(data?.meta?.utteranceCount, 'utterances') === '—'
      ? 'N/A'
      : formatCount(data?.meta?.utteranceCount, 'utterances');
  metaSpeakersEl.textContent = !diarizationEnabled
    ? 'N/A'
    : formatCount(data?.meta?.speakerCount, 'speakers') === '—'
      ? 'N/A'
      : formatCount(data?.meta?.speakerCount, 'speakers');

  if (isUnsupported('languages')) {
    metaLanguagesEl.textContent = 'N/A';
  } else if (Array.isArray(data?.meta?.languages) && data.meta.languages.length) {
    metaLanguagesEl.textContent = `${data.meta.languages.join(', ')} (${INT_FMT.format(data.meta.languages.length)} langs)`;
  } else if (typeof data?.meta?.languageCount === 'number') {
    metaLanguagesEl.textContent = formatCount(data.meta.languageCount, 'languages');
  } else {
    metaLanguagesEl.textContent = 'N/A';
  }

  const signalStats = collectSignalStats(data?.result);
  metaEmotionsEl.textContent = emotionEnabled ? formatSignalMap(signalStats.emotions) : 'N/A';
  metaAccentsEl.textContent = accentEnabled ? formatSignalMap(signalStats.accents) : 'N/A';
  metaPiiTagsEl.textContent = !piiEnabled
    ? 'N/A'
    : typeof signalStats.piiTagCount === 'number'
      ? `${INT_FMT.format(signalStats.piiTagCount)} tags`
      : 'N/A';

  metaResponseBytesEl.textContent = formatResponseBytes(data?.meta?.responseBytes);

  if (metaRequestIdEl.textContent === '—' || !metaRequestIdEl.textContent) {
    metaRequestIdEl.textContent = 'N/A';
  }
  if (metaTokensEl.textContent === '—') {
    metaTokensEl.textContent = 'N/A';
  }
  if (metaTranscriptCharsEl.textContent === '—') {
    metaTranscriptCharsEl.textContent = 'N/A';
  }
  if (metaTranscriptWordsEl.textContent === '—') {
    metaTranscriptWordsEl.textContent = 'N/A';
  }
}


modelEl.addEventListener('change', () => {
  updateInputWidgetForModel(modelEl.value);
  updateFeatureControlsForModel(modelEl.value);
  metaModelEl.textContent = toText(modelEl.selectedOptions[0]?.textContent, modelEl.value);
  metaOptionsEl.textContent = formatRequestedOptions(getRequestedOptions(), modelEl.value);
});

for (const optInput of optionInputs) {
  optInput.addEventListener('change', () => {
    metaOptionsEl.textContent = formatRequestedOptions(getRequestedOptions(), modelEl.value);
  });
}

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    setActiveTab(button.dataset.tab || 'preview');
  });
}

if (toggleViewBtnEl) {
  toggleViewBtnEl.addEventListener('click', () => {
    setActiveTab(tabJsonEl.classList.contains('active') ? 'preview' : 'json');
  });
}

fileEl.addEventListener('change', () => {
  if (!fileEl.files?.length) return;
  addFiles(fileEl.files);
});

panelChooseBtnEl.addEventListener('click', (event) => {
  event.stopPropagation();
  fileEl.click();
});

panelNewUploadEl.addEventListener('click', () => {
  fileEl.click();
});

panelNewUploadEl.addEventListener('dragover', (event) => {
  event.preventDefault();
  panelNewUploadEl.classList.add('drag');
});

panelNewUploadEl.addEventListener('dragleave', () => {
  panelNewUploadEl.classList.remove('drag');
});

panelNewUploadEl.addEventListener('drop', (event) => {
  event.preventDefault();
  panelNewUploadEl.classList.remove('drag');
  const droppedFiles = event.dataTransfer?.files;
  if (!droppedFiles?.length) return;
  addFiles(droppedFiles);
});

recordToggleBtnEl.addEventListener('click', () => {
  if (!isStreamingModel()) return;
  if (mediaRecorder?.state === 'recording') {
    stopRecording(false);
    return;
  }
  void startRecording();
});

copyJsonBtnEl.addEventListener('click', async () => {
  try {
    const jsonText = JSON.stringify(latestPayload ?? {}, null, 2);
    await copyTextToClipboard(jsonText);
    const previousText = copyJsonBtnEl.textContent;
    copyJsonBtnEl.textContent = 'Copied';
    setTimeout(() => {
      copyJsonBtnEl.textContent = previousText || 'Copy json';
    }, 1200);
  } catch {
    copyJsonBtnEl.textContent = 'Copy failed';
    setTimeout(() => {
      copyJsonBtnEl.textContent = 'Copy json';
    }, 1200);
  }
});

copyPreviewBtnEl.addEventListener('click', async () => {
  if (!latestPreviewText) return;
  const saved = copyPreviewBtnEl.textContent;
  try {
    await copyTextToClipboard(latestPreviewText);
    copyPreviewBtnEl.textContent = 'Copied';
    setTimeout(() => { copyPreviewBtnEl.textContent = saved; }, 1200);
  } catch {
    copyPreviewBtnEl.textContent = 'Copy failed';
    setTimeout(() => { copyPreviewBtnEl.textContent = saved; }, 1200);
  }
});

audioPlayerEl.addEventListener('timeupdate', () => {
  const currentMs = audioPlayerEl.currentTime * 1000;
  const turns = Array.from(previewOutputEl.querySelectorAll('.speaker-turn[data-start-ms]'));
  // Keep the last utterance that has already started (sticky during silence)
  let newActive = null;
  for (const turn of turns) {
    if (Number(turn.dataset.startMs) <= currentMs) newActive = turn;
  }
  for (const turn of turns) {
    turn.classList.toggle('active-utterance', turn === newActive);
  }
  if (newActive && newActive !== activeUtteranceEl) {
    activeUtteranceEl = newActive;
    if (autoscrollEl.checked) {
      newActive.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});



const themeToggleEl = document.getElementById('theme-toggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleEl.querySelector('.icon-moon').style.display = theme === 'light' ? '' : 'none';
  themeToggleEl.querySelector('.icon-sun').style.display = theme === 'dark' ? '' : 'none';
  localStorage.setItem('demo-theme', theme);
}
themeToggleEl.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
applyTheme(localStorage.getItem('demo-theme') || 'light');

setActiveTab('preview');
updateInputWidgetForModel(modelEl.value);
updateFeatureControlsForModel(modelEl.value);
metaModelEl.textContent = toText(modelEl.selectedOptions[0]?.textContent, modelEl.value);
metaOptionsEl.textContent = formatRequestedOptions(getRequestedOptions(), modelEl.value);
renderJson({});
renderFileTabs();

