import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { dictionaries } from '../assets/js/i18n.js';
import { createPlan } from '../assets/js/data.js';

let instance = 0;
function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
async function mount(file, locale = 'en', options = {}) {
  const params = new URLSearchParams({ lang: locale, ...options.params });
  const console = new VirtualConsole();
  const errors = [];
  console.on('jsdomError', error => { if (!error.message.includes('navigation')) errors.push(error); });
  const pageUrl = new URL(`https://tabiro.test/${file}.html?${params}`);
  if (options.hash) pageUrl.hash = options.hash;
  const dom = new JSDOM(readFileSync(new URL(`../${file}.html`, import.meta.url), 'utf8'), { url: pageUrl.href, virtualConsole: console });
  const local = options.local || memoryStorage();
  const session = options.session || memoryStorage();
  Object.defineProperty(dom.window, 'localStorage', { value: local });
  Object.defineProperty(dom.window, 'sessionStorage', { value: session });
  for (const name of ['window', 'document', 'location', 'navigator', 'history', 'FormData']) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] });
  globalThis.matchMedia = () => ({ matches: false });
  const calls = [];
  const fixture = options;
  globalThis.fetch = async (url, options) => {
    calls.push({url, ...options});
    if (fixture.respond) return fixture.respond(url, options);
    const body = options.body ? JSON.parse(options.body) : {};
    const data = options.method === 'POST' && url.includes('/auth/') ? {user:{id:1,name:body.name || 'Traveler'},csrf_token:'rotated'} : url.endsWith('/session') ? {user:optionsUser(),csrf_token:'test'} : url.endsWith('/trips') ? (fixture.trips || []) : fixture.trip || {};
    function optionsUser() { return mountUser; }
    return {ok:true,status:200,json:async()=>({data})};
  };
  const mountUser = options.user || null;
  await import(`../assets/js/app.js?test=${++instance}`);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { dom, local, session, errors, calls, $: selector => dom.window.document.querySelector(selector), click: selector => dom.window.document.querySelector(selector).click(), input: (selector, value) => { const input = dom.window.document.querySelector(selector); input.value = value; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }, submit: selector => dom.window.document.querySelector(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })) };
}

test('all eight pages render in English, Japanese, and French with valid navigation', async () => {
  for (const lang of ['en', 'ja', 'fr']) for (const file of ['index', 'explore', 'route', 'planner', 'trips', 'signin', 'signup', 'account']) {
    const app = await mount(file, lang, { params: { id: 'kyoto' } });
    assert.equal(document.documentElement.lang, lang);
    assert.ok(document.querySelector('main'), `${file} ${lang}: main`);
    assert.ok(document.querySelector('h1, h2')?.textContent.trim());
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    assert.equal(new Set(ids).size, ids.length, `${file} ${lang}: unique IDs`);
    for (const label of document.querySelectorAll('label[for]')) assert.ok(document.getElementById(label.htmlFor));
    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href');
      if (href.startsWith('#')) { assert.ok(document.querySelector(href)); continue; }
      const url = new URL(anchor.href);
      assert.ok(existsSync(new URL(`..${url.pathname}`, import.meta.url)), href);
      assert.equal(url.searchParams.get('lang'), lang, href);
    }
    assert.deepEqual(app.errors, []);
    app.dom.window.close();
  }
});

test('search, category filters, reset and language switching work together', async () => {
  const app = await mount('explore');
  app.input('#route-search', 'Kyoto');
  assert.equal(document.querySelectorAll('.route-card').length, 1);
  app.click('[data-filter="coast"]');
  assert.equal(document.querySelectorAll('.route-card').length, 0);
  app.click('[data-reset]');
  assert.equal(document.querySelectorAll('.route-card').length, 4);
  app.$('#language').value = 'ja';
  app.$('#language').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.documentElement.lang, 'ja');
  assert.equal(app.local.getItem('tabiro-language'), 'ja');
  assert.match(app.$('h1').textContent, /あなた/);
  app.input('#route-search', '京都');
  assert.equal(document.querySelectorAll('.route-card').length, 1);
  app.dom.window.close();
});

