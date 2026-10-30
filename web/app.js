import {icon, hydrateIcons} from './icons.js';
import {modules, styles, qualities, templates, stages, statusNames} from './modules.js';
import {API, readStorage, writeStorage, backendCompatibilityError} from './api.js';
import {stylePreview} from './style-preview.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults = {provider:'OpenAI 兼容',model:'gpt-4.1',base_url:'https://api.openai.com/v1',proxy:'',workers:2,api_concurrency:1,api_timeout:600,api_retries:3,max_tokens:65536,planning_max_tokens:8192,repair_max_tokens:65536,model_output_limit:0,max_continuations:2,retries:3,tts_provider:'windows',tts_speed:1,tts_base_url:'',tts_model:'',tts_voice_zh:'alloy',tts_voice_en:'alloy'};
const preferenceKeys = Object.keys(defaults);
const storedPreferences = readStorage('code2x.preferences', {});
const saved = storedPreferences && typeof storedPreferences==='object' ? storedPreferences : {};
const config = {...defaults, ...Object.fromEntries(preferenceKeys.filter(k => k in saved).map(k => [k,saved[k]])), api_key:'',tts_api_key:''};
if ('max_tokens' in saved && !('repair_max_tokens' in saved)) config.repair_max_tokens=saved.max_tokens;
const isLocal = ['127.0.0.1','localhost'].includes(location.hostname);
const api = new API(readStorage('code2x.endpoint', isLocal ? location.origin : 'http://127.0.0.1:8765'), readStorage('code2x.token','',sessionStorage));
const state = {
  view:'studio', module:'video', connected:false, health:null, config, backendError:'',
  draft:{topic:'',duration:1,quality:'快速 480p',language:'中文',narration_language:'zh-CN',burn_subtitles:true,styleId:'math',...readStorage('code2x.draft',{})},
  jobs:[], active:null, tab:'preview', logLines:[], cursor:0, previewKey:'', recentKey:'', filter:'all', query:'', submitting:false, polling:false,
};
let sourceRequest = 0;
if (!styles.some(style=>style.id===state.draft.styleId)) state.draft.styleId='math';
const terminal = job => ['completed','failed','cancelled'].includes(job?.status);
const lostNarrationConfig = job => job?.error === "'narration_language'";
const jobErrorMessage = job => lostNarrationConfig(job)
  ? '此任务由旧版服务创建，配音语言配置在传递时丢失。服务更新后，请刷新网页并重新创作；保留你当前选择的配音语言。'
  : job.error;
const fileFor = (job, kind) => job?.artifacts?.find(a => a.kind === kind);
const shortDate = value => new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const sizeText = size => size > 1048576 ? `${(size/1048576).toFixed(1)} MB` : `${Math.round(size/1024)} KB`;

