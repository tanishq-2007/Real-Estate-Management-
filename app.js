const API = 'http://localhost:8080/api';
const $ = id => document.getElementById(id);
let properties = [];
let modalAction = null;

const pageNames = {dashboard:'Overview',properties:'Properties',add:'Add a property',requests:'Inquiries',bookings:'Bookings'};

function page(id) {
  document.querySelectorAll('.page').forEach(section => section.classList.toggle('active', section.id === id));
  document.querySelectorAll('.nav').forEach(button => button.classList.toggle('active', button.dataset.page === id));
  $('breadcrumb').textContent = pageNames[id] || 'Overview';
  if (id === 'properties') loadProps();
  if (id === 'requests') loadRequests();
  if (id === 'bookings') loadBookings();
}

document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => page(button.dataset.page)));
$('today').textContent = new Intl.DateTimeFormat('en', {weekday:'short', month:'short', day:'numeric', year:'numeric'}).format(new Date());

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(API + path, {headers:{'Content-Type':'application/json'}, ...options, signal:controller.signal});
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('The server returned an invalid response.');
    }
    if (!response.ok || data.success === false) throw new Error(data.message || 'Request failed. Please try again.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server did not respond in time.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}

function money(value) {
  return new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(Number(value) || 0);
}

function safe(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function propertyCard(property) {
  const type = safe(property.type);
  const visual = ['Villa','Plot','Commercial','House'].includes(property.type) ? property.type.toLowerCase() : '';
  return `<article class="property-card">
    <div class="property-visual ${visual}"><span class="property-pill">${type}</span></div>
    <div class="property-info">
      <div class="property-titleline"><h3>${type} in ${safe(property.location)}</h3><span class="property-id">${safe(property.id)}</span></div>
      <div class="property-location">Owned by ${safe(property.owner || 'Property owner')}</div>
      <div class="property-price">${money(property.price)}</div>
      <div class="property-details"><span>${safe(property.area)} sq. ft.</span><span class="availability ${property.available ? 'available' : 'booked'}">${property.available ? 'Available' : 'Booked'}</span></div>
      <div class="property-actions"><button class="button button-primary property-action" data-action="booking" data-property-id="${safe(property.id)}" ${property.available ? '' : 'disabled'}>Book property</button><button class="button button-quiet property-action" data-action="inquiry" data-property-id="${safe(property.id)}">Inquire</button></div>
    </div>
  </article>`;
}

function emptyMessage(message) {
  return `<div class="empty">${safe(message)}</div>`;
}

function renderProperties(list) {
  $('grid').innerHTML = list.length ? list.map(propertyCard).join('') : emptyMessage(properties.length ? 'No properties match those filters.' : 'No properties have been added yet.');
  $('dashboardGrid').innerHTML = properties.length ? properties.slice(0, 3).map(propertyCard).join('') : emptyMessage('Add a property to start building your portfolio.');
}

['grid','dashboardGrid'].forEach(id => $(id).addEventListener('click', event => {
  const button = event.target.closest('.property-action');
  if (button && !button.disabled) openAction(button.dataset.action, button.dataset.propertyId);
}));

async function loadProps() {
  try {
    properties = await api('/properties');
    $('tp').textContent = properties.length;
    $('ap').textContent = properties.filter(property => property.available).length;
    filterProps();
  } catch (error) {
    $('grid').innerHTML = emptyMessage('Unable to load properties. Check the database connection and try again.');
    $('dashboardGrid').innerHTML = emptyMessage('Property data is currently unavailable.');
    toast(error.message);
  }
}

function filterProps() {
  const query = ($('sid').value || '').trim().toLowerCase();
  const type = $('typeFilter').value;
  const availability = $('availabilityFilter').value;
  const filtered = properties.filter(property => {
    const text = `${property.id} ${property.type} ${property.location} ${property.owner}`.toLowerCase();
    return (!query || text.includes(query))
      && (!type || property.type === type)
      && (availability === '' || String(property.available) === availability);
  });
  renderProperties(filtered);
}

function showTableError(target, message) {
  $(target).innerHTML = emptyMessage(message);
}

function inquiryTable(requests) {
  if (!requests.length) return emptyMessage('Your inquiry inbox is empty.');
  return `<table><thead><tr><th>CLIENT</th><th>PROPERTY</th><th>REQUEST</th><th>PHONE</th><th>STATUS</th></tr></thead><tbody>${requests.map(request => `<tr>
    <td><strong>${safe(request.customer)}</strong><br><span class="property-id">Inquiry #${safe(request.requestId)}</span></td>
    <td>${safe(request.propertyId)}</td><td>${safe(request.message || 'Property inquiry')}</td><td>${safe(request.phone || '—')}</td><td><span class="table-status">${safe(request.status)}</span></td>
  </tr>`).join('')}</tbody></table>`;
}

async function loadRequests() {
  try {
    const requests = await api('/requests');
    $('rq').textContent = requests.length;
    $('requestCount').textContent = requests.length;
    $('requestsTable').innerHTML = inquiryTable(requests);
  } catch (error) {
    showTableError('requestsTable', 'Unable to load inquiries. Please check the server connection.');
    toast(error.message);
  }
}

async function loadBookings() {
  try {
    const bookings = await api('/bookings');
    $('bk').textContent = bookings.length;
    $('bookingsTable').innerHTML = bookings.length ? `<table><thead><tr><th>BOOKING</th><th>PROPERTY</th><th>CLIENT</th><th>PHONE</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>${bookings.map(booking => `<tr>
      <td><strong>#${safe(booking.bookingId)}</strong></td><td>${safe(booking.propertyId)}</td><td>${safe(booking.customer)}</td><td>${safe(booking.phone || '—')}</td><td>${safe(booking.date || '—')}</td><td><span class="table-status">${safe(booking.status)}</span></td>
    </tr>`).join('')}</tbody></table>` : emptyMessage('No bookings yet. Confirmed reservations will appear here.');
  } catch (error) {
    showTableError('bookingsTable', 'Unable to load bookings. Please check the server connection.');
    toast(error.message);
  }
}

$('propForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const property = {
    id:form.get('id').trim(), owner:form.get('owner').trim(), location:form.get('location').trim(),
    type:form.get('type'), price:Number(form.get('price')), area:Number(form.get('area')),
    available:form.get('available') === 'true'
  };
  try {
    const result = await api('/properties', {method:'POST', body:JSON.stringify(property)});
    event.currentTarget.reset();
    toast(result.message);
    await loadProps();
    page('properties');
  } catch (error) {
    toast(error.message);
  }
});

