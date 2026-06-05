import { renderCohortFocusSvg, type CohortLabels, type VisualCohort } from './cohorting';

export interface OpenAiModelInfo {
  id: string;
}

export interface AiCohortLabelRequest {
  apiKey: string;
  model: string;
  sourceSvg: string;
  cohort: VisualCohort;
  labels: CohortLabels;
  chartKind: string;
  specText: string;
  signal?: AbortSignal;
}

function parseSvgSize(svgText: string) {
  const fallback = { width: 1100, height: 760 };
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    const widthAttr = Number.parseFloat(svg.getAttribute('width') || '');
    const heightAttr = Number.parseFloat(svg.getAttribute('height') || '');
    const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : viewBox && viewBox.length === 4 ? viewBox[2] : fallback.width;
    const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : viewBox && viewBox.length === 4 ? viewBox[3] : fallback.height;
    return {
      width: Math.max(320, Math.min(1800, Math.round(width))),
      height: Math.max(240, Math.min(1400, Math.round(height)))
    };
  } catch {
    return fallback;
  }
}

export async function svgToPngDataUrl(svgText: string): Promise<string> {
  const { width, height } = parseSvgSize(svgText);
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not rasterize the cohort thumbnail for AI labeling.'));
    });
    image.src = url;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable in this browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fetchOpenAiModels(apiKey: string, signal?: AbortSignal): Promise<OpenAiModelInfo[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal
  });
  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`Could not load OpenAI models (${response.status}). ${message}`.trim());
  }
  const data = await response.json();
  const ids = Array.isArray(data?.data) ? data.data.map((model: any) => String(model.id || '')).filter(Boolean) : [];
  const preferred = ids
    .filter((id: string) => /^(gpt|o\d)/i.test(id) && !/audio|realtime|transcribe|tts|image|embedding|moderation/i.test(id))
    .sort((a: string, b: string) => a.localeCompare(b));
  return (preferred.length ? preferred : ids.sort((a: string, b: string) => a.localeCompare(b))).map((id: string) => ({ id }));
}

function extractResponseText(data: any): string {
  if (typeof data?.output_text === 'string') return data.output_text;
  const fragments: string[] = [];
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') fragments.push(content.text);
      if (typeof content?.output_text === 'string') fragments.push(content.output_text);
    }
  }
  return fragments.join('\n').trim();
}

function cleanLabel(value: string, cohort: VisualCohort) {
  const firstLine = value
    .replace(/^```(?:json|text)?/i, '')
    .replace(/```$/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
  const noQuotes = firstLine.replace(/^[-*\d.)\s]+/, '').replace(/^['"]|['"]$/g, '').trim();
  return (noQuotes || cohort.suggestedRole || cohort.title).slice(0, 90);
}


export function inferLocalCohortLabel(cohort: VisualCohort): string {
  const fields = [cohort.suggestedRole, cohort.title, cohort.type, cohort.evidence]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const joined = fields.join(' ').toLowerCase();

  const normalize = (value: string) => value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cohort.type === 'title') return 'chart title';
  if (cohort.type === 'axis-title') return joined.includes('y axis') || joined.includes('y-axis') ? 'y-axis title' : joined.includes('x axis') || joined.includes('x-axis') ? 'x-axis title' : 'axis title';
  if (cohort.type === 'axis-labels') return joined.includes('y axis') || joined.includes('y-axis') ? 'y-axis tick labels' : joined.includes('x axis') || joined.includes('x-axis') ? 'x-axis tick labels' : 'axis tick labels';
  if (cohort.type === 'axis-ticks') return joined.includes('y axis') || joined.includes('y-axis') ? 'y-axis tick marks' : joined.includes('x axis') || joined.includes('x-axis') ? 'x-axis tick marks' : 'axis tick marks';
  if (cohort.type === 'axis-gridlines') return joined.includes('y axis') || joined.includes('y-axis') ? 'y-axis gridlines' : joined.includes('x axis') || joined.includes('x-axis') ? 'x-axis gridlines' : 'axis gridlines';
  if (cohort.type === 'axis-domain') return joined.includes('y axis') || joined.includes('y-axis') ? 'y-axis domain line' : joined.includes('x axis') || joined.includes('x-axis') ? 'x-axis domain line' : 'axis domain line';
  if (cohort.type === 'legend-symbols') return 'legend symbols';
  if (cohort.type === 'legend-labels') return 'legend labels';
  if (cohort.type === 'legend-title') return 'legend title';
  if (cohort.type === 'text-label') {
    if (joined.includes('node')) return 'graph node labels';
    return 'text labels';
  }
  if (cohort.type === 'data-mark') {
    if (joined.includes('node')) return 'graph nodes';
    if (joined.includes('link') || joined.includes('edge')) return 'graph links';
    if (joined.includes('bar') || joined.includes('rect')) return 'data bars';
    if (joined.includes('point') || joined.includes('symbol') || joined.includes('circle')) return 'data points';
    if (joined.includes('line')) return 'data lines';
    if (joined.includes('area')) return 'data areas';
    return 'data marks';
  }

  const candidate = fields.find(Boolean) || 'visual elements';
  return cleanLabel(normalize(candidate), cohort);
}

function isLikelyTransientOpenAiError(error: unknown): boolean {
  if ((error as Error)?.name === 'AbortError') return false;
  const message = error instanceof Error ? error.message : String(error || '');
  return /failed to fetch|networkerror|cors|err_failed|timeout|temporar|rate|429|500|502|503|504/i.test(message);
}

async function delay(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function labelCohortWithOpenAiResilient(request: AiCohortLabelRequest, attempts = 2): Promise<{ label: string; source: 'openai' | 'local-fallback'; warning?: string }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      const label = await labelCohortWithOpenAi(request);
      return { label, source: 'openai' };
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      lastError = error;
      if (!isLikelyTransientOpenAiError(error) || attempt >= attempts) break;
      await delay(550 * attempt, request.signal);
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError || 'OpenAI request failed');
  return { label: inferLocalCohortLabel(request.cohort), source: 'local-fallback', warning: message };
}

export async function labelCohortWithOpenAi(request: AiCohortLabelRequest): Promise<string> {
  const focusSvg = renderCohortFocusSvg(request.sourceSvg, request.cohort, request.labels);
  const imageUrl = await svgToPngDataUrl(focusSvg);
  const prompt = [
    'You are labeling a semantic cohort in a Vega/Vega-Lite visualization.',
    'In the image, the target cohort is shown in blue while the rest of the visualization is faded for context.',
    'Return exactly one concise, human-readable label for the blue elements.',
    'The label should capture the specific visualization role, not just the SVG tag. Prefer labels such as “x-axis tick labels”, “y-axis gridlines”, “legend symbols for category”, “data points for cars”, “chart title”, or “bars encoding sales”.',
    'Do not return explanations, numbering, JSON, quotes, or punctuation-only output.',
    '',
    `Chart kind: ${request.chartKind}`,
    `Cohort title: ${request.cohort.title}`,
    `Cohort type: ${request.cohort.type}`,
    `Compiler suggestion: ${request.cohort.suggestedRole}`,
    `Compiler evidence: ${request.cohort.evidence}`,
    `Element count: ${request.cohort.count}`,
    `Spec excerpt: ${request.specText.slice(0, 4000)}`
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: request.model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl, detail: 'high' }
          ]
        }
      ],
      max_output_tokens: 80
    }),
    signal: request.signal
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`OpenAI labeling failed for ${request.cohort.title} (${response.status}). ${message}`.trim());
  }
  const data = await response.json();
  return cleanLabel(extractResponseText(data), request.cohort);
}
