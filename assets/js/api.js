export function createApi(fetcher = (...args) => fetch(...args)) {
  let csrf = null;
  async function request(path, method = 'GET', body = {}) {
    if (method !== 'GET' && !csrf) await request('/session');
    let response, envelope;
    try {
      response = await fetcher(`/api/v1${path}`, {
        method, credentials: 'same-origin', headers: { Accept: 'application/json', ...(method !== 'GET' ? {'Content-Type':'application/json','X-CSRF-Token':csrf} : {}) },
        ...(method !== 'GET' ? {body:JSON.stringify(body)} : {}),
      });
      if (response.status === 204 && response.ok) return null;
      envelope = await response.json();
    } catch { throw Object.assign(new Error('apiUnavailable'), {key:'apiUnavailable'}); }
    if (!response.ok) {
      const key = ({401:'apiUnauthorized',403:'apiForbidden',404:'apiNotFound',409:'apiConflict',422:'apiInvalid',429:'apiRateLimit'})[response.status] || 'apiUnavailable';
      if (response.status === 403) csrf = null;
      throw Object.assign(new Error(key), {key,status:response.status});
    }
    if (envelope.data?.csrf_token) csrf = envelope.data.csrf_token;
    return envelope.data;
  }
  return {request};
}