function openAction(action, propertyId) {
  modalAction = {action, propertyId};
  const isBooking = action === 'booking';
  $('modalTitle').textContent = isBooking ? 'Confirm property booking' : 'Create an inquiry';
  $('modalDescription').textContent = isBooking ? `Add the client details for ${propertyId}.` : `Capture a client's interest in ${propertyId}.`;
  $('modalSubmit').textContent = isBooking ? 'Confirm booking' : 'Save inquiry';
  $('modalFields').innerHTML = `<label>Client name<input name="customer" required placeholder="Full name" autocomplete="name"></label>
    <label>Phone number<input name="phone" type="tel" placeholder="Contact number" autocomplete="tel"></label>
    ${isBooking ? '' : '<label>Note<input name="message" placeholder="Viewing request or other details"></label>'}`;
  $('modal').classList.add('open');
  $('modal').setAttribute('aria-hidden','false');
  $('modalFields').querySelector('input').focus();
}

function closeModal() {
  $('modal').classList.remove('open');
  $('modal').setAttribute('aria-hidden','true');
  $('modalForm').reset();
  modalAction = null;
}

$('modalForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!modalAction) return;
  const form = new FormData(event.currentTarget);
  const booking = modalAction.action === 'booking';
  const payload = {
    customer:form.get('customer').trim(), phone:form.get('phone').trim(),
    propertyId:modalAction.propertyId
  };
  const path = booking ? '/bookings' : '/requests';
  if (booking) payload.date = new Date().toISOString().slice(0,10);
  else payload.message = form.get('message').trim() || 'Property inquiry';
  try {
    const result = await api(path, {method:'POST', body:JSON.stringify(payload)});
    closeModal();
    toast(result.message);
    await Promise.all([loadProps(), loadRequests(), loadBookings()]);
  } catch (error) {
    toast(error.message);
  }
});

$('reqForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    customer:form.get('customer').trim(), phone:form.get('phone').trim(),
    propertyId:form.get('propertyId').trim(), message:form.get('message').trim() || 'Property inquiry'
  };
  try {
    const result = await api('/requests', {method:'POST', body:JSON.stringify(payload)});
    event.currentTarget.reset();
    toast(result.message);
    await Promise.all([loadRequests(), loadProps()]);
  } catch (error) {
    toast(error.message);
  }
});

async function processReq() {
  try {
    const result = await api('/requests/process', {method:'POST'});
    toast(result.message);
    await loadRequests();
  } catch (error) {
    toast(error.message);
  }
}

async function cancelLatest() {
  if (!confirm('Cancel the latest booking and release its property?')) return;
  try {
    const result = await api('/bookings/cancel-latest', {method:'POST'});
    toast(result.message);
    await Promise.all([loadBookings(), loadProps()]);
  } catch (error) {
    toast(error.message);
  }
}

async function health() {
  const card = document.querySelector('.status-card');
  try {
    await api('/health');
    $('status').textContent = 'Database connected';
    card.classList.remove('offline');
    card.classList.add('online');
  } catch {
    $('status').textContent = 'Database unavailable';
    card.classList.remove('online');
    card.classList.add('offline');
  }
}

health();
loadProps();
loadRequests();
loadBookings();

window.page = page;
window.filterProps = filterProps;
window.openAction = openAction;
window.closeModal = closeModal;
window.processReq = processReq;
window.cancelLatest = cancelLatest;
