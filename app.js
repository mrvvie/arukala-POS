/* Arukala Dashboard 4A-2 : login, order baru, pengeluaran, riwayat hari ini, kelola menu & PIN.
   Ditulis kompatibel Safari 12 (iPad Air 1 / iOS 12): tanpa ?. ?? flex-gap, dsb. */
(function () {
  'use strict';
  var CFG = window.ARUKALA_CONFIG || {};
  var KEY = 'ark_session_v1';
  var ASSET = 'Asset / Capital Expenditure', OPEX = 'Operational Expense';
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MARK = '<svg width="{w}" height="{h}" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 22 L16 4 Q20 -1 24 4 L38 22 Q30 24 26 18 L19 9 L8 22Z" fill="#262420"/></svg>';

  function newExp() { return { amount: '', cat: '', sub: '', type: '', desc: '', pay: 'Cash', vendor: '' }; }
  var S = {
    view: 'boot', token: null, user: null, username: '', menu: [], categories: [], cafeName: 'Arukala Coffee',
    cat: '', q: '', cart: {}, pay: 'Cash', notes: '', inflight: null, unsure: false, busy: false, msg: '',
    online: navigator.onLine !== false, locked: false, pin: '', loginUser: '', loginErr: '', cartOpen: false,
    orders: null, expenses: null, histTab: 'orders', histErr: '', modal: null,
    exp: newExp(), expInflight: null, expUnsure: false, expBusy: false, expMsg: '',
    users: null, cp: { old: '', n1: '', n2: '', err: '', forced: false, busy: false }, edit: null, lockErr: ''
  };

  /* ---------- util ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n) { return 'Rp' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function hm(t) { return String(t || '').slice(0, 5); }
  function dateId(iso) { var p = String(iso).split('-'); var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  var MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function dShort(iso) { var p = String(iso).split('-'); return Number(p[2]) + '/' + MONS[Number(p[1]) - 1] + '/' + p[0]; }
  function qno(o) { var n = o.queueNo; if (!n) n = parseInt(String(o.orderId).split('-').pop(), 10) || 0; return ('00' + n).slice(-3); }
  function newRid(p) {
    var c = 'abcdefghijklmnopqrstuvwxyz0123456789', a = '', i, arr;
    try { arr = new Uint8Array(20); (window.crypto || window.msCrypto).getRandomValues(arr); for (i = 0; i < 20; i++) a += c[arr[i] % 36]; }
    catch (e) { for (i = 0; i < 20; i++) a += c[Math.floor(Math.random() * 36)]; }
    return p + '-' + a;
  }
  function sget() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function sset(v) { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* mode privat: abaikan */ } }
  function toast(msg, bad) {
    var t = el('toast'), d = document.createElement('div');
    d.textContent = msg; if (bad) d.className = 'bad'; t.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  }
  function mark(w, h) { return MARK.replace('{w}', w).replace('{h}', h); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function isOwner() { return !!(S.user && S.user.role === 'Owner'); }

  /* ---------- API ---------- */
  function apiRaw(action, payload, token) {
    if (!CFG.API_URL) return Promise.reject({ code: 'NOCONFIG', message: 'Alamat API belum diisi di config.js' });
    var req = fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, payload: payload || {}, token: token || undefined }) })
      .then(function (r) { return r.json(); });
    var timeout = new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'NETWORK', message: 'Koneksi lambat atau terputus.', unknown: true }); }, CFG.TIMEOUT_MS || 25000); });
    return Promise.race([req, timeout]).then(function (res) {
      if (res && res.ok) return res.data;
      throw { code: (res && res.code) || 'SERVER', message: (res && res.message) || 'Terjadi kesalahan di server.' };
    }, function (err) {
      if (err && err.code) throw err;
      throw { code: 'NETWORK', message: 'Tidak bisa terhubung ke server.', unknown: true };
    });
  }
  function call(action, payload) {
    return apiRaw(action, payload, S.token).catch(function (err) {
      if (err.code === 'AUTH') { doLogout('Sesi berakhir, silakan masuk lagi.', true); }
      else if (err.code === 'MUST_CHANGE_PIN') { S.cp = { old: '', n1: '', n2: '', err: '', forced: true, busy: false }; S.view = 'changePin'; render(); }
      throw err;
    });
  }

  /* ---------- sesi ---------- */
  function afterAuth(data) {
    S.token = data.token; S.user = data.user; S.username = data.user.username || S.username;
    sset({ token: data.token, username: S.username, name: data.user.name, role: data.user.role });
  }
  function loadBootstrap() {
    return call('bootstrap').then(function (d) {
      S.user = d.user; S.menu = d.menu; S.categories = d.categories; S.cafeName = d.cafeName || S.cafeName;
      var cats = menuCats(); if (!cats.length || cats.indexOf(S.cat) < 0) S.cat = cats[0] || '';
      S.view = 'order'; render(); bump();
    });
  }
  function boot() {
    if (!CFG.API_URL) { S.view = 'noconfig'; render(); return; }
    var ses = sget();
    if (ses && ses.token) {
      S.token = ses.token; S.username = ses.username || '';
      loadBootstrap().catch(function (err) { if (S.view === 'boot') { S.view = 'login'; S.loginErr = err.code === 'NETWORK' ? 'Tidak bisa terhubung. Periksa internet.' : ''; render(); } });
    } else { S.view = 'login'; render(); }
  }
  function doLogout(msg, skipApi) {
    var t = S.token;
    if (t && !skipApi) apiRaw('logout', {}, t).catch(function () { });
    sset(null); S.token = null; S.user = null; S.cart = {}; S.inflight = null; S.unsure = false; S.pin = '';
    S.orders = null; S.expenses = null; S.exp = newExp(); S.expInflight = null; S.expUnsure = false; S.modal = null; S.locked = false; S.cartOpen = false;
    S.loginErr = msg || ''; S.view = 'login'; render();
  }
  function doLogin() {
    var u = S.loginUser.trim().toLowerCase();
    if (!u) { S.loginErr = 'Isi username terlebih dahulu.'; return render(); }
    if (S.pin.length < 6) { S.loginErr = 'PIN terdiri dari 6–10 angka.'; return render(); }
    S.busy = true; S.loginErr = ''; render();
    apiRaw('login', { username: u, pin: S.pin, device: 'web' }).then(function (d) {
      S.busy = false; S.pin = ''; S.username = d.user.username || u; afterAuth(d);
      if (d.user.mustChangePin) { S.cp = { old: '', n1: '', n2: '', err: '', forced: true, busy: false }; S.view = 'changePin'; render(); return; }
      return loadBootstrap();
    }).catch(function (err) { S.busy = false; S.pin = ''; S.loginErr = err.message; render(); });
  }
  function doUnlock() {
    if (S.pin.length < 6) { S.lockErr = 'PIN terdiri dari 6–10 angka.'; return render(); }
    S.busy = true; S.lockErr = ''; render();
    var old = S.token;
    apiRaw('login', { username: S.username, pin: S.pin, device: 'web' }).then(function (d) {
      S.busy = false; S.pin = ''; S.locked = false; afterAuth(d);
      apiRaw('logout', {}, old).catch(function () { });
      render(); bump();
    }).catch(function (err) { S.busy = false; S.pin = ''; S.lockErr = err.message; render(); });
  }
  var idleT = null;
  function bump() {
    if (!S.token || S.locked) return;
    clearTimeout(idleT);
    var m = isOwner() ? (CFG.OWNER_IDLE_LOCK_MIN || 15) : (CFG.IDLE_LOCK_MIN || 5);
    idleT = setTimeout(lockNow, m * 60000);
  }
  function lockNow() { if (!S.token || S.view === 'login' || S.view === 'boot') return; S.locked = true; S.pin = ''; S.lockErr = ''; S.cartOpen = false; render(); }

  /* ---------- keranjang ---------- */
  function menuCats() { var out = []; S.menu.forEach(function (m) { if (m.active !== false && out.indexOf(m.category) < 0) out.push(m.category); }); return out; }
  function menuById(id) { for (var i = 0; i < S.menu.length; i++) if (S.menu[i].id === id) return S.menu[i]; return null; }
  function cartItems() { var out = []; Object.keys(S.cart).forEach(function (id) { var m = menuById(id); if (m && S.cart[id] > 0) out.push({ id: id, name: m.name, price: m.price, qty: S.cart[id], category: m.category }); }); return out; }
  function cartTotal(items) { var t = 0; items.forEach(function (i) { t += i.price * i.qty; }); return t; }
  function cartCount(items) { var t = 0; items.forEach(function (i) { t += i.qty; }); return t; }
  function locked() { return S.busy || S.unsure; }

  function cardHtml(m) {
    var q = S.cart[m.id] || 0;
    return '<button class="mc' + (q ? ' on' : '') + '" data-a="add" data-v="' + esc(m.id) + '"><span class="q">' + (q || '') + '</span><b>' + esc(m.name) + '</b><span class="p">' + rp(m.price) + (S.q ? ' · ' + esc(m.category) : '') + '</span></button>';
  }
  function gridHtml() {
    var list = S.menu.filter(function (m) {
      if (m.active === false) return false;
      if (S.q) return (m.name + ' ' + m.category).toLowerCase().indexOf(S.q.toLowerCase()) >= 0;
      return m.category === S.cat;
    });
    return list.length ? list.map(cardHtml).join('') : '<p class="empty" style="grid-column:1/-1">Menu tidak ditemukan.</p>';
  }
  function cartHtml() {
    var items = cartItems(), total = cartTotal(items), dis = locked();
    var h = '<div class="cartin"><div class="carthead"><b>Order baru</b><span>' + (items.length ? '<button class="lnk" data-a="clear"' + (dis ? ' disabled' : '') + '>Kosongkan</button>' : '') + '<button class="lnk sheetclose" data-a="cartclose">Tutup</button></span></div><div class="lines">';
    if (!items.length) h += '<p class="empty">Ketuk menu untuk menambah ke order.</p>';
    items.forEach(function (i) {
      h += '<div class="line"><div class="t"><b>' + esc(i.name) + '</b><span class="sm mute">' + rp(i.price) + ' &times; ' + i.qty + ' = ' + rp(i.price * i.qty) + '</span></div><div class="qty"><button aria-label="Kurangi" data-a="dec" data-v="' + esc(i.id) + '"' + (dis ? ' disabled' : '') + '>&minus;</button><span>' + i.qty + '</span><button aria-label="Tambah" data-a="add" data-v="' + esc(i.id) + '"' + (dis ? ' disabled' : '') + '>+</button></div></div>';
    });
    h += '</div>';
    if (!S.online) h += '<div class="err">Tidak ada internet. Order belum bisa disimpan sampai koneksi kembali.</div>';
    if (S.unsure) h += '<div class="note">Hasil penyimpanan belum pasti karena koneksi terputus. Tekan <b>Kirim ulang</b>. Order tidak akan tercatat dobel.</div>';
    else if (S.msg) h += '<div class="err">' + esc(S.msg) + '</div>';
    h += '<div class="seg">' + ['Cash', 'QRIS'].map(function (p) { return '<button data-a="pay" data-v="' + p + '" class="' + (S.pay === p ? 'on' : '') + '"' + (dis ? ' disabled' : '') + '>' + p + '</button>'; }).join('') + '</div>';
    h += '<input type="text" id="notes" data-bind="notes" placeholder="Catatan (opsional)" maxlength="200" value="' + esc(S.notes) + '"' + (dis ? ' disabled' : '') + '>';
    h += '<div class="totalrow"><span class="mute">Total</span><b>' + rp(total) + '</b></div>';
    var label = S.busy ? 'Menyimpan…' : (S.unsure ? 'Kirim ulang order' : 'Simpan Order');
    h += '<button class="btn pri big" data-a="save"' + ((!items.length || S.busy || !S.online) ? ' disabled' : '') + '>' + label + '</button>';
    if (S.unsure && !S.busy) h += '<button class="lnk" style="margin-top:8px;width:100%" data-a="cancelUnsure">Batalkan order ini</button>';
    return h + '</div>';
  }
  function barHtml() {
    var items = cartItems(); if (!items.length) return '';
    return '<button class="barbtn" data-a="cartopen"><span><span class="bd">' + cartCount(items) + '</span>Lihat order</span><b>' + rp(cartTotal(items)) + '</b></button>';
  }
  function updateCartUI() {
    var cc = el('cartcol'), cb = el('cartbar'), cards = document.querySelectorAll('.mc'), i, q;
    if (cc) cc.innerHTML = cartHtml();
    if (cb) cb.innerHTML = barHtml();
    for (i = 0; i < cards.length; i++) {
      q = S.cart[cards[i].getAttribute('data-v')] || 0;
      cards[i].className = 'mc' + (q ? ' on' : ''); cards[i].querySelector('.q').textContent = q || '';
    }
    var app = el('app'); if (app) app.className = S.cartOpen ? 'sheet' : '';
  }
  function saveOrder() {
    if (S.busy) return;
    var items = cartItems();
    if (!items.length) return;
    if (!S.online) { toast('Tidak ada internet.', true); return; }
    if (!S.inflight) S.inflight = { rid: newRid('o'), payload: { paymentMethod: S.pay, notes: S.notes, items: items.map(function (i) { return { menuId: i.id, qty: i.qty }; }), clientRequestId: null } };
    S.inflight.payload.clientRequestId = S.inflight.rid;
    S.busy = true; S.msg = ''; updateCartUI();
    call('order.create', S.inflight.payload).then(function (res) {
      S.inflight = null; S.unsure = false; S.busy = false; S.cart = {}; S.notes = ''; S.msg = ''; S.cartOpen = false;
      S.modal = { type: 'order', order: res.order, fresh: true, dup: res.duplicate };
      render(); bump();
    }).catch(function (err) {
      S.busy = false;
      if (err.unknown) { S.unsure = true; S.msg = ''; }
      else { S.inflight = null; S.unsure = false; S.msg = err.message; }
      if (S.view === 'order') updateCartUI();
    });
  }

  /* ---------- tampilan ---------- */
  function topHtml() {
    return '<div class="top"><div class="brand">' + mark(30, 18) + '<b>' + esc(S.cafeName) + '</b></div><div class="who"><span id="net"><i class="dot' + (S.online ? '' : ' off') + '"></i>' + (S.online ? 'Online' : 'Offline') + '</span><span style="margin-left:14px">' + esc(S.user ? S.user.name : '') + '</span></div></div>';
  }
  function navHtml() {
    var tabs = [['order', 'Order Baru'], ['expense', 'Pengeluaran'], ['history', 'Riwayat'], ['more', 'Lainnya']];
    var cur = S.view === 'menuAdmin' || S.view === 'users' ? 'more' : S.view;
    return '<div class="nav">' + tabs.map(function (t) { return '<button data-a="go" data-v="' + t[0] + '" class="' + (cur === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function padHtml(goLabel) {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'], h = '<div class="dots" id="dots">' + dotsHtml() + '</div><div class="pad">';
    keys.forEach(function (k) { h += '<button data-a="pk" data-v="' + k + '">' + k + '</button>'; });
    return h + '<button class="del" data-a="pk" data-v="del" aria-label="Hapus">&#9003;</button><button data-a="pk" data-v="0">0</button><button class="go" data-a="pk" data-v="go"' + (S.busy ? ' disabled' : '') + '>' + (S.busy ? '…' : goLabel) + '</button></div>';
  }
  function dotsHtml() { var n = Math.max(6, S.pin.length), h = '', i; for (i = 0; i < n; i++) h += '<i class="' + (i < S.pin.length ? 'f' : '') + '"></i>'; return h; }
  function vLogin() {
    var chips = (CFG.QUICK_USERS || []).map(function (u) { return '<button data-a="qu" data-v="' + esc(u) + '" class="' + (S.loginUser.toLowerCase() === u ? 'on' : '') + '">' + esc(cap(u)) + '</button>'; }).join('');
    return '<div class="login"><div class="hero">' + mark(110, 66) + '<div class="name">ARUKALA</div><p>Masuk untuk mulai bekerja</p></div><div class="lform">' +
      (chips ? '<div class="chips">' + chips + '</div>' : '') +
      '<label class="field"><span>Username</span><input type="text" id="un" data-bind="loginUser" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off" value="' + esc(S.loginUser) + '"></label>' +
      (S.loginErr ? '<div class="err" style="margin-top:12px">' + esc(S.loginErr) + '</div>' : '') + padHtml('Masuk') + '</div></div>';
  }
  function vLock() {
    return '<div class="lock"><div style="width:100%;max-width:380px;padding:24px;text-align:center">' + mark(70, 42) + '<h2 style="margin:12px 0 2px">Layar terkunci</h2><p class="mute" style="margin:0 0 12px">Masukkan PIN ' + esc(S.user ? S.user.name : '') + ' untuk melanjutkan.</p>' +
      (S.lockErr ? '<div class="err">' + esc(S.lockErr) + '</div>' : '') + padHtml('Buka') + '<button class="lnk" style="margin-top:14px" data-a="logout">Ganti pengguna</button></div></div>';
  }
  function vChangePin() {
    var c = S.cp;
    return '<div class="login"><div class="hero">' + mark(90, 54) + '<div class="name" style="font-size:20px;letter-spacing:.2em">ARUKALA</div></div><div class="lform vs"><h2 style="margin:0">' + (c.forced ? 'Buat PIN baru' : 'Ganti PIN') + '</h2><p class="mute sm" style="margin:0">' + (c.forced ? 'PIN sementara harus diganti sebelum Anda mulai bekerja.' : 'PIN terdiri dari 6–10 angka.') + '</p>' +
      '<label class="field"><span>' + (c.forced ? 'PIN sementara' : 'PIN lama') + '</span><input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-bind="cp.old" value="' + esc(c.old) + '"></label>' +
      '<label class="field"><span>PIN baru</span><input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-bind="cp.n1" value="' + esc(c.n1) + '"></label>' +
      '<label class="field"><span>Ulangi PIN baru</span><input type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-bind="cp.n2" value="' + esc(c.n2) + '"></label>' +
      (c.err ? '<div class="err">' + esc(c.err) + '</div>' : '') + '<button class="btn pri big" data-a="savePin"' + (c.busy ? ' disabled' : '') + '>' + (c.busy ? 'Menyimpan…' : 'Simpan PIN') + '</button>' +
      (c.forced ? '<button class="lnk" style="width:100%" data-a="logout">Keluar</button>' : '<button class="lnk" style="width:100%" data-a="go" data-v="more">Batal</button>') + '</div></div>';
  }
  function vNoConfig() {
    return '<div class="center">' + mark(80, 48) + '<h2>Alamat server belum diisi</h2><p class="mute" style="max-width:380px">Buka file <b>config.js</b>, isi <b>API_URL</b> dengan alamat Web App Apps Script (berakhiran /exec), lalu muat ulang halaman ini.</p></div>';
  }
  function vOrder() {
    var cats = menuCats();
    return '<div class="pos"><div class="menucol"><div class="tools"><input type="search" id="q" data-bind="q" placeholder="Cari menu" autocomplete="off" value="' + esc(S.q) + '"><div class="cats" id="cats">' + catsHtml(cats) + '</div></div><div class="gridwrap"><div class="grid" id="grid">' + gridHtml() + '</div></div></div><div class="cartcol" id="cartcol">' + cartHtml() + '</div></div><div class="cartbar" id="cartbar">' + barHtml() + '</div><div class="backdrop" data-a="cartclose"></div>';
  }
  function catsHtml(cats) { return cats.map(function (c) { return '<button data-a="cat" data-v="' + esc(c) + '" class="' + (!S.q && S.cat === c ? 'on' : '') + '">' + esc(c) + '</button>'; }).join(''); }

  function uniqueCats() { var o = []; S.categories.forEach(function (c) { if (o.indexOf(c.category) < 0) o.push(c.category); }); return o; }
  function vExpense() {
    var e = S.exp, subs = S.categories.filter(function (c) { return c.category === e.cat; }), dis = S.expBusy || S.expUnsure;
    var opts = '<option value="">Pilih kategori</option>' + uniqueCats().map(function (c) { return '<option' + (c === e.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var sopts = '<option value="">Pilih subkategori</option>' + subs.map(function (c) { return '<option' + (c.subcategory === e.sub ? ' selected' : '') + '>' + esc(c.subcategory) + '</option>'; }).join('');
    var d = dis ? ' disabled' : '';
    return '<div class="scroll"><div class="vs" style="max-width:560px;margin:0 auto"><h2 style="margin:0">Catat pengeluaran</h2>' +
      '<label class="field"><span>Nominal</span><input type="text" id="amount" inputmode="numeric" pattern="[0-9]*" placeholder="0" data-bind="exp.amount" value="' + esc(e.amount) + '"' + d + '><span class="sm mute" id="amtfmt" style="margin:6px 0 0">' + (e.amount ? rp(e.amount) : '') + '</span></label>' +
      '<label class="field"><span>Kategori</span><select data-bind="exp.cat"' + d + '>' + opts + '</select></label>' +
      '<label class="field"><span>Subkategori</span><select data-bind="exp.sub"' + (e.cat && !dis ? '' : ' disabled') + '>' + sopts + '</select></label>' +
      '<div><span class="sm mute" style="font-weight:600;display:block;margin-bottom:6px">Jenis</span><div class="seg"><button data-a="etype" data-v="' + OPEX + '" class="' + (e.type === OPEX ? 'on' : '') + '"' + d + '>Operasional</button><button data-a="etype" data-v="' + ASSET + '" class="' + (e.type === ASSET ? 'on' : '') + '"' + d + '>Aset / Capex</button></div></div>' +
      '<div class="note">Aset (grinder, meja, renovasi) dicatat terpisah dan tidak dihitung sebagai beban operasional.</div>' +
      '<label class="field"><span>Deskripsi</span><input type="text" data-bind="exp.desc" maxlength="200" placeholder="Contoh: susu 2 karton" value="' + esc(e.desc) + '"' + d + '></label>' +
      '<div><span class="sm mute" style="font-weight:600;display:block;margin-bottom:6px">Dibayar dengan</span><div class="seg"><button data-a="epay" data-v="Cash" class="' + (e.pay === 'Cash' ? 'on' : '') + '"' + d + '>Cash</button><button data-a="epay" data-v="QRIS" class="' + (e.pay === 'QRIS' ? 'on' : '') + '"' + d + '>QRIS</button></div></div>' +
      '<label class="field"><span>Vendor atau toko (opsional)</span><input type="text" data-bind="exp.vendor" maxlength="80" value="' + esc(e.vendor) + '"' + d + '></label>' +
      (!S.online ? '<div class="err">Tidak ada internet. Pengeluaran belum bisa disimpan.</div>' : '') +
      (S.expUnsure ? '<div class="note">Hasil penyimpanan belum pasti karena koneksi terputus. Tekan <b>Kirim ulang</b>. Pengeluaran tidak akan tercatat dobel.</div>' : (S.expMsg ? '<div class="err">' + esc(S.expMsg) + '</div>' : '')) +
      '<button class="btn pri big" data-a="saveExp"' + ((S.expBusy || !S.online) ? ' disabled' : '') + '>' + (S.expBusy ? 'Menyimpan…' : (S.expUnsure ? 'Kirim ulang pengeluaran' : 'Simpan Pengeluaran')) + '</button>' +
      (S.expUnsure && !S.expBusy ? '<button class="lnk" style="width:100%" data-a="cancelExp">Batalkan pengeluaran ini</button>' : '') + '</div></div>';
  }
  function saveExpense() {
    var e = S.exp, amt = Number(e.amount);
    if (S.expBusy) return;
    if (!S.expInflight) {
      if (!amt || amt < 1) { S.expMsg = 'Isi nominal pengeluaran.'; return render(); }
      if (!e.cat || !e.sub) { S.expMsg = 'Pilih kategori dan subkategori.'; return render(); }
      if (!e.desc.trim()) { S.expMsg = 'Isi deskripsi pengeluaran.'; return render(); }
      S.expInflight = { rid: newRid('e'), payload: { amount: amt, category: e.cat, subcategory: e.sub, expenseType: e.type, description: e.desc.trim(), paymentMethod: e.pay, vendor: e.vendor.trim(), clientRequestId: null } };
    }
    S.expInflight.payload.clientRequestId = S.expInflight.rid;
    S.expBusy = true; S.expMsg = ''; render();
    call('expense.create', S.expInflight.payload).then(function (res) {
      var pay = S.exp.pay; S.expInflight = null; S.expUnsure = false; S.expBusy = false; S.exp = newExp(); S.exp.pay = pay; S.expMsg = '';
      toast(res.duplicate ? 'Pengeluaran sudah tercatat sebelumnya.' : 'Pengeluaran tersimpan: ' + rp(res.expense.amount)); render(); bump();
    }).catch(function (err) {
      S.expBusy = false;
      if (err.unknown) { S.expUnsure = true; S.expMsg = ''; } else { S.expInflight = null; S.expUnsure = false; S.expMsg = err.message; }
      if (S.view === 'expense') render();
    });
  }

  function vHistory() {
    var h = '<div class="scroll"><div style="max-width:640px;margin:0 auto"><div class="row" style="margin-bottom:12px"><div><h2 style="margin:0">Hari ini</h2><span class="sm mute">' + (S.orders ? dateId(S.orders.date) : '') + '</span></div><button class="btn" data-a="reload">Muat ulang</button></div>';
    h += '<div class="seg tabs"><button data-a="htab" data-v="orders" class="' + (S.histTab === 'orders' ? 'on' : '') + '">Penjualan</button><button data-a="htab" data-v="expenses" class="' + (S.histTab === 'expenses' ? 'on' : '') + '">Pengeluaran</button></div>';
    if (S.histErr) h += '<div class="err" style="margin-bottom:12px">' + esc(S.histErr) + '</div>';
    if (S.histTab === 'orders') {
      if (!S.orders) h += S.histErr ? '' : '<div class="center"><div class="spin"></div></div>';
      else {
        if (isOwner() && S.orders.summary) { var s = S.orders.summary; h += '<div class="card sum"><span class="sm mute">Omzet hari ini</span><br><b>' + rp(s.total) + '</b><div class="sm mute">' + s.count + ' order, Cash ' + rp(s.cash) + ', QRIS ' + rp(s.qris) + '</div></div>'; }
        if (!S.orders.orders.length) h += '<p class="empty">Belum ada order hari ini.</p>';
        else h += '<div class="list">' + S.orders.orders.map(function (o, i) {
          var n = 0; o.items.forEach(function (it) { n += it.qty; });
          return '<button class="item" data-a="openOrder" data-v="' + i + '"><div class="l"><b>No. ' + qno(o) + '</b><span class="sm mute">' + hm(o.time) + ', ' + esc(o.payment) + ', ' + esc(o.staff) + '</span></div><div class="r"><b>' + rp(o.total) + '</b><br><span class="sm mute">' + n + ' item</span></div></button>';
        }).join('') + '</div>';
      }
    } else {
      if (!S.expenses) h += S.histErr ? '' : '<div class="center"><div class="spin"></div></div>';
      else {
        if (isOwner() && S.expenses.summary) { var x = S.expenses.summary; h += '<div class="card sum"><span class="sm mute">Pengeluaran operasional hari ini</span><br><b>' + rp(x.operational) + '</b><div class="sm mute">Pembelian aset (terpisah): ' + rp(x.asset) + '</div></div>'; }
        if (!S.expenses.expenses.length) h += '<p class="empty">Belum ada pengeluaran hari ini.</p>';
        else h += '<div class="list">' + S.expenses.expenses.map(function (e) {
          return '<div class="item"><div class="l"><b>' + esc(e.description) + (e.type === ASSET ? '<span class="pill asset">Aset</span>' : '') + '</b><span class="sm mute">' + esc(e.category) + ', ' + esc(e.subcategory) + '<br>' + hm(e.time) + ', ' + esc(e.payment) + ', ' + esc(e.staff) + '</span></div><div class="r"><b>' + rp(e.amount) + '</b></div></div>';
        }).join('') + '</div>';
      }
    }
    return h + '</div></div>';
  }
  function loadHistory() {
    S.orders = null; S.expenses = null; S.histErr = '';
    call('orders.list', {}).then(function (d) { S.orders = d; if (S.view === 'history') render(); }).catch(function (e) { if (e.code !== 'AUTH') { S.histErr = e.message; if (S.view === 'history') render(); } });
    call('expenses.list', {}).then(function (d) { S.expenses = d; if (S.view === 'history') render(); }).catch(function (e) { if (e.code !== 'AUTH') { S.histErr = e.message; if (S.view === 'history') render(); } });
  }
  function vMore() {
    var u = S.user || {};
    var h = '<div class="scroll"><div class="vs" style="max-width:520px;margin:0 auto"><div class="card"><b style="font-size:18px">' + esc(u.name) + '</b><div class="mute sm">' + esc(u.role === 'Owner' ? 'Owner' : 'Barista') + '</div></div><div class="list">';
    if (isOwner()) h += '<button class="item" data-a="go" data-v="menuAdmin"><b>Kelola menu</b><span class="mute">Harga, HPP, aktif/nonaktif</span></button><button class="item" data-a="go" data-v="users"><b>Pengguna</b><span class="mute">Reset PIN</span></button>';
    h += '<button class="item" data-a="chpin"><b>Ganti PIN</b></button><button class="item" data-a="lock"><b>Kunci layar</b></button><button class="item" data-a="logout"><b class="red">Keluar</b></button></div>';
    h += '<p class="sm mute" style="text-align:center">Arukala Dashboard versi ' + esc(CFG.VERSION || '') + '</p>';
    if (isOwner()) h += '<div class="note">Dashboard, laporan, kas, dan closing menyusul di tahap berikutnya.</div>';
    return h + '</div></div>';
  }
  function vMenuAdmin() {
    var h = '<div class="scroll"><div style="max-width:640px;margin:0 auto"><div class="row" style="margin-bottom:12px"><div><button class="lnk" data-a="go" data-v="more" style="padding-left:0">&lsaquo; Kembali</button><h2 style="margin:0">Kelola menu</h2></div><button class="btn ok" data-a="menuNew">+ Menu</button></div><div class="list">';
    S.menu.forEach(function (m) {
      h += '<button class="item menuitem' + (m.active === false ? ' inactive' : '') + '" data-a="menuEdit" data-v="' + esc(m.id) + '"><div class="l"><b>' + esc(m.name) + (m.active === false ? '<span class="pill asset">Nonaktif</span>' : '') + '</b><span class="sm mute">' + esc(m.category) + (m.cost === null || m.cost === undefined ? ', HPP belum diisi' : ', HPP ' + rp(m.cost)) + '</span></div><div class="r"><b>' + rp(m.price) + '</b></div></button>';
    });
    return h + '</div></div></div>';
  }
  function vUsers() {
    var h = '<div class="scroll"><div style="max-width:560px;margin:0 auto"><button class="lnk" data-a="go" data-v="more" style="padding-left:0">&lsaquo; Kembali</button><h2 style="margin:0 0 12px">Pengguna</h2>';
    if (!S.users) return h + '<div class="center"><div class="spin"></div></div></div></div>';
    h += '<div class="list">' + S.users.map(function (u) {
      return '<div class="item"><div class="l"><b>' + esc(u.name) + '</b><span class="sm mute">' + esc(u.role) + ', ' + esc(u.username) + (u.mustChangePin ? ', belum ganti PIN' : '') + '</span></div><button class="btn" data-a="resetPin" data-v="' + esc(u.id) + '">Reset PIN</button></div>';
    }).join('') + '</div>';
    return h + '</div></div>';
  }
  function receiptHtml(o) {
    var h = '<div class="receipt" id="receipt"><div class="rc"><img class="rlogo" src="icons/logo-struk.png" alt="Arukala Coffee"></div>' +
      '<div class="rc rq"><span class="rql">NO. ANTRIAN</span><b>' + qno(o) + '</b></div><div class="rule dbl"></div>' +
      '<div class="rr"><span>Tanggal</span><span>' + esc(dShort(o.date)) + ' ' + hm(o.time) + '</span></div>' +
      '<div class="rr"><span>Kasir</span><span>' + esc(o.staff) + '</span></div><div class="rule dsh"></div>';
    o.items.forEach(function (i) {
      h += '<div class="ri">' + esc(i.name) + '</div><div class="rr"><span>' + i.qty + ' x ' + rp(i.price).replace('Rp', '') + '</span><span>' + rp(i.subtotal).replace('Rp', '') + '</span></div>';
    });
    h += '<div class="rule dsh"></div><div class="rr rt"><span>TOTAL:</span><span>' + rp(o.total) + '</span></div><div class="rule dsh"></div>' +
      '<div class="rr"><span>' + esc(o.payment) + '</span><span>' + rp(o.total).replace('Rp', '') + '</span></div>' +
      (o.notes ? '<div class="rn">Catatan: ' + esc(o.notes) + '</div>' : '') +
      '<div class="rule dsh"></div><div class="rr"><span>No. Order</span><span>' + esc(o.orderId) + '</span></div><div class="rule dbl"></div><div class="rc">Terima kasih</div></div>';
    return h;
  }
  function vModal() {
    var m = S.modal, h = '<div class="modal" data-a="mbg"><div class="sheetbox">';
    if (m.type === 'order') {
      if (m.fresh) h += '<div class="ok-h"><i>&#10003;</i><div><b>' + (m.dup ? 'Order sudah tersimpan' : 'Order tersimpan') + '</b><div class="sm mute">No. antrian ' + qno(m.order) + '</div></div></div>';
      else h += '<div class="row" style="margin-bottom:10px"><b>Detail order</b></div>';
      h += receiptHtml(m.order) + '<div class="vs" style="margin-top:14px"><button class="btn pri big" data-a="mclose">' + (m.fresh ? 'Order berikutnya' : 'Tutup') + '</button><button class="btn big line" data-a="print">Cetak struk</button></div>';
    } else if (m.type === 'pin') {
      h += '<h3 style="margin:0 0 6px">PIN sementara ' + esc(m.name) + '</h3><p class="mute sm" style="margin:0">Catat dan berikan kepada yang bersangkutan. PIN ini hanya tampil sekali dan wajib diganti saat masuk.</p><div class="bigpin">' + esc(m.pin) + '</div><button class="btn pri big" data-a="mclose">Sudah dicatat</button>';
    } else if (m.type === 'menu') {
      var e = S.edit;
      h += '<h3 style="margin:0 0 12px">' + (e.id ? 'Ubah menu' : 'Menu baru') + '</h3><div class="vs">' +
        '<label class="field"><span>Nama menu</span><input type="text" data-bind="edit.name" maxlength="60" value="' + esc(e.name) + '"></label>' +
        '<label class="field"><span>Kategori</span><input type="text" list="catlist" data-bind="edit.category" maxlength="40" value="' + esc(e.category) + '"><datalist id="catlist">' + menuCats().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
        '<label class="field"><span>Harga jual (Rp)</span><input type="text" inputmode="numeric" data-bind="edit.price" value="' + esc(e.price) + '"></label>' +
        '<label class="field"><span>HPP (Rp, kosongkan jika belum ada)</span><input type="text" inputmode="numeric" data-bind="edit.cost" value="' + esc(e.cost) + '"></label>' +
        '<div class="seg"><button data-a="eactive" data-v="1" class="' + (e.active ? 'on' : '') + '">Aktif</button><button data-a="eactive" data-v="0" class="' + (!e.active ? 'on' : '') + '">Nonaktif</button></div>' +
        '<div class="note">Perubahan harga hanya berlaku untuk order berikutnya. Histori tetap memakai harga saat order.</div>' +
        (e.err ? '<div class="err">' + esc(e.err) + '</div>' : '') +
        '<button class="btn pri big" data-a="menuSave"' + (e.busy ? ' disabled' : '') + '>' + (e.busy ? 'Menyimpan…' : 'Simpan menu') + '</button><button class="lnk" style="width:100%" data-a="mclose">Batal</button></div>';
    }
    return h + '</div></div>';
  }
  function vShell() {
    var body = S.view === 'order' ? vOrder() : S.view === 'expense' ? vExpense() : S.view === 'history' ? vHistory() : S.view === 'more' ? vMore() : S.view === 'menuAdmin' ? vMenuAdmin() : S.view === 'users' ? vUsers() : '';
    return topHtml() + '<div class="main">' + body + '</div>' + navHtml();
  }
  function render() {
    var h;
    if (S.view === 'noconfig') h = vNoConfig();
    else if (S.view === 'boot') h = '<div class="center"><div class="spin"></div></div>';
    else if (S.view === 'login') h = vLogin();
    else if (S.view === 'changePin') h = vChangePin();
    else h = vShell();
    if (S.modal) h += vModal();
    if (S.locked) h += vLock();
    el('app').innerHTML = h;
    el('app').className = S.cartOpen && S.view === 'order' ? 'sheet' : '';
  }

  /* ---------- aksi ---------- */
  function setPath(path, v) { var p = path.split('.'), o = S, i; for (i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }
  function go(v) {
    S.view = v; S.cartOpen = false; S.modal = null;
    if (v === 'history') { render(); loadHistory(); return; }
    if (v === 'users') { S.users = null; render(); call('users.list').then(function (d) { S.users = d.users; if (S.view === 'users') render(); }).catch(function (e) { toast(e.message, true); }); return; }
    render();
  }
  function pinKey(v) {
    if (v === 'del') S.pin = S.pin.slice(0, -1);
    else if (v === 'go') { return S.locked ? doUnlock() : doLogin(); }
    else if (S.pin.length < 10) S.pin += v;
    var d = el('dots'); if (d) d.innerHTML = dotsHtml();
  }
  function saveMenuItem() {
    var e = S.edit, price = Number(e.price);
    if (!e.name.trim() || !e.category.trim()) { e.err = 'Nama dan kategori wajib diisi.'; return render(); }
    if (e.price === '' || isNaN(price) || price < 0) { e.err = 'Harga tidak valid.'; return render(); }
    if (e.cost !== '' && (isNaN(Number(e.cost)) || Number(e.cost) < 0)) { e.err = 'HPP tidak valid.'; return render(); }
    e.busy = true; e.err = ''; render();
    call('menu.save', { id: e.id || undefined, name: e.name, category: e.category, variant: e.variant || '', price: price, cost: e.cost === '' ? '' : Number(e.cost), active: e.active }).then(function () {
      S.modal = null; S.edit = null; toast('Menu disimpan.'); return call('bootstrap').then(function (d) { S.menu = d.menu; S.categories = d.categories; render(); });
    }).catch(function (err) { if (S.edit) { S.edit.busy = false; S.edit.err = err.message; render(); } });
  }
  var A = {
    go: function (e) { go(e.getAttribute('data-v')); },
    add: function (e) { if (locked()) return; var id = e.getAttribute('data-v'); S.cart[id] = Math.min(99, (S.cart[id] || 0) + 1); S.msg = ''; updateCartUI(); },
    dec: function (e) { if (locked()) return; var id = e.getAttribute('data-v'); S.cart[id] = (S.cart[id] || 0) - 1; if (S.cart[id] <= 0) delete S.cart[id]; if (!Object.keys(S.cart).length) S.cartOpen = false; updateCartUI(); },
    clear: function () { if (locked()) return; S.cart = {}; S.cartOpen = false; S.msg = ''; updateCartUI(); },
    pay: function (e) { if (locked()) return; S.pay = e.getAttribute('data-v'); updateCartUI(); },
    cat: function (e) { S.cat = e.getAttribute('data-v'); S.q = ''; var q = el('q'); if (q) q.value = ''; el('grid').innerHTML = gridHtml(); el('cats').innerHTML = catsHtml(menuCats()); },
    cartopen: function () { S.cartOpen = true; updateCartUI(); },
    cartclose: function () { S.cartOpen = false; updateCartUI(); },
    save: saveOrder,
    cancelUnsure: function () {
      if (confirm('Order ini mungkin sudah tersimpan. Cek tab Riwayat dulu agar tidak tercatat dobel.\n\nBatalkan dan kosongkan keranjang?')) { S.inflight = null; S.unsure = false; S.cart = {}; S.notes = ''; S.msg = ''; S.cartOpen = false; updateCartUI(); }
    },
    pk: function (e) { pinKey(e.getAttribute('data-v')); },
    qu: function (e) { S.loginUser = e.getAttribute('data-v'); S.loginErr = ''; render(); },
    logout: function () { doLogout(''); },
    lock: lockNow,
    chpin: function () { S.cp = { old: '', n1: '', n2: '', err: '', forced: false, busy: false }; S.view = 'changePin'; render(); },
    savePin: function () {
      var c = S.cp;
      if (!/^\d{6,10}$/.test(c.n1)) { c.err = 'PIN baru harus 6–10 angka.'; return render(); }
      if (c.n1 !== c.n2) { c.err = 'Pengulangan PIN baru tidak sama.'; return render(); }
      c.busy = true; c.err = ''; render();
      call('changePin', { oldPin: c.old, newPin: c.n1, device: 'web' }).then(function (d) {
        afterAuth(d); S.cp = { old: '', n1: '', n2: '', err: '', forced: false, busy: false }; toast('PIN berhasil diganti.'); return loadBootstrap();
      }).catch(function (err) { c.busy = false; c.err = err.message; if (S.view === 'changePin') render(); });
    },
    etype: function (e) { if (S.expBusy || S.expUnsure) return; S.exp.type = e.getAttribute('data-v'); render(); },
    epay: function (e) { if (S.expBusy || S.expUnsure) return; S.exp.pay = e.getAttribute('data-v'); render(); },
    saveExp: saveExpense,
    cancelExp: function () { if (confirm('Pengeluaran ini mungkin sudah tersimpan. Cek tab Riwayat dulu agar tidak tercatat dobel.\n\nBatalkan dan kosongkan formulir?')) { S.expInflight = null; S.expUnsure = false; S.exp = newExp(); S.expMsg = ''; render(); } },
    htab: function (e) { S.histTab = e.getAttribute('data-v'); render(); },
    reload: loadHistory,
    openOrder: function (e) { S.modal = { type: 'order', order: S.orders.orders[Number(e.getAttribute('data-v'))], fresh: false }; render(); },
    mclose: function () { S.modal = null; S.edit = null; render(); },
    mbg: function (e, ev) { if (ev.target === e && S.modal && S.modal.type !== 'menu') { S.modal = null; render(); } },
    print: function () { try { window.print(); } catch (x) { toast('Cetak tidak tersedia di perangkat ini.', true); } },
    menuNew: function () { S.edit = { id: '', name: '', category: S.cat || '', variant: '', price: '', cost: '', active: true, err: '', busy: false }; S.modal = { type: 'menu' }; render(); },
    menuEdit: function (e) { var m = menuById(e.getAttribute('data-v')); if (!m) return; S.edit = { id: m.id, name: m.name, category: m.category, variant: m.variant || '', price: String(m.price), cost: m.cost === null || m.cost === undefined ? '' : String(m.cost), active: m.active !== false, err: '', busy: false }; S.modal = { type: 'menu' }; render(); },
    eactive: function (e) { S.edit.active = e.getAttribute('data-v') === '1'; render(); },
    menuSave: saveMenuItem,
    resetPin: function (e) {
      var id = e.getAttribute('data-v'), u = null; S.users.forEach(function (x) { if (x.id === id) u = x; });
      if (!u || !confirm('Reset PIN ' + u.name + '? PIN lama tidak berlaku dan semua sesinya keluar.')) return;
      call('users.resetPin', { userId: id }).then(function (d) { S.modal = { type: 'pin', name: d.name, pin: d.tempPin }; return call('users.list'); }).then(function (d) { S.users = d.users; render(); }).catch(function (err) { toast(err.message, true); });
    }
  };

  document.addEventListener('click', function (ev) {
    var t = ev.target, e = t;
    while (e && e !== document && !(e.getAttribute && e.getAttribute('data-a'))) e = e.parentNode;
    if (!e || e === document) return;
    var fn = A[e.getAttribute('data-a')];
    if (fn) { if (e.disabled) return; fn(e, ev); bump(); }
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target, b = t.getAttribute && t.getAttribute('data-bind');
    if (!b) return;
    var v = t.value;
    if (b === 'exp.amount' || b === 'edit.price' || b === 'edit.cost') { v = v.replace(/\D/g, ''); if (t.value !== v) t.value = v; }
    setPath(b, v);
    if (b === 'exp.amount') { var f = el('amtfmt'); if (f) f.textContent = v ? rp(v) : ''; }
    if (b === 'q') { S.cat = S.cat; var g = el('grid'); if (g) { g.innerHTML = gridHtml(); el('cats').innerHTML = catsHtml(menuCats()); } }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, b = t.getAttribute && t.getAttribute('data-bind');
    if (b !== 'exp.cat' && b !== 'exp.sub') return;
    setPath(b, t.value);
    if (b === 'exp.cat') { S.exp.sub = ''; S.exp.type = ''; }
    if (b === 'exp.sub') { var row = null; S.categories.forEach(function (c) { if (c.category === S.exp.cat && c.subcategory === S.exp.sub) row = c; }); if (row) S.exp.type = row.defaultType; }
    render();
  });
  document.addEventListener('keydown', function (ev) {
    if (!(S.view === 'login' || S.locked)) return;
    var tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' && ev.target.id === 'un') { if (ev.key === 'Enter') { ev.preventDefault(); doLogin(); } return; }
    if (/^\d$/.test(ev.key)) pinKey(ev.key); else if (ev.key === 'Backspace') pinKey('del'); else if (ev.key === 'Enter') pinKey('go');
  });
  ['touchstart', 'mousedown', 'keydown'].forEach(function (n) { document.addEventListener(n, bump, true); });
  window.addEventListener('online', function () { S.online = true; refreshNet(); });
  window.addEventListener('offline', function () { S.online = false; refreshNet(); });
  function refreshNet() {
    var n = el('net'); if (n) n.innerHTML = '<i class="dot' + (S.online ? '' : ' off') + '"></i>' + (S.online ? 'Online' : 'Offline');
    if (S.view === 'order') updateCartUI(); else if (S.view === 'expense') render();
  }
  if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('service-worker.js').catch(function () { }); } catch (e) { /* abaikan */ } }
  window.__ark = { S: S };
  boot();
})();
