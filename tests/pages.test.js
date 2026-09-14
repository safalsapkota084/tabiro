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
  const dom = new JSDOM(readFileSync(new URL(`../${file}.html`, import.meta.url), 'utf8'), { url: `https://tabiro.test/${file}.html?${params}`, virtualConsole: console });
  const local = options.local || memoryStorage();
  const session = options.session || memoryStorage();
  Object.defineProperty(dom.window, 'localStorage', { value: local });
  Object.defineProperty(dom.window, 'sessionStorage', { value: session });
  for (const name of ['window', 'document', 'location', 'navigator', 'history', 'FormData']) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] });
  globalThis.matchMedia = () => ({ matches: false });
  await import(`../assets/js/app.js?test=${++instance}`);
  return { dom, local, session, errors, $: selector => dom.window.document.querySelector(selector), click: selector => dom.window.document.querySelector(selector).click(), input: (selector, value) => { const input = dom.window.document.querySelector(selector); input.value = value; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }, submit: selector => dom.window.document.querySelector(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })) };
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
    assert.deepEqual(JSON.parse(app.session.getItem('tabiro-demo-profile')), { name: 'Demo <Traveler>' });
    assert.equal(app.$('#password').value, '');
    assert.equal(app.$('#email').value, '');
    assert.equal(app.local.getItem('tabiro-demo-profile'), null);
    app.dom.window.close();
  }
});

test('planner generates, translates and saves a preferences-based itinerary', async () => {
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
  // Another tab saves a plan after this page was opened.
  const otherPlan = createPlan({ routeId: 'alpine', days: 2, travelers: 1 });
  app.local.setItem('tabiro-plans', JSON.stringify([otherPlan]));
  app.click('[data-save-plan]');
  const stored = JSON.parse(app.local.getItem('tabiro-plans'));
  assert.equal(stored.length, 2);
  assert.equal(stored[1].days, 7);
  assert.equal(stored[1].travelers, 3);
  const local = app.local;
  app.dom.window.close();
  const tripPage = await mount('trips', 'ja', { local });
  assert.equal(document.querySelectorAll('.saved-plan').length, 2);
  tripPage.dom.window.close();
});

test('malformed stored trips do not break page rendering and profile names remain text', async () => {
  const malformed = { id: 'x', routeId: 'kyoto', days: 4, travelers: 2, interests: ['unknown'] };
  const app = await mount('trips', 'en', { local: memoryStorage({ 'tabiro-plans': JSON.stringify([malformed]) }) });
  assert.ok(app.$('h1'));
  assert.equal(document.querySelectorAll('.saved-plan').length, 0);
  app.dom.window.close();
  const account = await mount('account', 'fr', { session: memoryStorage({ 'tabiro-demo-profile': JSON.stringify({ name: '<img src=x onerror=alert(1)>' }) }) });
  assert.equal(account.$('.profile-heading h2').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(account.$('.profile-heading img'), null);
  account.dom.window.close();
});
