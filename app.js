const els = {
  form: document.querySelector('#imageForm'),
  baseUrl: document.querySelector('#baseUrl'),
  apiKey: document.querySelector('#apiKey'),
  toggleKey: document.querySelector('#toggleKey'),
  clearKey: document.querySelector('#clearKey'),
  rememberKey: document.querySelector('#rememberKey'),
  prompt: document.querySelector('#prompt'),
  imageUrls: document.querySelector('#imageUrls'),
  imageFiles: document.querySelector('#imageFiles'),
  model: document.querySelector('#model'),
  size: document.querySelector('#size'),
  quality: document.querySelector('#quality'),
  format: document.querySelector('#format'),
  resultGrid: document.querySelector('#resultGrid'),
  rawResponse: document.querySelector('#rawResponse'),
  requestState: document.querySelector('#requestState'),
  submitBtn: document.querySelector('#submitBtn'),
};

const STORAGE = {
  baseUrl: 'gpt-image-2-base-url',
  apiKey: 'gpt-image-2-api-key',
  remember: 'gpt-image-2-remember-key',
};

const samplePrompt = '生成一张未来感产品发布会主视觉：一台半透明 AI 相机悬浮在雾面玻璃展台上，橙色和苔绿色光线交错，背景有巨大的中文标题“看见灵感”，高端科技广告，强构图，细节清晰。';

function init() {
  els.baseUrl.value = localStorage.getItem(STORAGE.baseUrl) || els.baseUrl.value;
  els.rememberKey.checked = localStorage.getItem(STORAGE.remember) === 'true';
  if (els.rememberKey.checked) els.apiKey.value = localStorage.getItem(STORAGE.apiKey) || '';
  els.prompt.value = samplePrompt;
  syncMode();
}

function getMode() {
  return new FormData(els.form).get('mode');
}

function syncMode() {
  const mode = getMode();
  document.querySelectorAll('[data-mode-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.modePanel !== mode;
  });
  els.model.value = mode === 'generate' ? 'gpt-image-2' : 'gpt-image-2-all';
  els.quality.disabled = mode === 'file-edit';
  els.format.disabled = mode === 'file-edit';
}

function endpoint(path) {
  return `${els.baseUrl.value.replace(/\/+$/, '')}${path}`;
}

function setState(text, busy = false) {
  els.requestState.textContent = text;
  els.submitBtn.disabled = busy;
  els.submitBtn.textContent = busy ? '生成中...' : '生成图片';
}

function persistSettings() {
  localStorage.setItem(STORAGE.baseUrl, els.baseUrl.value.trim());
  localStorage.setItem(STORAGE.remember, String(els.rememberKey.checked));
  if (els.rememberKey.checked) {
    localStorage.setItem(STORAGE.apiKey, els.apiKey.value.trim());
  } else {
    localStorage.removeItem(STORAGE.apiKey);
  }
}

function parseImageUrls() {
  return els.imageUrls.value
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);
}

function buildJsonPayload(mode) {
  const payload = {
    model: els.model.value,
    prompt: els.prompt.value.trim(),
    n: 1,
    size: els.size.value,
  };

  if (mode === 'generate') {
    payload.quality = els.quality.value;
    payload.format = els.format.value;
  }

  if (mode === 'url-edit') {
    const image = parseImageUrls();
    if (!image.length) throw new Error('请至少填写一个参考图片 URL。');
    payload.image = image;
  }

  return payload;
}

function buildEditFormData() {
  const files = Array.from(els.imageFiles.files || []);
  if (!files.length) throw new Error('请至少上传一张图片。');

  const data = new FormData();
  files.forEach((file) => data.append('image', file));
  data.append('prompt', els.prompt.value.trim());
  data.append('model', els.model.value);
  data.append('n', '1');
  data.append('size', els.size.value);
  return data;
}

async function requestImages(mode) {
  const key = els.apiKey.value.trim();
  if (!key) throw new Error('请填写 API Key。');
  if (!els.prompt.value.trim()) throw new Error('请填写提示词。');

  if (mode === 'file-edit') {
    const response = await fetch(endpoint('/v1/images/edits'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: buildEditFormData(),
    });
    return parseResponse(response);
  }

  const response = await fetch(endpoint('/v1/images/generations'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(buildJsonPayload(mode)),
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const message = json?.error?.message || json?.message || response.statusText || '请求失败';
    throw new Error(`${response.status} ${message}`);
  }
  return json;
}

function normalizeImages(json) {
  if (Array.isArray(json?.data)) {
    return json.data
      .map((item, index) => ({
        index,
        url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
        prompt: item.revised_prompt || item.prompt || '',
      }))
      .filter((item) => item.url);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const urls = content.match(/https?:\/\/[^\s"')]+/g) || [];
    return urls.map((url, index) => ({ index, url, prompt: '' }));
  }

  return [];
}

function renderResults(json) {
  const images = normalizeImages(json);
  els.rawResponse.textContent = JSON.stringify(json, null, 2);

  if (!images.length) {
    els.resultGrid.innerHTML = '<div class="empty-state"><span>没有识别到图片</span><p>接口已返回，但响应里没有 data.url / data.b64_json。请展开原始响应查看。</p></div>';
    return;
  }

  els.resultGrid.innerHTML = images
    .map((image) => `
      <article class="result-card">
        <img src="${escapeAttr(image.url)}" alt="GPT Image 2 生成结果 ${image.index + 1}" loading="lazy" />
        <div class="result-actions">
          <span>#${image.index + 1}</span>
          <a href="${escapeAttr(image.url)}" target="_blank" rel="noreferrer" download>打开 / 下载</a>
        </div>
      </article>
    `)
    .join('');
}

function escapeAttr(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

els.form.addEventListener('change', (event) => {
  if (event.target.name === 'mode') syncMode();
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  persistSettings();
  setState('请求中', true);
  els.rawResponse.textContent = '{}';

  try {
    const json = await requestImages(getMode());
    renderResults(json);
    setState('完成');
  } catch (error) {
    els.resultGrid.innerHTML = `<div class="empty-state"><span>生成失败</span><p>${escapeAttr(error.message)}</p></div>`;
    setState('失败');
  }
});

els.toggleKey.addEventListener('click', () => {
  const hidden = els.apiKey.type === 'password';
  els.apiKey.type = hidden ? 'text' : 'password';
  els.toggleKey.textContent = hidden ? '隐藏' : '显示';
});

els.clearKey.addEventListener('click', () => {
  els.apiKey.value = '';
  els.rememberKey.checked = false;
  localStorage.removeItem(STORAGE.apiKey);
  localStorage.setItem(STORAGE.remember, 'false');
});

document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    els.prompt.value = button.dataset.prompt;
    document.querySelector('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.querySelector('[data-fill-sample]').addEventListener('click', () => {
  els.prompt.value = samplePrompt;
  document.querySelector('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

init();