test('saving a route keeps changes made by another tab', async () => {
  const app = await mount('explore');
  app.local.setItem('tabiro-saved', '["kyoto"]');
  app.click('[data-save="alpine"]');
  assert.deepEqual(JSON.parse(app.local.getItem('tabiro-saved')).sort(), ['alpine', 'kyoto']);
  app.dom.window.close();
});

test('mobile navigation places keyboard focus inside the opened menu', async () => {
  const app = await mount('index');
  app.click('#menu-toggle');
  assert.equal(app.$('#menu-toggle').getAttribute('aria-expanded'), 'true');
  assert.ok(app.$('#sidebar').contains(document.activeElement));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(document.activeElement.id, 'menu-toggle');
  assert.equal(app.$('#menu-toggle').getAttribute('aria-expanded'), 'false');
  app.dom.window.close();
});

test('signup validation is translated and never persists credentials', async () => {
  for (const lang of ['en', 'ja', 'fr']) {
    const app = await mount('signup', lang);
    app.submit('#auth-form');
    assert.equal(app.$('#name-error').textContent, dictionaries[lang].required);
    app.input('#name', 'Demo <Traveler>');
    app.input('#email', 'invalid');
    app.input('#password', '123');
    app.input('#confirmPassword', 'different-password');
    app.submit('#auth-form');
    assert.equal(app.$('#email-error').textContent, dictionaries[lang].invalidEmail);
    assert.equal(app.$('#password-error').textContent, dictionaries[lang].shortPassword);
    app.input('#email', 'demo@example.test');
    app.input('#password', 'demo-password');
    app.input('#confirmPassword', 'demo-password');
    app.submit('#auth-form');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(app.session.getItem('tabiro-demo-profile'), null);
    assert.equal(JSON.parse(app.calls.find(call => call.url.endsWith('/auth/register')).body).name, 'Demo <Traveler>');
    assert.equal(app.$('#password').value, '');
    assert.equal(app.$('#email').value, '');
    assert.equal(app.local.getItem('tabiro-demo-profile'), null);
    app.dom.window.close();
  }
});

test('recovery fragments are cleared before explicit reset or verification submission', async () => {
  const token = 'a'.repeat(64);
  const reset = await mount('signin', 'fr', { hash: `action=reset_password&token=${token}` });
  assert.equal(reset.dom.window.location.hash, '');
  assert.ok(reset.$('#reset-form'));
  assert.ok(!reset.calls.some(call => call.url.endsWith('/auth/reset-password')));
  reset.input('#reset-password', 'replacement-password-123');
  reset.input('#reset-confirm', 'replacement-password-123');
  reset.submit('#reset-form');
  await settle();
  const resetCall = reset.calls.find(call => call.url.endsWith('/auth/reset-password'));
  assert.equal(JSON.parse(resetCall.body).token, token);
  assert.equal(reset.$('#recovery-status').textContent, dictionaries.fr.passwordUpdated);
  assert.ok(!reset.dom.window.location.href.includes(token));
  reset.dom.window.close();

  const verify = await mount('signin', 'ja', { hash: `action=verify_email&token=${token}` });
  assert.equal(verify.dom.window.location.hash, '');
  assert.ok(verify.$('#verify-form'));
  assert.ok(!verify.calls.some(call => call.url.endsWith('/auth/verify-email')));
  verify.submit('#verify-form');
  await settle();
  assert.equal(JSON.parse(verify.calls.find(call => call.url.endsWith('/auth/verify-email')).body).token, token);
  assert.equal(verify.$('#recovery-status').textContent, dictionaries.ja.emailVerified);
  verify.dom.window.close();
});

