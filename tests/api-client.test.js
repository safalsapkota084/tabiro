import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../assets/js/api.js';
test('client bootstraps CSRF, rotates tokens, includes cookies and accepts empty deletes', async () => {
  const calls = [];
  const api = createApi(async (url, options) => {
    calls.push({url, ...options});
    const data = url.endsWith('/session') ? {user:null,csrf_token:'first'} : {user:{id:1},csrf_token:'second'};
    return {ok:true,status:options.method === 'DELETE' ? 204 : 200,json:async () => ({data})};
  });
  await api.request('/auth/login','POST',{email:'a@b.test',password:'secret'});
  await api.request('/trips/1','DELETE');
  assert.equal(calls[1].headers['X-CSRF-Token'],'first');
  assert.equal(calls[2].headers['X-CSRF-Token'],'second');
  assert.ok(calls.every(call => call.credentials === 'same-origin'));
});
test('client maps unsafe server and network errors to known translation keys', async () => {
  const api = createApi(async () => ({ok:false,status:409,json:async()=>({error:{message:'SQL password secret'}})}));
  await assert.rejects(api.request('/trips'), error => error.key === 'apiConflict' && !error.message.includes('secret'));
  await assert.rejects(createApi(async()=>{throw Error('secret');}).request('/session'), error => error.key === 'apiUnavailable');
});
