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
      if (error.name === 'AbortError') throw new Error('服务连接超时，请检查本地服务和网络。');
      if (error instanceof TypeError) throw new Error('无法连接计算服务。请先启动本地服务，并允许浏览器访问本地网络。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  fileURL(id, path, download=false) {
    const query = new URLSearchParams({path, token:this.token});
    if (download) query.set('download', '1');
    return `${this.endpoint}/api/jobs/${id}/file?${query}`;
  }
  archiveURL(id) { return `${this.endpoint}/api/jobs/${id}/archive?${new URLSearchParams({token:this.token})}`; }
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