test('forgot-password and authenticated verification requests use the API', async () => {
  const forgot = await mount('signin', 'en');
  forgot.input('#recovery-email', 'traveler@example.test');
  forgot.submit('#forgot-form');
  await settle();
  const forgotCall = forgot.calls.find(call => call.url.endsWith('/auth/forgot-password'));
  assert.equal(JSON.parse(forgotCall.body).email, 'traveler@example.test');
  assert.equal(forgot.$('#recovery-status').textContent, dictionaries.en.recoverySent);
  forgot.dom.window.close();

  const account = await mount('account', 'fr', { user: {id:1,name:'Traveler',email:'traveler@example.test',verified_at:null} });
  account.click('#verification-request');
  await settle();
  assert.ok(account.calls.some(call => call.url.endsWith('/auth/verification-request') && call.method === 'POST'));
  assert.equal(account.$('#verification-status').textContent, dictionaries.fr.verificationRequested);
  account.dom.window.close();
});

test('sample planner generates and translates inspiration without fake persistence', async () => {
  const app = await mount('planner');
  app.input('[name="travelers"]', '0');
  app.submit('#planner-form');
  assert.equal(app.$('#planner-error').textContent, dictionaries.en.invalidPlan);
  app.input('[name="travelers"]', '3');
  app.input('[name="days"]', '7');
  app.submit('#planner-form');
  assert.equal(app.$('#generate').disabled, true);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(document.querySelectorAll('.timeline li').length, 7);
  app.$('#language').value = 'fr';
  app.$('#language').dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.querySelectorAll('.timeline li').length, 7);
  assert.match(app.$('.day-label').textContent, /Jour/);
  assert.equal(app.$('[data-save-plan]'), null);
  assert.ok(app.$('#private-itinerary'));
  app.dom.window.close();
});

