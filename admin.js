(function () {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const API = 'https://api.github.com', BRANCH = 'main', DATA = 'data/portfolio.json';
  const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const store = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };
  let items = [], editingTitle = null, keepImgs = [], keepDocs = [];

  const bytesToB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const textToB64 = t => bytesToB64(new TextEncoder().encode(t));
  const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const say = (t, err, id) => { const m = $(id || 'msg'); m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); };

  async function gh(path, method, body) {
    const owner = $('owner').value.trim(), repo = $('repo').value.trim(), token = $('token').value.trim();
    if (!owner || !repo || !token) throw new Error('Fill in the Connection section first.');
    const url = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}` + (method ? '' : `?ref=${BRANCH}`);
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { method: method || 'GET', cache: 'no-store', headers, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = [401, 403, 404].includes(res.status) ? ' Check your token, username, and repository name.' : '';
      throw new Error(`GitHub said ${res.status}: ${j.message || 'error'}.${hint}`);
    }
    return j;
  }
  const put = (path, content, message, sha) => gh(path, 'PUT', { message, content, branch: BRANCH, sha });
  const readData = async () => { const r = await gh(DATA); return { list: JSON.parse(b64ToText(r.content)), sha: r.sha }; };
  const writeData = (list, sha, message) => put(DATA, textToB64(JSON.stringify(list, null, 2) + '\n'), message, sha);

  // Shrink photos so pages stay fast: max 1800px, JPEG
  async function prepImage(file) {
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
      return bytesToB64(new Uint8Array(await blob.arrayBuffer()));
    } catch (e) {
      throw new Error(`Couldn't read "${file.name}". Use a JPG or PNG photo.`);
    }
  }

  function renderList() {
    const ul = $('entries'); ul.replaceChildren();
    if (!items.length) { ul.append(el('li', null, 'No entries yet.')); return; }
    items.forEach(it => {
      const li = el('li'); li.append(el('span', null, `${it.title} (${it.year})`));
      const b = el('span');
      const e = el('button', 'alt', 'Edit'); e.type = 'button'; e.onclick = () => startEdit(it);
      const d = el('button', 'alt', 'Delete'); d.type = 'button'; d.onclick = () => removeEntry(it);
      b.append(e, ' ', d); li.append(b); ul.append(li);
    });
  }

  function renderKeep() {
    const imgs = $('keepImgs'), docs = $('keepDocs');
    imgs.replaceChildren(); docs.replaceChildren();
    keepImgs.forEach(k => {
      const f = el('figure'), i = el('img'), l = el('label'), c = el('input');
      i.src = k.path.replace(/^\/+/, ''); i.alt = '';
      c.type = 'checkbox'; c.checked = k.keep; c.onchange = () => { k.keep = c.checked; };
      l.append(c, ' Keep'); f.append(i, l); imgs.append(f);
    });
    keepDocs.forEach(k => {
      const l = el('label'), c = el('input');
      l.style.fontWeight = '400';
      c.type = 'checkbox'; c.checked = k.keep; c.onchange = () => { k.keep = c.checked; };
      l.append(c, ' Keep ' + (k.doc.label || k.doc.file)); docs.append(l);
    });
  }

  function startEdit(it) {
    editingTitle = it.title;
    $('formTitle').textContent = 'Edit: ' + it.title;
    $('title').value = it.title || ''; $('year').value = it.year || '';
    $('desc').value = it.description || ''; $('sum').value = it.summary || '';
    keepImgs = (it.images || []).filter(Boolean).map(p => ({ path: p, keep: true }));
    keepDocs = (it.documents || []).filter(d => d && d.file).map(d => ({ doc: d, keep: true }));
    $('imgs').value = ''; $('docs').value = ''; $('docLabels').replaceChildren();
    renderKeep(); say('');
    $('formTitle').scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    editingTitle = null; keepImgs = []; keepDocs = [];
    ['title', 'desc', 'sum'].forEach(id => { $(id).value = ''; });
    $('year').value = new Date().getFullYear();
    $('imgs').value = ''; $('docs').value = ''; $('docLabels').replaceChildren();
    $('formTitle').textContent = 'Add a project';
    renderKeep();
  }

  async function removeEntry(it) {
    if (!confirm(`Delete "${it.title}" from your portfolio?`)) return;
    try {
      say('Deleting…', false, 'cmsg');
      const cur = await readData();
      const list = cur.list.filter(x => x.title !== it.title);
      await writeData(list, cur.sha, `Remove ${it.title}`);
      items = list; renderList();
      if (editingTitle === it.title) resetForm();
      say('Deleted. Your site updates in a minute or two.', false, 'cmsg');
    } catch (e) { say(e.message, true, 'cmsg'); }
  }

  async function save() {
    const title = $('title').value.trim(), desc = $('desc').value.trim();
    if (!title || !desc) { say('Add a title and a description.', true); return; }
    const year = parseInt($('year').value, 10) || new Date().getFullYear();
    $('save').disabled = true;
    try {
      const stamp = Date.now().toString(36), base = slugify(title) || 'project';
      const imgFiles = [...$('imgs').files], docFiles = [...$('docs').files];
      const labels = [...$('docLabels').querySelectorAll('input')];
      const newImgs = [], newDocs = [];
      let n = 0;
      const total = imgFiles.length + docFiles.length;
      for (const [i, f] of imgFiles.entries()) {
        say(`Uploading file ${++n} of ${total}…`);
        const path = `uploads/${base}-${stamp}-${i + 1}.jpg`;
        await put(path, await prepImage(f), `Add photo for ${title}`);
        newImgs.push('/' + path);
      }
      for (const [i, f] of docFiles.entries()) {
        say(`Uploading file ${++n} of ${total}…`);
        const path = `uploads/${stamp}-${f.name.replace(/[^A-Za-z0-9._-]+/g, '-')}`;
        await put(path, bytesToB64(new Uint8Array(await f.arrayBuffer())), `Add document for ${title}`);
        newDocs.push({ label: (labels[i] && labels[i].value.trim()) || f.name.replace(/\.[^.]+$/, ''), file: '/' + path });
      }
      say('Saving entry…');
      const cur = await readData();
      const entry = { title, year, description: desc };
      const sum = $('sum').value.trim();
      if (sum) entry.summary = sum;
      entry.images = keepImgs.filter(k => k.keep).map(k => k.path).concat(newImgs);
      entry.documents = keepDocs.filter(k => k.keep).map(k => k.doc).concat(newDocs);
      const idx = editingTitle === null ? -1 : cur.list.findIndex(x => x.title === editingTitle);
      if (idx >= 0) cur.list[idx] = entry; else cur.list.unshift(entry);
      await writeData(cur.list, cur.sha, `${idx >= 0 ? 'Update' : 'Add'} ${title}`);
      items = cur.list; renderList(); resetForm();
      say('Saved. Your site updates in a minute or two.');
    } catch (e) { say(e.message, true); }
    $('save').disabled = false;
  }

  async function connect() {
    store.set('adm_owner', $('owner').value.trim());
    store.set('adm_repo', $('repo').value.trim());
    store.set('adm_token', $('token').value.trim());
    try {
      say('Loading…', false, 'cmsg');
      items = (await readData()).list;
      renderList(); $('conn').open = false; say('', false, 'cmsg');
    } catch (e) { $('conn').open = true; say(e.message, true, 'cmsg'); }
  }

  function guess(which) {
    const h = location.hostname;
    if (!/\.github\.io$/.test(h)) return '';
    if (which === 'owner') return h.split('.')[0];
    const seg = location.pathname.split('/')[1];
    return seg && !/\./.test(seg) ? seg : h;
  }

  $('owner').value = store.get('adm_owner') || guess('owner');
  $('repo').value = store.get('adm_repo') || guess('repo');
  $('token').value = store.get('adm_token');
  $('connect').onclick = connect;
  $('forget').onclick = () => { store.del('adm_token'); $('token').value = ''; items = []; renderList(); $('conn').open = true; say('Token removed from this browser.', false, 'cmsg'); };
  $('save').onclick = save;
  $('reset').onclick = () => { resetForm(); say(''); };
  $('docs').onchange = () => {
    const box = $('docLabels'); box.replaceChildren();
    [...$('docs').files].forEach(f => {
      const i = el('input'); i.type = 'text'; i.value = f.name.replace(/\.[^.]+$/, '');
      i.setAttribute('aria-label', 'Link text for ' + f.name); box.append(i);
    });
  };
  resetForm(); renderList();
  if ($('owner').value && $('repo').value && $('token').value) connect();
})();
