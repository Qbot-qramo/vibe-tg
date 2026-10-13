// AI Chat: an in-browser LLM (WebLLM) writes LOGO programs, which are checked, put into the editor and run.
import { checkProgram, applyProgram, selectView } from './blocks.js';
import { WEBLLM_URL } from './webllm.js';

const SETTINGS_KEY = 'vibe-tg-chat-settings';

// VRAM figures come from WebLLM 0.2.85's prebuilt model list.
const MODELS = [
  { id: 'Qwen3.5-4B-q4f16_1-MLC', label: 'Qwen3.5 4B', vram: 3.9 },
  { id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B', vram: 3.4 },
  { id: 'Phi-4-mini-instruct-q4f16_1-MLC', label: 'Phi-4-mini 3.8B', vram: 3.4 },
  { id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC', label: 'Qwen2.5-Coder 3B', vram: 2.5 },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B', vram: 2.3 },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', label: 'Qwen3.5 2B', vram: 2.2 },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B', vram: 2.0 },
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', label: 'Qwen3.5 0.8B', vram: 1.6 },
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B', vram: 1.4 }
];

const DEFAULT_SYSTEM_PROMPT = `You write programs for a small LOGO turtle-graphics interpreter.
Reply with one short Japanese sentence, then exactly one code block:
\`\`\`logo
(program)
\`\`\`

The interpreter understands only these commands. Anything else is an error.
- fd N / bk N: move forward / back N steps
- rt N / lt N: turn right (clockwise) / left N degrees
- setheading N: face a direction (0 = up, 90 = right, 180 = down, 270 = left)
- home: go to the center and face up
- pu / pd: pen up (move without drawing) / pen down
- setpc C: pen color, setbg C: background color, setpensize N: line width
- cs: clear the screen and go home
- label "TEXT: write TEXT. The text runs to the end of the line, so label must be the last command on its line.
- setlabelheight N: text size
- repeat N [ commands ]
- if A < B [ commands ] and if A > B [ commands ]
- wait N: wait N/100 seconds
- to NAME :a :b ... end: define a procedure, then call it as NAME 10 20. stop leaves the current procedure.

Rules:
- Numbers are whole numbers 0 or greater. No decimals and no negative numbers: use lt instead of rt -90, bk instead of fd -10.
- Arithmetic: + - * / and ( ). :name reads a parameter, and only inside the procedure that declares it.
- Names use English letters only.
- There are no comments, no variables (make), no setxy or setpos, no arc or circle commands.
- Colors: 0 black, 1 blue, 2 green, 3 cyan, 4 red, 5 magenta, 6 yellow, 7 white, 8 brown, 9 tan, 10 dark green, 11 aqua, 12 salmon, 13 purple, 14 orange, 15 grey.
- The turtle starts at the center facing up. The canvas reaches about 270 steps from the center in every direction.

How to draw well:
- Before every move, work out where the turtle is and which way it faces.
- Move to the start of each part with pu, moves, then pd.
- Circle: repeat 36 [fd S rt 10] draws a circle about 11 * S wide on the right side of the turtle.
- Regular polygon with N sides: repeat N [fd S rt 360 / N].

Example request: 星を描いて
星を描きます。
\`\`\`logo
cs
setpc 14
setpensize 3
pu fd 60 lt 90 fd 100 rt 180 pd
repeat 5 [fd 200 rt 144]
pu home pd
\`\`\`

Example request: 木を描いて
茶色の幹と緑の丸い葉の木を描きます。
\`\`\`logo
to rect :w :h
  repeat 2 [fd :h rt 90 fd :w rt 90]
end
to circle :step
  repeat 36 [fd :step rt 10]
end
cs
setpensize 3
pu bk 150 lt 90 fd 20 rt 90 pd
setpc 8
rect 40 100
pu fd 100 rt 90 fd 20 pd
setpc 2
rt 180
circle 10
pu home pd
\`\`\``;

