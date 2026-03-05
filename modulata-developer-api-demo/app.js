const API_BASE_URL = 'https://modulate-developer-apis.com';
const API_KEY = '30b0ea76-da9d-424f-9fd7-423bc74a1184';

const MODEL_CONFIG = {
  'batch-fast': {
    fullName: 'velma-2-stt-batch-english-vfast',
    endpoint: '/api/velma-2-stt-batch-english-vfast',
    ratePerHourUsd: 0.025,
    unsupported: new Set(['utterances', 'speakers', 'languages']),
  },
  batch: {
    fullName: 'velma-2-stt-batch',
    endpoint: '/api/velma-2-stt-batch',
    ratePerHourUsd: 0.03,
    unsupported: new Set(),
  },
};

const modelEl = document.getElementById('model');
const fileEl = document.getElementById('file');
const chooseBtnEl = document.getElementById('choose-btn');
const dropZoneEl = document.getElementById('drop-zone');
const outputEl = document.getElementById('output');
const previewOutputEl = document.getElementById('preview-output');
const copyPreviewBtnEl = document.getElementById('copy-preview');
const downloadBtnEl = document.getElementById('download-json');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPreviewEl = document.getElementById('tab-preview');
const tabJsonEl = document.getElementById('tab-json');

const metaStatusEl = document.getElementById('meta-status');
const metaModelEl = document.getElementById('meta-model');
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
const metaResponseBytesEl = document.getElementById('meta-response-bytes');

let latestPayload = null;
let latestPreviewText = '';

const INT_FMT = new Intl.NumberFormat('en-US');
const DEC3_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const DEC2_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEC1_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function toText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function formatCount(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${INT_FMT.format(value)} ${unit}`;
}

function formatMb(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '-';
  return `${DEC3_FMT.format(bytes / (1024 * 1024))} MB`;
}

function formatResponseBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${INT_FMT.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${DEC2_FMT.format(bytes / 1024)} KB`;
  return `${DEC2_FMT.format(bytes / (1024 * 1024))} MB`;
}

function formatSecondsFromMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '-';
  return `${DEC1_FMT.format(ms / 1000)} s`;
}

function formatMinutes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
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
    return `x${formatAdaptive(fasterMultiplier)} faster`;
  }

  const slowerMultiplier = processingSecondsForFactor / durationSecondsForFactor;
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
  if (!cost) return '-';

  if (typeof cost.ratePerHourUsd === 'number' && cost.ratePerHourUsd > 0) {
    return `$${cost.ratePerHourUsd}/hour`;
  }

  return 'N/A';
}

function formatCost(cost) {
  if (!cost) return '-';

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
  downloadBtnEl.disabled = false;
  updatePreview(payload);
}

function extractTranscriptText(payload) {
  const result = payload?.result;

  if (result && typeof result.text === 'string' && result.text.trim()) {
    return result.text.trim();
  }

  if (result && Array.isArray(result.utterances) && result.utterances.length) {
    const lines = result.utterances
      .map((utterance) => (utterance && typeof utterance.text === 'string' ? utterance.text.trim() : ''))
      .filter(Boolean);

    if (lines.length) return lines.join('\n');
  }

  return '';
}

function updatePreview(payload) {
  const transcriptText = extractTranscriptText(payload);

  latestPreviewText = transcriptText;
  if (transcriptText) {
    previewOutputEl.textContent = transcriptText;
    copyPreviewBtnEl.disabled = false;
  } else {
    previewOutputEl.textContent = payload?.success ? 'No transcript returned.' : 'No transcript yet.';
    copyPreviewBtnEl.disabled = true;
  }
}