test('malformed stored trips do not break page rendering and profile names remain text', async () => {
  const malformed = { id: 'x', routeId: 'kyoto', days: 4, travelers: 2, interests: ['unknown'] };
  const app = await mount('trips', 'en', { local: memoryStorage({ 'tabiro-plans': JSON.stringify([malformed]) }) });
  assert.ok(app.$('h1'));
  assert.equal(document.querySelectorAll('.saved-plan').length, 0);
  app.dom.window.close();
  const account = await mount('account', 'fr', { user: {id:1,name:'<img src=x onerror=alert(1)>'} });
  assert.equal(account.$('.profile-heading h2').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(account.$('.profile-heading img'), null);
  account.dom.window.close();
});

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
test('private trip list comes from API and escapes titles', async () => {
  const app = await mount('trips','ja',{user:{id:1,name:'A'},trips:[{id:7,title:'<script>bad</script>',start_date:'2026-10-01',end_date:'2026-10-02'}]});
  await settle();
  assert.equal(app.$('#private-itinerary h3').textContent,'<script>bad</script>');
  assert.equal(app.$('#private-itinerary script'),null);
  assert.match(app.$('#private-itinerary h3 a').href,/trip=7/);
  assert.ok(app.calls.some(call => call.url === '/api/v1/trips'));
  app.dom.window.close();
});

test('private editor sends revision, dated days, stops, duplication and complete reorder', async () => {
  const trip = {id:7,title:'Kyoto',description:'',start_date:'2026-10-01',end_date:'2026-10-03',travelers:2,vehicle:'car',budget_minor:5000,currency:'JPY',revision:3,days:[{id:8,date:'2026-10-01',notes:'',stops:[{id:9,title:'Temple',notes:'',arrival_time:'09:00:00',departure_time:null,confirmation_status:'unconfirmed'},{id:10,title:'Park',notes:'',confirmation_status:'confirmed'}]}]};
  const app = await mount('planner','fr',{params:{trip:7},user:{id:1,name:'A'},trip});
  await settle();
  assert.equal(app.$('[name="arrival_time"]').value,'09:00');
  app.input('[data-trip-form] [name="title"]','Revised');
  app.submit('[data-trip-form]'); await settle();
  let call = app.calls.find(call=>call.method === 'PATCH');
  assert.equal(JSON.parse(call.body).revision,3);
  assert.equal(JSON.parse(call.body).title,'Revised');
  app.input('[data-edit-day="8"] [name="notes"]','Updated day'); app.submit('[data-edit-day="8"]'); await settle();
  assert.equal(JSON.parse(app.calls.find(call=>call.url.endsWith('/days/8') && call.method === 'PATCH').body).notes,'Updated day');
  app.input('[data-day-form] [name="date"]','2026-10-02'); app.submit('[data-day-form]'); await settle();
  assert.equal(JSON.parse(app.calls.find(call=>call.url.endsWith('/days') && call.method === 'POST').body).date,'2026-10-02');
  app.input('[data-stop-form=""] [name="title"]','Lunch'); app.submit('[data-stop-form=""]'); await settle();
  assert.equal(JSON.parse(app.calls.find(call=>call.url.endsWith('/stops') && call.method === 'POST').body).title,'Lunch');
  app.click('[data-duplicate="9"]'); await settle();
  assert.equal(JSON.parse(app.calls.filter(call=>call.url.endsWith('/stops') && call.method === 'POST').at(-1).body).title,'Temple');
  app.click('[data-move="10"][data-direction="-1"]'); await settle();
  assert.deepEqual(JSON.parse(app.calls.find(call=>call.method === 'PUT').body).stop_ids,[10,9]);
  app.dom.window.confirm = () => true;
  app.click('[data-delete-stop="9"]'); await settle();
  assert.ok(app.calls.some(call=>call.method === 'DELETE' && call.url.endsWith('/days/8/stops/9')));
  app.dom.window.close();
});

test('failed creation preserves draft and displays translated safe errors', async () => {
  const app = await mount('planner','ja',{respond:async(url,options)=>url.endsWith('/session') ? {ok:true,status:200,json:async()=>({data:{user:{id:1,name:'A'},csrf_token:'csrf'}})} : {ok:false,status:422,json:async()=>({error:{message:'SQL secret'}})}});
  await settle();
  app.input('[data-trip-form] [name="title"]','Keep my draft');
  app.submit('[data-trip-form]'); await settle();
  assert.equal(app.$('[data-trip-form] [name="title"]').value,'Keep my draft');
  assert.equal(app.$('#private-itinerary [role="alert"]').textContent,dictionaries.ja.apiInvalid);
  assert.ok(!app.$('#private-itinerary').textContent.includes('SQL'));
  assert.equal(app.$('.itinerary-controls').disabled,false);
  app.dom.window.close();
});

test('new private trip is created remotely and remains editable at its stable URL', async () => {
  let trip = null;
  const app = await mount('planner','en',{respond:async(url, options)=>{
    let data;
    if (url.endsWith('/session')) data = {user:{id:1,name:'A'},csrf_token:'csrf'};
    else if (url.endsWith('/trips') && options.method === 'POST') { trip = {...JSON.parse(options.body),id:11,revision:1,days:[]}; data = trip; }
    else data = trip;
    return {ok:true,status:200,json:async()=>({data})};
  }});
  await settle();
  app.input('[data-trip-form] [name="title"]','A dated journey');
  app.input('[data-trip-form] [name="start_date"]','2026-11-01');
  app.input('[data-trip-form] [name="end_date"]','2026-11-03');
  app.submit('[data-trip-form]'); await settle();
  assert.equal(trip.title,'A dated journey');
  assert.equal(new URL(app.dom.window.location.href).searchParams.get('trip'),'11');
  assert.ok(app.$('[data-day-form]'));
  assert.equal(app.local.getItem('tabiro-plans'),null);
  app.dom.window.close();
});

test('account updates and logout use authenticated API without browser profiles', async () => {
  const user = {id:1,name:'Original',email:'a@example.test',locale:'en'};
  const app = await mount('account','fr',{respond:async(url,options)=>{
    const data = url.endsWith('/me') ? {...user,...JSON.parse(options.body)} : {user,csrf_token:'csrf'};
    return {ok:true,status:200,json:async()=>({data})};
  }});
  app.input('[name="name"]','Updated'); app.submit('#profile-form'); await settle();
  assert.equal(app.$('.profile-heading h2').textContent,'Updated');
  assert.equal(JSON.parse(app.calls.find(call=>call.method === 'PATCH').body).locale,'fr');
  app.click('#signout'); await settle();
  assert.ok(app.calls.some(call=>call.url.endsWith('/auth/logout') && call.method === 'POST'));
  assert.equal(app.session.getItem('tabiro-demo-profile'),null);
  app.dom.window.close();
});
