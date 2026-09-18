
let token = sessionStorage.getItem('admin-token') || '';
let allRequests = [];
let activeId = null;
const $ = id => document.getElementById(id);

async function login() {
  const pw = $('password-input').value;
  $('login-error').textContent = '';
  if (!pw) return;
  const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pw}) });
  const data = await res.json();
  if (!res.ok) { $('login-error').textContent = data.error || 'Wrong password'; return; }
  token = data.token;
  sessionStorage.setItem('admin-token', token);
  showAdmin();
}

function logout() {
  token = ''; sessionStorage.removeItem('admin-token');
  $('admin-screen').style.display = 'none';
  $('login-screen').style.display = 'flex';
  $('password-input').value = '';
  $('main-panel').style.display = 'none';
  $('gallery-section').style.display = 'none';
}

async function loadRequests() {
  const res = await fetch('/api/admin/requests', { headers:{'x-admin-token':token} });
  if (res.status === 401) { logout(); return; }
  const data = await res.json();
  allRequests = data.requests || [];
  renderStats(); renderTable(allRequests);
}

function renderStats() {
  const today = new Date().toISOString().slice(0,10);
  $('stat-total').textContent = allRequests.length;
  $('stat-today').textContent = allRequests.filter(r => r.created_at?.startsWith(today)).length;
  $('stat-tv').textContent = allRequests.filter(r => r.selection?.tv && r.selection.tv !== 'none').length;
  $('stat-phone').textContent = allRequests.filter(r => r.selection?.phone).length;
}

function esc(s) {
  return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderTable(rows) {
  const tbody = $('requests-tbody');
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No requests found.</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
    const plan = r.selection?.speed ? (r.selection.speed>=1000 ? r.selection.speed/1000+' Gbps' : r.selection.speed+' Mbps') : '—';
    const total = r.pricing?.total ? '$'+r.pricing.total : '—';
    return `<tr onclick="showDetail('${r.id}')">
      <td>${date}</td>
      <td><strong>${esc(r.firstName)} ${esc(r.lastName)}</strong></td>
      <td>${esc(r.email)}</td>
      <td>${esc(r.phone||'—')}</td>
      <td>${esc(r.address?.city||'—')}</td>
      <td><span class="badge badge-province">${esc(r.address?.province||'—')}</span></td>
      <td><span class="badge badge-plan">${plan}</span></td>
      <td><span class="badge badge-total">${total}</span></td>
      <td><button class="delete-btn" onclick="event.stopPropagation();deleteReq('${r.id}')">Delete</button></td>
    </tr>`;
  }).join('');
}

