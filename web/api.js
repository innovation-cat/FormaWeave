export class API {
  constructor(endpoint, token='') { this.endpoint = endpoint; this.token = token; }
  configure(endpoint, token) {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('请输入有效的 HTTP(S) 后端地址。');
    this.endpoint = url.href.replace(/\/$/, ''); this.token = token.trim();
  }
  async request(path, {method='GET', body, timeout=8000, publicRequest=false}={}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${this.endpoint}${path}`, {method, signal:controller.signal,
        headers:{...(publicRequest ? {} : {Authorization:`Bearer ${this.token}`}), ...(body ? {'Content-Type':'application/json'} : {})},
        ...(body ? {body:JSON.stringify(body)} : {})});
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || `服务响应 ${response.status}`); error.status=response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('服务连接超时，请检查本地服务和网络。'),{kind:'offline'});
      if (error instanceof TypeError) throw Object.assign(new Error('无法访问计算服务。请确认地址和本地服务，并允许浏览器访问本地网络。'),{kind:'offline'});
      throw error;
    } finally { clearTimeout(timer); }
  }
  async connect({pageOrigin='', timeout=4000}={}) {
    let health;
    try {
      health=await this.request('/api/health',{publicRequest:true,timeout});
      if(health.service!=='code2x')throw Object.assign(new Error('此地址不是 Code2X 计算服务，请检查计算服务地址。'),{kind:'address'});
      const compatibility=backendCompatibilityError(health);
      if(compatibility)throw Object.assign(new Error(compatibility),{kind:'restart'});
      if(!health.runtime?.ready)throw Object.assign(new Error('计算服务已启动，但渲染环境未就绪，请运行 Setup-Code2X.cmd。'),{kind:'runtime'});
      const page=new URL(pageOrigin || 'https://unpaired.invalid');
      const endpoint=new URL(this.endpoint);
      const loopback=host=>['127.0.0.1','localhost'].includes(host);
      if(page.protocol==='http:' && endpoint.protocol==='http:' && loopback(page.hostname) && loopback(endpoint.hostname) && page.port===endpoint.port) {
        const session=await this.request('/api/local-session',{publicRequest:true,timeout});
        this.token=session.token;
      }
      if(!this.token)throw Object.assign(new Error('计算服务已启动，但此网页尚未配对。请从本机工作台复制连接令牌，粘贴到“连接令牌”后连接。'),{kind:'pairing'});
      const data=await this.request('/api/jobs',{timeout});
      return {health,jobs:data.jobs};
    } catch(error) {
      throw connectionProblem(error,{health,token:this.token});
    }
  }
  fileURL(id, path, download=false) {
    const query = new URLSearchParams({path, token:this.token});
    if (download) query.set('download', '1');
    return `${this.endpoint}/api/jobs/${id}/file?${query}`;
  }
  archiveURL(id) { return `${this.endpoint}/api/jobs/${id}/archive?${new URLSearchParams({token:this.token})}`; }
}
export function connectionProblem(error,{health,token=''}={}) {
  const pairing=error.status===401 || error.kind==='pairing';
  const message=pairing && token
    ? '计算服务已启动，但连接令牌已失效。请从本机工作台重新复制令牌并连接；重启服务后需要重新配对。'
    : error.message;
  return Object.assign(new Error(message),{status:error.status,kind:pairing?'pairing':error.kind||'offline',health});
}
export function readStorage(key, fallback, storage=localStorage) {
  try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function writeStorage(key, value, storage=localStorage) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing/storage quotas do not block creation. */ }
}
export function backendCompatibilityError(health) {
  if (health.generation_contract!==2 || health.restart_required!==false || health.capabilities?.narration!==true || health.capabilities?.duration_budget!==true || health.capabilities?.render_specs!==true) {
    return '计算服务仍在运行旧版代码，无法完整应用创作参数。请关闭 Code2X 服务窗口，重新启动 Start-Code2X.cmd，再刷新网页后重新生成。';
  }
  return '';
}
