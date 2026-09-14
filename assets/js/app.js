import { translate, resolveLocale } from './i18n.js';
import { routes, images, getRoute, createPlan, planDays, validPlan } from './data.js';
import { getStorage, readList, safeWrite, readProfile } from './store.js';

const local = getStorage(), session = getStorage('sessionStorage');
const params = new URLSearchParams(location.search);
let storedLocale;
try { storedLocale = local?.getItem('tabiro-language'); } catch {}
let lang = resolveLocale(params.get('lang') || storedLocale || navigator.language);
const page = document.body.dataset.page || 'home';
const pageKeys = { home: 'discover', explore: 'explore', planner: 'planner', trips: 'trips', route: 'explore', signin: 'signIn', signup: 'signUp', account: 'account' };
let profile = readProfile(session);
let saved = new Set(readList(local, 'tabiro-saved', id => typeof id === 'string' && Boolean(getRoute(id))));
let plans = readList(local, 'tabiro-plans', validPlan);
let activePlan = plans.find(plan => plan.id === params.get('plan')) || null;
let plannerDraft = activePlan || { routeId: getRoute(params.get('destination'))?.id || 'kyoto', days: 4, travelers: 2, pace: 'balanced', interests: ['nature', 'food'] };
let category = 'all', query = '', toastTimer, busy = false;
const $ = selector => document.querySelector(selector);
const t = (key, values) => translate(lang, key, values);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const link = (file, values = {}) => `${file}.html?${new URLSearchParams({ ...values, lang })}`;
const symbolPaths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16m6-14v16"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  up: '<path d="M6 18 18 6M6 6h12v12"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  leaf: '<path d="M20 3C8 2 2 9 6 16s15 2 14-13ZM4 21 16 9"/>',
  food: '<path d="M5 3v6m4-6v6M3 3v4a4 4 0 0 0 8 0V3M7 11v10M19 3c-5 2-5 10 0 10V3Zm0 10v8"/>',
  culture: '<path d="m3 8 9-5 9 5ZM5 10v8m7-8v8m7-8v8M3 21h18"/>',
  logout: '<path d="M9 3H3v18h6m5-14 5 5-5 5m-7-5h14"/>',
};
const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbolPaths[name] || symbolPaths.compass}</svg>`;
const brand = `<span class="brand-mark">${icon('compass')}</span><span>tabiro<span class="orange">.</span></span>`;
const buttonLink = (label, file, options = {}, secondary = false) => `<a class="button ${secondary ? 'secondary' : ''}" href="${link(file, options)}">${esc(t(label))}${icon('arrow')}</a>`;
function localeControl(id = 'language') {
  return `<label class="language-control" for="${id}">${icon('globe')}<span class="sr-only">${t('language')}</span><select id="${id}" data-language><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="ja" ${lang === 'ja' ? 'selected' : ''}>日本語</option><option value="fr" ${lang === 'fr' ? 'selected' : ''}>Français</option></select></label>`;
}
function render() {
  document.documentElement.lang = lang;
  document.title = `${t(pageKeys[page])} — Tabiro`;
  const isAuth = page === 'signin' || page === 'signup';
  document.body.classList.toggle('auth-body', isAuth);
  $('#app').innerHTML = isAuth ? authPage() : shell();
  bindCommon();
  if (page === 'explore') bindExplore();
  if (page === 'planner') bindPlanner();
  if (isAuth) bindAuth();
  if (page === 'account') bindAccount();
}
function shell() {
  const navItems = [['home', 'discover', 'compass', 'index'], ['explore', 'explore', 'map', 'explore'], ['planner', 'planner', 'spark', 'planner'], ['trips', 'trips', 'heart', 'trips']];
  const content = { home: homePage, explore: explorePage, planner: plannerPage, trips: tripsPage, route: routePage, account: accountPage }[page] || homePage;
  return `<a class="skip-link" href="#main">${t('skip')}</a><aside class="sidebar" id="sidebar"><a class="brand" href="${link('index')}">${brand}</a><div class="workspace-label">${t('workspace')}</div><nav aria-label="${t('menu')}">${navItems.map(([id, key, glyph, file]) => `<a class="nav-item ${(page === id || (page === 'route' && id === 'explore')) ? 'active' : ''}" ${page === id || (page === 'route' && id === 'explore') ? 'aria-current="page"' : ''} href="${link(file)}">${icon(glyph)}<span>${t(key)}</span>${id === 'planner' ? '<span class="nav-dot"></span>' : ''}</a>`).join('')}</nav><div class="sidebar-promo"><span class="promo-symbol">✳</span><h3>${t('sidebarTitle')}</h3><p>${t('sidebarText')}</p><a href="${link('planner')}">${t('tryPlanner')} ${icon('arrow')}</a></div><div class="sidebar-bottom"><a class="nav-item ${page === 'account' ? 'active' : ''}" ${page === 'account' ? 'aria-current="page"' : ''} href="${link('account')}">${icon('user')}<span>${t('account')}</span></a><p>${t('littleFurther')}</p></div></aside><div class="workspace"><header class="topbar"><div class="topbar-left"><button class="icon-button mobile-menu" aria-label="${t('menu')}" aria-expanded="false" aria-controls="sidebar" id="menu-toggle">${icon('menu')}</button><span class="breadcrumb">${t(pageKeys[page])}</span></div><div class="topbar-actions">${localeControl()}<span class="topbar-divider"></span>${profile ? `<a class="profile-link" href="${link('account')}" aria-label="${t('account')}"><span class="avatar">${esc(profile.name.slice(0, 1).toUpperCase())}</span><span class="profile-name">${esc(profile.name)}</span></a>` : `<a class="signin-link" href="${link('signin')}">${t('signIn')}</a><a class="button small" href="${link('signup')}">${t('signUp')}</a>`}</div></header><main id="main" class="main" tabindex="-1">${content()}</main><footer><span>© ${new Date().getFullYear()} Tabiro</span><span>${t('littleFurther')}</span><span class="preview-label"><i></i>${t('demo')}</span></footer></div><div class="toast" role="status" aria-live="polite"></div>`;
}
const heading = (title, description, action = '') => `<div class="page-heading"><div><p class="eyebrow">TABIRO / ${t(pageKeys[page]).toUpperCase()}</p><h1>${esc(title)}</h1><p class="page-intro">${esc(description)}</p></div>${action}</div>`;
function card(route) {
  const isSaved = saved.has(route.id);
  return `<article class="route-card"><div class="card-cover image-${route.image}"><a href="${link('route', { id: route.id })}" aria-label="${esc(route.title[lang])}"><img src="${images[route.image]}" alt="" loading="lazy"></a><span class="category-badge">${t(route.category)}</span><button class="save-button ${isSaved ? 'is-saved' : ''}" data-save="${route.id}" aria-pressed="${isSaved}" aria-label="${t(isSaved ? 'saved' : 'save')}: ${esc(route.title[lang])}">${icon('heart')}</button></div><div class="card-content"><p class="location">${icon('pin')}${esc(route.region[lang])}</p><h3><a href="${link('route', { id: route.id })}">${esc(route.title[lang])}</a></h3><div class="card-bottom"><span>${icon('clock')}${t('days', { count: route.days })}</span><a href="${link('route', { id: route.id })}" aria-label="${t('viewRoute')}: ${esc(route.title[lang])}">${icon('up')}</a></div></div></article>`;
}
function homePage() {
  return `${heading(profile ? t('greeting', { name: profile.name }) : t('hello'), t('dashboardIntro'))}<section class="dashboard-hero"><div class="hero-content"><p class="eyebrow"><span class="orange-dot"></span>${t('heroKicker')}</p><h2>${esc(t('heroTitle')).replace('\n', '<br>')}</h2><p>${t('heroText')}</p><div class="button-row">${buttonLink('planTrip', 'planner')}${buttonLink('findRoute', 'explore', {}, true)}</div></div><div class="hero-art"><img src="assets/images/journey.svg" alt=""><span class="art-caption">${t('littleFurther')}</span></div></section><div class="dashboard-stats"><a href="${link('trips')}"><span class="stat-icon">${icon('heart')}</span><div><strong>${t('savedCount', { count: saved.size })}</strong><span>${t('savedRoutes')}</span></div>${icon('arrow')}</a><a href="${link('trips')}"><span class="stat-icon peach">${icon('map')}</span><div><strong>${t('planCount', { count: plans.length })}</strong><span>${t('plannedTrips')}</span></div>${icon('arrow')}</a><a href="${link('planner')}" class="planner-shortcut">${icon('spark')}<div><strong>${t('planner')}</strong><span>${t('sidebarText')}</span></div>${icon('arrow')}</a></div><section><div class="section-heading"><div><h2>${t('madeForYou')}</h2><p>${t('handpicked')}</p></div><a class="text-link" href="${link('explore')}">${t('viewAll')}${icon('arrow')}</a></div><div class="card-grid home-cards">${routes.slice(0, 3).map(card).join('')}</div></section>`;
}
function explorePage() {
  return `${heading(t('exploreTitle'), t('exploreIntro'))}<div class="explore-tools"><label class="search-field">${icon('search')}<span class="sr-only">${t('search')}</span><input id="route-search" type="search" value="${esc(query)}" placeholder="${t('searchPlaceholder')}" maxlength="100"></label><div class="filters" aria-label="${t('explore')}">${['all', 'coast', 'mountains', 'countryside'].map(type => `<button class="filter" data-filter="${type}" aria-pressed="${category === type}">${t(type)}</button>`).join('')}</div></div><p class="result-count" id="result-count" role="status"></p><div class="card-grid explore-grid" id="route-results"></div>`;
}
function filteredRoutes() {
  const normalized = query.normalize('NFKC').toLocaleLowerCase(lang).trim();
  return routes.filter(route => (category === 'all' || category === route.category) && `${route.title[lang]} ${route.region[lang]} ${t(route.category)} ${route.title.en} ${route.region.en}`.normalize('NFKC').toLocaleLowerCase(lang).includes(normalized));
}
function updateResults() {
  const list = filteredRoutes();
  $('#result-count').textContent = t('results', { count: list.length });
  $('#route-results').innerHTML = list.length ? list.map(card).join('') : `<div class="empty-state full-width">${icon('search')}<h2>${t('noResults')}</h2><p>${t('noResultsText')}</p><button class="button secondary" data-reset>${t('resetFilters')}</button></div>`;
}
function bindExplore() {
  updateResults();
  $('#route-search').addEventListener('input', event => { query = event.target.value; updateResults(); });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    updateResults();
  }));
}
function timeline(days) {
  return `<ol class="timeline">${days.map((day, i) => `<li><span class="day-number">${String(i + 1).padStart(2, '0')}</span><div><p class="day-label">${t('day', { count: i + 1 })}</p><h3>${esc(day.title)}</h3><p>${esc(day.description)}</p></div></li>`).join('')}</ol>`;
}
function routePage() {
  const route = getRoute(params.get('id'));
  if (!route) return `<div class="empty-state">${icon('map')}<h1>${t('routeNotFound')}</h1>${buttonLink('backExplore', 'explore')}</div>`;
  return `<a class="text-link back-link" href="${link('explore')}">← ${t('backExplore')}</a><section class="route-hero image-${route.image}"><img src="${images[route.image]}" alt=""><div class="route-hero-content"><span class="category-badge">${t(route.category)}</span><p>${esc(route.region[lang])}</p><h1>${esc(route.title[lang])}</h1><span>${t('days', { count: route.days })} · ${t('sampleRoute')}</span></div><span class="photo-label">${t('photoNote')}</span></section><div class="detail-layout"><section><h2>${t('overview')}</h2><p class="route-description">${esc(route.description[lang])}</p><h2 class="itinerary-heading">${t('itinerary')}</h2>${timeline(route.stops.slice(0, route.days).map(stop => ({ title: stop[lang][0], description: stop[lang][1] })))}</section><aside class="panel trip-summary">${icon('spark')}<h2>${t('makeItYours')}</h2><p>${t('customizeText')}</p>${buttonLink('customize', 'planner', { destination: route.id })}<button class="button secondary" data-save="${route.id}" aria-pressed="${saved.has(route.id)}">${icon(saved.has(route.id) ? 'check' : 'heart')}<span>${t(saved.has(route.id) ? 'saved' : 'save')}</span></button><div class="notice">${t('routeNote')}</div></aside></div>`;
}
function plannerPage() {
  return `${heading(t('plannerTitle'), t('plannerIntro'))}<div class="demo-notice">${icon('spark')}<span>${t('plannerDemo')}</span></div>${params.has('plan') && !activePlan ? `<p class="notice">${t('planMissing')}</p>` : ''}<div class="planner-layout"><section class="panel planner-form-panel"><h2>${t('tripDetails')}</h2><form id="planner-form" novalidate><label class="field">${t('destination')}<select name="routeId">${routes.map(route => `<option value="${route.id}" ${plannerDraft.routeId === route.id ? 'selected' : ''}>${esc(route.region[lang])}</option>`).join('')}</select></label><div class="field-row"><label class="field">${t('duration')}<select name="days">${[2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${Number(plannerDraft.days) === n ? 'selected' : ''}>${t('days', { count: n })}</option>`).join('')}</select></label><label class="field">${t('travelers')}<input type="number" min="1" max="8" step="1" name="travelers" value="${esc(plannerDraft.travelers)}" required></label></div><fieldset><legend>${t('pace')}</legend><div class="pace-options">${['relaxed', 'balanced', 'active'].map(pace => `<label><input type="radio" name="pace" value="${pace}" ${plannerDraft.pace === pace ? 'checked' : ''}><span>${t(pace)}</span></label>`).join('')}</div></fieldset><fieldset><legend>${t('interests')}</legend><div class="interest-options">${['nature', 'food', 'culture'].map(interest => `<label><input type="checkbox" name="interests" value="${interest}" ${plannerDraft.interests.includes(interest) ? 'checked' : ''}><span>${icon(interest === 'nature' ? 'leaf' : interest)}${t(interest)}</span></label>`).join('')}</div></fieldset><p class="form-error" id="planner-error" role="alert"></p><button class="button full-width" type="submit" id="generate" ${busy ? 'disabled' : ''}>${icon('spark')}${t(busy ? 'building' : activePlan ? 'regenerate' : 'generate')}</button></form></section><section class="panel planner-output" id="planner-output" aria-busy="${busy}" aria-label="${t('itinerary')}">${planOutput()}</section></div>`;
}
function planOutput() {
  if (!activePlan) return `<div class="empty-planner"><div class="empty-orbit">${icon('spark')}</div><h2>${t('emptyPlannerTitle')}</h2><p>${t('emptyPlannerText')}</p><div class="skeleton-route" aria-hidden="true"><span></span><span></span><span></span></div></div>`;
  const route = getRoute(activePlan.routeId);
  const isSaved = plans.some(plan => plan.id === activePlan.id);
  return `<div class="output-heading" tabindex="-1"><p class="eyebrow">${t('samplePlan')}</p><h2>${esc(route.title[lang])}</h2><div class="plan-meta"><span>${icon('clock')}${t('days', { count: activePlan.days })}</span><span>${icon('user')}${t('travelersCount', { count: activePlan.travelers })}</span><span>${t(activePlan.pace)}</span></div></div>${timeline(planDays(activePlan, lang))}<div class="output-actions"><button class="button" data-save-plan ${isSaved ? 'disabled' : ''}>${icon(isSaved ? 'check' : 'heart')}${t(isSaved ? 'saved' : 'savePlan')}</button><button class="button secondary" data-download>${icon('download')}${t('download')}</button></div><p class="notice">${t('routeNote')}</p>`;
}
function bindPlanner() {
  const form = $('#planner-form');
  const readDraft = () => { const fields = new FormData(form); plannerDraft = { routeId: fields.get('routeId'), days: fields.get('days'), travelers: fields.get('travelers'), pace: fields.get('pace'), interests: fields.getAll('interests') }; };
  form.addEventListener('input', readDraft);
  form.addEventListener('change', readDraft);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    readDraft();
    let next;
    try { next = createPlan(plannerDraft); } catch {
      $('#planner-error').textContent = t('invalidPlan');
      form.elements.travelers.focus(); return;
    }
    $('#planner-error').textContent = '';
    busy = true;
    $('#generate').disabled = true;
    $('#generate').textContent = t('building');
    $('#planner-output').setAttribute('aria-busy', 'true');
    setTimeout(() => {
      activePlan = next; busy = false;
      $('#planner-output').innerHTML = planOutput();
      $('#planner-output').setAttribute('aria-busy', 'false');
      $('#generate').disabled = false;
      $('#generate').innerHTML = `${icon('spark')}${t('regenerate')}`;
      $('.output-heading').focus({ preventScroll: true });
      if (matchMedia('(max-width: 800px)').matches) $('#planner-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 550);
  });
}
function tripsPage() {
  const savedRoutes = routes.filter(route => saved.has(route.id));
  return `${heading(t('tripsTitle'), t('tripsIntro'), buttonLink('planTrip', 'planner'))}<p class="local-note">${icon('heart')}${t('browserSaved')}</p><section><div class="section-heading"><h2>${t('savedRoutes')} <span class="count-badge">${savedRoutes.length}</span></h2></div>${savedRoutes.length ? `<div class="card-grid home-cards">${savedRoutes.map(card).join('')}</div>` : `<div class="empty-state compact">${icon('heart')}<h2>${t('noTrips')}</h2><p>${t('noTripsText')}</p>${buttonLink('findRoute', 'explore')}</div>`}</section><section class="plans-section"><div class="section-heading"><h2>${t('plannedTrips')} <span class="count-badge">${plans.length}</span></h2></div>${plans.length ? `<div class="saved-plans">${plans.map(plan => { const route = getRoute(plan.routeId); return `<article class="saved-plan"><span class="stat-icon peach">${icon('map')}</span><div><h3><a href="${link('planner', { plan: plan.id })}">${esc(route.title[lang])}</a></h3><p>${t('days', { count: plan.days })} · ${t('travelersCount', { count: plan.travelers })} · ${t(plan.pace)}</p></div><div class="saved-plan-actions"><a class="text-link" href="${link('planner', { plan: plan.id })}">${t('viewPlan')}${icon('arrow')}</a><button class="subtle-button" data-remove-plan="${esc(plan.id)}" aria-label="${t('remove')}: ${esc(route.title[lang])}">${t('remove')}</button></div></article>`; }).join('')}</div>` : `<div class="empty-state compact"><p>${t('noPlans')}</p>${buttonLink('tryPlanner', 'planner', {}, true)}</div>`}</section>`;
}
function authPage() {
  const signup = page === 'signup';
  return `<div class="auth-layout"><aside class="auth-art"><a class="brand" href="${link('index')}">${brand}</a><div class="auth-story"><p class="eyebrow">${t('heroKicker')}</p><h1>${esc(t('authQuote')).replace('\n', '<br>')}</h1><p>${t('authSub')}</p><img src="assets/images/journey.svg" alt=""></div><span class="auth-tagline">${t('littleFurther')}</span></aside><div class="auth-main"><header class="auth-top"><a class="auth-mobile-brand brand" href="${link('index')}">${brand}</a>${localeControl()}</header><main class="auth-form-wrap" id="main"><p class="eyebrow">${t(signup ? 'signUp' : 'signIn')}</p><h2>${t(signup ? 'signupTitle' : 'welcomeBack')}</h2><p class="page-intro">${t(signup ? 'signupIntro' : 'signInIntro')}</p><div class="demo-notice auth-demo">${icon('user')}<span>${t('authDemo')}</span></div><form id="auth-form" novalidate>${signup ? authField('name', 'text', 'name', 'namePlaceholder') : ''}${authField('email', 'email', 'email')}${authField('password', 'password', signup ? 'new-password' : 'current-password')}${signup ? authField('confirmPassword', 'password', 'new-password') : ''}<p class="password-hint">${t('passwordHint')}</p><p class="form-error" id="auth-error" role="alert"></p><button class="button full-width" type="submit">${t(signup ? 'signupSubmit' : 'signinSubmit')}${icon('arrow')}</button></form><p class="auth-switch">${t(signup ? 'hasAccount' : 'noAccount')} <a href="${link(signup ? 'signin' : 'signup')}">${t(signup ? 'signIn' : 'signUp')}</a></p><a class="guest-link" href="${link('index')}">${t('guest')}${icon('arrow')}</a></main><footer><span>© ${new Date().getFullYear()} Tabiro</span><span>${t('demo')}</span></footer></div></div><div class="toast" role="status" aria-live="polite"></div>`;
}
function authField(name, type, autocomplete, placeholder) {
  return `<div class="field auth-field"><label for="${name}">${t(name)}</label><div class="input-wrap"><input id="${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" required maxlength="${name === 'name' ? 60 : 254}" ${type === 'password' ? 'minlength="8"' : ''} ${placeholder ? `placeholder="${t(placeholder)}"` : ''} aria-describedby="${name}-error">${type === 'password' ? `<button type="button" class="password-toggle" data-password="${name}" aria-label="${t('showPassword')}" aria-pressed="false">${icon('compass')}</button>` : ''}</div><span class="field-error" id="${name}-error"></span></div>`;
}
function bindAuth() {
  const form = $('#auth-form');
  form.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    const error = document.getElementById(`${event.target.name}-error`);
    if (error) error.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); let firstInvalid;
    [...form.querySelectorAll('input')].forEach(input => {
      let error = '';
      if (!input.value.trim()) error = t('required');
      else if (input.type === 'email' && input.validity.typeMismatch) error = t('invalidEmail');
      else if (input.name.toLowerCase().includes('password') && input.value.length < 8) error = t('shortPassword');
      else if (input.name === 'confirmPassword' && input.value !== form.elements.password.value) error = t('mismatch');
      $(`#${input.name}-error`).textContent = error;
      input.setAttribute('aria-invalid', String(Boolean(error)));
      if (error && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }
    const nextProfile = { name: page === 'signup' ? form.elements.name.value.trim() : t('traveler') };
    // Demo only: never persist or transmit credentials, including email.
    if (!safeWrite(session, 'tabiro-demo-profile', nextProfile)) { $('#auth-error').textContent = t('sessionError'); return; }
    form.reset();
    location.href = link('account');
  });
}
function accountPage() {
  return `${heading(t('accountTitle'), t('accountIntro'))}${profile ? `<div class="account-layout"><section class="panel"><div class="profile-heading"><span class="avatar large">${esc(profile.name.slice(0, 1).toUpperCase())}</span><div><h2>${esc(profile.name)}</h2><span class="demo-badge">${t('demoProfile')}</span></div></div><p class="notice">${t('demoProfileText')}</p><form id="profile-form" novalidate><label class="field">${t('name')}<input name="name" value="${esc(profile.name)}" required maxlength="60" aria-describedby="profile-error"></label><p class="form-error" id="profile-error" role="alert"></p><button type="submit" class="button">${t('saveChanges')}${icon('check')}</button></form></section><section class="panel account-settings"><h2>${t('preferences')}</h2><p>${t('language')}</p>${localeControl('account-language')}<hr><p class="notice">${t('privacyLocal')}</p><a class="text-link" href="${link('trips')}">${t('trips')}${icon('arrow')}</a><button class="button secondary full-width" id="signout">${icon('logout')}${t('signOut')}</button></section></div>` : `<div class="empty-state account-empty">${icon('user')}<h2>${t('guestTitle')}</h2><p>${t('guestText')}</p><div class="button-row">${buttonLink('signUp', 'signup')}${buttonLink('signIn', 'signin', {}, true)}</div><p class="notice">${t('privacyLocal')}</p></div>`}`;
}
function bindAccount() {
  $('#profile-form')?.addEventListener('submit', event => {
    event.preventDefault(); const input = event.target.elements.name;
    if (!input.value.trim()) { $('#profile-error').textContent = t('required'); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    const next = { name: input.value.trim() };
    if (!safeWrite(session, 'tabiro-demo-profile', next)) { $('#profile-error').textContent = t('sessionError'); return; }
    profile = next; render(); notify(t('changesSaved'));
  });
  $('#signout')?.addEventListener('click', () => {
    try { session.removeItem('tabiro-demo-profile'); } catch { notify(t('sessionError')); return; }
    profile = null; location.href = link('index');
  });
}
function notify(message) {
  $('.toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if ($('.toast')) $('.toast').textContent = ''; }, 3600);
}
function bindCommon() {
  document.querySelectorAll('[data-language]').forEach(select => select.addEventListener('change', event => {
    const focusId = event.target.id;
    // Keep unfinished form input across language changes, without writing it to storage.
    const draftForm = $('#auth-form') || $('#profile-form');
    const draft = draftForm ? [...draftForm.querySelectorAll('input')].map(input => [input.name, input.value]) : [];
    lang = resolveLocale(event.target.value);
    try { local?.setItem('tabiro-language', lang); } catch {}
    const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
    render();
    const restoredForm = $('#auth-form') || $('#profile-form');
    if (restoredForm) draft.forEach(([name, value]) => { if (restoredForm.elements[name]) restoredForm.elements[name].value = value; });
    document.getElementById(focusId)?.focus();
  }));
  $('#menu-toggle')?.addEventListener('click', () => {
    const open = $('#menu-toggle').getAttribute('aria-expanded') !== 'true';
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
    $('#menu-toggle').setAttribute('aria-label', t(open ? 'close' : 'menu'));
    $('#sidebar').classList.toggle('is-open', open);
    if (open) $('#sidebar nav a').focus();
  });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#sidebar')?.classList.contains('is-open')) {
    $('#sidebar').classList.remove('is-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); $('#menu-toggle').setAttribute('aria-label', t('menu')); $('#menu-toggle').focus();
  }
});
document.addEventListener('click', event => {
  const saveButton = event.target.closest('[data-save]');
  if (saveButton) {
    const id = saveButton.dataset.save;
    if (!getRoute(id)) return;
    const wasSaved = saved.has(id);
    const next = new Set(readList(local, 'tabiro-saved', value => typeof value === 'string' && Boolean(getRoute(value))));
    wasSaved ? next.delete(id) : next.add(id);
    if (!safeWrite(local, 'tabiro-saved', [...next])) { notify(t('storageError')); return; }
    saved = next;
    if (page === 'trips') { render(); $('#main').focus({ preventScroll: true }); }
    else document.querySelectorAll('[data-save]').forEach(button => {
      const buttonId = button.dataset.save;
      const active = saved.has(buttonId);
      button.setAttribute('aria-pressed', String(active)); button.classList.toggle('is-saved', active);
      button.setAttribute('aria-label', `${t(active ? 'saved' : 'save')}: ${getRoute(buttonId).title[lang]}`);
      if (button.classList.contains('button')) button.innerHTML = `${icon(active ? 'check' : 'heart')}<span>${t(active ? 'saved' : 'save')}</span>`;
    });
    if (page === 'home') { const label = $('.dashboard-stats strong'); label.textContent = t('savedCount', { count: saved.size }); }
    notify(t(saved.has(id) ? 'routeSaved' : 'routeRemoved'));
  }
  if (event.target.closest('[data-reset]')) { category = 'all'; query = ''; render(); $('#route-search').focus(); }
  if (event.target.closest('[data-save-plan]') && activePlan) {
    const latestPlans = readList(local, 'tabiro-plans', validPlan);
    const next = [...latestPlans.filter(plan => plan.id !== activePlan.id), activePlan];
    if (!safeWrite(local, 'tabiro-plans', next)) { notify(t('storageError')); return; }
    plans = next; $('#planner-output').innerHTML = planOutput(); $('.output-heading').focus({ preventScroll: true }); notify(t('planSaved'));
  }
  const removeButton = event.target.closest('[data-remove-plan]');
  if (removeButton) {
    const next = readList(local, 'tabiro-plans', validPlan).filter(plan => plan.id !== removeButton.dataset.removePlan);
    if (!safeWrite(local, 'tabiro-plans', next)) { notify(t('storageError')); return; }
    plans = next; render(); $('#main').focus({ preventScroll: true }); notify(t('removedPlan'));
  }
  if (event.target.closest('[data-download]') && activePlan) {
    const route = getRoute(activePlan.routeId);
    const content = `${route.title[lang]}\n${t('days', { count: activePlan.days })} · ${t('travelersCount', { count: activePlan.travelers })}\n\n${t('plannerDemo')}\n\n${planDays(activePlan, lang).map((day, i) => `${t('day', { count: i + 1 })} — ${day.title}\n${day.description}`).join('\n\n')}\n\n${t('routeNote')}\n\nTabiro`;
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tabiro-${route.id}-${lang}.txt`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify(t('downloaded'));
  }
  const passwordButton = event.target.closest('[data-password]');
  if (passwordButton) { const input = document.getElementById(passwordButton.dataset.password); const show = input.type === 'password'; input.type = show ? 'text' : 'password'; passwordButton.setAttribute('aria-pressed', String(show)); passwordButton.setAttribute('aria-label', t(show ? 'hidePassword' : 'showPassword')); }
});
render();