// Mirrors what js/blocks.js can convert, so constrained output is always syntactically valid.
// It keeps the reply shape the system prompt asks for (one sentence, then a fenced block): forcing models to start
// straight with code made them spill the sentence into the program as bogus procedure calls.
const FENCE = '```';
const LOGO_GRAMMAR = [
  `root ::= intro "${FENCE}logo\\n" program "\\n${FENCE}"`,
  'intro ::= [^\\n`]{0,80} "\\n"',
  'program ::= item ("\\n"+ item)*',
  'item ::= procdef | line',
  'procdef ::= "to " name params "\\n" ("  "? line "\\n")* "end"',
  'params ::= (" :" name)*',
  'line ::= statements (" " label)? | label',
  'label ::= "label \\"" [^\\n]*',
  'statements ::= statement (" " statement)*',
  'statement ::= command1 " " expr | command0 | "repeat " expr " [" statements "]"' +
    ' | "if " expr " " ("<" | ">") " " expr " [" statements "]" | name (" " expr)*',
  'command1 ::= "fd" | "bk" | "rt" | "lt" | "setheading" | "setpc" | "setpensize" | "setbg" | "setlabelheight" | "wait"',
  'command0 ::= "pu" | "pd" | "home" | "cs" | "clean" | "ht" | "st" | "stop"',
  'expr ::= term (" "? ("+" | "-") " "? term)*',
  'term ::= factor (" "? ("*" | "/") " "? factor)*',
  'factor ::= number | ":" name | "(" expr ")"',
  'number ::= "0" | [1-9] [0-9]? [0-9]?',
  'name ::= [a-z]+'
].join('\n');

const DEFAULT_SETTINGS = {
  model: 'Qwen3-4B-q4f16_1-MLC',
  temperature: 0.3,
  maxRetries: 2,
  maxTokens: 1024,
  grammar: false,
  includeCode: true,
  autoRun: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT
};

const SUGGESTIONS = ['家を描いて', '花を描いて', '雪だるまを描いて', '六角形を色を変えながら回転させて描いて'];

const $ = id => document.getElementById(id);
const editor = $('logo-editor');
const log = $('chat-log');
const input = $('chat-input');
const sendButton = $('chat-send');
const loadButton = $('chat-load');
const modelStatus = $('chat-model-status');
const progress = $('chat-progress');
const progressBar = $('chat-progress-bar');
const progressText = $('chat-progress-text');
const dialog = $('chat-settings');

let settings = loadSettings();
let engine = null;
let loadedModel = null;
let loading = false;
let generating = false;
let interrupted = false;

// ---------- Settings ----------

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    if (!MODELS.some(model => model.id === merged.model)) merged.model = DEFAULT_SETTINGS.model;
    return merged;
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* storage unavailable */ }
}

