/* Phở 10 Sync — Customer View Logic (Firestore edition) */

(function () {
  'use strict';

  /* ── Timing constants (demo-friendly) ───────────────────── */
  const TOTAL_WAIT_MS     = 5 * 60 * 1000;
  const WAIT_THRESHOLD_MS = 5 * 60 * 1000;

  /* ── Menu data ───────────────────────────────────────────── */
  const MENU = [
    { name: 'Tai',  label: 'Phở Tái',  desc: 'Thịt bò tái mềm', price: 55000 },
    { name: 'Chin', label: 'Phở Chín', desc: 'Thịt bò chín kỹ', price: 55000 },
    { name: 'Nam',  label: 'Phở Nạm',  desc: 'Thịt bò nạm',     price: 60000 },
    { name: 'Gau',  label: 'Phở Gầu',  desc: 'Thịt bò gầu béo', price: 60000 },
  ];

  /* ── State ───────────────────────────────────────────────── */
  const params   = new URLSearchParams(window.location.search);
  const tableNum = parseInt(params.get('table') || '1', 10);
  const db       = window._pho10Db;

  let quantities       = {};
  MENU.forEach(function (d) { quantities[d.name] = 0; });

  let myTicket         = null;
  let myQueueNumber    = 0;
  let orderLocked      = false;
  let countdownTimer   = null;
  let currentInventory = [];   /* cached from Firestore inventory onSnapshot */

  /* ── DOM shortcuts ───────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  const dom = {
    queueNum:      el('queue-number-display'),
    tableNum:      el('table-number-display'),
    statusBadge:   el('status-badge'),
    menuList:      el('menu-list'),
    btnCheckout:   el('btn-checkout'),
    secWaiting:    el('section-waiting'),
    secBell:       el('section-bell'),
    secStatus:     el('section-status'),
    countdown:     el('countdown-display'),
    progressBar:   el('progress-bar'),
    progressLabel: el('progress-label'),
    btnBell:       el('btn-bell'),
    bellLabel:     el('bell-status-label'),
    orderStatus:   el('order-status-display'),
  };

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */
  function init() {
    dom.tableNum.textContent = tableNum;

    const savedId = sessionStorage.getItem('pho10_ticket_id');
    if (savedId) {
      /* Restore session: load ticket from Firestore */
      db.collection('orders').doc(savedId).get().then(function (snap) {
        if (snap.exists) {
          myTicket      = snap.data();
          myQueueNumber = myTicket.queueNumber;
          showQueueNumber(myQueueNumber);
          if (myTicket.status !== 'pending') {
            lockOrder();
          }
        } else {
          /* Ticket no longer in Firestore — start fresh */
          assignQueueNumber();
        }
        attachListeners();
        listenFirestore();
      });
    } else {
      assignQueueNumber();
      attachListeners();
      listenFirestore();
    }
  }

  /* ── Claim next queue number from Firestore meta doc ─────── */
  function assignQueueNumber() {
    const ref = db.collection('meta').doc('queue_counter');
    ref.get().then(function (snap) {
      const current = (snap.exists && snap.data().value != null) ? snap.data().value : 44;
      myQueueNumber = current + 1;
      return ref.set({ value: myQueueNumber });
    }).then(function () {
      showQueueNumber(myQueueNumber);
    });
  }

  function showQueueNumber(n) {
    dom.queueNum.innerHTML =
      '<span style="font-size:0.42em;font-weight:600;opacity:0.65;vertical-align:middle">#</span>' + n;
  }

  /* ════════════════════════════════════════════════════════════
     MENU
  ════════════════════════════════════════════════════════════ */
  function renderMenu() {
    const rows = MENU.map(function (dish) {
      const inv   = currentInventory.find(function (i) { return i.dishName === dish.name; });
      const avail = inv ? inv.available : true;
      const qty   = quantities[dish.name] || 0;
      const locked = !avail || orderLocked;

      return (
        '<article class="flex items-center justify-between py-2.5' + (!avail ? ' opacity-40' : '') + '">' +
          '<div class="flex-1 min-w-0 pr-3">' +
            '<p class="font-semibold text-gray-900 text-sm leading-tight">' + dish.label + '</p>' +
            '<p class="text-xs mt-0.5 ' + (!avail ? 'text-red-500 font-semibold' : 'text-gray-400') + '">' +
              (!avail ? 'Hết món' : fmtPrice(dish.price)) +
            '</p>' +
          '</div>' +
          '<div class="flex items-center gap-2 flex-shrink-0">' +
            '<button data-action="minus" data-dish="' + dish.name + '"' +
              ' class="qty-btn w-9 h-9 rounded-full border-2 border-gray-200 text-gray-500' +
              ' flex items-center justify-center hover:border-red-500 hover:text-red-600' +
              ' transition-colors disabled:opacity-25 disabled:cursor-not-allowed"' +
              (locked ? ' disabled' : '') + '>' +
              '<i class="fa-solid fa-minus text-xs"></i>' +
            '</button>' +
            '<span id="qty-' + dish.name + '"' +
              ' class="w-8 text-center font-black text-gray-900 text-lg tabular-nums leading-none">' +
              qty +
            '</span>' +
            '<button data-action="plus" data-dish="' + dish.name + '"' +
              ' class="qty-btn w-9 h-9 rounded-full text-white' +
              ' flex items-center justify-center transition-all' +
              ' disabled:cursor-not-allowed disabled:opacity-25"' +
              ' style="background-color:' + (locked ? '#D1D5DB' : '#D62828') + '"' +
              (locked ? ' disabled' : '') + '>' +
              '<i class="fa-solid fa-plus text-xs"></i>' +
            '</button>' +
          '</div>' +
        '</article>'
      );
    }).join('<div class="border-t border-gray-50"></div>');

    dom.menuList.innerHTML = rows;
    syncCheckoutBtn();
  }

  function fmtPrice(n) { return n.toLocaleString('vi-VN') + 'đ'; }

  function syncCheckoutBtn() {
    if (orderLocked) return;
    const total = Object.values(quantities).reduce(function (s, q) { return s + q; }, 0);
    dom.btnCheckout.disabled = total === 0;
    dom.btnCheckout.innerHTML = total > 0
      ? '<i class="fa-solid fa-bag-shopping mr-2"></i>Đặt món (' + total + ' phần)'
      : '<i class="fa-solid fa-bag-shopping mr-2"></i>Xác nhận đặt món';
  }

  /* ════════════════════════════════════════════════════════════
     EVENT LISTENERS
  ════════════════════════════════════════════════════════════ */
  function attachListeners() {
    dom.menuList.addEventListener('click', function (e) {
      const btn = e.target.closest('.qty-btn');
      if (!btn || btn.disabled || orderLocked) return;
      const dish   = btn.dataset.dish;
      const action = btn.dataset.action;
      if (action === 'plus')  quantities[dish] = (quantities[dish] || 0) + 1;
      if (action === 'minus') quantities[dish] = Math.max(0, (quantities[dish] || 0) - 1);
      const qEl = document.getElementById('qty-' + dish);
      if (qEl) qEl.textContent = quantities[dish];
      syncCheckoutBtn();
    });

    dom.btnCheckout.addEventListener('click', handleCheckout);
    dom.btnBell.addEventListener('click', handleBell);
  }

  /* ════════════════════════════════════════════════════════════
     CHECKOUT → FIRESTORE
  ════════════════════════════════════════════════════════════ */
  function handleCheckout() {
    if (orderLocked) return;

    const dishes = MENU
      .filter(function (d) { return quantities[d.name] > 0; })
      .map(function (d) {
        return { name: d.name, label: d.label, quantity: quantities[d.name], price: d.price };
      });
    if (!dishes.length) return;

    /* Loading state */
    dom.btnCheckout.disabled = true;
    dom.btnCheckout.classList.add('btn-loading');
    dom.btnCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Đang gửi đơn...';

    const now = Date.now();
    myTicket = {
      id:               Pho10.uid(),
      queueNumber:      myQueueNumber,
      tableNumber:      tableNum,
      dishes:           dishes,
      status:           'waiting',
      orderSubmittedAt: now,
      bellPressed:      false,
      bellPressedAt:    null,
      createdAt:        now,
    };

    db.collection('orders').doc(myTicket.id).set(myTicket)
      .then(function () {
        sessionStorage.setItem('pho10_ticket_id', myTicket.id);
        lockOrder();
        listenMyTicket();   /* start reacting to kitchen status updates */
      })
      .catch(function () {
        dom.btnCheckout.disabled = false;
        dom.btnCheckout.classList.remove('btn-loading');
        dom.btnCheckout.innerHTML = '<i class="fa-solid fa-bag-shopping mr-2"></i>Thử lại';
      });
  }

  /* ════════════════════════════════════════════════════════════
     LOCK / RESTORE ORDER UI
  ════════════════════════════════════════════════════════════ */
  function lockOrder() {
    orderLocked = true;

    dom.btnCheckout.disabled = true;
    dom.btnCheckout.classList.remove('btn-loading');
    dom.btnCheckout.classList.add('btn-success');
    dom.btnCheckout.innerHTML = '<i class="fa-solid fa-circle-check mr-2"></i>Đơn đã gửi bếp!';

    function revealSection(elem, delayMs) {
      setTimeout(function () {
        elem.classList.remove('hidden');
        elem.classList.add('section-reveal');
      }, delayMs);
    }
    revealSection(dom.secWaiting, 0);
    revealSection(dom.secBell,    120);
    revealSection(dom.secStatus,  240);

    setStatusBadge(myTicket.status);
    renderOrderSummary();
    renderMenu();
    restoreBellState();
    startCountdown(myTicket.orderSubmittedAt);

    if (Date.now() - myTicket.orderSubmittedAt < 3000) {
      showFloatToast(
        '<i class="fa-solid fa-circle-check" style="margin-right:8px"></i>Đơn đã gửi bếp thành công!',
        '#16A34A'
      );
    }
  }

  /* ════════════════════════════════════════════════════════════
     COUNTDOWN
  ════════════════════════════════════════════════════════════ */
  function startCountdown(submittedAt) {
    if (countdownTimer) clearInterval(countdownTimer);

    function tick() {
      const elapsed   = Date.now() - submittedAt;
      const remaining = Math.max(0, TOTAL_WAIT_MS - elapsed);
      const pct       = Math.min(100, (elapsed / TOTAL_WAIT_MS) * 100);

      dom.countdown.textContent     = Pho10.formatTime(remaining);
      dom.progressBar.style.width   = pct.toFixed(1) + '%';
      dom.progressLabel.textContent = Math.floor(pct) + '% thời gian đã qua';

      if (elapsed >= WAIT_THRESHOLD_MS && !myTicket.bellPressed) activateBell();
      if (remaining === 0 && countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    }

    tick();
    countdownTimer = setInterval(tick, 500);
  }

  /* ════════════════════════════════════════════════════════════
     BELL
  ════════════════════════════════════════════════════════════ */
  function activateBell() {
    if (dom.btnBell.classList.contains('bell-active') ||
        dom.btnBell.classList.contains('bell-pressed')) return;
    dom.btnBell.disabled = false;
    dom.btnBell.classList.add('bell-active');
    dom.bellLabel.textContent      = 'Nhấn để báo bếp ngay!';
    dom.bellLabel.style.color      = '#D62828';
    dom.bellLabel.style.fontWeight = '700';
  }

  function restoreBellState() {
    if (!myTicket || !myTicket.bellPressed) return;
    dom.btnBell.disabled = true;
    dom.btnBell.classList.remove('bell-active');
    dom.btnBell.classList.add('bell-pressed');
    dom.bellLabel.textContent      = '✓ Đã giục bếp — bếp sẽ ưu tiên bàn bạn!';
    dom.bellLabel.style.color      = '#16A34A';
    dom.bellLabel.style.fontWeight = '700';
  }

  function handleBell() {
    if (!myTicket || myTicket.bellPressed) return;
    if (myTicket.status === 'served') return;

    myTicket.bellPressed   = true;
    myTicket.bellPressedAt = Date.now();

    /* Update the order document's bell flag */
    db.collection('orders').doc(myTicket.id).update({
      bellPressed:   true,
      bellPressedAt: myTicket.bellPressedAt,
    });

    /* Write bell alert — doc ID = ticketId (enforces one bell per customer) */
    db.collection('bells').doc(myTicket.id).set({
      ticketId:     myTicket.id,
      tableNumber:  myTicket.tableNumber,
      queueNumber:  myTicket.queueNumber,
      pressedAt:    myTicket.bellPressedAt,
      acknowledged: false,
    });

    /* Update bell UI immediately — don't wait for Firestore round-trip */
    dom.btnBell.disabled = true;
    dom.btnBell.classList.remove('bell-active');
    dom.btnBell.classList.add('bell-pressed');
    dom.bellLabel.textContent      = '✓ Đã giục bếp — bếp sẽ ưu tiên bàn bạn!';
    dom.bellLabel.style.color      = '#16A34A';
    dom.bellLabel.style.fontWeight = '700';

    showFloatToast(
      '<i class="fa-solid fa-circle-check" style="margin-right:8px"></i>Đã giục bếp!',
      '#16A34A'
    );
  }

  function showFloatToast(html, bg) {
    const t = document.createElement('div');
    t.style.cssText = [
      'position:fixed', 'bottom:28px', 'left:50%', 'transform:translateX(-50%)',
      'background:' + bg, 'color:white', 'padding:12px 22px', 'border-radius:9999px',
      'font-size:14px', 'font-weight:700',
      'box-shadow:0 8px 24px rgba(0,0,0,0.20)',
      'z-index:9999', 'white-space:nowrap',
    ].join(';');
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  /* ════════════════════════════════════════════════════════════
     ORDER SUMMARY & STATUS
  ════════════════════════════════════════════════════════════ */
  function renderOrderSummary() {
    if (!myTicket) return;
    const rows = myTicket.dishes.map(function (d) {
      return (
        '<div class="flex justify-between items-center py-2">' +
          '<span class="text-gray-700 text-sm">' + d.label +
            ' <span class="text-gray-400">× ' + d.quantity + '</span></span>' +
          '<span class="text-gray-800 text-sm font-semibold">' + fmtPrice(d.price * d.quantity) + '</span>' +
        '</div>'
      );
    }).join('<div class="border-t border-gray-50"></div>');
    const total = myTicket.dishes.reduce(function (s, d) { return s + d.price * d.quantity; }, 0);
    dom.orderStatus.innerHTML =
      '<div>' + rows +
      '<div class="border-t-2 border-gray-100 mt-1 pt-2 flex justify-between items-center">' +
        '<span class="text-gray-900 font-bold text-sm">Tổng cộng</span>' +
        '<span style="color:#D62828;font-weight:800;font-size:1rem">' + fmtPrice(total) + '</span>' +
      '</div></div>';
  }

  function setStatusBadge(status) {
    const map = {
      pending:     { cls: 'badge-waiting',  text: 'Chờ đặt món' },
      waiting:     { cls: 'badge-waiting',  text: 'Đang chờ' },
      in_progress: { cls: 'badge-progress', text: 'Đang nấu' },
      served:      { cls: 'badge-served',   text: 'Đã phục vụ' },
    };
    const s = map[status] || map.waiting;
    dom.statusBadge.className   = s.cls + ' text-xs font-semibold px-3 py-1 rounded-full';
    dom.statusBadge.textContent = s.text;
  }

  function applyStatusChange(status) {
    setStatusBadge(status);

    if (status === 'in_progress') {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      dom.countdown.style.fontSize = '1.6rem';
      dom.countdown.style.color    = '#1D4ED8';
      dom.countdown.innerHTML =
        '<i class="fa-solid fa-motorcycle" style="font-size:1.2rem;margin-right:6px"></i>Đang tới!';
      dom.progressBar.style.backgroundColor = '#3B82F6';
      if (!document.getElementById('msg-in-progress')) {
        const msg = document.createElement('div');
        msg.id = 'msg-in-progress';
        msg.style.cssText =
          'margin-top:10px;padding:12px 14px;background:#EFF6FF;border-radius:12px;' +
          'display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:#1D4ED8;' +
          'animation:fade-in 0.4s ease-out';
        msg.innerHTML =
          '<i class="fa-solid fa-motorcycle" style="font-size:1.2rem;flex-shrink:0"></i>' +
          '<span>Phở đang tới bàn bạn!</span>';
        dom.orderStatus.appendChild(msg);
      }
      showFloatToast(
        '<i class="fa-solid fa-motorcycle" style="margin-right:8px"></i>Phở đang tới bàn bạn!',
        '#1D4ED8'
      );
    }

    if (status === 'served') {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      dom.countdown.style.fontSize = '1.75rem';
      dom.countdown.style.color    = '#16A34A';
      dom.countdown.innerHTML =
        '<i class="fa-solid fa-circle-check" style="font-size:1.2rem;margin-right:6px"></i>Đã phục vụ!';
      dom.progressBar.style.width           = '100%';
      dom.progressBar.style.backgroundColor = '#16A34A';
      dom.btnBell.disabled = true;
      dom.btnBell.classList.remove('bell-active');
      if (!document.getElementById('msg-served')) {
        const msg = document.createElement('div');
        msg.id = 'msg-served';
        msg.style.cssText =
          'margin-top:10px;padding:12px 14px;background:#F0FDF4;border-radius:12px;' +
          'display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700;color:#16A34A';
        msg.innerHTML =
          '<i class="fa-solid fa-circle-check" style="font-size:1.2rem;flex-shrink:0"></i>' +
          '<span>Phở đã được phục vụ. Chúc ngon miệng!</span>';
        dom.orderStatus.appendChild(msg);
      }
      showFloatToast(
        '<i class="fa-solid fa-circle-check" style="margin-right:8px"></i>Phở đã được phục vụ. Chúc ngon miệng!',
        '#16A34A'
      );
    }
  }

  /* ════════════════════════════════════════════════════════════
     FIRESTORE LISTENERS
  ════════════════════════════════════════════════════════════ */
  function listenFirestore() {
    /* Inventory — re-render menu whenever kitchen toggles availability */
    db.collection('inventory').onSnapshot(function (snap) {
      currentInventory = snap.docs.map(function (d) {
        return Object.assign({ dishName: d.id }, d.data());
      });
      renderMenu();
    });

    /* Own ticket status — only start listening if order already exists */
    if (myTicket) listenMyTicket();
  }

  function listenMyTicket() {
    db.collection('orders').doc(myTicket.id).onSnapshot(function (snap) {
      if (!snap.exists) return;
      const updated = snap.data();
      if (updated.status !== myTicket.status) {
        myTicket = updated;
        applyStatusChange(myTicket.status);
      }
    });
  }

  /* ── Boot ────────────────────────────────────────────────── */
  init();

})();
