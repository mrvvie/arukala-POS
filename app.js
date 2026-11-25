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

  var DEFAULT_CFG = { cafe: { name: 'Arukala Coffee', address: '', instagram: '', footer: 'Terima kasih' }, receipt: { logo: true, queue: true, cashier: true, orderNo: true, footerOn: true }, orderTypes: { enabled: false, types: ['Dine-in', 'Take away'], askName: false, askTable: false }, discounts: { enabled: false, staffCanUse: true, presets: [] } };
  function cfg() { return S.config || DEFAULT_CFG; }
  function calcDisc(sub, kind, value) { return kind === 'percent' ? Math.min(sub, Math.round(sub * value / 100)) : Math.min(sub, value); }
  function presetById(id) { var r = null; cfg().discounts.presets.forEach(function (p) { if (p.id === id && p.active) r = p; }); return r; }
  function usablePresets() { var d = cfg().discounts; return (d.enabled && (isOwner() || d.staffCanUse)) ? d.presets.filter(function (p) { return p.active; }) : []; }
  function calcTotals(items) {
    var sub = cartTotal(items), d = 0, c = cfg();
    if (c.discounts.enabled && S.odisc && items.length) {
      if (S.odisc === 'manual' && isOwner()) d = calcDisc(sub, S.manual.kind, Number(S.manual.value) || 0);
      else { var pr = presetById(S.odisc); if (pr) d = calcDisc(sub, pr.kind, pr.value); }
    }
    return { sub: sub, disc: d, total: sub - d };
  }
  function isoAdd(iso, n) { var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function ymShift(ym, k) { var p = ym.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1 + k, 1)); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2); }
  function pf(v) { return String(Math.abs(v)).replace('.', ','); }
  function rangeText(r) { return r.from === r.to ? dShort(r.from) : dShort(r.from) + ' sampai ' + dShort(r.to); }
  function greet() { var h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }
  function newExp() { return { amount: '', cat: '', sub: '', type: '', desc: '', pay: 'Cash', vendor: '' }; }
  var S = {
    view: 'boot', token: null, user: null, username: '', menu: [], categories: [], cafeName: 'Arukala Coffee',
    cat: '', q: '', cart: {}, pay: 'Cash', notes: '', inflight: null, unsure: false, busy: false, msg: '',
    online: navigator.onLine !== false, locked: false, pin: '', loginUser: '', loginErr: '', cartOpen: false,
    orders: null, expenses: null, histTab: 'orders', histErr: '', modal: null,
    exp: newExp(), expInflight: null, expUnsure: false, expBusy: false, expMsg: '',
    users: null, cp: { old: '', n1: '', n2: '', err: '', forced: false, busy: false }, edit: null, lockErr: '',
    cl: { sum: null, closing: null, list: null, actual: '', notes: '', busy: false, err: '' },
    kas: { data: null, type: 'Cash In', amount: '', reason: '', busy: false, err: '', rid: null },
    histDate: '', histDel: false, reason: { text: '' },
    config: null, cfgVersion: 0, otype: '', cname: '', tno: '', odisc: '', manual: { kind: 'percent', value: '' },
    cfg: null, cfgTypes: '', cfgHist: null, cfgBusy: false, cfgErr: '', cfgNote: '',
    today: '', dash: { period: 'today', from: '', to: '', data: null, err: '', seq: 0 }, rep: { type: 'week', data: null, err: '', seq: 0 }, tg: { daily: '', weekly: '', monthly: '', busy: false, err: '' }
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
      S.user = d.user; S.menu = d.menu; S.categories = d.categories; S.cafeName = d.cafeName || S.cafeName; S.config = d.config || null; S.cfgVersion = d.configVersion || 0; S.today = String(d.serverTime || '').slice(0, 10);
      if (!S.otype || cfg().orderTypes.types.indexOf(S.otype) < 0) S.otype = cfg().orderTypes.types[0];
      if (S.odisc && S.odisc !== 'manual' && !presetById(S.odisc)) S.odisc = '';
      var cats = menuCats(); if (!cats.length || cats.indexOf(S.cat) < 0) S.cat = cats[0] || '';
      S.view = isOwner() ? 'dashboard' : 'order'; render(); bump(); if (S.view === 'dashboard') loadDashboard();
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
    S.orders = null; S.expenses = null; S.histDate = ''; S.histDel = false; S.dash.data = null; S.rep.data = null; S.dash.period = 'today'; S.cl = { sum: null, closing: null, list: null, actual: '', notes: '', busy: false, err: '' }; S.exp = newExp(); S.expInflight = null; S.expUnsure = false; S.modal = null; S.locked = false; S.cartOpen = false;
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
    var items = cartItems(), t = calcTotals(items), dis = locked(), c = cfg();
    var h = '<div class="cartin"><div class="carthead"><b>Order baru</b><span>' + (items.length ? '<button class="lnk" data-a="clear"' + (dis ? ' disabled' : '') + '>Kosongkan</button>' : '') + '<button class="lnk sheetclose" data-a="cartclose">Tutup</button></span></div><div class="lines">';
    if (!items.length) h += '<p class="empty">Ketuk menu untuk menambah ke order.</p>';
    items.forEach(function (i) {
      h += '<div class="line"><div class="t"><b>' + esc(i.name) + '</b><span class="sm mute">' + rp(i.price) + ' &times; ' + i.qty + ' = ' + rp(i.price * i.qty) + '</span></div><div class="qty"><button aria-label="Kurangi" data-a="dec" data-v="' + esc(i.id) + '"' + (dis ? ' disabled' : '') + '>&minus;</button><span>' + i.qty + '</span><button aria-label="Tambah" data-a="add" data-v="' + esc(i.id) + '"' + (dis ? ' disabled' : '') + '>+</button></div></div>';
    });
    h += '</div>';
    if (!S.online) h += '<div class="err">Tidak ada internet. Order belum bisa disimpan sampai koneksi kembali.</div>';
    if (S.unsure) h += '<div class="note">Hasil penyimpanan belum pasti karena koneksi terputus. Tekan <b>Kirim ulang</b>. Order tidak akan tercatat dobel.</div>';
    else if (S.msg) h += '<div class="err">' + esc(S.msg) + '</div>';
    var d = dis ? ' disabled' : '';
    if (c.orderTypes.enabled) {
      h += '<div class="seg">' + c.orderTypes.types.map(function (t2) { return '<button data-a="otype" data-v="' + esc(t2) + '" class="' + (S.otype === t2 ? 'on' : '') + '"' + d + '>' + esc(t2) + '</button>'; }).join('') + '</div>';
      if (c.orderTypes.askName) h += '<input type="text" data-bind="cname" maxlength="40" placeholder="Nama pelanggan (opsional)" value="' + esc(S.cname) + '"' + d + '>';
      if (c.orderTypes.askTable) h += '<input type="text" data-bind="tno" maxlength="10" placeholder="Nomor meja (opsional)" value="' + esc(S.tno) + '"' + d + '>';
    }
    var up = usablePresets();
    if (up.length || (c.discounts.enabled && isOwner())) {
      h += '<select data-bind="odisc"' + d + '><option value="">Tanpa diskon</option>' + up.map(function (p) { return '<option value="' + esc(p.id) + '"' + (S.odisc === p.id ? ' selected' : '') + '>' + esc(p.name) + ' (' + (p.kind === 'percent' ? p.value + '%' : rp(p.value)) + ')</option>'; }).join('') + (isOwner() ? '<option value="manual"' + (S.odisc === 'manual' ? ' selected' : '') + '>Diskon manual…</option>' : '') + '</select>';
      if (S.odisc === 'manual' && isOwner()) h += '<div class="seg"><button data-a="mkind" data-v="percent" class="' + (S.manual.kind === 'percent' ? 'on' : '') + '"' + d + '>Persen (%)</button><button data-a="mkind" data-v="amount" class="' + (S.manual.kind === 'amount' ? 'on' : '') + '"' + d + '>Rupiah (Rp)</button></div><input type="text" inputmode="numeric" pattern="[0-9]*" data-bind="manual.value" placeholder="Nilai diskon" value="' + esc(S.manual.value) + '"' + d + '>';
    }
    h += '<div class="seg">' + ['Cash', 'QRIS'].map(function (p) { return '<button data-a="pay" data-v="' + p + '" class="' + (S.pay === p ? 'on' : '') + '"' + d + '>' + p + '</button>'; }).join('') + '</div>';
    h += '<input type="text" id="notes" data-bind="notes" placeholder="Catatan (opsional)" maxlength="200" value="' + esc(S.notes) + '"' + d + '>';
    h += '<div id="ctotals">' + totalsHtml(t) + '</div>';
    var label = S.busy ? 'Menyimpan…' : (S.unsure ? 'Kirim ulang order' : 'Simpan Order');
    h += '<button class="btn pri big" data-a="save"' + ((!items.length || S.busy || !S.online) ? ' disabled' : '') + '>' + label + '</button>';
    if (S.unsure && !S.busy) h += '<button class="lnk" style="margin-top:8px;width:100%" data-a="cancelUnsure">Batalkan order ini</button>';
    return h + '</div>';
  }
  function totalsHtml(t) {
    return (t.disc > 0 ? '<div class="row sm mute" style="margin-top:4px"><span>Subtotal</span><span>' + rp(t.sub) + '</span></div><div class="row sm red"><span>Diskon</span><span>&minus;' + rp(t.disc) + '</span></div>' : '') + '<div class="totalrow"><span class="mute">Total</span><b>' + rp(t.total) + '</b></div>';
  }
  function updateTotals() { var e = el('ctotals'); if (e) e.innerHTML = totalsHtml(calcTotals(cartItems())); var b = el('cartbar'); if (b) b.innerHTML = barHtml(); }
  function barHtml() {
    var items = cartItems(); if (!items.length) return '';
    return '<button class="barbtn" data-a="cartopen"><span><span class="bd">' + cartCount(items) + '</span>Lihat order</span><b>' + rp(calcTotals(items).total) + '</b></button>';
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
    if (!S.inflight) {
      var pl = { paymentMethod: S.pay, notes: S.notes, items: items.map(function (i) { return { menuId: i.id, qty: i.qty }; }), clientRequestId: null }, c = cfg();
      if (c.orderTypes.enabled) { pl.orderType = S.otype || c.orderTypes.types[0]; if (c.orderTypes.askName) pl.customerName = S.cname; if (c.orderTypes.askTable) pl.tableNo = S.tno; }
      if (c.discounts.enabled && S.odisc) {
        if (S.odisc === 'manual' && isOwner()) { if (!(Number(S.manual.value) > 0)) { S.msg = 'Isi nilai diskon manual.'; return updateCartUI(); } pl.customDiscount = { kind: S.manual.kind, value: Number(S.manual.value) }; }
        else pl.discountId = S.odisc;
      }
      S.inflight = { rid: newRid('o'), payload: pl };
    }
    S.inflight.payload.clientRequestId = S.inflight.rid;
    S.busy = true; S.msg = ''; updateCartUI();
    call('order.create', S.inflight.payload).then(function (res) {
      S.inflight = null; S.unsure = false; S.busy = false; S.cart = {}; S.notes = ''; S.msg = ''; S.cartOpen = false; S.odisc = ''; S.manual = { kind: 'percent', value: '' }; S.cname = ''; S.tno = '';
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
    var tabs = isOwner() ? [['dashboard', 'Dashboard'], ['order', 'Order Baru'], ['history', 'Riwayat'], ['reports', 'Laporan'], ['more', 'Lainnya']] : [['order', 'Order Baru'], ['expense', 'Pengeluaran'], ['closing', 'Closing'], ['history', 'Riwayat'], ['more', 'Lainnya']];
    var cur = S.view;
    if (isOwner() && ['expense', 'closing', 'menuAdmin', 'users', 'kas', 'settings'].indexOf(cur) >= 0) cur = 'more';
    if (!isOwner() && ['menuAdmin', 'users', 'kas', 'settings'].indexOf(cur) >= 0) cur = 'more';
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

  function kvr(a, b, cls) { return '<div class="kv"><span>' + a + '</span><b class="' + (cls || '') + '">' + b + '</b></div>'; }
  var STATE = { Open: 'Belum closing', Reopened: 'Dibuka kembali', Submitted: 'Closing dikirim', Locked: 'Terkunci' };
  function badge(st) { return '<span class="badge st-' + esc(st) + '">' + esc(STATE[st] || st) + '</span>'; }
  function diffTxt(d) { return (d > 0 ? '+' : d < 0 ? '\u2212' : '') + rp(Math.abs(d)); }

  function loadClosing() {
    S.cl.sum = null; S.cl.closing = null; S.cl.err = '';
    call('closing.get', {}).then(function (d) { S.cl.sum = d.summary; S.cl.closing = d.closing; if (S.view === 'closing') render(); })
      .catch(function (e) { if (e.code !== 'AUTH') { S.cl.err = e.message; if (S.view === 'closing') render(); } });
    if (isOwner()) call('closing.list', {}).then(function (d) { S.cl.list = d.closings; if (S.view === 'closing') render(); }).catch(function () { });
  }
  function updateDiff() {
    var c = S.cl, d = el('cldiff'), n = el('cldnote');
    if (!d || !c.sum) return;
    if (c.actual === '') { d.textContent = '\u2014'; d.className = ''; if (n) n.style.display = 'none'; return; }
    var diff = Number(c.actual) - c.sum.expected;
    d.textContent = diff === 0 ? 'Pas (Rp0)' : diffTxt(diff); d.className = diff === 0 ? 'green' : 'red';
    if (n) { n.style.display = diff === 0 ? 'none' : 'block'; n.textContent = diff < 0 ? 'Uang di laci KURANG dari seharusnya. Keterangan wajib diisi.' : 'Uang di laci LEBIH dari seharusnya. Keterangan wajib diisi.'; }
  }
  function vClosing() {
    var c = S.cl, m = c.sum, cl = c.closing;
    var h = '<div class="scroll"><div style="max-width:900px;margin:0 auto"><div class="row" style="margin-bottom:12px"><div><h2 style="margin:0">Closing harian</h2><span class="sm mute">' + (m ? dateId(m.date) : '') + '</span></div>' + (m ? badge(m.state) : '') + '</div>';
    if (c.err && !m) return h + '<div class="err">' + esc(c.err) + '</div><button class="btn" style="margin-top:12px" data-a="clreload">Muat ulang</button></div></div>';
    if (!m) return h + '<div class="center"><div class="spin"></div></div></div></div>';
    h += '<div class="two"><div class="card"><div class="h2">Ringkasan hari ini</div>' +
      kvr('Total order', m.orders) + kvr('Total omzet', rp(m.revenue)) + kvr('Item terjual', m.itemCount + (m.best ? ' <span class="mute sm">(terlaris ' + esc(m.best.name) + ' x' + m.best.qty + ')</span>' : '')) +
      kvr('Penjualan Cash', rp(m.cashSales)) + kvr('Penjualan QRIS <span class="mute sm">(bukan uang di laci)</span>', rp(m.qrisSales)) + '<div class="hr"></div>' +
      kvr('Modal awal laci', rp(m.opening)) + kvr('+ Penjualan Cash', rp(m.cashSales)) + kvr('+ Cash masuk', rp(m.cashIn)) + kvr('\u2212 Pengeluaran Cash', rp(m.cashExpenses), 'red') + kvr('\u2212 Cash keluar', rp(m.cashOut), 'red') +
      '<div class="kv big"><span>Uang seharusnya di laci</span><b>' + rp(m.expected) + '</b></div>' +
      '<p class="sm mute" style="margin:10px 0 0">Pengeluaran QRIS ' + rp(m.qrisExpenses) + '. Pembelian aset ' + rp(m.assetExpenses) + ' tercatat terpisah dari pengeluaran operasional.</p></div>';
    var frozen = m.state === 'Submitted' || m.state === 'Locked';
    if (!frozen) {
      var dis = c.busy || !S.online, diff = c.actual === '' ? null : Number(c.actual) - m.expected;
      h += '<div class="card vs"><div class="h2">Uang cash di laci</div><label class="field"><span>Hitung uang fisik, lalu isi di sini</span><input type="text" id="actual" inputmode="numeric" pattern="[0-9]*" placeholder="Rp" data-bind="cl.actual" value="' + esc(c.actual) + '" style="font-size:22px;min-height:60px"></label>' +
        '<div class="kv"><span>Selisih</span><b id="cldiff" class="' + (diff === null ? '' : diff === 0 ? 'green' : 'red') + '">' + (diff === null ? '\u2014' : diff === 0 ? 'Pas (Rp0)' : diffTxt(diff)) + '</b></div>' +
        '<div class="note" id="cldnote" style="display:' + (diff === null || diff === 0 ? 'none' : 'block') + '">' + (diff < 0 ? 'Uang di laci KURANG dari seharusnya. Keterangan wajib diisi.' : 'Uang di laci LEBIH dari seharusnya. Keterangan wajib diisi.') + '</div>' +
        '<label class="field"><span>Keterangan (wajib jika ada selisih)</span><textarea data-bind="cl.notes" maxlength="300" rows="3">' + esc(c.notes) + '</textarea></label>' +
        (c.err ? '<div class="err">' + esc(c.err) + (c.unknown ? '<br><button class="lnk" data-a="clreload">Muat ulang status closing</button>' : '') + '</div>' : '') +
        (!S.online ? '<div class="err">Tidak ada internet. Closing belum bisa dikirim.</div>' : '') +
        '<button class="btn pri big" data-a="clsubmit"' + (dis ? ' disabled' : '') + '>' + (c.busy ? 'Mengirim…' : 'Kirim Closing') + '</button></div>';
    } else if (cl) {
      h += '<div class="card"><div class="h2">Hasil closing</div>' + kvr('Dikirim oleh', esc(cl.staff)) + kvr('Waktu', hm(String(cl.submittedAt).slice(11))) + kvr('Cash aktual', rp(cl.actual)) + kvr('Seharusnya', rp(cl.expected)) +
        kvr('Selisih', cl.difference === 0 ? 'Pas (Rp0)' : diffTxt(cl.difference), cl.difference === 0 ? 'green' : 'red') + (cl.notes ? '<p class="sm" style="margin:10px 0 0">Keterangan: ' + esc(cl.notes) + '</p>' : '') +
        (cl.state === 'Locked' ? '<p class="sm mute" style="margin:10px 0 0">Dikunci oleh ' + esc(cl.approvedBy) + '.</p>' : '');
      if (isOwner()) h += '<div class="vs" style="margin-top:14px">' + (cl.state === 'Submitted' ? '<button class="btn ok big" data-a="cllock">Kunci closing</button>' : '') + '<button class="btn big outline" data-a="clreopen">Buka kembali closing</button></div>';
      else h += '<div class="note" style="margin-top:12px">Order dan pengeluaran hari ini sudah dikunci. Hubungi owner jika perlu koreksi.</div>';
      h += '</div>';
    }
    h += '</div>';
    if (isOwner() && c.list && c.list.length) {
      h += '<h3 style="margin:20px 0 10px">Riwayat closing</h3><div class="list">' + c.list.map(function (x) {
        return '<div class="item"><div class="l"><b>' + esc(dShort(x.date)) + '</b><span class="sm mute">' + esc(x.staff) + ', ' + esc(STATE[x.state] || x.state) + '</span></div><div class="r"><b class="' + (x.difference === 0 ? 'green' : 'red') + '">' + (x.difference === 0 ? 'Pas' : diffTxt(x.difference)) + '</b></div></div>';
      }).join('') + '</div>';
    }
    return h + '</div></div>';
  }

  function loadKas() {
    S.kas.data = null; S.kas.err = '';
    call('cash.list', {}).then(function (d) { S.kas.data = d; if (S.view === 'kas') render(); }).catch(function (e) { if (e.code !== 'AUTH') { S.kas.err = e.message; if (S.view === 'kas') render(); } });
  }
  var KAS_LABEL = { 'Cash In': 'Cash masuk', 'Cash Out': 'Cash keluar', 'Opening Float': 'Ubah float' };
  var KAS_HELP = { 'Cash In': 'Uang ditambahkan ke laci hari ini. Menambah "uang seharusnya".', 'Cash Out': 'Uang diambil dari laci hari ini. Mengurangi "uang seharusnya".', 'Opening Float': 'Mengubah modal awal laci. Berlaku untuk hitungan hari ini dan menjadi modal bawaan hari berikutnya.' };
  function vKas() {
    var k = S.kas, d = k.data;
    var h = '<div class="scroll"><div style="max-width:620px;margin:0 auto"><button class="lnk" data-a="go" data-v="more" style="padding-left:0">&lsaquo; Kembali</button><h2 style="margin:0 0 12px">Kelola kas</h2>';
    if (!d) return h + (k.err ? '<div class="err">' + esc(k.err) + '</div>' : '<div class="center"><div class="spin"></div></div>') + '</div></div>';
    var frozen = d.todayState === 'Submitted' || d.todayState === 'Locked';
    h += '<div class="card"><div class="kv"><span>Modal laci bawaan (float)</span><b>' + rp(d.float) + '</b></div><div class="kv"><span>Uang seharusnya di laci hari ini</span><b>' + rp(d.expectedToday) + '</b></div><p class="sm mute" style="margin:8px 0 0">Modal kembalian bukan omzet dan bukan profit.</p></div>';
    if (frozen) h += '<div class="note" style="margin-top:12px">Closing hari ini sudah ' + (d.todayState === 'Locked' ? 'dikunci' : 'dikirim') + '. Perubahan kas ditutup sampai closing dibuka kembali.</div>';
    h += '<div class="card vs" style="margin-top:12px"><div class="seg">' + ['Cash In', 'Cash Out', 'Opening Float'].map(function (t) { return '<button data-a="kastype" data-v="' + t + '" class="' + (k.type === t ? 'on' : '') + '">' + KAS_LABEL[t] + '</button>'; }).join('') + '</div><p class="sm mute" style="margin:0">' + KAS_HELP[k.type] + '</p>' +
      '<label class="field"><span>' + (k.type === 'Opening Float' ? 'Float baru' : 'Nominal') + '</span><input type="text" inputmode="numeric" pattern="[0-9]*" data-bind="kas.amount" placeholder="Rp" value="' + esc(k.amount) + '"></label>' +
      '<label class="field"><span>Alasan (wajib)</span><input type="text" data-bind="kas.reason" maxlength="200" placeholder="Contoh: tambah kembalian akhir pekan" value="' + esc(k.reason) + '"></label>' +
      (k.err ? '<div class="err">' + esc(k.err) + '</div>' : '') + '<button class="btn pri big" data-a="kassave"' + ((k.busy || frozen || !S.online) ? ' disabled' : '') + '>' + (k.busy ? 'Menyimpan…' : 'Simpan perubahan kas') + '</button></div>';
    h += '<h3 style="margin:20px 0 10px">Riwayat kas</h3>' + (d.logs.length ? '<div class="list">' + d.logs.map(function (l) {
      return '<div class="item"><div class="l"><b>' + esc(KAS_LABEL[l.type] || l.type) + '</b><span class="sm mute">' + esc(dShort(l.date)) + ' ' + esc(l.time) + ', ' + esc(l.by) + '<br>' + esc(l.reason) + '</span></div><div class="r"><b>' + rp(l.amount) + '</b><br><span class="sm mute">' + rp(l.previous) + ' &rarr; ' + rp(l.balance) + '</span></div></div>';
    }).join('') + '</div>' : '<p class="empty">Belum ada perubahan kas.</p>');
    return h + '</div></div>';
  }
  function openReason(o) { S.reason = { kind: o.kind, id: o.id || '', extra: o.extra || '', title: o.title, desc: o.desc, btn: o.btn, text: '', busy: false, err: '', danger: !!o.danger }; S.modal = { type: 'reason' }; render(); }

  function vHistory() {
    var own = isOwner(), day = S.orders ? S.orders.date : (S.expenses ? S.expenses.date : '');
    var h = '<div class="scroll"><div style="max-width:640px;margin:0 auto"><div class="row" style="margin-bottom:12px"><div><h2 style="margin:0">' + (own ? 'Riwayat' : 'Hari ini') + '</h2><span class="sm mute">' + (day ? dateId(day) : '') + '</span></div><button class="btn" data-a="reload">Muat ulang</button></div>';
    if (own) h += '<div class="row" style="margin-bottom:12px"><input type="date" data-bind="histDate" value="' + esc(S.histDate || day) + '" style="max-width:190px;min-height:44px"><div class="seg" style="min-width:190px"><button data-a="hdel" data-v="0" class="' + (!S.histDel ? 'on' : '') + '">Aktif</button><button data-a="hdel" data-v="1" class="' + (S.histDel ? 'on' : '') + '">Dihapus</button></div></div>';
    h += '<div class="seg tabs"><button data-a="htab" data-v="orders" class="' + (S.histTab === 'orders' ? 'on' : '') + '">Penjualan</button><button data-a="htab" data-v="expenses" class="' + (S.histTab === 'expenses' ? 'on' : '') + '">Pengeluaran</button></div>';
    var st = S.orders ? S.orders.dayState : '';
    if (own && (st === 'Submitted' || st === 'Locked')) h += '<div class="note" style="margin-bottom:12px">Tanggal ini sudah closing. Buka kembali closing (menu Closing) sebelum mengubah atau menghapus.</div>';
    if (S.histErr) h += '<div class="err" style="margin-bottom:12px">' + esc(S.histErr) + '</div>';
    if (S.histTab === 'orders') {
      if (!S.orders) h += S.histErr ? '' : '<div class="center"><div class="spin"></div></div>';
      else {
        if (own && S.orders.summary) { var s1 = S.orders.summary; h += '<div class="card sum"><span class="sm mute">Omzet</span><br><b>' + rp(s1.total) + '</b><div class="sm mute">' + s1.count + ' order, Cash ' + rp(s1.cash) + ', QRIS ' + rp(s1.qris) + '</div></div>'; }
        if (!S.orders.orders.length) h += '<p class="empty">' + (S.histDel ? 'Tidak ada order yang dihapus.' : 'Belum ada order.') + '</p>';
        else h += '<div class="list">' + S.orders.orders.map(function (o, i) {
          var n = 0; o.items.forEach(function (it) { n += it.qty; });
          return '<button class="item' + (o.deleted ? ' inactive' : '') + '" data-a="openOrder" data-v="' + i + '"><div class="l"><b>No. ' + qno(o) + (o.deleted ? '<span class="pill asset">Dihapus</span>' : '') + '</b><span class="sm mute">' + hm(o.time) + ', ' + esc(o.payment) + ', ' + esc(o.staff) + (o.deleted && o.deleteReason ? '<br>Alasan: ' + esc(o.deleteReason) : '') + '</span></div><div class="r"><b>' + rp(o.total) + '</b><br><span class="sm mute">' + n + ' item</span></div></button>';
        }).join('') + '</div>';
      }
    } else {
      if (!S.expenses) h += S.histErr ? '' : '<div class="center"><div class="spin"></div></div>';
      else {
        if (own && S.expenses.summary) { var x = S.expenses.summary; h += '<div class="card sum"><span class="sm mute">Pengeluaran operasional</span><br><b>' + rp(x.operational) + '</b><div class="sm mute">Pembelian aset (terpisah): ' + rp(x.asset) + '</div></div>'; }
        if (!S.expenses.expenses.length) h += '<p class="empty">' + (S.histDel ? 'Tidak ada pengeluaran yang dihapus.' : 'Belum ada pengeluaran.') + '</p>';
        else h += '<div class="list">' + S.expenses.expenses.map(function (e, i) {
          var inner = '<div class="l"><b>' + esc(e.description) + (e.type === ASSET ? '<span class="pill asset">Aset</span>' : '') + (e.deleted ? '<span class="pill asset">Dihapus</span>' : '') + '</b><span class="sm mute">' + esc(e.category) + ', ' + esc(e.subcategory) + '<br>' + hm(e.time) + ', ' + esc(e.payment) + ', ' + esc(e.staff) + (e.deleted && e.deleteReason ? '<br>Alasan: ' + esc(e.deleteReason) : '') + '</span></div><div class="r"><b>' + rp(e.amount) + '</b></div>';
          return own ? '<button class="item' + (e.deleted ? ' inactive' : '') + '" data-a="openExp" data-v="' + i + '">' + inner + '</button>' : '<div class="item">' + inner + '</div>';
        }).join('') + '</div>';
      }
    }
    return h + '</div></div>';
  }
  function loadHistory() {
    S.orders = null; S.expenses = null; S.histErr = '';
    var pl = isOwner() ? { date: S.histDate || undefined, deleted: S.histDel } : {};
    call('orders.list', pl).then(function (d) { S.orders = d; if (S.view === 'history') render(); }).catch(function (e) { if (e.code !== 'AUTH') { S.histErr = e.message; if (S.view === 'history') render(); } });
    call('expenses.list', pl).then(function (d) { S.expenses = d; if (S.view === 'history') render(); }).catch(function (e) { if (e.code !== 'AUTH') { S.histErr = e.message; if (S.view === 'history') render(); } });
  }
  function tog(path, on, label) { return '<button class="tog' + (on ? ' on' : '') + '" data-a="cfgtog" data-v="' + path + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"><span>' + label + '</span><i></i></button>'; }
  function loadSettings() {
    S.cfg = JSON.parse(JSON.stringify(cfg())); S.cfgTypes = S.cfg.orderTypes.types.join(', '); S.cfgErr = ''; S.cfgHist = null; S.view = 'settings'; render();
    call('targets.get', {}).then(function (t) { S.tg.daily = t.daily ? String(t.daily) : ''; S.tg.weekly = t.weekly ? String(t.weekly) : ''; S.tg.monthly = t.monthly ? String(t.monthly) : ''; if (S.view === 'settings') render(); }).catch(function () { });
    call('config.history', {}).then(function (d) { S.cfgHist = d.versions; if (S.view === 'settings') render(); }).catch(function () { });
  }
  function vSettings() {
    var c = S.cfg, h = '<div class="scroll"><div style="max-width:620px;margin:0 auto" class="vs"><div><button class="lnk" data-a="go" data-v="more" style="padding-left:0">&lsaquo; Kembali</button><h2 style="margin:0">Pengaturan</h2><span class="sm mute">Versi aktif: ' + S.cfgVersion + '. Perubahan berlaku setelah diterapkan dan aplikasi dimuat ulang di perangkat lain.</span></div>';
    h += '<div class="card vs"><div class="h2">Target omzet</div><p class="sm mute" style="margin:0">Kosongkan jika belum ada target. Dipakai untuk progres di Dashboard dan laporan.</p><label class="field"><span>Target harian (Rp)</span><input type="text" inputmode="numeric" pattern="[0-9]*" data-bind="tg.daily" value="' + esc(S.tg.daily) + '"></label><label class="field"><span>Target mingguan (Rp)</span><input type="text" inputmode="numeric" pattern="[0-9]*" data-bind="tg.weekly" value="' + esc(S.tg.weekly) + '"></label><label class="field"><span>Target bulanan (Rp)</span><input type="text" inputmode="numeric" pattern="[0-9]*" data-bind="tg.monthly" value="' + esc(S.tg.monthly) + '"></label>' + (S.tg.err ? '<div class="err">' + esc(S.tg.err) + '</div>' : '') + '<button class="btn ok big" data-a="tgsave"' + (S.tg.busy ? ' disabled' : '') + '>' + (S.tg.busy ? 'Menyimpan…' : 'Simpan target') + '</button></div>';
    h += '<div class="card vs"><div class="h2">Info cafe</div><label class="field"><span>Nama cafe</span><input type="text" data-bind="cfg.cafe.name" maxlength="60" value="' + esc(c.cafe.name) + '"></label><label class="field"><span>Alamat (opsional, tampil di struk)</span><input type="text" data-bind="cfg.cafe.address" maxlength="120" value="' + esc(c.cafe.address) + '"></label><label class="field"><span>Instagram (opsional)</span><input type="text" data-bind="cfg.cafe.instagram" maxlength="40" value="' + esc(c.cafe.instagram) + '"></label><label class="field"><span>Teks bawah struk</span><input type="text" data-bind="cfg.cafe.footer" maxlength="80" value="' + esc(c.cafe.footer) + '"></label></div>';
    h += '<div class="card"><div class="h2">Isi struk</div>' + tog('receipt.logo', c.receipt.logo, 'Logo di atas') + tog('receipt.queue', c.receipt.queue, 'Nomor antrian') + tog('receipt.cashier', c.receipt.cashier, 'Nama kasir') + tog('receipt.orderNo', c.receipt.orderNo, 'Nomor order') + tog('receipt.footerOn', c.receipt.footerOn, 'Teks bawah')+ '</div>';
    h += '<div class="card vs"><div class="h2">Tipe order</div>' + tog('orderTypes.enabled', c.orderTypes.enabled, 'Aktifkan pilihan tipe order') + (c.orderTypes.enabled ? '<label class="field"><span>Pilihan (pisahkan dengan koma)</span><input type="text" data-bind="cfgTypes" value="' + esc(S.cfgTypes) + '"></label>' + tog('orderTypes.askName', c.orderTypes.askName, 'Tanyakan nama pelanggan') + tog('orderTypes.askTable', c.orderTypes.askTable, 'Tanyakan nomor meja') : '') + '</div>';
    h += '<div class="card vs"><div class="h2">Diskon</div>' + tog('discounts.enabled', c.discounts.enabled, 'Aktifkan diskon');
    if (c.discounts.enabled) {
      h += tog('discounts.staffCanUse', c.discounts.staffCanUse, 'Barista boleh memakai diskon') + '<p class="sm mute" style="margin:0">Barista hanya bisa memilih diskon di bawah. Diskon manual hanya untuk owner.</p>';
      c.discounts.presets.forEach(function (p, i) {
        h += '<div class="card" style="background:var(--bg)"><label class="field"><span>Nama diskon</span><input type="text" data-bind="cfg.discounts.presets.' + i + '.name" maxlength="30" value="' + esc(p.name) + '"></label><div class="seg" style="margin:10px 0"><button data-a="cfgkind" data-v="' + i + ':percent" class="' + (p.kind === 'percent' ? 'on' : '') + '">Persen (%)</button><button data-a="cfgkind" data-v="' + i + ':amount" class="' + (p.kind === 'amount' ? 'on' : '') + '">Rupiah (Rp)</button></div><label class="field"><span>Nilai</span><input type="text" inputmode="numeric" pattern="[0-9]*" data-bind="cfg.discounts.presets.' + i + '.value" value="' + esc(p.value) + '"></label>' + tog('discounts.presets.' + i + '.active', p.active, 'Aktif') + '<button class="lnk red" data-a="cfgdel" data-v="' + i + '">Hapus diskon ini</button></div>';
      });
      h += '<button class="btn" data-a="cfgadd">+ Tambah diskon</button>';
    }
    h += '</div><div><div class="h2" style="margin:4px 0 8px">Pratinjau struk</div>' + receiptHtml({ orderId: 'ARK-20260101-0007', queueNo: 7, date: '2026-01-01', time: '10:15:00', staff: 'Aldo', payment: 'Cash', subtotal: 55000, discount: 0, discountName: '', total: 55000, notes: '', orderType: c.orderTypes.enabled ? c.orderTypes.types[0] : '', customer: c.orderTypes.enabled && c.orderTypes.askName ? 'Contoh' : '', table: c.orderTypes.enabled && c.orderTypes.askTable ? '5' : '', items: [{ name: 'Kala', qty: 2, price: 19000, subtotal: 38000 }, { name: 'Spanish Latte', qty: 1, price: 17000, subtotal: 17000 }] }, c) + '</div>';
    h += '<label class="field"><span>Catatan perubahan (opsional)</span><input type="text" data-bind="cfgNote" maxlength="100" value="' + esc(S.cfgNote) + '"></label>' + (S.cfgErr ? '<div class="err">' + esc(S.cfgErr) + '</div>' : '') + '<button class="btn pri big" data-a="cfgsave"' + (S.cfgBusy || !S.online ? ' disabled' : '') + '>' + (S.cfgBusy ? 'Menerapkan…' : 'Terapkan pengaturan') + '</button>';
    h += '<div><div class="h2" style="margin:8px 0">Riwayat versi</div>' + (S.cfgHist ? '<div class="list">' + S.cfgHist.map(function (v) { return '<div class="item"><div class="l"><b>Versi ' + v.version + (v.active ? '<span class="pill">Aktif</span>' : '') + '</b><span class="sm mute">' + esc(String(v.createdAt).slice(0, 10)) + ', ' + esc(v.by) + (v.note ? '<br>' + esc(v.note) : '') + '</span></div>' + (v.active ? '' : '<button class="btn" data-a="cfgrb" data-v="' + v.version + '">Kembalikan</button>') + '</div>'; }).join('') + '</div>' : '<div class="center"><div class="spin"></div></div>') + '</div>';
    return h + '</div></div>';
  }
  var PERIODS = [['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['thisWeek', 'Minggu ini'], ['lastWeek', 'Minggu lalu'], ['thisMonth', 'Bulan ini'], ['lastMonth', 'Bulan lalu'], ['custom', 'Kustom']];
  function gchip(v, invert) {
    if (v === null || v === undefined) return '<span class="gr na">tanpa pembanding</span>';
    var up = v >= 0, good = invert ? !up : up;
    return '<span class="gr ' + (good ? 'up' : 'dn') + '">' + (up ? '+' : '\u2212') + pf(v) + '%</span>';
  }
  function barsHtml(series, key) {
    var max = 0, topI = -1; series.forEach(function (d, i) { if (d[key] > max) { max = d[key]; topI = i; } });
    var many = series.length > 14, h = '<div class="bars">';
    series.forEach(function (d, i) {
      var pc = max ? Math.max(d[key] > 0 ? 3 : 0, Math.round(d[key] / max * 100)) : 0;
      var lab = series.length <= 8 ? d.dow.slice(0, 3) : (many ? (i % 5 === 0 ? Number(d.date.slice(8)) : '') : Number(d.date.slice(8)));
      h += '<div class="bc" title="' + esc(d.date + ': ' + d[key]) + '"><div class="bv"><i class="' + (i === topI ? 'top' : '') + '" style="height:' + pc + '%"></i></div><span>' + lab + '</span></div>';
    });
    return h + '</div>';
  }
  function hbars(items, nameFn, valFn, fmt) {
    var max = 0; items.forEach(function (x) { if (valFn(x) > max) max = valFn(x); });
    return items.map(function (x) { return '<div class="hb"><div class="row"><span>' + nameFn(x) + '</span><b>' + fmt(valFn(x)) + '</b></div><div class="hbt"><i style="width:' + (max ? Math.max(2, Math.round(valFn(x) / max * 100)) : 0) + '%"></i></div></div>'; }).join('');
  }
  function targetHtml(t, dark) {
    if (!t) return '';
    return '<div class="prog"><i style="width:' + Math.min(100, t.pct) + '%"></i></div><div class="sm">' + (t.reached ? 'Target tercapai: ' : 'Target ' + rp(t.target) + ': ') + pf(t.pct) + '%' + (t.reached ? '' : ', sisa ' + rp(t.remaining) + (t.daysLeft > 0 ? ', butuh ' + rp(t.neededPerDay) + ' per hari' : '')) + (t.projection ? '. Proyeksi akhir periode (estimasi): ' + rp(t.projection) : '') + '</div>';
  }
  function loadDashboard() {
    var D = S.dash, seq = ++D.seq, pl = { period: D.period };
    if (D.period === 'custom') { pl.from = D.from; pl.to = D.to; if (!D.from || !D.to) { D.data = null; D.err = ''; render(); return; } }
    D.err = ''; D.data = null; render();
    call('dashboard.get', pl).then(function (d) { if (seq !== D.seq) return; D.data = d; if (S.view === 'dashboard') render(); }).catch(function (e) { if (seq !== D.seq || e.code === 'AUTH') return; D.err = e.message; if (S.view === 'dashboard') render(); });
  }
  function vDashboard() {
    var D = S.dash, d = D.data, h = '<div class="scroll"><div style="max-width:1000px;margin:0 auto" class="vs"><div><div class="sm mute">' + (S.today ? dateId(S.today) : '') + '</div><h2 style="margin:0">' + greet() + ', ' + esc(S.user ? S.user.name : '') + '</h2></div>';
    h += '<div class="cats" style="margin:0 -16px;padding-left:16px">' + PERIODS.map(function (x) { return '<button data-a="dper" data-v="' + x[0] + '" class="' + (D.period === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (D.period === 'custom') h += '<div class="row"><input type="date" data-bind="dash.from" value="' + esc(D.from) + '" style="max-width:170px"><input type="date" data-bind="dash.to" value="' + esc(D.to) + '" style="max-width:170px"><button class="btn ok" data-a="dapply">Terapkan</button></div>';
    h += '<div class="qa"><button class="btn ok" data-a="go" data-v="order">+ Order Baru</button><button class="btn" data-a="go" data-v="expense">+ Pengeluaran</button></div>';
    if (D.err) return h + '<div class="err">' + esc(D.err) + '</div><button class="btn" data-a="dreload">Muat ulang</button></div></div>';
    if (!d) return h + (D.period === 'custom' && !(D.from && D.to) ? '<p class="empty">Pilih tanggal awal dan akhir.</p>' : '<div class="center"><div class="spin"></div></div>') + '</div></div>';
    var c = d.cur, p = d.prev, r = d.range;
    h += '<div class="card hero2"><div class="sm" style="opacity:.8">Omzet, ' + esc(r.label) + ' (' + rangeText(r) + ')</div><div><b class="bigv">' + rp(c.revenue) + '</b>' + gchip(d.growth.revenue) + '</div><div class="sm" style="opacity:.8">Pembanding ' + rangeText({ from: r.prevFrom, to: r.prevTo }) + ': ' + rp(p.revenue) + '</div>' + targetHtml(d.targets) + '</div>';
    h += '<div class="kpis"><div class="card"><div class="sm mute">Pengeluaran operasional</div><b>' + rp(c.opExp) + '</b>' + gchip(d.growth.opExp, true) + '</div><div class="card"><div class="sm mute">Estimasi profit*</div><b>' + rp(c.estProfit) + '</b></div><div class="card"><div class="sm mute">Order</div><b>' + c.orders + '</b>' + gchip(d.growth.orders) + '</div><div class="card"><div class="sm mute">Item terjual</div><b>' + c.itemCount + '</b>' + gchip(d.growth.items) + '</div><div class="card"><div class="sm mute">Rata-rata per order</div><b>' + rp(c.aov) + '</b>' + gchip(d.growth.aov) + '</div><div class="card"><div class="sm mute">Rata-rata omzet per hari</div><b>' + rp(c.dailyAvg) + '</b></div></div>';
    h += '<div class="note">*Estimasi profit = omzet dikurangi pengeluaran operasional yang tercatat. Pembelian aset (' + rp(c.assetExp) + ') dicatat terpisah dan tidak dikurangkan. Ini bukan profit akurat.' + d.warnings.map(function (w) { return '<br>' + esc(w); }).join('') + '</div>';
    var tot = c.cash + c.qris, cp = tot ? Math.round(c.cash / tot * 100) : 0;
    h += '<div class="dgrid">';
    h += '<div class="card"><div class="h2">Tren omzet</div>' + (c.orders ? barsHtml(d.series, 'revenue') + (d.bestDay ? '<div class="sm mute" style="margin-top:6px">Tertinggi: ' + esc(d.bestDay.dow) + ' ' + dShort(d.bestDay.date) + ', ' + rp(d.bestDay.revenue) + (d.worstDay && d.worstDay.date !== d.bestDay.date ? '. Terendah: ' + esc(d.worstDay.dow) + ' ' + dShort(d.worstDay.date) + ', ' + rp(d.worstDay.revenue) : '') + '</div>' : '') : '<p class="empty">Belum ada transaksi pada periode ini.</p>') + '</div>';
    h += '<div class="card"><div class="h2">Jumlah order per hari</div>' + (c.orders ? barsHtml(d.series, 'orders') : '<p class="empty">Belum ada order.</p>') + '</div>';
    h += '<div class="card"><div class="h2">Omzet vs pengeluaran</div>' + hbars([{ n: 'Omzet', v: c.revenue }, { n: 'Pengeluaran operasional', v: c.opExp }, { n: 'Pembelian aset (terpisah)', v: c.assetExp }], function (x) { return x.n; }, function (x) { return x.v; }, rp) + '</div>';
    h += '<div class="card"><div class="h2">Cash dan QRIS</div><div class="split"><i style="width:' + cp + '%"></i></div><div class="row sm" style="margin-top:6px"><span>Cash ' + rp(c.cash) + '</span><span>QRIS ' + rp(c.qris) + '</span></div><p class="sm mute" style="margin:8px 0 0">QRIS bukan uang fisik di laci.</p><div class="row" style="margin-top:10px"><span class="sm">Closing hari ini</span>' + badge(d.todayClosing) + '</div><button class="lnk" data-a="go" data-v="closing" style="padding-left:0">Buka closing &rsaquo;</button></div>';
    h += '<div class="card"><div class="h2">Menu terlaris</div>' + (d.topMenu.length ? hbars(d.topMenu, function (x) { return esc(x.name); }, function (x) { return x.qty; }, function (v) { return v + ' porsi'; }) : '<p class="empty">Belum ada penjualan.</p>') + '</div>';
    h += '<div class="card"><div class="h2">Pengeluaran per kategori</div>' + (d.expenseByCat.length ? hbars(d.expenseByCat, function (x) { return esc(x.category) + (x.asset > 0 ? '<span class="pill asset">Aset</span>' : ''); }, function (x) { return x.total; }, rp) : '<p class="empty">Belum ada pengeluaran.</p>') + '</div>';
    h += '<div class="card"><div class="h2">Transaksi terbaru</div>' + (d.latest.length ? d.latest.map(function (o) { return '<div class="kv"><span>No. ' + ('00' + o.queueNo).slice(-3) + ', ' + esc(o.time) + ', ' + esc(o.payment) + ', ' + esc(o.staff) + '</span><b>' + rp(o.total) + '</b></div>'; }).join('') : '<p class="empty">Belum ada transaksi.</p>') + '</div>';
    return h + '</div></div></div>';
  }

  function loadReport() {
    var R = S.rep, seq = ++R.seq, pl = { type: R.type };
    if (R.type === 'week' && R.start) pl.start = R.start;
    if (R.type === 'month' && R.month) pl.month = R.month;
    R.err = ''; R.data = null; render();
    call('report.get', pl).then(function (d) { if (seq !== R.seq) return; R.data = d; if (S.view === 'reports') render(); }).catch(function (e) { if (seq !== R.seq || e.code === 'AUTH') return; R.err = e.message; if (S.view === 'reports') render(); });
  }
  function vReports() {
    var R = S.rep, d = R.data;
    var h = '<div class="scroll"><div style="max-width:900px;margin:0 auto" class="vs"><div class="row noprint"><h2 style="margin:0">Laporan</h2>' + (d ? '<button class="btn" data-a="rprint">Cetak / simpan PDF</button>' : '') + '</div><div class="seg noprint"><button data-a="rtype" data-v="week" class="' + (R.type === 'week' ? 'on' : '') + '">Mingguan</button><button data-a="rtype" data-v="month" class="' + (R.type === 'month' ? 'on' : '') + '">Bulanan</button></div>';
    if (R.err) return h + '<div class="err">' + esc(R.err) + '</div></div></div>';
    if (!d) return h + '<div class="center"><div class="spin"></div></div></div></div>';
    var r = d.range, c = d.cur, p = d.prev, g = d.growth, ex = d.expenses, mn = d.menu, wk = d.type === 'week';
    h += '<div class="row noprint"><button class="btn" data-a="rprev" aria-label="Sebelumnya">&lsaquo; Sebelumnya</button><button class="btn" data-a="rnext"' + (r.to >= S.today ? ' disabled' : '') + ' aria-label="Berikutnya">Berikutnya &rsaquo;</button></div>';
    h += '<div class="reportdoc vs"><div><h2 style="margin:0">Laporan ' + (wk ? 'mingguan' : 'bulanan') + ' ' + esc(S.cafeName) + '</h2><div class="sm mute">' + rangeText(r) + (r.complete ? '' : ' (periode berjalan, data sampai hari ini)') + '. Pembanding: ' + rangeText({ from: r.prevFrom, to: r.prevTo }) + '.</div></div>';
    h += '<div class="card"><div class="h2">Ringkasan</div>' + kvr('Omzet ' + gchip(g.revenue), rp(c.revenue)) + kvr('Omzet periode pembanding', rp(p.revenue)) + kvr('Order ' + gchip(g.orders), c.orders) + kvr('Item terjual', c.itemCount) + kvr('Rata-rata per order ' + gchip(g.aov), rp(c.aov)) + kvr('Rata-rata omzet per hari', rp(c.dailyAvg)) + kvr('Pengeluaran operasional ' + gchip(g.opExp, true), rp(c.opExp)) + kvr('Pembelian aset (terpisah)', rp(c.assetExp)) + kvr('Estimasi profit*', rp(c.estProfit)) + kvr('Penjualan Cash', rp(c.cash)) + kvr('Penjualan QRIS', rp(c.qris)) + (c.discount > 0 ? kvr('Diskon diberikan', rp(c.discount)) : '') + targetHtml(d.targets) + '</div>';
    h += '<div class="card"><div class="h2">Penjualan</div>' + (c.orders ? barsHtml(d.daily, 'revenue') : '<p class="empty">Tidak ada transaksi.</p>') + '<table class="tbl"><tr><th>Hari</th><th class="n">Order</th><th class="n">Omzet</th><th class="n">Rata-rata</th></tr>' + d.daily.map(function (x) { return '<tr><td>' + esc(x.dow) + ' ' + dShort(x.date) + '</td><td class="n">' + x.orders + '</td><td class="n">' + rp(x.revenue) + '</td><td class="n">' + (x.orders ? rp(x.aov) : '-') + '</td></tr>'; }).join('') + '</table>' + (d.bestDay ? '<p class="sm" style="margin:8px 0 0">Terlaris: ' + esc(d.bestDay.dow) + ' (' + rp(d.bestDay.revenue) + ')' + (d.worstDay && d.worstDay.date !== d.bestDay.date ? ', terendah: ' + esc(d.worstDay.dow) + ' (' + rp(d.worstDay.revenue) + ')' : '') + '. Hari tanpa transaksi tidak dihitung.</p>' : '') + '</div>';
    h += '<div class="card"><div class="h2">Performa menu</div>' + (mn.topQty.length ? '<div class="sm mute">Lima terlaris (porsi)</div>' + hbars(mn.topQty, function (x) { return esc(x.name); }, function (x) { return x.qty; }, function (v) { return v + ' porsi'; }) + '<div class="sm mute" style="margin-top:12px">Lima teratas menurut omzet (sebelum diskon)</div>' + hbars(mn.topRevenue, function (x) { return esc(x.name) + ' <span class="mute sm">' + pf(x.share) + '%</span>'; }, function (x) { return x.revenue; }, rp) : '<p class="empty">Belum ada penjualan.</p>');
    if (mn.growing.length) h += '<p class="sm" style="margin:12px 0 0"><b class="green">Naik:</b> ' + mn.growing.map(function (x) { return esc(x.name) + ' (' + x.prevQty + ' menjadi ' + x.qty + ')'; }).join(', ') + '</p>';
    if (mn.declining.length) h += '<p class="sm" style="margin:6px 0 0"><b class="red">Turun:</b> ' + mn.declining.map(function (x) { return esc(x.name) + ' (' + x.prevQty + ' menjadi ' + x.qty + ')'; }).join(', ') + '</p>';
    if (c.orders) h += '<p class="sm" style="margin:6px 0 0"><b>Terendah:</b> ' + mn.lowest.map(function (x) { return esc(x.name) + (x.qty === 0 ? ' (tidak terjual)' : ' (' + x.qty + ')'); }).join(', ') + '</p>';
    if (mn.categories.length) h += '<table class="tbl" style="margin-top:10px"><tr><th>Kategori</th><th class="n">Porsi</th><th class="n">Omzet</th><th class="n">Porsi omzet</th></tr>' + mn.categories.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="n">' + x.qty + '</td><td class="n">' + rp(x.revenue) + '</td><td class="n">' + pf(x.share) + '%</td></tr>'; }).join('') + '</table>';
    h += '</div>';
    h += '<div class="card"><div class="h2">Pengeluaran</div>' + kvr('Operasional', rp(ex.operational)) + kvr('Operasional periode pembanding', rp(ex.prevOperational)) + kvr('Rasio terhadap omzet', ex.ratio === null ? '-' : pf(ex.ratio) + '%') + kvr('Pembelian aset (terpisah)', rp(ex.asset)) + (ex.byCategory.length ? '<div style="margin-top:10px">' + hbars(ex.byCategory, function (x) { return esc(x.category) + (x.asset > 0 ? '<span class="pill asset">Aset</span>' : ''); }, function (x) { return x.total; }, rp) + '</div>' : '') + (ex.unusual.length ? '<p class="sm" style="margin:8px 0 0"><b>Tidak biasa:</b> ' + ex.unusual.map(function (u) { return esc(u.description) + ' ' + rp(u.amount); }).join(', ') + '</p>' : '') + '<p class="sm mute" style="margin:8px 0 0">Arus kas (uang keluar) tidak sama dengan beban akuntansi: pembelian aset tidak dihitung sebagai biaya operasional.</p></div>';
    h += '<div class="card"><div class="h2">Operasional</div>' + (d.operations.staff.length ? '<table class="tbl"><tr><th>Staff</th><th class="n">Order</th><th class="n">Omzet</th></tr>' + d.operations.staff.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td class="n">' + x.orders + '</td><td class="n">' + rp(x.revenue) + '</td></tr>'; }).join('') + '</table>' : '<p class="empty">Belum ada data.</p>') + '<p class="sm mute" style="margin:8px 0 0">Angka per staff tidak memperhitungkan jadwal dan shift, jangan dipakai sebagai penilaian kinerja.</p>' + kvr('Closing terkirim', d.operations.closings.count) + kvr('Closing dengan selisih', d.operations.closings.withDiff + (d.operations.closings.withDiff ? ' (total ' + (d.operations.closings.totalDiff < 0 ? '\u2212' : '+') + rp(Math.abs(d.operations.closings.totalDiff)) + ')' : '')) + '</div>';
    h += '<div class="card"><div class="h2">Insight</div>' + d.insights.map(function (x) { return '<p style="margin:0 0 8px">' + esc(x) + '</p>'; }).join('') + '</div>';
    h += '<div class="card"><div class="h2">Rekomendasi</div>' + (d.recommendations.length ? '<ol style="margin:0;padding-left:20px">' + d.recommendations.map(function (x) { return '<li style="margin-bottom:8px"><b>' + esc(x.title) + '</b><br><span class="sm">' + esc(x.detail) + '</span></li>'; }).join('') + '</ol>' : '<p class="empty" style="padding:8px 0">Data belum cukup untuk rekomendasi yang spesifik.</p>') + '</div>';
    h += '<div class="card"><div class="h2">Keterbatasan data</div><ul class="sm mute" style="margin:0;padding-left:18px">' + d.limitations.map(function (x) { return '<li style="margin-bottom:4px">' + esc(x) + '</li>'; }).join('') + '</ul><p class="sm mute" style="margin:10px 0 0">*Estimasi profit = omzet dikurangi pengeluaran operasional tercatat.' + (d.stored && d.stored.changedSinceGenerated ? ' Laporan ini dihitung ulang karena ada koreksi transaksi sejak dibuat.' : '') + '</p></div></div>';
    return h + '</div></div>';
  }
  function vMore() {
    var u = S.user || {};
    var h = '<div class="scroll"><div class="vs" style="max-width:520px;margin:0 auto"><div class="card"><b style="font-size:18px">' + esc(u.name) + '</b><div class="mute sm">' + esc(u.role === 'Owner' ? 'Owner' : 'Barista') + '</div></div><div class="list">';
    if (isOwner()) h += '<button class="item" data-a="go" data-v="expense"><b>Catat pengeluaran</b></button><button class="item" data-a="go" data-v="closing"><b>Closing harian</b><span class="mute">Cek, kunci, buka kembali</span></button>';
    if (isOwner()) h += '<button class="item" data-a="go" data-v="settings"><b>Pengaturan</b><span class="mute">Struk, tipe order, diskon</span></button>';
    if (isOwner()) h += '<button class="item" data-a="go" data-v="kas"><b>Kelola kas</b><span class="mute">Cash masuk/keluar, float</span></button>';
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
  function receiptHtml(o, cf) {
    var c = cf || cfg(), r = c.receipt;
    var h = '<div class="receipt" id="receipt">' + (r.logo ? '<div class="rc"><img class="rlogo" src="icons/logo-struk.png" alt="' + esc(c.cafe.name) + '"></div>' : '<div class="rc"><b>' + esc(c.cafe.name) + '</b></div>') +
      (c.cafe.address ? '<div class="rc rs">' + esc(c.cafe.address) + '</div>' : '') + (c.cafe.instagram ? '<div class="rc rs">' + esc(c.cafe.instagram) + '</div>' : '') +
      (r.queue ? '<div class="rc rq"><span class="rql">NO. ANTRIAN</span><b>' + qno(o) + '</b></div>' : '') + '<div class="rule dbl"></div>' +
      '<div class="rr"><span>Tanggal</span><span>' + esc(dShort(o.date)) + ' ' + hm(o.time) + '</span></div>' +
      (r.cashier ? '<div class="rr"><span>Kasir</span><span>' + esc(o.staff) + '</span></div>' : '') +
      (o.orderType ? '<div class="rr"><span>Tipe</span><span>' + esc(o.orderType) + '</span></div>' : '') +
      (o.customer ? '<div class="rr"><span>Nama</span><span>' + esc(o.customer) + '</span></div>' : '') +
      (o.table ? '<div class="rr"><span>Meja</span><span>' + esc(o.table) + '</span></div>' : '') + '<div class="rule dsh"></div>';
    o.items.forEach(function (i) {
      h += '<div class="ri">' + esc(i.name) + '</div><div class="rr"><span>' + i.qty + ' x ' + rp(i.price).replace('Rp', '') + '</span><span>' + rp(i.subtotal).replace('Rp', '') + '</span></div>';
    });
    h += '<div class="rule dsh"></div>' + (o.discount > 0 ? '<div class="rr"><span>Subtotal</span><span>' + rp(o.subtotal).replace('Rp', '') + '</span></div><div class="rr"><span>Diskon' + (o.discountName ? ' (' + esc(o.discountName) + ')' : '') + '</span><span>-' + rp(o.discount).replace('Rp', '') + '</span></div>' : '') +
      '<div class="rr rt"><span>TOTAL:</span><span>' + rp(o.total) + '</span></div><div class="rule dsh"></div>' +
      '<div class="rr"><span>' + esc(o.payment) + '</span><span>' + rp(o.total).replace('Rp', '') + '</span></div>' +
      (o.notes ? '<div class="rn">Catatan: ' + esc(o.notes) + '</div>' : '') +
      (r.orderNo ? '<div class="rule dsh"></div><div class="rr"><span>No. Order</span><span>' + esc(o.orderId) + '</span></div>' : '') + '<div class="rule dbl"></div>' +
      (r.footerOn && c.cafe.footer ? '<div class="rc">' + esc(c.cafe.footer) + '</div>' : '') + '</div>';
    return h;
  }
  function waText(o) {
    var c = cfg(), L = [c.cafe.name];
    if (c.cafe.address) L.push(c.cafe.address);
    L.push('');
    if (c.receipt.queue) L.push('No. antrian: ' + qno(o));
    L.push('Tanggal: ' + dShort(o.date) + ' ' + hm(o.time));
    if (o.orderType) L.push('Tipe: ' + o.orderType + (o.table ? ', meja ' + o.table : ''));
    if (o.customer) L.push('Nama: ' + o.customer);
    L.push('');
    o.items.forEach(function (i) { L.push(i.qty + ' x ' + i.name + '  ' + rp(i.subtotal)); });
    L.push('');
    if (o.discount > 0) L.push('Diskon' + (o.discountName ? ' (' + o.discountName + ')' : '') + ': -' + rp(o.discount));
    L.push('TOTAL: ' + rp(o.total)); L.push('Bayar: ' + o.payment);
    if (c.receipt.orderNo) L.push('No. order: ' + o.orderId);
    if (c.receipt.footerOn && c.cafe.footer) { L.push(''); L.push(c.cafe.footer); }
    return L.join('\n');
  }
  function vModal() {
    var m = S.modal, h = '<div class="modal" data-a="mbg"><div class="sheetbox">';
    if (m.type === 'order') {
      if (m.fresh) h += '<div class="ok-h"><i>&#10003;</i><div><b>' + (m.dup ? 'Order sudah tersimpan' : 'Order tersimpan') + '</b><div class="sm mute">No. antrian ' + qno(m.order) + '</div></div></div>';
      else h += '<div class="row" style="margin-bottom:10px"><b>Detail order</b></div>';
      var od = m.order, acts = '';
      if (!m.fresh && isOwner()) {
        if (od.deleted) acts += '<div class="err">Order ini DIHAPUS' + (od.deleteReason ? ': ' + esc(od.deleteReason) : '') + '</div>' + (m.frozen ? '' : '<button class="btn ok big" data-a="orderRestore">Pulihkan order</button>');
        else if (m.frozen) acts += '<div class="note">Tanggal ini sudah closing. Buka kembali closing sebelum mengubah atau menghapus.</div>';
        else acts += '<button class="btn big outline" data-a="orderPay">Ubah pembayaran ke ' + (od.payment === 'Cash' ? 'QRIS' : 'Cash') + '</button><button class="btn big outline red" data-a="orderDel">Hapus order</button>';
      }
      h += receiptHtml(od) + '<div class="vs" style="margin-top:14px">' + acts + '<button class="btn pri big" data-a="mclose">' + (m.fresh ? 'Order berikutnya' : 'Tutup') + '</button><button class="btn big outline" data-a="wa">Kirim lewat WhatsApp</button><button class="btn big outline" data-a="print">Cetak struk 58 mm</button></div>';
    } else if (m.type === 'reason') {
      var r = S.reason;
      h += '<h3 style="margin:0 0 6px">' + esc(r.title) + '</h3><p class="mute sm" style="margin:0 0 12px">' + esc(r.desc) + '</p><label class="field"><span>Alasan (wajib)</span><input type="text" data-bind="reason.text" maxlength="200" value="' + esc(r.text) + '"></label>' + (r.err ? '<div class="err" style="margin-top:12px">' + esc(r.err) + '</div>' : '') +
        '<div class="vs" style="margin-top:14px"><button class="btn big ' + (r.danger ? 'danger' : 'pri') + '" data-a="reasonOk"' + (r.busy ? ' disabled' : '') + '>' + (r.busy ? 'Memproses…' : esc(r.btn)) + '</button><button class="lnk" style="width:100%" data-a="mclose">Batal</button></div>';
    } else if (m.type === 'expense') {
      var ex = m.expense;
      h += '<h3 style="margin:0 0 10px">Detail pengeluaran</h3><div class="card">' + kvr('Deskripsi', esc(ex.description)) + kvr('Kategori', esc(ex.category) + ', ' + esc(ex.subcategory)) + kvr('Jenis', ex.type === ASSET ? 'Aset / Capex' : 'Operasional') + kvr('Nominal', rp(ex.amount)) + kvr('Dibayar', esc(ex.payment)) + kvr('Oleh', esc(ex.staff) + ', ' + hm(ex.time)) + (ex.vendor ? kvr('Vendor', esc(ex.vendor)) : '') + '</div><div class="vs" style="margin-top:14px">' +
        (ex.deleted ? '<div class="err">DIHAPUS' + (ex.deleteReason ? ': ' + esc(ex.deleteReason) : '') + '</div>' + (m.frozen ? '' : '<button class="btn ok big" data-a="expRestore">Pulihkan pengeluaran</button>') : (m.frozen ? '<div class="note">Tanggal ini sudah closing. Buka kembali closing sebelum menghapus.</div>' : '<button class="btn big outline red" data-a="expDel">Hapus pengeluaran</button>')) + '<button class="btn pri big" data-a="mclose">Tutup</button></div>';
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
    var body = S.view === 'order' ? vOrder() : S.view === 'expense' ? vExpense() : S.view === 'history' ? vHistory() : S.view === 'closing' ? vClosing() : S.view === 'kas' ? vKas() : S.view === 'settings' ? vSettings() : S.view === 'dashboard' ? vDashboard() : S.view === 'reports' ? vReports() : S.view === 'more' ? vMore() : S.view === 'menuAdmin' ? vMenuAdmin() : S.view === 'users' ? vUsers() : '';
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
    if (S.modal) el('toast').innerHTML = '';
    var prevSc = document.querySelector('.scroll'), top = prevSc ? prevSc.scrollTop : 0, pv = S._pv;
    el('app').innerHTML = h;
    var nwSc = document.querySelector('.scroll'); if (nwSc && pv === S.view) nwSc.scrollTop = top; S._pv = S.view;
    el('app').className = S.cartOpen && S.view === 'order' ? 'sheet' : '';
  }

  /* ---------- aksi ---------- */
  function setPath(path, v) { var p = path.split('.'), o = S, i; for (i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }
  function go(v) {
    S.view = v; S.cartOpen = false; S.modal = null;
    if (v === 'history') { render(); loadHistory(); return; }
    if (v === 'closing') { render(); loadClosing(); return; }
    if (v === 'kas') { render(); loadKas(); return; }
    if (v === 'settings') { loadSettings(); return; }
    if (v === 'dashboard') { loadDashboard(); return; }
    if (v === 'reports') { loadReport(); return; }
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
  var clearPreviousPrint;
  function printWith(cls) {
    if (clearPreviousPrint) clearPreviousPrint();
    var sheet = document.createElement('style');
    sheet.media = 'print';
    sheet.textContent = cls === 'print-receipt' ? '@page { size: auto; margin: 0 }' : '@page { margin: 10mm }';
    document.head.appendChild(sheet);
    document.body.classList.add(cls);
    function clearPrint() {
      document.body.classList.remove(cls);
      if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
      window.onafterprint = null;
      clearPreviousPrint = null;
    }
    clearPreviousPrint = window.onafterprint = clearPrint;
    try { window.print(); } catch (x) { clearPrint(); toast('Cetak tidak tersedia di perangkat ini.', true); }
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
    openOrder: function (e) { var fz = S.orders.dayState === 'Submitted' || S.orders.dayState === 'Locked'; S.modal = { type: 'order', order: S.orders.orders[Number(e.getAttribute('data-v'))], fresh: false, frozen: fz }; render(); },
    openExp: function (e) { var fz = S.expenses.dayState === 'Submitted' || S.expenses.dayState === 'Locked'; S.modal = { type: 'expense', expense: S.expenses.expenses[Number(e.getAttribute('data-v'))], frozen: fz }; render(); },
    hdel: function (e) { S.histDel = e.getAttribute('data-v') === '1'; render(); loadHistory(); },
    orderDel: function () { var o = S.modal.order; openReason({ kind: 'delOrder', id: o.orderId, title: 'Hapus order No. ' + qno(o), desc: 'Order hilang dari riwayat dan semua laporan, tetapi datanya tetap tersimpan dan tercatat di audit. Bisa dipulihkan.', btn: 'Hapus order', danger: true }); },
    orderRestore: function () { var o = S.modal.order; openReason({ kind: 'restoreOrder', id: o.orderId, title: 'Pulihkan order No. ' + qno(o), desc: 'Order kembali masuk ke riwayat dan laporan.', btn: 'Pulihkan' }); },
    orderPay: function () { var o = S.modal.order, to = o.payment === 'Cash' ? 'QRIS' : 'Cash'; openReason({ kind: 'payOrder', id: o.orderId, extra: to, title: 'Ubah pembayaran ke ' + to, desc: 'Mengubah metode bayar order No. ' + qno(o) + ' akan mengubah hitungan uang di laci.', btn: 'Ubah ke ' + to }); },
    expDel: function () { var x = S.modal.expense; openReason({ kind: 'delExp', id: x.expenseId, title: 'Hapus pengeluaran', desc: 'Pengeluaran hilang dari riwayat dan laporan, tetapi tetap tersimpan di audit. Bisa dipulihkan.', btn: 'Hapus pengeluaran', danger: true }); },
    expRestore: function () { var x = S.modal.expense; openReason({ kind: 'restoreExp', id: x.expenseId, title: 'Pulihkan pengeluaran', desc: 'Pengeluaran kembali masuk ke riwayat dan laporan.', btn: 'Pulihkan' }); },
    reasonOk: function () {
      var r = S.reason, t = r.text.trim();
      if (t.length < 3) { r.err = 'Alasan wajib diisi (minimal 3 huruf).'; return render(); }
      var map = { delOrder: ['order.delete', { orderId: r.id }], restoreOrder: ['order.restore', { orderId: r.id }], payOrder: ['order.update', { orderId: r.id, paymentMethod: r.extra }], delExp: ['expense.delete', { expenseId: r.id }], restoreExp: ['expense.restore', { expenseId: r.id }], reopen: ['closing.reopen', { date: S.cl.sum ? S.cl.sum.date : undefined }] };
      var c = map[r.kind]; c[1].reason = t; r.busy = true; r.err = ''; render();
      call(c[0], c[1]).then(function () { S.modal = null; toast('Berhasil disimpan.'); if (r.kind === 'reopen') { loadClosing(); render(); } else { render(); loadHistory(); } })
        .catch(function (e) { r.busy = false; r.err = e.message; render(); });
    },
    clreload: function () { S.cl.err = ''; S.cl.unknown = false; render(); loadClosing(); },
    clsubmit: function () {
      var c = S.cl; if (c.busy) return;
      if (c.actual === '') { c.err = 'Isi uang cash aktual di laci.'; return render(); }
      var diff = Number(c.actual) - c.sum.expected;
      if (diff !== 0 && !c.notes.trim()) { c.err = 'Keterangan wajib diisi karena ada selisih.'; return render(); }
      if (!confirm('Kirim closing hari ini? Setelah dikirim, order dan pengeluaran hari ini terkunci sampai owner membukanya kembali.')) return;
      c.busy = true; c.err = ''; c.unknown = false; render();
      call('closing.submit', { actualCash: Number(c.actual), notes: c.notes }).then(function (d) { c.busy = false; c.sum = d.summary; c.closing = d.closing; c.actual = ''; c.notes = ''; toast('Closing terkirim.'); render(); })
        .catch(function (e) { c.busy = false; if (e.unknown) { c.unknown = true; c.err = 'Koneksi terputus. Cek status closing dulu sebelum mengirim lagi.'; } else c.err = e.message; render(); });
    },
    cllock: function () { if (!confirm('Kunci closing hari ini?')) return; call('closing.lock', { date: S.cl.sum.date }).then(function (d) { S.cl.sum = d.summary; S.cl.closing = d.closing; toast('Closing dikunci.'); loadClosing(); render(); }).catch(function (e) { toast(e.message, true); }); },
    clreopen: function () { openReason({ kind: 'reopen', title: 'Buka kembali closing', desc: 'Order, pengeluaran, dan kas hari ini bisa diubah lagi. Staff harus mengirim closing ulang.', btn: 'Buka kembali' }); },
    kastype: function (e) { S.kas.type = e.getAttribute('data-v'); S.kas.err = ''; render(); },
    kassave: function () {
      var k = S.kas, amt = Number(k.amount);
      if (k.busy) return;
      if (k.amount === '' || isNaN(amt) || (k.type !== 'Opening Float' && amt < 1)) { k.err = 'Isi nominal dengan benar.'; return render(); }
      if (k.reason.trim().length < 3) { k.err = 'Alasan wajib diisi (minimal 3 huruf).'; return render(); }
      if (!k.rid) k.rid = newRid('c');
      k.busy = true; k.err = ''; render();
      call('cash.add', { type: k.type, amount: amt, reason: k.reason.trim(), clientRequestId: k.rid }).then(function (res) { k.busy = false; k.rid = null; k.amount = ''; k.reason = ''; toast(res.duplicate ? 'Sudah tercatat sebelumnya.' : 'Perubahan kas tersimpan.'); render(); loadKas(); })
        .catch(function (e) { k.busy = false; if (!e.unknown) k.rid = null; k.err = e.unknown ? 'Koneksi terputus. Tekan Simpan lagi (aman, tidak akan tercatat ganda).' : e.message; render(); });
    },
    mclose: function () { S.modal = null; S.edit = null; render(); },
    mbg: function (e, ev) { if (ev.target === e && S.modal && S.modal.type !== 'menu') { S.modal = null; render(); } },
    print: function () { printWith('print-receipt'); },
    menuNew: function () { S.edit = { id: '', name: '', category: S.cat || '', variant: '', price: '', cost: '', active: true, err: '', busy: false }; S.modal = { type: 'menu' }; render(); },
    menuEdit: function (e) { var m = menuById(e.getAttribute('data-v')); if (!m) return; S.edit = { id: m.id, name: m.name, category: m.category, variant: m.variant || '', price: String(m.price), cost: m.cost === null || m.cost === undefined ? '' : String(m.cost), active: m.active !== false, err: '', busy: false }; S.modal = { type: 'menu' }; render(); },
    eactive: function (e) { S.edit.active = e.getAttribute('data-v') === '1'; render(); },
    menuSave: saveMenuItem,
    otype: function (e) { if (locked()) return; S.otype = e.getAttribute('data-v'); updateCartUI(); },
    mkind: function (e) { if (locked()) return; S.manual.kind = e.getAttribute('data-v'); updateCartUI(); },
    wa: function () { var o = S.modal && S.modal.order; if (!o) return; try { window.open('https://wa.me/?text=' + encodeURIComponent(waText(o)), '_blank'); } catch (x) { toast('WhatsApp tidak bisa dibuka.', true); } },
    cfgtog: function (e) { var p = e.getAttribute('data-v').split('.'), o = S.cfg, i; for (i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = !o[p[p.length - 1]]; render(); },
    cfgkind: function (e) { var x = e.getAttribute('data-v').split(':'); S.cfg.discounts.presets[Number(x[0])].kind = x[1]; render(); },
    cfgadd: function () { if (S.cfg.discounts.presets.length >= 20) return; S.cfg.discounts.presets.push({ id: '', name: '', kind: 'percent', value: 10, active: true }); render(); },
    cfgdel: function (e) { if (confirm('Hapus diskon ini dari pengaturan? Order lama tidak terpengaruh.')) { S.cfg.discounts.presets.splice(Number(e.getAttribute('data-v')), 1); render(); } },
    cfgsave: function () {
      var c = JSON.parse(JSON.stringify(S.cfg)), i;
      c.orderTypes.types = S.cfgTypes.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      for (i = 0; i < c.discounts.presets.length; i++) { c.discounts.presets[i].value = Number(c.discounts.presets[i].value) || 0; }
      S.cfgBusy = true; S.cfgErr = ''; render();
      call('config.save', { config: c, note: S.cfgNote }).then(function (d) {
        S.cfgBusy = false; S.cfgNote = ''; S.config = d.config; S.cfgVersion = d.version; S.cafeName = d.config.cafe.name; toast('Pengaturan diterapkan (versi ' + d.version + ').'); loadSettings();
      }).catch(function (e) { S.cfgBusy = false; S.cfgErr = e.message; render(); });
    },
    cfgrb: function (e) {
      var v = Number(e.getAttribute('data-v')); if (!confirm('Kembalikan pengaturan ke versi ' + v + '? Ini membuat versi baru, riwayat lama tetap tersimpan.')) return;
      call('config.rollback', { version: v }).then(function (d) { S.config = d.config; S.cfgVersion = d.version; S.cafeName = d.config.cafe.name; toast('Pengaturan dikembalikan (versi baru ' + d.version + ').'); loadSettings(); }).catch(function (er) { toast(er.message, true); });
    },
    dper: function (e) { S.dash.period = e.getAttribute('data-v'); loadDashboard(); },
    dapply: function () { if (!S.dash.from || !S.dash.to) { toast('Pilih tanggal awal dan akhir.', true); return; } loadDashboard(); },
    dreload: function () { loadDashboard(); },
    rtype: function (e) { S.rep.type = e.getAttribute('data-v'); S.rep.start = ''; S.rep.month = ''; loadReport(); },
    rprev: function () { var r = S.rep.data.range; if (S.rep.type === 'week') S.rep.start = isoAdd(r.from, -7); else S.rep.month = ymShift(r.from.slice(0, 7), -1); loadReport(); },
    rnext: function () { var r = S.rep.data.range; if (S.rep.type === 'week') S.rep.start = isoAdd(r.from, 7); else S.rep.month = ymShift(r.from.slice(0, 7), 1); loadReport(); },
    rprint: function () { printWith('print-report'); },
    tgsave: function () {
      var t = S.tg; if (t.busy) return; t.busy = true; t.err = ''; render();
      call('targets.save', { daily: t.daily, weekly: t.weekly, monthly: t.monthly }).then(function () { t.busy = false; toast('Target disimpan.'); render(); }).catch(function (e) { t.busy = false; t.err = e.message; render(); });
    },
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
    if (b === 'exp.amount' || b === 'edit.price' || b === 'edit.cost' || b === 'cl.actual' || b === 'kas.amount' || b === 'manual.value' || /^tg\.(daily|weekly|monthly)$/.test(b) || /^cfg\.discounts\.presets\.\d+\.value$/.test(b)) { v = v.replace(/\D/g, ''); if (t.value !== v) t.value = v; }
    setPath(b, v);
    if (b === 'exp.amount') { var f = el('amtfmt'); if (f) f.textContent = v ? rp(v) : ''; }
    if (b === 'cl.actual') updateDiff();
    if (b === 'manual.value') updateTotals();
    if (b === 'q') { S.cat = S.cat; var g = el('grid'); if (g) { g.innerHTML = gridHtml(); el('cats').innerHTML = catsHtml(menuCats()); } }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, b = t.getAttribute && t.getAttribute('data-bind');
    if (b === 'histDate') { S.histDate = t.value; loadHistory(); return; }
    if (b === 'odisc') { S.odisc = t.value; updateCartUI(); return; }
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
