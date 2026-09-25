import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TABIRO_TEST_URL;
if (base && !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/api\/v1$/.test(base)) throw Error('Tests require a loopback API');
function client() {
  let cookie='', csrf='';
  return {get cookie(){return cookie}, async call(path, method='GET', body, options={}) {
    const response=await fetch(base+path,{method,headers:{Cookie:options.cookie??cookie,'Content-Type':'application/json','X-CSRF-Token':options.csrf??csrf},body:body===undefined?undefined:JSON.stringify(body)});
    for(const raw of response.headers.getSetCookie()) if(raw.startsWith('tabiro_session=')) cookie=raw.split(';')[0];
    const json=response.status===204?null:await response.json();
    if(json?.data?.csrf_token) csrf=json.data.csrf_token;
    return {status:response.status,json,headers:response.headers};
  }};
}
test('real MySQL milestone: ownership, persistence, validation and logout', {skip:!base}, async()=>{
 const a=client(), b=client(), other=client();
 assert.equal((await a.call('/session')).status,200);
 const suffix=Date.now(); const email=`a${suffix}@example.test`, password='test-only-password-123';
 const registered=await a.call('/auth/register','POST',{name:'Traveler A',email,password,locale:'ja'});
 assert.equal(registered.status,201); assert.equal(registered.json.data.user.email,email);
 assert.match(registered.headers.get('set-cookie'),/HttpOnly/i);
 const trip=await a.call('/trips','POST',{title:'October Japan',start_date:'2026-10-01',end_date:'2026-10-31',travelers:2,vehicle:'Alphard',budget_minor:100000,currency:'JPY'});
 assert.equal(trip.status,201); const id=trip.json.data.id;
 const day=await a.call(`/trips/${id}/days`,'POST',{date:'2026-10-01',notes:'Draft'});
 assert.equal(day.status,201); const dayId=day.json.data.id;
 const stop=await a.call(`/trips/${id}/days/${dayId}/stops`,'POST',{title:'Nikko',arrival_time:'10:00',departure_time:'12:00',confirmation_status:'unconfirmed'});
 assert.equal(stop.status,201); const stopId=stop.json.data.id;
 await other.call('/session'); assert.equal((await other.call('/auth/login','POST',{email,password})).status,200);
 const retrieved=await other.call(`/trips/${id}`); assert.equal(retrieved.json.data.days[0].stops[0].title,'Nikko');
 await b.call('/session'); await b.call('/auth/register','POST',{name:'Traveler B',email:`b${suffix}@example.test`,password});
 for (const [path,method,body] of [[`/trips/${id}`,'GET'],[`/trips/${id}`,'PATCH',{title:'stolen',revision:1}],[`/trips/${id}`,'DELETE'],[`/trips/${id}/days`,'POST',{date:'2026-10-02'}],[`/trips/${id}/days/${dayId}`,'DELETE'],[`/trips/${id}/days/${dayId}/stops`,'POST',{title:'stolen'}],[`/trips/${id}/days/${dayId}/stops/${stopId}`,'PATCH',{title:'stolen'}],[`/trips/${id}/days/${dayId}/stops/${stopId}`,'DELETE'],[`/trips/${id}/days/${dayId}/order`,'PUT',{stop_ids:[stopId]}]]) assert.equal((await b.call(path,method,body)).status,404,method+path);
 assert.equal((await b.call('/trips')).json.data.length,0);
 assert.equal((await a.call('/trips','POST',{title:'bad',start_date:'2026-02-30',end_date:'2026-03-01'})).status,422);
 assert.equal((await a.call(`/trips/${id}/days`,'POST',{date:'2027-01-01'})).status,422);
 assert.equal((await a.call('/trips','POST',{title:'bad',start_date:'2026-10-01',end_date:'2026-10-02',budget_minor:-1})).status,422);
 assert.equal((await a.call(`/trips/${id}`,'PATCH',{revision:999,title:'conflict'})).status,409);
 assert.equal((await a.call(`/trips/${id}`,'PATCH',{revision:1,title:'Updated'})).status,200);
 assert.equal((await a.call(`/trips/${id}/days/${dayId}/order`,'PUT',{stop_ids:[stopId,stopId]})).status,422);
 assert.equal((await a.call(`/trips/${id}/days/${dayId}/order`,'PUT',{stop_ids:[stopId]})).status,200);
 assert.equal((await a.call('/trips','POST',{}, {csrf:'wrong'})).status,403);
 const replay=other.cookie; assert.equal((await other.call('/auth/logout','POST',{})).status,200);
 assert.equal((await other.call(`/trips/${id}`,'GET',undefined,{cookie:replay})).status,401);
 const login=client(); await login.call('/session');
 assert.equal((await login.call('/auth/login','POST',{email,password:'wrong-password'})).status,401);
 assert.equal((await login.call('/auth/register','POST',{name:'Duplicate',email,password})).status,409);
 assert.equal((await a.call(`/trips/${id}`,'DELETE')).status,204);
 assert.equal((await a.call(`/trips/${id}`)).status,404);
});
