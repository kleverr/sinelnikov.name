const modelEl = document.getElementById('model');
const fileEl = document.getElementById('file');
const chooseBtnEl = document.getElementById('choose-btn');
const dropZoneEl = document.getElementById('drop-zone');
const outputEl = document.getElementById('output');
const previewOutputEl = document.getElementById('preview-output');
const copyPreviewBtnEl = document.getElementById('copy-preview');
const copyJsonBtnEl = document.getElementById('copy-json');
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

const API_BASE_URL = 'https://modulate-developer-apis.com';
const API_KEY = '30b0ea76-da9d-424f-9fd7-423bc74a1184';

const MODEL_CONFIG = {
  'batch-fast': {
    fullName: 'velma-2-stt-batch-english-vfast',
    endpoint: '/api/velma-2-stt-batch-english-vfast',
    ratePerHourUsd: 0.025,
    unsupported: new Set(['utterances', 'speakers', 'languages', 'emotions', 'accents', 'pii_tags', 'options']),
  },
  batch: {
    fullName: 'velma-2-stt-batch',
    endpoint: '/api/velma-2-stt-batch',
    ratePerHourUsd: 0.03,
    unsupported: new Set(),
  },
};

let latestPayload = null;
let latestPreviewText = '';

const INT_FMT = new Intl.NumberFormat('en-US');
const DEC3_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const DEC2_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEC1_FMT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const BATCH_ONLY_TOOLTIP = 'Available in Batch model.';

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

function formatDurationMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '-';
  return `${INT_FMT.format(Math.round(ms))} ms`;
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
    return `x${formatAdaptive(fasterMultiplier)} faster`;
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
  const supportsOptions = modelKey === 'batch';

  for (const input of optionInputs) {
    input.disabled = !supportsOptions;
    const label = input.closest('.feature-item');
    if (label) {
      label.classList.toggle('disabled', !supportsOptions);
      label.title = supportsOptions ? '' : BATCH_ONLY_TOOLTIP;
    }
  }

  if (featureNoteEl) featureNoteEl.textContent = '';
}

function formatRequestedOptions(options, modelKey) {
  if (modelKey !== 'batch') return 'N/A';

  const opts = options || getRequestedOptions();
  return [
    `diarization: ${opts.speaker_diarization ? 'on' : 'off'}`,
    `emotion: ${opts.emotion_signal ? 'on' : 'off'}`,
    `accent: ${opts.accent_signal ? 'on' : 'off'}`,
    `pii/phi: ${opts.pii_phi_tagging ? 'on' : 'off'}`,
  ].join(' | ');
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
      const emotionEl = document.createElement('span');
      emotionEl.className = 'signal-pill emotion';
      emotionEl.textContent = utterance.emotion.trim();
      meta.appendChild(emotionEl);
    }

    if (typeof utterance.accent === 'string' && utterance.accent.trim()) {
      const accentEl = document.createElement('span');
      accentEl.className = 'signal-pill accent';
      accentEl.textContent = utterance.accent.trim();
      meta.appendChild(accentEl);
    }

    if (typeof utterance.language === 'string' && utterance.language.trim()) {
      const langEl = document.createElement('span');
      langEl.className = 'signal-pill language';
      langEl.textContent = utterance.language.trim();
      meta.appendChild(langEl);
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
    previewOutputEl.innerHTML =
      '<span class="preview-processing">Processing<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>';
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
    previewOutputEl.textContent = payload?.success ? 'No transcript returned.' : 'No transcript yet.';
  }
}