function showDetail(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;
  activeId = id;
  const date = new Date(r.created_at).toLocaleString('en-CA');
  const plan = r.selection?.speed ? (r.selection.speed>=1000 ? r.selection.speed/1000+' Gbps' : r.selection.speed+' Mbps') : '—';
  $('modal-body').innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">Contact Info</div>
      <div class="modal-grid">
        <div class="modal-field"><label>First Name</label><span>${esc(r.firstName)}</span></div>
        <div class="modal-field"><label>Last Name</label><span>${esc(r.lastName)}</span></div>
        <div class="modal-field"><label>Email</label><span>${esc(r.email)}</span></div>
        <div class="modal-field"><label>Phone</label><span>${esc(r.phone||'—')}</span></div>
        <div class="modal-field"><label>Date of Birth</label><span>${esc(r.dob||'—')}</span></div>
        <div class="modal-field"><label>Submitted</label><span>${date}</span></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Service Address</div>
      <div class="modal-grid">
        <div class="modal-field full"><label>Street</label><span>${esc(r.address?.line1||'—')}</span></div>
        <div class="modal-field"><label>City</label><span>${esc(r.address?.city||'—')}</span></div>
        <div class="modal-field"><label>Province</label><span>${esc(r.address?.province||'—')}</span></div>
        <div class="modal-field"><label>Postal Code</label><span>${esc(r.address?.postalCode||'—')}</span></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Plan Selection</div>
      <div class="modal-grid">
        <div class="modal-field"><label>Internet</label><span>${plan}</span></div>
        <div class="modal-field"><label>Monthly Total</label><span>${r.pricing?.total ? '$'+r.pricing.total+'/mo' : '—'}</span></div>
        <div class="modal-field"><label>TV Package</label><span>${esc(r.selection?.tv||'none')}</span></div>
        <div class="modal-field"><label>Home Phone</label><span>${r.selection?.phone?'Yes':'No'}</span></div>
        <div class="modal-field"><label>Auto-pay</label><span>${r.selection?.autopay?'Yes':'No'}</span></div>
        <div class="modal-field"><label>Province</label><span>${esc(r.address?.province||'—')}</span></div>
      </div>
    </div>
    ${r.note ? `<div class="modal-section"><div class="modal-section-title">Note</div><div class="modal-field full"><label>Customer Note</label><span>${esc(r.note)}</span></div></div>` : ''}
    <div class="modal-section">
      <div class="modal-field full"><label>Reference ID</label><span style="font-size:11px;color:#3a3d4e">${esc(r.id)}</span></div>
    </div>`;
  $('modal').style.display = 'flex';
}

async function deleteReq(id) {
  if (!confirm('Delete this request?')) return;
  await fetch('/api/admin/requests/'+id, { method:'DELETE', headers:{'x-admin-token':token} });
  allRequests = allRequests.filter(r => r.id !== id);
  $('modal').style.display = 'none';
  renderStats(); renderTable(filterRows());
}

function filterRows() {
  const q = $('search-input').value.toLowerCase();
  if (!q) return allRequests;
  return allRequests.filter(r => [r.firstName,r.lastName,r.email,r.address?.city,r.address?.province,r.phone].some(v=>String(v||'').toLowerCase().includes(q)));
}

function showAdmin() {
  $('login-screen').style.display = 'none';
  $('admin-screen').style.display = 'block';
  showView('dashboard');
  loadRequests();
}

$('login-btn').onclick = login;
$('password-input').onkeydown = e => { if(e.key==='Enter') login(); };
$('logout-btn').onclick = logout;
$('refresh-btn').onclick = loadRequests;
$('search-input').oninput = () => renderTable(filterRows());
$('modal-close').onclick = () => $('modal').style.display = 'none';
$('modal-close2').onclick = () => $('modal').style.display = 'none';
$('modal-delete').onclick = () => { if(activeId) deleteReq(activeId); };
$('modal').onclick = e => { if(e.target===$('modal')) $('modal').style.display='none'; };


// â”€â”€ GALLERY â”€â”€
const SECTIONS = [
  { key: 'hero-board', label: 'Hero Board', slots: [
    { pos: 'large-left',   label: 'Large Left',   rec: '1200×800 px', fallback: '/assets/speed.jpg' },
    { pos: 'top-right',    label: 'Top Right',    rec: '800×450 px',  fallback: '/assets/canada-leader.jpg' },
    { pos: 'bottom-right', label: 'Bottom Right', rec: '800×450 px',  fallback: '/assets/switch-rogers.jpg' },
  ]},
  { key: 'slideshow', label: 'Campaign Slideshow', slots: [
    { pos: '0', label: 'Slide 1', rec: '1400×700 px', fallback: '/assets/speed.jpg' },
    { pos: '1', label: 'Slide 2', rec: '1400×700 px', fallback: '/assets/switch-rogers.jpg' },
    { pos: '2', label: 'Slide 3', rec: '1400×700 px', fallback: '/assets/canada-leader.jpg' },
    { pos: '3', label: 'Slide 4', rec: '1400×700 px', fallback: '/assets/building-canada.jpg' },
  ]},
  { key: 'service-cards', label: 'Service Cards', slots: [
    { pos: '0', label: 'Internet Card', rec: '600×400 px', fallback: '/assets/internet.png' },
    { pos: '1', label: 'TV Card',       rec: '600×400 px', fallback: '/assets/tv.jpg' },
    { pos: '2', label: 'Phone Card',    rec: '600×400 px', fallback: '/assets/building-canada.jpg' },
  ]},
  { key: 'savings-collage', label: 'Savings Collage', slots: [
    { pos: '0', label: 'Main Image',  rec: '800×600 px', fallback: '/assets/savings.jpg' },
    { pos: '1', label: 'Inset Image', rec: '400×300 px', fallback: '/assets/back-to-school.jpg' },
  ]},
  { key: 'dealer-portrait', label: 'Dealer Portrait', slots: [
    { pos: '0', label: 'Portrait Image', rec: '800×600 px', fallback: '/assets/canada-space.jpg' },
  ]},
  { key: 'switch-story', label: 'Switch Story', slots: [
    { pos: '0', label: 'Story Image', rec: '800×600 px', fallback: '/assets/switch-save.jpg' },
  ]},
  { key: 'community-gallery', label: 'Community Gallery', slots: [
    { pos: '0', label: 'Card 1', rec: '600×400 px', fallback: '/assets/savings.jpg' },
    { pos: '1', label: 'Card 2', rec: '600×400 px', fallback: '/assets/canada-space.jpg' },
    { pos: '2', label: 'Card 3', rec: '600×400 px', fallback: '/assets/back-to-school.jpg' },
    { pos: '3', label: 'Card 4', rec: '600×400 px', fallback: '/assets/two-moods.jpg' },
    { pos: '4', label: 'Card 5', rec: '600×400 px', fallback: '/assets/switch-save.jpg' },
  ]},
];

let galleryImages = [];
let pendingDeleteId = null;

function showView(view) {
  $('main-panel').style.display = view === 'dashboard' ? 'flex' : 'none';
  $('gallery-section').style.display = view === 'gallery' ? 'block' : 'none';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (view === 'dashboard') $('nav-dashboard').classList.add('active');
  if (view === 'gallery')   $('nav-gallery').classList.add('active');
}

async function loadGallery() {
  const res = await fetch('/api/admin/featured-images', { headers: { 'x-admin-token': token } });
  if (res.status === 401) { logout(); return; }
  const data = await res.json();
  galleryImages = data.images || [];
  renderSlots();
}

function getImageForSlot(sectionKey, pos) {
  return galleryImages.find(i => i.section_key === sectionKey && i.position === pos) || null;
}

function renderSlots() {
  const container = $('gallery-slots');
  container.innerHTML = SECTIONS.map(sec => `
    <div style="margin-bottom:32px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#3a3d4e;padding:0 0 12px">${sec.label}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        ${sec.slots.map(slot => buildSlotHTML(sec.key, slot)).join('')}
      </div>
    </div>
  `).join('');
  SECTIONS.forEach(sec => sec.slots.forEach(slot => bindSlot(sec.key, slot.pos)));
}

function buildSlotHTML(sectionKey, slot) {
  const img = getImageForSlot(sectionKey, slot.pos);
  const fallback = slot.fallback;
  const preview = img
    ? `<div class="gi-preview"><img src="${img.image_path}" alt="${img.alt_text}"><div class="gi-preview-overlay"><span>${img.title||'Untitled'}</span></div></div>`
    : `<div class="gi-preview" style="position:relative"><img src="${fallback}" alt="fallback" style="width:100%;height:100%;object-fit:cover;display:block;opacity:.6"><div class="gi-preview-overlay" style="background:linear-gradient(transparent,#00000099)"><span style="color:#facc15">⚠ Fallback</span></div></div>`;
  const statusBadge = img
    ? (img.is_active
        ? `<span style="background:#22c55e18;color:#4ade80;border:1px solid #22c55e30;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700">ACTIVE</span>`
        : `<span style="background:#6d748018;color:#6d7480;border:1px solid #6d748030;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700">INACTIVE</span>`)
    : '';
  const imgMeta = img
    ? `<div style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#0f1117;border:1px solid #2a2d3e;border-radius:10px;font-size:11px;color:#6d7480">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;letter-spacing:.6px;text-transform:uppercase">Current Image</span>${statusBadge}</div>
    <div style="color:#9da3b0;word-break:break-all">${img.image_path}</div>
    <div>Uploaded: <strong style="color:#c8cad4">${new Date(img.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</strong>${img.destination_url?` &nbsp;·&nbsp; URL: <strong style="color:#c8cad4">${img.destination_url.slice(0,40)}${img.destination_url.length>40?'…':''}</strong>`:''}</div>
  </div>`
    : `<div style="padding:10px 12px;background:#0f1117;border:1px solid #facc1530;border-radius:10px;font-size:11px;color:#facc15"><strong>Using fallback:</strong> <span style="color:#9da3b0">${fallback}</span></div>`;

  return `<div class="gi-slot" data-sec="${sectionKey}" data-pos="${slot.pos}">
    <div class="gi-slot-head">
      <span class="gi-pos-label">${slot.label}</span>
      ${img ? `<label class="gi-toggle" title="Active/Inactive"><input type="checkbox" class="gi-active-cb" ${img.is_active ? 'checked' : ''}><span class="gi-switch"></span></label>` : ''}
    </div>
    ${preview}
    ${imgMeta}
    <div class="gi-rec">${slot.rec}</div>
    <div class="gi-fields">
      <label class="gi-label">Title<input class="gi-input gi-title" type="text" value="${img ? img.title : ''}" placeholder="Image title"></label>
      <label class="gi-label">Alt text (SEO)<input class="gi-input gi-alt" type="text" value="${img ? img.alt_text : ''}" placeholder="Describe the image"></label>
      <label class="gi-label">Destination URL (optional)<input class="gi-input gi-url" type="url" value="${img ? img.destination_url : ''}" placeholder="https://"></label>
      <label class="gi-label gi-newtab-label"><input type="checkbox" class="gi-newtab" ${img && img.open_in_new_tab ? 'checked' : ''}> Open link in new tab</label>
    </div>
    <div class="gi-upload-area" data-sec="${sectionKey}" data-pos="${slot.pos}">
      <input type="file" class="gi-file-input" accept=".jpg,.jpeg,.png,.webp" style="display:none">
      <div class="gi-upload-inner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
        <span class="gi-upload-text">${img ? 'Replace image' : 'Upload image'}</span>
        <span class="gi-upload-hint">JPG, PNG, WebP &mdash; max 5 MB</span>
      </div>
      <div class="gi-progress" style="display:none"><div class="gi-progress-bar"></div></div>
      <div class="gi-new-preview" style="display:none"><img src="" alt="preview"><button class="gi-clear-upload" type="button">&#x2715; Remove</button></div>
    </div>
    <div class="gi-actions">
      <button class="gi-save-btn" data-sec="${sectionKey}" data-pos="${slot.pos}">Save Changes</button>
      ${img ? `<button class="gi-delete-btn" data-id="${img.id}">Delete</button>` : ''}
    </div>
    <div class="gi-msg" style="display:none"></div>
  </div>`;
}

function bindSlot(sectionKey, pos) {
  const slot = document.querySelector(`.gi-slot[data-sec="${sectionKey}"][data-pos="${pos}"]`);
  if (!slot) return;
  const fileInput = slot.querySelector('.gi-file-input');
  const uploadArea = slot.querySelector('.gi-upload-area');
  const newPreview = slot.querySelector('.gi-new-preview');
  const newPreviewImg = newPreview ? newPreview.querySelector('img') : null;
  const progress = slot.querySelector('.gi-progress');
  const progressBar = slot.querySelector('.gi-progress-bar');
  const saveBtn = slot.querySelector('.gi-save-btn');
  const deleteBtn = slot.querySelector('.gi-delete-btn');
  const clearBtn = slot.querySelector('.gi-clear-upload');
  let uploadedPath = null;

  uploadArea.addEventListener('click', e => {
    if (e.target.closest('.gi-clear-upload')) return;
    fileInput.click();
  });

  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  if (clearBtn) clearBtn.addEventListener('click', e => {
    e.stopPropagation();
    uploadedPath = null;
    newPreview.style.display = 'none';
    slot.querySelector('.gi-upload-inner').style.display = 'flex';
    fileInput.value = '';
  });

  async function handleFile(file) {
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.type)) { showMsg(slot, 'Only JPG, PNG or WebP allowed.', true); return; }
    if (file.size > 5 * 1024 * 1024) { showMsg(slot, 'File too large. Max 5 MB.', true); return; }
    // local preview
    const reader = new FileReader();
    reader.onload = e => {
      newPreviewImg.src = e.target.result;
      newPreview.style.display = 'flex';
      slot.querySelector('.gi-upload-inner').style.display = 'none';
    };
    reader.readAsDataURL(file);
    // upload
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    saveBtn.disabled = true;
    let prog = 0;
    const ticker = setInterval(() => { prog = Math.min(prog + 10, 85); progressBar.style.width = prog + '%'; }, 120);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch('/api/admin/featured-images/upload', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: fd,
      });
      clearInterval(ticker);
      progressBar.style.width = '100%';
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      uploadedPath = data.path;
      setTimeout(() => { progress.style.display = 'none'; progressBar.style.width = '0%'; }, 600);
    } catch(err) {
      clearInterval(ticker);
      progress.style.display = 'none';
      showMsg(slot, err.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', async () => {
    const img = getImageForSlot(sectionKey, pos);
    const title = slot.querySelector('.gi-title').value.trim();
    const alt = slot.querySelector('.gi-alt').value.trim();
    const url = slot.querySelector('.gi-url').value.trim();
    const newTab = slot.querySelector('.gi-newtab').checked;
    const active = slot.querySelector('.gi-active-cb') ? slot.querySelector('.gi-active-cb').checked : true;
    const imagePath = uploadedPath || (img ? img.image_path : null);
    if (!imagePath) { showMsg(slot, 'Please upload an image first.', true); return; }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const payload = { title, alt_text: alt, destination_url: url, open_in_new_tab: newTab, position: pos, section_key: sectionKey, is_active: active, image_path: imagePath };
      let res;
      if (img) {
        res = await fetch('/api/admin/featured-images/' + img.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(payload) });
      } else {
        res = await fetch('/api/admin/featured-images', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      showMsg(slot, 'Saved successfully!', false);
      uploadedPath = null;
      await loadGallery();
    } catch(err) {
      showMsg(slot, err.message, true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      pendingDeleteId = deleteBtn.dataset.id;
      const cm = $('confirm-modal');
      cm.style.display = 'flex';
    });
  }
}

function showMsg(slot, msg, isError) {
  const el = slot.querySelector('.gi-msg');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isError ? '#e7272e' : '#4ade80';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// confirm delete
$('confirm-cancel').onclick = () => { $('confirm-modal').style.display = 'none'; pendingDeleteId = null; };
$('confirm-ok').onclick = async () => {
  if (!pendingDeleteId) return;
  $('confirm-modal').style.display = 'none';
  await fetch('/api/admin/featured-images/' + pendingDeleteId, { method: 'DELETE', headers: { 'x-admin-token': token } });
  pendingDeleteId = null;
  await loadGallery();
};

// nav switching
document.addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  if (btn.id === 'nav-gallery') { showView('gallery'); loadGallery(); }
  else if (btn.id === 'nav-requests') { showView('dashboard'); }
  else if (btn.id === 'nav-dashboard') { showView('dashboard'); }
});
// ── GALLERY ──
const SECTIONS = [
  { key: 'hero-board',        label: 'Hero Board',          slots: [
    { pos: 'large-left',   label: 'Large Left',   rec: '1200×800 px', fallback: '/assets/speed.jpg' },
    { pos: 'top-right',    label: 'Top Right',    rec: '800×450 px',  fallback: '/assets/canada-leader.jpg' },
    { pos: 'bottom-right', label: 'Bottom Right', rec: '800×450 px',  fallback: '/assets/switch-rogers.jpg' },
  ]},
  { key: 'slideshow', label: 'Campaign Slideshow', slots: [
    { pos: '0', label: 'Slide 1', rec: '1400×700 px', fallback: '/assets/speed.jpg' },
    { pos: '1', label: 'Slide 2', rec: '1400×700 px', fallback: '/assets/switch-rogers.jpg' },
    { pos: '2', label: 'Slide 3', rec: '1400×700 px', fallback: '/assets/canada-leader.jpg' },
    { pos: '3', label: 'Slide 4', rec: '1400×700 px', fallback: '/assets/building-canada.jpg' },
  ]},
  { key: 'service-cards', label: 'Service Cards', slots: [
    { pos: '0', label: 'Internet Card', rec: '600×400 px', fallback: '/assets/internet.png' },
    { pos: '1', label: 'TV Card',       rec: '600×400 px', fallback: '/assets/tv.jpg' },
    { pos: '2', label: 'Phone Card',    rec: '600×400 px', fallback: '/assets/building-canada.jpg' },
  ]},
  { key: 'savings-collage', label: 'Savings Collage', slots: [
    { pos: '0', label: 'Main Image',   rec: '800×600 px', fallback: '/assets/savings.jpg' },
    { pos: '1', label: 'Inset Image',  rec: '400×300 px', fallback: '/assets/back-to-school.jpg' },
  ]},
  { key: 'dealer-portrait', label: 'Dealer Portrait', slots: [
    { pos: '0', label: 'Portrait Image', rec: '800×600 px', fallback: '/assets/canada-space.jpg' },
  ]},
  { key: 'switch-story', label: 'Switch Story', slots: [
    { pos: '0', label: 'Story Image', rec: '800×600 px', fallback: '/assets/switch-save.jpg' },
  ]},
  { key: 'community-gallery', label: 'Community Gallery', slots: [
    { pos: '0', label: 'Card 1', rec: '600×400 px', fallback: '/assets/savings.jpg' },
    { pos: '1', label: 'Card 2', rec: '600×400 px', fallback: '/assets/canada-space.jpg' },
    { pos: '2', label: 'Card 3', rec: '600×400 px', fallback: '/assets/back-to-school.jpg' },
    { pos: '3', label: 'Card 4', rec: '600×400 px', fallback: '/assets/two-moods.jpg' },
    { pos: '4', label: 'Card 5', rec: '600×400 px', fallback: '/assets/switch-save.jpg' },
  ]},
];

let galleryImages = [];
let pendingDeleteId = null;

function showView(view) {
  $('main-panel').style.display = view === 'dashboard' ? 'flex' : 'none';
  $('gallery-section').style.display = view === 'gallery' ? 'block' : 'none';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (view === 'dashboard') $('nav-dashboard').classList.add('active');
  if (view === 'gallery')   $('nav-gallery').classList.add('active');
}

async function loadGallery() {
  const res = await fetch('/api/admin/featured-images', { headers: { 'x-admin-token': token } });
  if (res.status === 401) { logout(); return; }
  const data = await res.json();
  galleryImages = data.images || [];
  renderSlots();
}


function showMsg(slot, msg, isError) {
  const el = slot.querySelector('.gi-msg');
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = isError ? '#e7272e' : '#4ade80';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// confirm delete
$('confirm-cancel').onclick = () => { $('confirm-modal').style.display = 'none'; pendingDeleteId = null; };
$('confirm-ok').onclick = async () => {
  if (!pendingDeleteId) return;
  $('confirm-modal').style.display = 'none';
  await fetch('/api/admin/featured-images/' + pendingDeleteId, { method: 'DELETE', headers: { 'x-admin-token': token } });
  pendingDeleteId = null;
  await loadGallery();
};

// nav switching
document.addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  if (btn.id === 'nav-gallery') { showView('gallery'); loadGallery(); }
  else if (btn.id === 'nav-requests') { showView('dashboard'); }
  else if (btn.id === 'nav-dashboard') { showView('dashboard'); }
});
if (token) showAdmin();