function toast(message, error=false) {
  const el=document.createElement('div'); el.className=`toast${error?' error':''}`; el.textContent=message;
  $('#toast-region').append(el); setTimeout(()=>el.remove(),6500);
}
function persistDraft() { writeStorage('code2x.draft',state.draft); }
function setConnection(connected, message) {
  state.connected=connected;
  $('#sidebar-status').textContent=connected?'本地引擎已连接':(state.health?'等待服务配对':'本地服务未连接');
  $('#sidebar-detail').textContent=connected?'隔离运行 · 准备就绪':'点击配置计算服务';
  $('#connection-status').textContent=message || (connected?'已连接':'未连接');
  for (const el of [$('#sidebar-dot'),$('#header-dot')]) el.classList.toggle('online',connected);
}
async function connect(notify=false) {
  try {
    const health=await api.request('/api/health',{publicRequest:true,timeout:4000});
    if (health.service!=='code2x') throw new Error('此地址不是 Code2X 计算服务。');
    state.health=health;
    state.backendError=backendCompatibilityError(health);
    if(state.backendError) throw new Error(state.backendError);
    for (const descriptor of health.modules || []) {
      const known = modules.find(module => module.id === descriptor.id);
      if (known) Object.assign(known, descriptor);
    }
    if (isLocal && ['127.0.0.1','localhost'].includes(new URL(api.endpoint).hostname)) {
      const session=await api.request('/api/local-session',{publicRequest:true,timeout:4000});
      api.token=session.token;
    }
    writeStorage('code2x.endpoint',api.endpoint); writeStorage('code2x.token',api.token,sessionStorage);
    const data=await api.request('/api/jobs',{timeout:4000}); state.jobs=data.jobs;
    if (!health.runtime.ready) throw new Error('环境未就绪，请运行 Setup-Code2X.cmd。');
    setConnection(true);
    if ($('#settings-dialog').open) $('#settings-form').elements.token.value=api.token;
    $('#runtime-checks').innerHTML=Object.entries(health.runtime.checks).map(([name,ok])=>`<span>${icon(ok?'check':'close')}${esc(name)}</span>`).join('');
    updateJobCount(); updateRecent(true);
    if (!state.active) {
      const running=state.jobs.find(j=>!terminal(j));
      if (running) await selectJob(running.id,false);
    }
    if (notify) toast('计算服务已连接，可以开始创作。');
    return true;
  } catch(error) {
    setConnection(false,error.message);
    if (notify) toast(error.message,true);
    return false;
  }
}
function nav() {
  $('#engine-nav').innerHTML=modules.map(m=>`<button class="engine-item ${state.module===m.id?'active':''}" data-module="${m.id}" title="${m.name}${m.available?'':' · 规划中'}">${icon(m.icon)}${m.name}<span class="soon">${m.available?'已就绪':'SOON'}</span></button>`).join('');
  document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===state.view && state.module==='video'));
  $('#breadcrumb-title').textContent=state.module!=='video'?modules.find(m=>m.id===state.module).name:({studio:'创作工作台',projects:'我的作品',templates:'灵感模板'}[state.view]);
}
function render() {
  nav(); state.previewKey=''; state.recentKey='';
  if (state.module!=='video') return renderModule();
  if (state.view==='templates') return renderTemplates();
  if (state.view==='projects') return renderProjects();
  renderStudio();
}
function navigate(view='studio',module='video') {
  state.view=view;state.module=module;
  const hash=module==='video'?view:`module/${module}`;
  if (location.hash!==`#${hash}`) history.replaceState(null,'',`#${hash}`);
  render(); window.scrollTo({top:0,behavior:'instant'});
}
function renderStudio() {
  $('#main').innerHTML=`
    <section class="hero"><div><span class="eyebrow">YOUR IDEAS. IN MOTION.</span><h1>让想法，<em>动起来。</em></h1><p>描述你的灵感，让代码将它变成一段精彩的动画。</p></div><div class="hero-art" aria-hidden="true"><span>${icon('code')}</span><span class="art-end">${icon('video')}</span></div></section>
    <div class="studio-grid">
      <section class="panel compose-panel" aria-labelledby="compose-title">
        <div class="panel-heading"><h2 class="panel-title" id="compose-title">${icon('sparkles')}创建视频</h2><span class="quiet-label">CODE → VIDEO</span></div>
        <form id="create-form">
          <label class="field-label" for="topic"><span class="step-number">01</span>你想讲述什么？<span class="hint">从一个知识点开始</span></label>
          <div class="prompt-wrap"><textarea id="topic" name="topic" maxlength="4000" required placeholder="例如：用直观的几何动画，解释勾股定理。\n展示面积如何变化，让每一步推导都清晰可见。">${esc(state.draft.topic)}</textarea><div class="prompt-bottom"><span>${icon('code')}用代码，让抽象变得具体</span><span id="char-count">${state.draft.topic.length} / 4000</span></div></div>
          <div class="suggestions"><span>试试</span>${templates.slice(0,3).map(t=>`<button type="button" class="suggestion" data-template="${t.id}">${t.id==='pythagoras'?'△ 勾股定理':t.id==='fourier'?'∿ 傅里叶级数':'⌘ 神经网络'}</button>`).join('')}</div>
          <div class="field-label"><span class="step-number">02</span>设定你的画面</div>
          <div class="parameter-row"><div><label for="duration">目标时长</label><select id="duration" name="duration">${[1,2,3,5].map(n=>`<option value="${n}" ${n===state.draft.duration?'selected':''}>约 ${n} 分钟</option>`).join('')}</select></div><div><label for="quality">画面质量</label><select id="quality" name="quality">${qualities.map(q=>`<option value="${q.label}" ${q.label===state.draft.quality?'selected':''}>${q.label} · ${q.width}×${q.height} · ${q.fps} fps</option>`).join('')}</select></div></div>
          <div class="aspect-info"><span>${icon('expand')}16:9 横屏</span><span>${icon('volume')}中英配音 · 逐镜头对齐</span><span>${icon('clock')}时长按预算校准 · 试运行固定短片</span></div>
          <span class="style-label">视觉风格</span><div class="style-options">${styles.map(s=>`<button type="button" class="style-option ${state.draft.styleId===s.id?'selected':''}" data-style="${s.id}" aria-pressed="${state.draft.styleId===s.id}"><span class="style-art ${s.id}">${s.id==='math'?'a² + b²':s.id==='blueprint'?icon('box'):'<i></i><i></i><i></i>'}</span><span class="style-name">${s.name}<i></i></span></button>`).join('')}</div><p id="style-description" class="style-description" aria-live="polite"></p>
          <div class="section-divider"></div><div class="parameter-row"><div><label for="language">画面语言</label><select id="language" name="language"><option ${state.draft.language==='中文'?'selected':''}>中文</option><option ${state.draft.language==='English'?'selected':''}>English</option></select></div><div><label for="narration_language">配音语言</label><select id="narration_language" name="narration_language">${[['zh-CN','中文解说'],['en-US','English narration'],['none','无配音']].map(([id,label])=>`<option value="${id}" ${state.draft.narration_language===id?'selected':''}>${label}</option>`).join('')}</select></div></div>
          <div class="speech-note"><label class="subtitle-choice"><input id="burn_subtitles" name="burn_subtitles" type="checkbox" ${state.draft.burn_subtitles?'checked':''}>将解说字幕嵌入画面</label><p>讲解语言独立于画面语言。先生成解说与语音，再逐镜头对齐动画；成品同时提供 SRT / VTT 字幕与独立音轨。配音由 AI 合成。</p></div>
          <button type="submit" id="generate-button" class="generate-button">${icon('play')}生成我的视频<span class="shortcut">Ctrl ↵</span></button>
          <div class="generation-note">${icon('lock')}本地隔离渲染 · 可编辑源码 · 使用你自己的模型</div>
        </form>
      </section>
      <div class="preview-column"><section class="panel preview-panel" aria-labelledby="preview-title"><div class="preview-header"><h2 class="panel-title" id="preview-title">${icon('video')}创作预览</h2><span id="preview-badge" class="badge">WORK IN PROGRESS</span></div><div class="preview-tabs" role="tablist" aria-label="创作内容"><button class="preview-tab" id="tab-preview" data-tab="preview" role="tab">${icon('play')}视频预览</button><button class="preview-tab" id="tab-outline" data-tab="outline" role="tab">${icon('layers')}内容分镜</button><button class="preview-tab" id="tab-source" data-tab="source" role="tab">${icon('code')}源码</button></div><div id="preview-body" class="preview-body" role="tabpanel"></div></section><section class="panel pipeline-panel" id="pipeline" aria-label="生成流程"></section></div>
    </div>
    <section class="recent-section"><div class="section-heading"><h2>${icon('clock')}最近创作</h2><button data-view="projects">查看全部${icon('arrow')}</button></div><div id="recent-jobs"></div></section>`;
  updateStyleSelection();updatePreview(true);updatePipeline();updateRecent(true);
}
function updateStyleSelection() {
  const selected=styles.find(style=>style.id===state.draft.styleId);
  document.querySelectorAll('[data-style]').forEach(button=>{
    const style=styles.find(style=>style.id===button.dataset.style);
    button.classList.toggle('selected',style.id===selected.id);
    button.setAttribute('aria-pressed',style.id===selected.id);
    const art=button.querySelector('.style-art');
    art.style.backgroundColor=style.palette.background;art.style.color=style.palette.primary;
    art.style.setProperty('--preview-grid',style.palette.grid);
    art.style.setProperty('--preview-secondary',style.palette.secondary);
    art.style.setProperty('--preview-tertiary',style.palette.tertiary);
  });
  const description=$('#style-description');
  if(description) description.textContent=`${selected.name} · 背景 ${selected.palette.background} · 新任务与离线测试均生效，已有视频保持原样`;
}
function updateJobCount() { $('#project-count').textContent=state.jobs.length; }
function jobCard(job) {
  const poster=fileFor(job,'image'); const video=fileFor(job,'video');
  return `<article class="job-card ${job.id===state.active?.id?'active-job':''}"><button class="job-image" data-action="view-job" data-job="${job.id}" aria-label="查看 ${esc(job.title)}">${poster?`<img src="${esc(api.fileURL(job.id,poster.path))}" alt="${esc(job.title)}" loading="lazy">`:`<span class="job-placeholder">${icon(job.status==='running'?'refresh':'film',job.status==='running'?'loading-spinner':'')}</span>`}<span class="status-badge">${esc(statusNames[job.status]||job.status)}</span></button><div class="job-card-body"><h3 title="${esc(job.title)}">${esc(job.title)}</h3><div class="job-meta"><span>${shortDate(job.created_at)}</span><span>${esc(job.config.quality.split(' ').pop())} · ${job.config.demo?'离线测试':'Manim'}</span></div><div class="job-actions"><button data-action="view-job" data-job="${job.id}">${icon('play')}查看</button>${video?`<a href="${esc(api.fileURL(job.id,video.path,true))}" download>${icon('download')}MP4</a>`:''}<button data-action="reuse" data-job="${job.id}" title="用此设置重新创作">${icon('refresh')}复用</button>${terminal(job)?`<button class="delete-job" data-action="delete" data-job="${job.id}" aria-label="删除作品">${icon('trash')}</button>`:`<button class="delete-job" data-action="cancel" data-job="${job.id}" title="停止任务">${icon('stop')}</button>`}</div></div></article>`;
}
function updateRecent(force=false) {
  updateJobCount();
  const target=$('#recent-jobs'); if(!target) return;
  const key=JSON.stringify(state.jobs.map(j=>[j.id,j.status,j.artifacts?.length]));
  if(!force && key===state.recentKey) return; state.recentKey=key;
  target.innerHTML=state.jobs.length?`<div class="job-grid">${state.jobs.slice(0,3).map(jobCard).join('')}</div>`:`<div class="recent-empty"><div><span class="empty-icon">${icon('folder')}</span><div><strong>你的下一个作品，从这里开始</strong><p>还没有创作？用一次离线渲染，点亮你的工作空间。</p></div></div><button data-action="demo">${icon('play')}试试离线渲染</button></div>`;
}
function updatePipeline() {
  const target=$('#pipeline'); if(!target) return;
  const job=state.active;
  const pipelineStages=job&&(!job.config.narration_language||job.config.narration_language==='none')?stages.filter(s=>!['narration','tts'].includes(s.id)):stages;
  let index=pipelineStages.findIndex(s=>s.id===job?.stage);
  if(job?.status==='completed') index=pipelineStages.length;
  const wasOpen=$('#task-logs')?.open;
  const oldLog=$('#log-content');const logScroll=oldLog?.scrollTop||0;
  const followLog=!oldLog || oldLog.scrollHeight-oldLog.clientHeight-logScroll<10;
  const label=job?(statusNames[job.status]||'准备中'):'等待你的第一个想法';
  target.innerHTML=`<div class="pipeline-header"><strong>从灵感到成片</strong><span>${job?esc(label):'7 STEPS'}</span></div><div class="pipeline-stages">${pipelineStages.map((s,i)=>`<div class="pipeline-step ${i<index?'done':i===index&&job?.status==='running'?'running':''}"><span>${icon(i<index?'check':s.icon)}</span>${s.name}</div>`).join('')}</div>${job?`<div class="task-progress"><div class="progress-track"><i id="progress-width"></i></div><div class="progress-detail"><span>${esc(label)} · ${job.progress}%${job.tokens?.total_tokens?` · ${job.tokens.total_tokens.toLocaleString()} tokens`:''}</span>${!terminal(job)?`<button data-action="cancel" data-job="${job.id}">${icon('stop')}停止</button>`:`<button data-action="${job.config.demo?'demo':'reuse'}" data-job="${job.id}">重新创作${icon('refresh')}</button>`}</div></div>${job.error?`<div class="error-box">${esc(jobErrorMessage(job))}</div>`:''}<details id="task-logs" class="logs-panel" ${wasOpen?'open':''}><summary>查看运行日志</summary><pre id="log-content"></pre></details>`:`<div class="pipeline-note">${icon('info')}生成后可查看每一步的分镜、代码与运行日志。</div>`}`;
  if($('#progress-width')) $('#progress-width').style.width=`${Math.max(0,Math.min(100,job.progress))}%`;
  if($('#log-content')) {const log=$('#log-content');log.textContent=state.logLines.join('').replace(/^@@CODE2X.*$/gm,'').trim() || '等待生成日志…';log.scrollTop=followLog?log.scrollHeight:logScroll;}
}
function updatePreview(force=false) {
  const target=$('#preview-body');if(!target) return;
  const job=state.active; const key=JSON.stringify([job?.id,state.tab,job?.status,job?.artifacts?.map(a=>a.path)]);
  if(!force&&key===state.previewKey) return; state.previewKey=key;
  document.querySelectorAll('[data-tab]').forEach(el=>{const selected=el.dataset.tab===state.tab;el.classList.toggle('active',selected);el.setAttribute('aria-selected',selected);el.tabIndex=selected?0:-1;});
  target.setAttribute('aria-labelledby',`tab-${state.tab}`);
  $('#preview-badge').textContent=job?(statusNames[job.status]||'准备中'):'INSPIRATION';
  if(state.tab==='preview') {
    const video=fileFor(job,'video'); const poster=fileFor(job,'image');
    const vtt=job?.artifacts?.find(a=>a.name==='subtitles.vtt');
    const voiced=job?.config.narration_language && job.config.narration_language!=='none';
    const track=vtt?`<track kind="subtitles" src="${esc(api.fileURL(job.id,vtt.path))}" srclang="${job.config.narration_language==='zh-CN'?'zh':'en'}" label="${job.config.narration_language==='zh-CN'?'中文':'English'}" ${job.config.burn_subtitles?'':'default'}>`:'';
    const downloads=voiced?`<div class="speech-downloads"><span>${icon('volume')}${job.config.narration_language==='zh-CN'?'中文解说':'English narration'} · AI 合成配音</span>${['narration.wav','subtitles.srt','subtitles.vtt','timeline.json'].map(name=>{const file=job.artifacts.find(a=>a.name===name);return file?`<a href="${esc(api.fileURL(job.id,file.path,true))}" download>${name==='narration.wav'?'配音 WAV':name==='timeline.json'?'时间轴 JSON':name.endsWith('.srt')?'字幕 SRT':'字幕 VTT'}</a>`:'';}).join('')}</div>`:'';
    const illustration=styles.find(style=>style.id===(job?.config.style_id || state.draft.styleId)) || styles[0];
    target.innerHTML=video?`<div class="video-stage"><video id="result-video" crossorigin="anonymous" controls playsinline preload="metadata" ${poster?`poster="${esc(api.fileURL(job.id,poster.path))}"`:''} src="${esc(api.fileURL(job.id,video.path))}">${track}</video></div><div class="preview-caption"><div><strong>${esc(job.title)}</strong><p>${esc(job.config.quality)} · ${sizeText(video.size)} · ${job.config.demo?'离线测试视频':'实际生成视频'}<br>成品风格：${esc(job.config.style_name || "旧版本（未记录风格）")}<br><span id="actual-video-settings">正在读取实际视频参数…</span></p></div><button data-action="download" data-job="${job.id}">${icon('download')}下载 MP4</button></div>${downloads}`:
      `<div class="video-stage"><img src="${esc(stylePreview(illustration))}" alt="灵感示意：用几何图形可视化勾股定理"><span class="preview-sample-label">${esc(illustration.name)} · 设计示意</span><button class="preview-play" data-action="demo" aria-label="运行真实离线渲染测试">${icon('play')}</button></div><div class="video-bar">${icon('play')}<span>—:—</span><span class="track"></span><span>16:9</span>${icon('volume')}</div><div class="preview-caption"><div><strong>${job?'正在把想法变成画面':'把公式，变成看得见的故事'}</strong><p>${job?'完成渲染后，成品会出现在这里':'点击播放按钮，运行真实的离线渲染测试'}</p></div><button data-action="${job?'help':'demo'}">${icon(job?'info':'play')}${job?'生成说明':'试运行'}</button></div>`;
    if(video)showActualVideoSettings(job);
  } else {
    const files=(job?.artifacts||[]).filter(a=>state.tab==='source'?(a.name.endsWith('.py')||a.name.endsWith('.partial.txt')):a.name.endsWith('.json')).sort((a,b)=>Number(a.name.startsWith('_'))-Number(b.name.startsWith('_')));
    if(!files.length) {target.innerHTML=`<div class="empty-pane">${icon(state.tab==='source'?'code':'layers')}<p>${state.tab==='source'?'生成的 Manim 源码将在这里显示。':'内容大纲与分镜将在规划完成后显示。'}<br>每一个画面，都有迹可循。</p>${job?'':'<button class="secondary-button" data-action="demo">试试离线渲染</button>'}</div>`;return;}
    target.innerHTML=`<div class="source-view"><select id="source-file" aria-label="选择文件">${files.map(a=>`<option value="${esc(a.path)}">${esc(a.name)}</option>`).join('')}</select><pre id="source-content">正在读取…</pre></div><div class="preview-caption"><div><strong>${state.tab==='source'?'可复现、可修改的动画代码':'从内容规划到分镜设计'}</strong><p>当前任务实际生成的文件</p></div><button data-action="archive" data-job="${job.id}">${icon('download')}源码包</button></div>`;
    loadSource(files[0].path);
  }
}
async function loadSource(path) {
  const request=++sourceRequest; const jobId=state.active?.id;
  try {
    const response=await fetch(api.fileURL(jobId,path),{signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error('文件读取失败，请重新连接服务。');
    const text=await response.text(); if(request===sourceRequest&&jobId===state.active?.id&&$('#source-content')) $('#source-content').textContent=text;
  } catch(error){if(request===sourceRequest&&$('#source-content')) $('#source-content').textContent=error.message;}
}
function showActualVideoSettings(job) {
  const video=$('#result-video');const output=$('#actual-video-settings');
  if(!video||!output)return;
  let actualFPS=null;
  const format=seconds=>{const total=Math.round(seconds);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;};
  const show=(duration,width,height,fps)=>{
    if(state.active?.id!==job.id||$('#actual-video-settings')!==output)return;
    output.textContent=`${job.config.demo?'试运行固定短片':`目标 ${job.config.duration} 分钟`} · 实际 ${format(duration)} · ${width}×${height}${fps?` · ${fps} fps`:''}`;
  };
  video.addEventListener('loadedmetadata',()=>show(video.duration,video.videoWidth,video.videoHeight,actualFPS),{once:true});
  if(video.readyState>=1)show(video.duration,video.videoWidth,video.videoHeight);
  const file=job.artifacts.find(a=>a.name==='render-report.json');
  if(file)fetch(api.fileURL(job.id,file.path)).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(r=>{actualFPS=r.fps;show(r.duration,r.width,r.height,r.fps);}).catch(()=>{});
}
async function selectJob(id, navigateTo=true) {
  if(!state.connected)return openSettings();
  const data=await api.request(`/api/jobs/${id}`);
  state.active=data.job;state.logLines=data.logs.lines;state.cursor=data.logs.cursor;state.tab='preview';
  if(navigateTo)navigate('studio');else {updatePreview(true);updatePipeline();}
}
function renderProjects() {
  $('#main').innerHTML=`<section class="page-heading"><span class="eyebrow">YOUR CREATIVE LIBRARY</span><h1>让每个想法，都有作品。</h1><p>视频、分镜和代码，保存在你自己的工作空间里。</p></section><div class="project-toolbar"><div class="filter-buttons">${[['all','全部作品'],['completed','已完成'],['running','进行中'],['failed','未完成']].map(([id,name])=>`<button data-filter="${id}" class="${state.filter===id?'active':''}">${name}</button>`).join('')}</div><input id="project-search" class="search-input" placeholder="搜索你的作品…" aria-label="搜索作品" value="${esc(state.query)}"></div><div id="project-list"></div>`;
  updateProjectList();
}
function updateProjectList() {
  const target=$('#project-list');if(!target) return;
  const jobs=state.jobs.filter(j=>(state.filter==='all'||(state.filter==='running'?!terminal(j):state.filter==='failed'?['failed','cancelled'].includes(j.status):j.status===state.filter))&&j.title.toLowerCase().includes(state.query.toLowerCase()));
  target.innerHTML=jobs.length?`<div class="job-grid">${jobs.map(jobCard).join('')}</div>`:`<div class="empty-page">${icon('folder')}<h3>${state.jobs.length?'没有符合条件的作品':'你的作品集，等待第一段故事'}</h3><p>${state.connected?'开始一次创作，或试试无需 API 的离线渲染。':'连接本地计算服务，即可查看保存的作品。'}</p><button class="primary-button" data-action="${state.connected?'new':'settings'}">${state.connected?'开始创作':'连接服务'}${icon('arrow')}</button></div>`;
}
function renderTemplates() {
  $('#main').innerHTML=`<section class="page-heading"><span class="eyebrow">A LITTLE SPARK GOES A LONG WAY</span><h1>灵感，不必从零开始。</h1><p>选一个有趣的起点，加入你的想法，创作属于你的动画。</p></section><div class="template-grid">${templates.map(t=>`<button class="template-card" data-template="${t.id}"><div class="template-art palette-${t.palette}">${esc(t.art)}</div><div class="template-card-body"><h3>${t.name}</h3><p>${t.description}</p><small>${t.tag}<span>·</span>使用模板${icon('arrow')}</small></div></button>`).join('')}</div>`;
}
function applyTemplate(id) {
  const template=templates.find(t=>t.id===id);if(!template)return;
  state.draft.topic=template.prompt;state.draft.styleId=template.style;persistDraft();navigate('studio');$('#topic')?.focus();
}
function renderModule() {
  const m=modules.find(m=>m.id===state.module);
  $('#main').innerHTML=`<div class="module-placeholder"><div class="module-icon">${icon(m.icon)}</div><span class="planned-label">ON THE HORIZON</span><h1>${m.name}</h1><p>${m.description}<br>此引擎尚未接入。我们为它保留了统一的模块与任务接口。</p><button class="primary-button" data-view="studio">先用 Video 开始创作${icon('arrow')}</button></div>`;
}
function openSettings() {
  const form=$('#settings-form');
  for(const [k,v] of Object.entries(state.config)) if(form.elements[k])form.elements[k].value=v;
  form.elements.endpoint.value=api.endpoint;form.elements.token.value=api.token;
  updateSpeechSettings();
  if(!$('#settings-dialog').open)$('#settings-dialog').showModal();
}
function updateSpeechSettings() {
  const form=$('#settings-form');
  const enabled=form.elements.tts_provider.value==='api';
  $('#speech-api-fields').hidden=!enabled;
  for(const name of ['tts_base_url','tts_model','tts_voice_zh','tts_voice_en']) form.elements[name].required=enabled;
}
function collectSettings() {
  const form=$('#settings-form'); const result={};
  for(const key of [...preferenceKeys,'api_key','tts_api_key'])result[key]=typeof defaults[key]==='number'?Number(form.elements[key].value):form.elements[key].value.trim();
  return result;
}
function configureEndpoint(endpoint, token) {
  const previous=api.endpoint;api.configure(endpoint,token);
  if(previous!==api.endpoint){state.jobs=[];state.active=null;state.health=null;state.logLines=[];state.cursor=0;}
}
async function connectFromForm() {
  const form=$('#settings-form');configureEndpoint(form.elements.endpoint.value.trim(),form.elements.token.value);
  return connect(true);
}
async function saveSettings(event) {
  event.preventDefault(); if(!event.target.reportValidity())return;
  configureEndpoint(event.target.elements.endpoint.value.trim(),event.target.elements.token.value);
  state.config=collectSettings();
  writeStorage('code2x.preferences',Object.fromEntries(preferenceKeys.map(k=>[k,state.config[k]])));
  writeStorage('code2x.endpoint',api.endpoint);writeStorage('code2x.token',api.token,sessionStorage);
  await connect(false);$('#settings-dialog').close();toast('设置已保存。API Key 仅在当前页面会话中有效。');
}
async function modelAction(action, button) {
  if(!state.connected){toast('请先连接计算服务。',true);return;}
  const data=collectSettings(); if(!data.api_key){toast('请先填写 API Key。',true);return;}
  button.disabled=true;$('#model-status').textContent=action==='models'?'正在获取模型列表…':'正在进行一次小额模型调用…';
  try {
    const result=await api.request(`/api/${action}`,{method:'POST',body:data,timeout:60000});
    if(action==='models') {$('#model-list').innerHTML=result.models.map(m=>`<option value="${esc(m)}"></option>`).join('');$('#model-status').textContent=`已获取 ${result.models.length} 个模型。在模型 ID 输入框中选择或输入。`;}
    else $('#model-status').textContent=`模型调用成功：${result.message}（${result.tokens?.total_tokens||0} tokens）`;
  } catch(error){$('#model-status').textContent=error.message;toast(error.message,true);}finally{button.disabled=false;}
}
async function generate(demo=false) {
  if(state.submitting)return;
  if(!state.connected){openSettings();toast(state.backendError||'请先启动并连接本地计算服务。',true);return;}
  const form=$('#create-form');
  if(form){state.draft.duration=Number(form.elements.duration.value);state.draft.quality=form.elements.quality.value;persistDraft();}
  if(!demo&&!state.draft.topic.trim()){$('#topic')?.focus();toast('写下你的想法，让创作开始。');return;}
  if(!demo&&!state.config.api_key){openSettings();toast('请先填写模型 API Key 并保存到本次会话。');return;}
  state.submitting=true;
  const button=$('#generate-button');if(button){button.disabled=true;button.innerHTML=`${icon('refresh','loading-spinner')}正在创建任务…`;}
  try {
    // Recheck the running process immediately before enqueueing; code can change after the page connects.
    const health=await api.request('/api/health',{publicRequest:true,timeout:4000});
    state.backendError=backendCompatibilityError(health);
    if(state.backendError){setConnection(false,state.backendError);throw new Error(state.backendError);}
    const job=await api.request('/api/jobs',{method:'POST',body:{...state.config,...state.draft,style_id:state.draft.styleId,style:styles.find(s=>s.id===state.draft.styleId).prompt,module:'video',demo},timeout:10000});
    state.jobs.unshift(job);state.active=job;state.logLines=[];state.cursor=0;state.tab='preview';navigate('studio');
    toast(demo?(state.config.tts_provider==='api'&&state.draft.narration_language!=='none'?'测试渲染已开始，将调用所配置的语音 API。':'离线渲染已开始，无需调用模型 API。'):'任务已加入队列，可在工作台查看进度。');
  } finally {state.submitting=false;if($('#generate-button')){$('#generate-button').disabled=false;$('#generate-button').innerHTML=`${icon('play')}生成我的视频<span class="shortcut">Ctrl ↵</span>`;}}
}
async function refresh() {
  if(!state.connected||state.polling)return;state.polling=true;
  try {
    const data=await api.request('/api/jobs');const oldJobs=state.jobs;state.jobs=data.jobs;
    for(const job of state.jobs){const old=oldJobs.find(j=>j.id===job.id);if(old&&!terminal(old)&&terminal(job))toast(`${job.config.demo?'离线测试':job.title.slice(0,18)}${job.status==='completed'?'已完成':' · '+statusNames[job.status]}`,job.status==='failed');}
    if(state.active){
      const old=state.active;
      if(!state.jobs.some(job=>job.id===old.id)){state.active=null;state.logLines=[];state.cursor=0;}
      else{const detail=await api.request(`/api/jobs/${old.id}?cursor=${state.cursor}`);state.active=detail.job;state.logLines.push(...detail.logs.lines);state.logLines=state.logLines.slice(-1000);state.cursor=detail.logs.cursor;}
      updatePreview();updatePipeline();
    }
    updateRecent(); if(state.view==='projects')updateProjectList();
  } catch(error) {
    setConnection(false,error.message);toast(error.message,true);
  } finally {state.polling=false;}
}
function download(url) {const a=document.createElement('a');a.href=url;a.download='';document.body.append(a);a.click();a.remove();}
function showInfo(kind) {
  $('#info-title').textContent=kind==='roadmap'?'FormaWeave · 织象':'开始你的第一次创作';
  $('#info-body').innerHTML=kind==='roadmap'?`<p>以代码构建，以模型生成，让想象成形。从视频开始，逐步连接图像、三维、游戏和世界。</p>${modules.map(m=>`<div class="roadmap-row">${m.name}<span>${m.available?'已接入 · Manim':'规划中 · 预留适配器'}</span></div>`).join('')}<div class="info-callout">当前可用的是 Code2Video / Manim 动画。生成式模型、世界模型及混合工作流是后续研究方向，尚未开放生成功能。</div>`:
    `<h3>1. 启动计算服务</h3><p>双击项目中的 <code>Start-Code2X.cmd</code>，然后打开 <code>http://127.0.0.1:8765</code>。首次安装可运行 <code>Setup-Code2X.cmd</code>。</p><h3>2. 先试一次离线渲染</h3><p>点击“试试离线渲染”，会真实生成勾股定理与线性变换的测试视频，验证中文、数学公式、动画和合成。测试内容固定，使用当前所选视觉风格、画面语言和配音语言，不使用内容模型 API。本地语音无需密钥；若改用语音 API，离线测试也会调用该语音服务。</p><h3>3. 连接你的模型</h3><p>打开“连接设置”，填写服务商的 Base URL、模型 ID 和 API Key，保存到本次会话。获取模型列表只读取目录；测试模型会产生一次小额调用。</p><h3>4. 从想法到成片</h3><p>描述主题、设定时长与质量，点击生成。完成后可播放 MP4、下载视频与源码包，在分镜和源码页查看实际生成文件。配音语言可选择中文、英文或无配音，独立于画面语言。Planner 完成分镜后先生成逐镜头解说与 TTS，再对齐动画、配音和字幕。可下载 WAV、SRT / VTT 与时间轴 JSON。配音由 AI 合成。</p><h3>在 GitHub Pages 上操作</h3><p>保持本地服务运行，在网页连接设置中填写本机地址与连接令牌。令牌可在本机工作台复制，或从 <code>data/access-token.txt</code> 读取。浏览器询问本地网络权限时需要允许。</p><div class="info-callout">GitHub Pages 负责界面，本地引擎负责生成。Python、依赖、FFmpeg、LaTeX 和缓存均在项目内。依赖隔离不等于代码安全沙箱；模型生成的 Python 代码以当前用户权限执行，仅连接可信模型和网页。</div><p>基于 <a href="https://github.com/showlab/Code2Video" target="_blank" rel="noreferrer">showlab / Code2Video</a> · MIT License</p>`;
  $('#info-dialog').showModal();
}

document.addEventListener('click', async event=>{
  const el=event.target.closest('button,[data-view],[data-template],[data-close]');if(!el)return;
  try {
    if(el.dataset.close){$('#'+el.dataset.close).close();return;}
    if(el.dataset.view){navigate(el.dataset.view);return;}
    if(el.dataset.module){navigate('studio',el.dataset.module);return;}
    if(el.dataset.template){applyTemplate(el.dataset.template);return;}
    if(el.dataset.tab){state.tab=el.dataset.tab;updatePreview();return;}
    if(el.dataset.style){state.draft.styleId=el.dataset.style;persistDraft();updateStyleSelection();if(!fileFor(state.active,'video'))updatePreview(true);return;}
    if(el.dataset.filter){state.filter=el.dataset.filter;renderProjects();return;}
    const id=el.dataset.job;
    switch(el.dataset.action){
      case 'new':state.active=null;state.draft.topic='';state.tab='preview';persistDraft();navigate('studio');$('#topic').focus();break;
      case 'settings':openSettings();break;
      case 'connect':el.disabled=true;try{await connectFromForm();}finally{el.disabled=false;}break;
      case 'copy-token':if(!api.token)throw new Error('请先在本机工作台连接服务。');await navigator.clipboard.writeText(api.token);toast('连接令牌已复制。');break;
      case 'token-defaults':for(const key of ['max_tokens','planning_max_tokens','repair_max_tokens','max_continuations'])$('#settings-form').elements[key].value=defaults[key];toast('已填入推荐输出预算，保存后用于新任务。');break;
      case 'toggle-key':{const input=$('#settings-form').elements.api_key;input.type=input.type==='password'?'text':'password';break;}
      case 'models':await modelAction('models',el);break;
      case 'test':await modelAction('test',el);break;
      case 'help':showInfo('help');break;
      case 'roadmap':showInfo('roadmap');break;
      case 'demo':await generate(true);break;
      case 'view-job':await selectJob(id);break;
      case 'cancel':await api.request(`/api/jobs/${id}/cancel`,{method:'POST'});await refresh();break;
      case 'reuse':{const job=state.jobs.find(j=>j.id===id);if(!job)return;const c=job.config;Object.assign(state.draft,{topic:c.demo?'':c.topic,duration:c.duration,quality:c.quality,language:c.language,narration_language:c.narration_language||(lostNarrationConfig(job)?state.draft.narration_language:'none'),burn_subtitles:c.burn_subtitles!==false,styleId:c.style_id || (c.style?.includes("蓝图")?"blueprint":c.style?.includes("极简")?"minimal":"math")});state.active=null;persistDraft();navigate('studio');toast('已复用创作设置，可修改主题后重新生成。');break;}
      case 'download':{const job=state.jobs.find(j=>j.id===id)||state.active;const file=fileFor(job,'video');if(file)download(api.fileURL(id,file.path,true));break;}
      case 'archive':download(api.archiveURL(id));break;
      case 'delete':{
        $('#info-title').textContent='删除这份作品？';$('#info-body').innerHTML=`<p>这会删除此任务的视频、代码和日志。此操作无法撤销。</p><div class="info-callout">${esc(state.jobs.find(j=>j.id===id)?.title)}</div><button class="primary-button" data-action="confirm-delete" data-job="${id}">确认删除</button>`;$('#info-dialog').showModal();break;
      }
      case 'confirm-delete':await api.request(`/api/jobs/${id}`,{method:'DELETE'});if(state.active?.id===id)state.active=null;$('#info-dialog').close();await refresh();render();toast('作品已删除。');break;
    }
  }catch(error){toast(error.message,true);}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='create-form'){event.preventDefault();generate().catch(e=>toast(e.message,true));}
  if(event.target.id==='settings-form')saveSettings(event).catch(e=>toast(e.message,true));
});
document.addEventListener('input',event=>{
  if(event.target.id==='topic'){state.draft.topic=event.target.value;$('#char-count').textContent=`${event.target.value.length} / 4000`;persistDraft();}
  if(event.target.id==='project-search'){state.query=event.target.value;updateProjectList();}
});
document.addEventListener('change',event=>{
  if(['duration','quality','language','narration_language'].includes(event.target.id)){state.draft[event.target.id]=event.target.id==='duration'?Number(event.target.value):event.target.value;persistDraft();}
  if(event.target.id==='burn_subtitles'){state.draft.burn_subtitles=event.target.checked;persistDraft();}
  if(event.target.name==='tts_provider')updateSpeechSettings();
  if(event.target.id==='source-file')loadSource(event.target.value);
  if(event.target.name==='provider'){
    const urls={'OpenAI 兼容':'https://api.openai.com/v1','Claude 原生':'https://api.anthropic.com','Gemini 原生':'https://generativelanguage.googleapis.com'};
    $('#settings-form').elements.base_url.value=urls[event.target.value];
  }
});
document.addEventListener('keydown',event=>{
  if(event.target.closest('.preview-tabs')&&['ArrowLeft','ArrowRight'].includes(event.key)){
    event.preventDefault();const tabs=['preview','outline','source'];const direction=event.key==='ArrowRight'?1:-1;state.tab=tabs[(tabs.indexOf(state.tab)+direction+3)%3];updatePreview();$(`#tab-${state.tab}`).focus();return;
  }
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&$('#create-form')&&!document.querySelector('dialog[open]')){event.preventDefault();generate().catch(e=>toast(e.message,true));}
  if(event.key.toLowerCase()==='n'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,dialog')){$('[data-action="new"]').click();}
});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
window.addEventListener('hashchange',()=>{
  const hash=location.hash.slice(1);if(hash.startsWith('module/')&&modules.some(m=>m.id===hash.split('/')[1]))navigate('studio',hash.split('/')[1]);else if(['studio','projects','templates'].includes(hash))navigate(hash);
});
hydrateIcons();
const initial=location.hash.slice(1);if(['studio','projects','templates'].includes(initial))state.view=initial;
if(initial.startsWith('module/')&&modules.some(m=>m.id===initial.split('/')[1]))state.module=initial.split('/')[1];
render();connect();setInterval(refresh,2000);