function modelInfo(id) {
  return MODELS.find(model => model.id === id);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

async function markCachedModels() {
  try {
    const webllm = await import(WEBLLM_URL);
    for (const option of $('setting-model').options) {
      const cached = await webllm.hasModelInCache(option.value);
      const info = modelInfo(option.value);
      option.textContent = `${info.label}（VRAM 約${info.vram}GB）${cached ? '・保存済み' : ''}`;
    }
  } catch (_) { /* the labels just stay without the cached mark */ }
}

async function deleteSelectedModel() {
  const id = $('setting-model').value;
  if (!confirm(`${modelInfo(id).label} の保存データを削除しますか？次に使うときは再ダウンロードが必要です。`)) return;
  const webllm = await import(WEBLLM_URL);
  await webllm.deleteModelAllInfoInCache(id);
  await markCachedModels();
}

function openSettings() {
  $('setting-model').replaceChildren(...MODELS.map(model =>
    new Option(`${model.label}（VRAM 約${model.vram}GB）`, model.id, false, model.id === settings.model)));
  markCachedModels();
  $('setting-temperature').value = settings.temperature;
  $('setting-retries').value = settings.maxRetries;
  $('setting-max-tokens').value = settings.maxTokens;
  $('setting-grammar').checked = settings.grammar;
  $('setting-include-code').checked = settings.includeCode;
  $('setting-auto-run').checked = settings.autoRun;
  $('setting-system-prompt').value = settings.systemPrompt;
  dialog.showModal();
}

function setupSettings() {
  $('chat-settings-open').addEventListener('click', openSettings);
  $('chat-settings-cancel').addEventListener('click', () => dialog.close());
  $('setting-delete-model').addEventListener('click', deleteSelectedModel);
  $('setting-reset-prompt').addEventListener('click', () => { $('setting-system-prompt').value = DEFAULT_SYSTEM_PROMPT; });
  $('chat-settings-form').addEventListener('submit', () => {
    settings = {
      model: $('setting-model').value,
      temperature: clampNumber($('setting-temperature').value, 0, 1.5, DEFAULT_SETTINGS.temperature),
      maxRetries: Math.round(clampNumber($('setting-retries').value, 0, 5, DEFAULT_SETTINGS.maxRetries)),
      maxTokens: Math.round(clampNumber($('setting-max-tokens').value, 256, 2048, DEFAULT_SETTINGS.maxTokens)),
      grammar: $('setting-grammar').checked,
      includeCode: $('setting-include-code').checked,
      autoRun: $('setting-auto-run').checked,
      systemPrompt: $('setting-system-prompt').value.trim() || DEFAULT_SYSTEM_PROMPT
    };
    saveSettings();
    updateUi();
  });
}

// ---------- UI ----------

function updateUi() {
  const info = modelInfo(settings.model);
  const ready = engine && loadedModel === settings.model;
  if (loading) modelStatus.textContent = `${info.label} を読み込み中…`;
  else if (ready) modelStatus.textContent = `${info.label}：準備完了`;
  else modelStatus.textContent = `${info.label}：未読み込み（VRAM 約${info.vram}GB）`;
  loadButton.hidden = Boolean(ready);
  loadButton.disabled = loading || generating || !navigator.gpu;
  loadButton.textContent = loadedModel ? 'このモデルに切り替える' : 'モデルを読み込む';
  input.disabled = !ready || loading;
  sendButton.disabled = !ready || loading || (!generating && !input.value.trim());
  sendButton.textContent = generating ? '中止' : '送信';
  sendButton.classList.toggle('is-stop', generating);
}

function scrollLog() {
  log.scrollTop = log.scrollHeight;
}

function addMessage(role, text) {
  const element = document.createElement('div');
  element.className = `chat-msg ${role}`;
  element.textContent = text;
  log.append(element);
  scrollLog();
  return element;
}

function addNote(text, kind = '') {
  const element = document.createElement('p');
  element.className = `chat-note ${kind}`.trim();
  element.textContent = text;
  log.append(element);
  scrollLog();
  return element;
}

function addActions(actions) {
  const row = document.createElement('div');
  row.className = 'chat-actions';
  actions.forEach(({ label, onClick }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    row.append(button);
  });
  log.append(row);
  scrollLog();
}

function showSuggestions() {
  const row = document.createElement('div');
  row.className = 'chat-suggestions';
  SUGGESTIONS.forEach(text => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-chip';
    button.textContent = text;
    button.addEventListener('click', () => {
      input.value = text;
      updateUi();
      if (!sendButton.disabled) submit();
      else input.focus();
    });
    row.append(button);
  });
  addNote('描きたいものを伝えてください。初回はモデルのダウンロード（数GB）に時間がかかります。');
  log.append(row);
}

// ---------- Model ----------

async function loadModel() {
  if (!navigator.gpu) return;
  loading = true;
  progress.hidden = false;
  progressBar.value = 0;
  progressText.textContent = '準備中…';
  updateUi();
  const onProgress = report => {
    progressBar.value = report.progress;
    progressText.textContent = `${Math.round(report.progress * 100)}% ${report.text}`;
  };
  try {
    const webllm = await import(WEBLLM_URL);
    if (!engine) {
      const worker = new Worker(new URL('./llm-worker.js', import.meta.url), { type: 'module' });
      engine = await webllm.CreateWebWorkerMLCEngine(worker, settings.model, { initProgressCallback: onProgress });
    } else {
      engine.setInitProgressCallback(onProgress);
      await engine.reload(settings.model);
    }
    loadedModel = settings.model;
    addNote(`${modelInfo(loadedModel).label} の準備ができました。`);
    progress.hidden = true;
  } catch (error) {
    console.error(error);
    loadedModel = null;
    progressText.textContent = '';
    progress.hidden = true;
    const message = String(error.message ?? error);
    const storageHint = /Cache|Quota/i.test(message)
      ? ' ブラウザーの保存容量が足りない可能性があります。⚙設定で使わないモデルの保存データを削除してから、もう一度読み込んでください。'
      : '';
    addNote(`モデルを読み込めませんでした：${message}${storageHint}`, 'error');
  } finally {
    loading = false;
    updateUi();
    if (loadedModel) input.focus();
  }
}

function visibleText(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '').trim();
}

