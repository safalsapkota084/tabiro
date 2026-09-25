// Private trips use server persistence exclusively; sample routes remain inspiration.
export function createItinerary({api, t, esc, link, getUser}) {
  let trip = null, list = [], loaded = false, pending = false, error = '';
  const id = new URLSearchParams(location.search).get('trip');
  const root = () => document.querySelector('#private-itinerary');
  const button = (key, attrs = '') => `<button class="button secondary small" ${attrs}>${t(key)}</button>`;
  const field = (key, name, value = '', type = 'text', extra = '') => `<label class="field">${t(key)}<input name="${name}" type="${type}" value="${esc(value ?? '')}" ${extra}></label>`;
  function metadata(value = {}) {
    return `${field('tripTitle','title',value.title,'text','required maxlength="160"')}${field('tripDescription','description',value.description,'text','maxlength="5000"')}<div class="field-row">${field('startDate','start_date',value.start_date,'date','required')}${field('endDate','end_date',value.end_date,'date','required')}</div><div class="field-row">${field('travelers','travelers',value.travelers || 1,'number','required min="1" max="100"')}${field('vehicle','vehicle',value.vehicle || 'car')}</div><div class="field-row">${field('budgetMinor','budget_minor',value.budget_minor ?? 0,'number','required min="0" step="1"')}${field('currency','currency',value.currency || 'JPY','text','required pattern="[A-Z]{3}" maxlength="3"')}</div>`;
  }
  function stopFields(stop = {}) {
    return `${field('stopTitle','title',stop.title,'text','required maxlength="200"')}<div class="field-row">${field('arrivalTime','arrival_time',stop.arrival_time?.slice(0,5),'time')}${field('departureTime','departure_time',stop.departure_time?.slice(0,5),'time')}</div>${field('notes','notes',stop.notes)}<label class="field">${t('confirmation')}<select name="confirmation_status">${['unconfirmed','confirmed','cancelled'].map(value => `<option value="${value}" ${stop.confirmation_status === value ? 'selected' : ''}>${t(value)}</option>`).join('')}</select></label>`;
  }
  function view(isList) {
    if (!getUser()) return `<h2>${t('privateTrips')}</h2><p>${t('signInTrips')}</p><a class="button" href="${link('signin')}">${t('signIn')}</a>`;
    if (!loaded && pending) return `<p role="status">${t('loading')}</p>`;
    if (!loaded && error) return `<p role="alert">${t(error)}</p>${button('retry','data-retry')}`;
    const message = `<p role="${error ? 'alert' : 'status'}">${error ? t(error) : pending ? t('saving') : ''}</p>`;
    if (isList) return `<h2>${t('privateTrips')}</h2>${message}${list.length ? list.map(item => `<article class="saved-plan"><div><h3><a href="${link('planner',{trip:item.id})}">${esc(item.title)}</a></h3><p>${esc(item.start_date)} — ${esc(item.end_date)}</p></div></article>`).join('') : `<p>${t('noPlans')}</p>`}<a class="button" href="${link('planner')}">${t('createTrip')}</a>`;
    if (id && !trip) return `${message}${button('retry','data-retry')}`;
    return `<h2>${t(trip ? 'privateTrip' : 'createTrip')}</h2><p class="notice">${t('privateNotice')}</p>${message}<fieldset class="itinerary-controls" ${pending ? 'disabled' : ''}><form data-trip-form>${metadata(trip || {})}${button(trip ? 'saveChanges' : 'createTrip','type="submit"')}</form>${trip ? `${button('deleteTrip','type="button" data-delete-trip')}<section class="itinerary-days">${trip.days.map(day => `<article class="panel itinerary-day"><h3>${esc(day.date)}</h3><form data-edit-day="${day.id}">${field('date','date',day.date,'date',`required min="${esc(trip.start_date)}" max="${esc(trip.end_date)}"`)}${field('notes','notes',day.notes)}${button('saveChanges','type="submit"')}</form>${button('deleteDay',`type="button" data-delete-day="${day.id}"`)}<ol class="itinerary-stops">${day.stops.map((stop, index) => `<li><form data-stop-form="${stop.id}" data-day="${day.id}">${stopFields(stop)}<div class="button-row">${button('saveChanges','type="submit"')}${button('duplicateStop',`type="button" data-duplicate="${stop.id}" data-day="${day.id}"`)}${button('remove',`type="button" data-delete-stop="${stop.id}" data-day="${day.id}"`)}${button('moveUp',`type="button" data-move="${stop.id}" data-day="${day.id}" data-direction="-1" ${index === 0 ? 'disabled' : ''}`)}${button('moveDown',`type="button" data-move="${stop.id}" data-day="${day.id}" data-direction="1" ${index === day.stops.length - 1 ? 'disabled' : ''}`)}</div></form></li>`).join('')}</ol><details><summary>${t('addStop')}</summary><form data-stop-form="" data-day="${day.id}">${stopFields()}${button('addStop','type="submit"')}</form></details></article>`).join('')}</section><form data-day-form><h3>${t('addDay')}</h3>${field('date','date','','date',`required min="${esc(trip.start_date)}" max="${esc(trip.end_date)}"`)}${field('notes','notes')}${button('addDay','type="submit"')}</form>` : ''}</fieldset>`;
  }
  async function load(isList) {
    if (!getUser() || pending) return;
    pending = true; error = ''; paint(isList);
    try {
      if (isList) list = await api.request('/trips');
      else if (id || trip) trip = await api.request(`/trips/${id || trip.id}`);
      loaded = true;
    } catch (e) { error = e.key || 'apiUnavailable'; }
    finally { pending = false; paint(isList); }
  }
  async function mutate(isList, path, method, data, created = false) {
    if (pending) return;
    pending = true; error = '';
    // Keep entered values visible if a request fails.
    const element = root();
    element.querySelector('.itinerary-controls')?.setAttribute('disabled','');
    const status = element.querySelector('[role="status"], [role="alert"]');
    if (status) { status.textContent = t('saving'); status.setAttribute('role','status'); }
    try {
      const result = await api.request(path,method,data);
      if (created) {
        trip = result;
        const url = new URL(location.href); url.searchParams.set('trip',trip.id); history.replaceState(null,'',url);
      }
      if (method === 'DELETE' && path === `/trips/${trip?.id}`) { location.href = link('trips'); return; }
      pending = false;
      await load(isList);
    } catch (e) {
      error = e.key || 'apiUnavailable';
      if (status) { status.textContent = t(error); status.setAttribute('role','alert'); }
    } finally { pending = false; element.querySelector('.itinerary-controls')?.removeAttribute('disabled'); }
  }
  function paint(isList) {
    if (!root()) return;
    root().innerHTML = view(isList);
    bind(isList);
  }
  function bind(isList) {
    root().querySelector('[data-retry]')?.addEventListener('click',()=>load(isList));
    root().querySelector('[data-trip-form]')?.addEventListener('submit',event=>{
      event.preventDefault(); const data = Object.fromEntries(new FormData(event.target));
      data.travelers = Number(data.travelers); data.budget_minor = Number(data.budget_minor);
      if (trip) data.revision = trip.revision;
      mutate(isList,trip ? `/trips/${trip.id}` : '/trips',trip ? 'PATCH' : 'POST',data,!trip);
    });
    root().querySelector('[data-day-form]')?.addEventListener('submit',event=>{
      event.preventDefault(); mutate(isList,`/trips/${trip.id}/days`,'POST',Object.fromEntries(new FormData(event.target)));
    });
    root().querySelectorAll('[data-edit-day]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault(); mutate(isList,`/trips/${trip.id}/days/${form.dataset.editDay}`,'PATCH',Object.fromEntries(new FormData(form)));
    }));
    root().querySelectorAll('[data-stop-form]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault(); const data = Object.fromEntries(new FormData(form));
      data.arrival_time ||= null; data.departure_time ||= null;
      mutate(isList,`/trips/${trip.id}/days/${form.dataset.day}/stops${form.dataset.stopForm ? `/${form.dataset.stopForm}` : ''}`,form.dataset.stopForm ? 'PATCH' : 'POST',data);
    }));
    root().querySelectorAll('[data-delete-trip],[data-delete-day],[data-delete-stop],[data-move],[data-duplicate]').forEach(control=>control.addEventListener('click',()=>{
      const base = `/trips/${trip.id}`;
      if (control.hasAttribute('data-delete-trip')) { if (window.confirm(t('confirmDelete'))) mutate(isList,base,'DELETE'); return; }
      if (control.dataset.deleteDay) { if (window.confirm(t('confirmDelete'))) mutate(isList,`${base}/days/${control.dataset.deleteDay}`,'DELETE'); return; }
      const day = trip.days.find(item=>String(item.id) === control.dataset.day);
      const path = `${base}/days/${day.id}`;
      if (control.dataset.deleteStop) { if (window.confirm(t('confirmDelete'))) mutate(isList,`${path}/stops/${control.dataset.deleteStop}`,'DELETE'); return; }
      if (control.dataset.duplicate) {
        const stop = day.stops.find(item=>String(item.id) === control.dataset.duplicate);
        const {title,notes,arrival_time,departure_time,confirmation_status} = stop;
        mutate(isList,`${path}/stops`,'POST',{title,notes,arrival_time:arrival_time?.slice(0,5) || null,departure_time:departure_time?.slice(0,5) || null,confirmation_status}); return;
      }
      const ids = day.stops.map(item=>item.id), from = ids.findIndex(value=>String(value) === control.dataset.move), to = from + Number(control.dataset.direction);
      if (to < 0 || to >= ids.length) return;
      [ids[from],ids[to]] = [ids[to],ids[from]];
      mutate(isList,`${path}/order`,'PUT',{stop_ids:ids});
    }));
  }
  return {mount(isList = false) { paint(isList); if (!loaded && !pending && getUser()) load(isList); }};
}