function setActiveTab(tabName) {
  const isPreview = tabName === 'preview';

  tabPreviewEl.classList.toggle('active', isPreview);
  tabJsonEl.classList.toggle('active', !isPreview);

  for (const button of tabButtons) {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('active', active);
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = text;
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  document.execCommand('copy');
  tempTextArea.remove();
}

function deriveClientFileType(file) {
  if (!file) return '-';

  if (file.type) return file.type;

  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  return ext ? `.${ext}` : 'unknown';
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
  const outputTokens = findFirstNumericValueByKey(resultData, ['output_tokens', 'completion_tokens', 'outputTokens', 'completionTokens']);
  const totalTokens = findFirstNumericValueByKey(resultData, ['total_tokens', 'token_count', 'tokens', 'totalTokens', 'tokenCount']);

  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function normalizeResponse({ modelKey, file, response, parsed, rawText, processingMs }) {
  const cfg = MODEL_CONFIG[modelKey];

  const durationMs =
    typeof parsed?.duration_ms === 'number'
      ? parsed.duration_ms
      : findFirstNumericValueByKey(parsed, ['duration_ms', 'audio_duration_ms', 'durationMs']);

  const audioMinutes = typeof durationMs === 'number' ? durationMs / 60000 : null;
  const ratePerHourUsd = cfg.ratePerHourUsd;
  const estimatedUsd = typeof durationMs === 'number' ? (durationMs / 3600000) * ratePerHourUsd : null;

  const transcriptText = typeof parsed?.text === 'string' ? parsed.text : null;
  const transcriptChars = transcriptText ? transcriptText.length : null;
  const transcriptWords = transcriptText ? transcriptText.trim().split(/\s+/).filter(Boolean).length : null;

  const utterances = Array.isArray(parsed?.utterances) ? parsed.utterances : [];
  const speakers = new Set();
  const languages = new Set();

  for (const utterance of utterances) {
    if (!utterance || typeof utterance !== 'object') continue;

    if (utterance.speaker !== undefined && utterance.speaker !== null) {
      speakers.add(String(utterance.speaker));
    }

    if (typeof utterance.language === 'string' && utterance.language.trim()) {
      languages.add(utterance.language.trim());
    }
  }

  const requestId = findFirstStringValueByKey(parsed, ['request_id', 'requestId', 'transcription_id', 'transcriptionId']);
  const tokens = extractTokenUsage(parsed);

  const payload = {
    success: response.ok,
    failure: !response.ok,
    model: modelKey,
    modelFullName: cfg.fullName,
    meta: {
      fileName: file.name,
      fileMimeType: file.type || null,
      fileSizeBytes: file.size,
      fileSizeMb: file.size / (1024 * 1024),
      responseBytes: rawText.length,
      audioDurationMs: typeof durationMs === 'number' ? durationMs : null,
      audioMinutes: typeof audioMinutes === 'number' ? audioMinutes : null,
      requestId,
      transcriptChars,
      transcriptWords,
      utteranceCount: utterances.length || null,
      speakerCount: speakers.size || null,
      languageCount: languages.size || null,
      languages: Array.from(languages),
    },
    speed: {
      processingMs,
      audioDurationMs: typeof durationMs === 'number' ? durationMs : null,
      realtimeFactor: typeof durationMs === 'number' && durationMs > 0 ? processingMs / durationMs : null,
    },
    cost: {
      currency: 'USD',
      ratePerHourUsd,
      ratePerMinuteUsd: ratePerHourUsd / 60,
      estimatedUsd: typeof estimatedUsd === 'number' ? Number(estimatedUsd.toFixed(6)) : null,
      estimatedFromAudioDuration: typeof durationMs === 'number',
      tokens,
    },
    api: {
      baseUrl: API_BASE_URL,
      endpoint: cfg.endpoint,
      statusCode: response.status,
      statusText: response.statusText,
    },
    result: parsed,
  };

  if (!response.ok) {
    payload.error = {
      message: typeof parsed?.detail === 'string' ? parsed.detail : 'Modulate API request failed.',
      detail: parsed,
    };
  }

  return payload;
}

function resetMeta(file) {
  setStatus('Processing', 'processing');
  metaModelEl.textContent = toText(modelEl.selectedOptions[0]?.textContent, modelEl.value);
  metaFileNameEl.textContent = file?.name || '-';
  metaFileTypeEl.textContent = deriveClientFileType(file);
  metaFileSizeEl.textContent = formatMb(file?.size);
  metaDurationMinEl.textContent = '-';
  metaProcessingEl.textContent = '-';
  metaRtfEl.textContent = '-';
  metaHttpEl.textContent = '-';
  metaEndpointEl.textContent = '-';
  metaRequestIdEl.textContent = '-';
  metaRateEl.textContent = '-';
  metaCostEl.textContent = '-';
  metaTokensEl.textContent = '-';
  metaTranscriptCharsEl.textContent = '-';
  metaTranscriptWordsEl.textContent = '-';
  metaUtterancesEl.textContent = '-';
  metaSpeakersEl.textContent = '-';
  metaLanguagesEl.textContent = '-';
  metaResponseBytesEl.textContent = '-';
}

function updateMetaFromResponse(data, fallbackModel) {
  const processingText = formatSecondsFromMs(data?.speed?.processingMs);
  const factor = formatProcessingFactor(data);

  if (data?.success) {
    setStatus(`SUCCESS (${processingText})`, 'ok');
  } else {
    setStatus(`FAILURE (${processingText})`, 'fail');
  }

  const modelKey = data?.model || fallbackModel;
  const cfg = MODEL_CONFIG[modelKey] || MODEL_CONFIG.batch;
  const isUnsupported = (field) => cfg.unsupported?.has(field);

  metaModelEl.textContent = toText(data?.modelFullName, toText(data?.model, fallbackModel));
  metaFileNameEl.textContent = toText(data?.meta?.fileName, '-');
  metaFileTypeEl.textContent = toText(data?.meta?.fileMimeType, metaFileTypeEl.textContent || '-');
  metaFileSizeEl.textContent = typeof data?.meta?.fileSizeBytes === 'number' ? formatMb(data.meta.fileSizeBytes) : '-';
  metaDurationMinEl.textContent = formatMinutes(data?.meta?.audioMinutes);

  metaProcessingEl.textContent = processingText;
  metaRtfEl.textContent = factor;

  metaHttpEl.textContent = `${toText(data?.api?.statusCode)} ${toText(data?.api?.statusText, '')}`.trim();
  metaEndpointEl.textContent = toText(data?.api?.endpoint);
  metaRequestIdEl.textContent = toText(data?.meta?.requestId, 'N/A');

  metaRateEl.textContent = formatRate(data?.cost);
  metaCostEl.textContent = formatCost(data?.cost);
  metaTokensEl.textContent = formatTokens(data?.cost?.tokens);

  metaTranscriptCharsEl.textContent = formatCount(data?.meta?.transcriptChars, 'chars') === '-' ? 'N/A' : formatCount(data?.meta?.transcriptChars, 'chars');
  metaTranscriptWordsEl.textContent = formatCount(data?.meta?.transcriptWords, 'words') === '-' ? 'N/A' : formatCount(data?.meta?.transcriptWords, 'words');

  const utteranceText = formatCount(data?.meta?.utteranceCount, 'utterances');
  const speakerText = formatCount(data?.meta?.speakerCount, 'speakers');

  metaUtterancesEl.textContent = isUnsupported('utterances') ? 'N/A' : utteranceText === '-' ? 'N/A' : utteranceText;
  metaSpeakersEl.textContent = isUnsupported('speakers') ? 'N/A' : speakerText === '-' ? 'N/A' : speakerText;

  if (isUnsupported('languages')) {
    metaLanguagesEl.textContent = 'N/A';
  } else if (Array.isArray(data?.meta?.languages) && data.meta.languages.length) {
    metaLanguagesEl.textContent = `${data.meta.languages.join(', ')} (${INT_FMT.format(data.meta.languages.length)} langs)`;
  } else if (typeof data?.meta?.languageCount === 'number') {
    metaLanguagesEl.textContent = formatCount(data.meta.languageCount, 'languages');
  } else {
    metaLanguagesEl.textContent = 'N/A';
  }

  metaResponseBytesEl.textContent = formatResponseBytes(data?.meta?.responseBytes);
}

async function runWithFile(file) {
  if (!file) return;

  const model = modelEl.value;
  const cfg = MODEL_CONFIG[model];
  const formData = new FormData();
  formData.append('upload_file', file, file.name);

  resetMeta(file);

  const pendingPayload = {
    status: 'processing',
    model,
    endpoint: cfg.endpoint,
    file: { name: file.name, size: file.size, type: file.type },
  };
  renderJson(pendingPayload);

  const startedAt = performance.now();

  try {
    const response = await fetch(`${API_BASE_URL}${cfg.endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
      },
      body: formData,
    });

    const raw = await response.text();
    let parsed;

    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { raw };
    }

    const processingMs = performance.now() - startedAt;
    const payload = normalizeResponse({ modelKey: model, file, response, parsed, rawText: raw, processingMs });

    renderJson(payload);
    updateMetaFromResponse(payload, model);
  } catch (error) {
    const processingMs = performance.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    const payload = {
      success: false,
      failure: true,
      model,
      modelFullName: cfg.fullName,
      meta: {
        fileName: file.name,
        fileMimeType: file.type || null,
        fileSizeBytes: file.size,
        fileSizeMb: file.size / (1024 * 1024),
        responseBytes: null,
        audioDurationMs: null,
        audioMinutes: null,
        requestId: null,
        transcriptChars: null,
        transcriptWords: null,
        utteranceCount: null,
        speakerCount: null,
        languageCount: null,
        languages: [],
      },
      speed: {
        processingMs,
        audioDurationMs: null,
        realtimeFactor: null,
      },
      cost: {
        currency: 'USD',
        ratePerHourUsd: cfg.ratePerHourUsd,
        ratePerMinuteUsd: cfg.ratePerHourUsd / 60,
        estimatedUsd: null,
        estimatedFromAudioDuration: false,
        tokens: null,
      },
      api: {
        baseUrl: API_BASE_URL,
        endpoint: cfg.endpoint,
        statusCode: 0,
        statusText: 'Network Error',
      },
      error: {
        message,
        detail: 'Request may be blocked by network/CORS or invalid API key.',
      },
    };

    renderJson(payload);
    updateMetaFromResponse(payload, model);
  } finally {
    fileEl.value = '';
  }
}

chooseBtnEl.addEventListener('click', (event) => {
  event.stopPropagation();
  fileEl.click();
});

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    setActiveTab(button.dataset.tab || 'preview');
  });
}

dropZoneEl.addEventListener('click', () => {
  fileEl.click();
});

fileEl.addEventListener('change', () => {
  const file = fileEl.files?.[0];
  void runWithFile(file);
});

dropZoneEl.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZoneEl.classList.add('drag');
});

dropZoneEl.addEventListener('dragleave', () => {
  dropZoneEl.classList.remove('drag');
});

dropZoneEl.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZoneEl.classList.remove('drag');

  const file = event.dataTransfer?.files?.[0];
  void runWithFile(file);
});

downloadBtnEl.addEventListener('click', () => {
  if (!latestPayload) return;

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const model = toText(latestPayload?.model, 'unknown-model');
  const filename = `modulate-${model}-${stamp}.json`;

  const blob = new Blob([JSON.stringify(latestPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

copyPreviewBtnEl.addEventListener('click', async () => {
  if (!latestPreviewText) return;

  try {
    await copyTextToClipboard(latestPreviewText);
    const previousText = copyPreviewBtnEl.textContent;
    copyPreviewBtnEl.textContent = 'Copied';
    setTimeout(() => {
      copyPreviewBtnEl.textContent = previousText || 'Copy text';
    }, 1200);
  } catch {
    copyPreviewBtnEl.textContent = 'Copy failed';
    setTimeout(() => {
      copyPreviewBtnEl.textContent = 'Copy text';
    }, 1200);
  }
});

setActiveTab('preview');
renderJson({});