function setActiveTab(tabName) {
  const isPreview = tabName === 'preview';

  tabPreviewEl.classList.toggle('active', isPreview);
  tabJsonEl.classList.toggle('active', !isPreview);
  copyPreviewBtnEl.hidden = !isPreview;
  copyJsonBtnEl.hidden = isPreview;

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

function normalizeApiResponse({ modelKey, file, options, response, parsed, rawText, processingMs }) {
  const cfg = MODEL_CONFIG[modelKey] || MODEL_CONFIG.batch;
  const durationMs =
    typeof parsed?.duration_ms === 'number'
      ? parsed.duration_ms
      : findFirstNumericValueByKey(parsed, ['duration_ms', 'audio_duration_ms', 'durationMs']);

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

  const transcriptText = typeof parsed?.text === 'string' ? parsed.text : null;
  const transcriptChars = transcriptText ? transcriptText.length : null;
  const transcriptWords = transcriptText ? transcriptText.trim().split(/\s+/).filter(Boolean).length : null;

  const requestId = findFirstStringValueByKey(parsed, ['request_id', 'requestId', 'transcription_id', 'transcriptionId']);
  const tokens = extractTokenUsage(parsed);

  const ratePerHourUsd = cfg.ratePerHourUsd;
  const estimatedUsd =
    typeof durationMs === 'number' && durationMs > 0 ? Number(((durationMs / 3600000) * ratePerHourUsd).toFixed(6)) : null;

  const payload = {
    success: response.ok,
    failure: !response.ok,
    model: modelKey,
    modelFullName: cfg.fullName,
    options: {
      ...options,
      appliedByModel: modelKey === 'batch',
    },
    meta: {
      fileName: file.name,
      fileMimeType: file.type || null,
      fileSizeBytes: file.size,
      fileSizeMb: file.size / (1024 * 1024),
      responseBytes: rawText.length,
      audioDurationMs: typeof durationMs === 'number' ? durationMs : null,
      audioMinutes: typeof durationMs === 'number' ? durationMs / 60000 : null,
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
      estimatedUsd,
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
      type: `HTTP ${response.status}`,
      message: 'Modulate API request failed.',
      detail: parsed,
    };
  }

  return payload;
}

function resetMeta(file) {
  const modelKey = modelEl.value;
  const options = getRequestedOptions();
  setStatus('Processing', 'processing');
  metaFailureTypeEl.textContent = 'N/A';
  metaFailureNameEl.textContent = 'N/A';
  metaModelEl.textContent = toText(modelEl.selectedOptions[0]?.textContent, modelEl.value);
  metaOptionsEl.textContent = formatRequestedOptions(options, modelKey);
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
  metaSpeakersEl.textContent = modelKey === 'batch' && options.speaker_diarization ? '-' : 'N/A';
  metaLanguagesEl.textContent = '-';
  metaEmotionsEl.textContent = modelKey === 'batch' && options.emotion_signal ? '-' : 'N/A';
  metaAccentsEl.textContent = modelKey === 'batch' && options.accent_signal ? '-' : 'N/A';
  metaPiiTagsEl.textContent = modelKey === 'batch' && options.pii_phi_tagging ? '-' : 'N/A';
  metaResponseBytesEl.textContent = '-';
}

function updateMetaFromResponse(data, fallbackModel) {
  const processingText = formatSecondsFromMs(data?.speed?.processingMs);
  const factor = formatProcessingFactor(data);
  const modelKey = data?.model || fallbackModel;
  const cfg = MODEL_CONFIG[modelKey] || MODEL_CONFIG.batch;
  const isUnsupported = (field) => cfg.unsupported?.has(field);
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
  metaFailureTypeEl.textContent = failureInfo.type;
  metaFailureNameEl.textContent = failureInfo.name;

  metaModelEl.textContent = toText(data?.modelFullName, toText(data?.model, fallbackModel));
  metaOptionsEl.textContent = isUnsupported('options') ? 'N/A' : formatRequestedOptions(options, modelKey);
  metaFileNameEl.textContent = toText(data?.meta?.fileName, '-');
  metaFileTypeEl.textContent = toText(data?.meta?.fileMimeType, metaFileTypeEl.textContent || '-');
  metaFileSizeEl.textContent = typeof data?.meta?.fileSizeBytes === 'number' ? formatMb(data.meta.fileSizeBytes) : '-';
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
  metaHttpEl.textContent = httpParts.length ? httpParts.join(' ') : '-';
  metaEndpointEl.textContent = toText(data?.api?.endpoint);
  metaRequestIdEl.textContent = toText(data?.meta?.requestId);

  metaRateEl.textContent = formatRate(data?.cost);
  metaCostEl.textContent = formatCost(data?.cost);
  metaTokensEl.textContent = formatTokens(data?.cost?.tokens);

  metaTranscriptCharsEl.textContent = formatCount(data?.meta?.transcriptChars, 'chars');
  metaTranscriptWordsEl.textContent = formatCount(data?.meta?.transcriptWords, 'words');
  metaUtterancesEl.textContent = isUnsupported('utterances')
    ? 'N/A'
    : formatCount(data?.meta?.utteranceCount, 'utterances') === '-'
      ? 'N/A'
      : formatCount(data?.meta?.utteranceCount, 'utterances');
  metaSpeakersEl.textContent = !diarizationEnabled
    ? 'N/A'
    : formatCount(data?.meta?.speakerCount, 'speakers') === '-'
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

  if (metaRequestIdEl.textContent === '-' || !metaRequestIdEl.textContent) {
    metaRequestIdEl.textContent = 'N/A';
  }
  if (metaTokensEl.textContent === '-') {
    metaTokensEl.textContent = 'N/A';
  }
  if (metaTranscriptCharsEl.textContent === '-') {
    metaTranscriptCharsEl.textContent = 'N/A';
  }
  if (metaTranscriptWordsEl.textContent === '-') {
    metaTranscriptWordsEl.textContent = 'N/A';
  }
}

async function runWithFile(file) {
  if (!file) return;

  const model = modelEl.value;
  const options = getRequestedOptions();
  const cfg = MODEL_CONFIG[model] || MODEL_CONFIG.batch;
  const startedAt = Date.now();
  const formData = new FormData();
  formData.append('upload_file', file, file.name);
  if (model === 'batch') {
    formData.append('speaker_diarization', String(options.speaker_diarization));
    formData.append('emotion_signal', String(options.emotion_signal));
    formData.append('accent_signal', String(options.accent_signal));
    formData.append('pii_phi_tagging', String(options.pii_phi_tagging));
  }

  resetMeta(file);

  const pendingPayload = {
    status: 'processing',
    file: { name: file.name, size: file.size, type: file.type },
    model,
    options,
  };
  renderJson(pendingPayload);

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

    const processingMs = Date.now() - startedAt;
    const payload = normalizeApiResponse({ modelKey: model, file, options, response, parsed, rawText: raw, processingMs });
    renderJson(payload);
    updateMetaFromResponse(payload, model);
  } catch (error) {
    const processingMs = Date.now() - startedAt;
    const payload = {
      success: false,
      failure: true,
      model,
      modelFullName: cfg.fullName,
      options: {
        ...options,
        appliedByModel: model === 'batch',
      },
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
        type: 'Network Error',
        message: error instanceof Error ? error.message : String(error),
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

modelEl.addEventListener('change', () => {
  updateFeatureControlsForModel(modelEl.value);
  metaModelEl.textContent = toText(modelEl.selectedOptions[0]?.textContent, modelEl.value);
  metaOptionsEl.textContent = formatRequestedOptions(getRequestedOptions(), modelEl.value);
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
  try {
    await copyTextToClipboard(latestPreviewText);
    const previousText = copyPreviewBtnEl.textContent;
    copyPreviewBtnEl.textContent = 'Copied';
    setTimeout(() => {
      copyPreviewBtnEl.textContent = previousText || 'Copy transcript';
    }, 1200);
  } catch {
    copyPreviewBtnEl.textContent = 'Copy failed';
    setTimeout(() => {
      copyPreviewBtnEl.textContent = 'Copy transcript';
    }, 1200);
  }
});

setActiveTab('preview');
updateFeatureControlsForModel(modelEl.value);
metaOptionsEl.textContent = formatRequestedOptions(getRequestedOptions(), modelEl.value);
renderJson({});