async function generate(messages, bubble, attempt) {
  const isQwen = /^Qwen3/.test(loadedModel);
  const request = {
    messages,
    stream: true,
    // At a low temperature a retry tends to reproduce the same broken program, so loosen it a little each time.
    temperature: Math.min(1, settings.temperature + attempt * 0.3),
    max_tokens: settings.maxTokens,
    ...(isQwen ? { extra_body: { enable_thinking: false } } : {}),
    ...(settings.grammar ? { response_format: { type: 'grammar', grammar: LOGO_GRAMMAR } } : {})
  };
  let text = '';
  const chunks = await engine.chat.completions.create(request);
  for await (const chunk of chunks) {
    text += chunk.choices[0]?.delta?.content ?? '';
    bubble.textContent = visibleText(text) || '…';
    scrollLog();
  }
  return visibleText(text);
}

// ---------- Requests ----------

function extractCode(reply) {
  const fenced = [...reply.matchAll(/```[A-Za-z]*[ \t]*\n?([\s\S]*?)```/g)];
  let code = reply;
  if (fenced.length) code = fenced.at(-1)[1];
  else if (reply.includes('```')) code = reply.slice(reply.indexOf('```')).replace(/^```[A-Za-z]*/, '');
  return code.split('\n')
    .map(line => (/\blabel\s+"/i.test(line) ? line : line.replace(/;.*$/, '')).replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

function currentProgram() {
  // Only an English program can be shown to the model, since the prompt teaches English commands.
  if (!settings.includeCode || interpreter.locale !== i18n.English) return '';
  return editor.value.trim();
}

function buildUserMessage(request) {
  const program = currentProgram();
  if (!program) return request;
  return `現在のプログラム:\n\`\`\`logo\n${program}\n\`\`\`\n\n依頼: ${request}\n（今の絵を変える依頼なら現在のプログラムを直し、新しい絵の依頼なら新しく書いてください。）`;
}

function onSuccess(code) {
  const applied = applyProgram(code);
  const actions = [
    { label: 'ブロックで見る', onClick: () => selectView('blocks') },
    { label: 'コードで見る', onClick: () => selectView('text') }
  ];
  if (settings.autoRun) {
    interpreter.run();
    addNote('✓ ブロックに変換して実行しました。');
  } else {
    actions.unshift({ label: '実行', onClick: () => interpreter.run() });
    addNote('✓ ブロックに変換しました。');
  }
  addActions(actions);
  return applied;
}

function onFailure(code, error) {
  addNote(`エラーが残りました：${error}`, 'error');
  addActions([{
    label: 'コードタブで直す',
    onClick: () => { editor.value = code; selectView('text'); }
  }]);
}

async function handleRequest(request) {
  generating = true;
  interrupted = false;
  updateUi();
  addMessage('user', request);
  const base = [{ role: 'system', content: settings.systemPrompt }, { role: 'user', content: buildUserMessage(request) }];
  let messages = base;
  try {
    for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
      const bubble = addMessage('assistant', '…');
      const reply = await generate(messages, bubble, attempt);
      if (interrupted) return;
      const code = extractCode(reply);
      const error = checkProgram(code);
      if (!error) {
        onSuccess(code);
        return;
      }
      if (attempt === settings.maxRetries) {
        onFailure(code, error);
        return;
      }
      addNote(`エラー：${error} → AIに修正を頼みます（${attempt + 1}/${settings.maxRetries}）`, 'warn');
      messages = [
        ...base,
        { role: 'assistant', content: `\`\`\`logo\n${code}\n\`\`\`` },
        { role: 'user', content: `That program has an error: ${error}\nFix it. Use only the commands in the rules, and reply with the complete corrected program in one code block.` }
      ];
    }
  } catch (error) {
    console.error(error);
    addNote(`生成中にエラーが起きました：${error.message ?? error}`, 'error');
  } finally {
    generating = false;
    updateUi();
  }
}

function submit() {
  if (generating) {
    interrupted = true;
    engine.interruptGenerate();
    addNote('生成を中止しました。');
    return;
  }
  const request = input.value.trim();
  if (!request) return;
  input.value = '';
  handleRequest(request);
}

// ---------- Init ----------

function init() {
  setupSettings();
  loadButton.addEventListener('click', loadModel);
  $('chat-form').addEventListener('submit', event => {
    event.preventDefault();
    submit();
  });
  input.addEventListener('input', updateUi);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!sendButton.disabled) submit();
    }
  });
  showSuggestions();
  if (!navigator.gpu) {
    addNote('このブラウザーはWebGPUに対応していないため、AI Chatを使えません。Chrome または Edge の最新版で開いてください。', 'error');
  }
  updateUi();
}

init();
