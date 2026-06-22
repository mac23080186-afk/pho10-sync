/* Phở 10 Sync — Kitchen View Logic (Firestore edition) */

(function () {
  'use strict';

  /* ── Menu metadata (must match customer.js dish names) ───── */
  const MENU = {
    'Tai':  { label: 'Phở Tái',  price: 55000 },
    'Chin': { label: 'Phở Chín', price: 55000 },
    'Nam':  { label: 'Phở Nạm',  price: 60000 },
    'Gau':  { label: 'Phở Gầu',  price: 60000 },
  };

  const MENU_ORDER = ['Tai', 'Chin', 'Nam', 'Gau'];

  /* ── Firestore reference ──────────────────────────────────── */
  const db = window._pho10Db;

  /* ── Module-level state (populated by onSnapshot listeners) ─ */
  let _orders    = [];
  let _bells     = [];
  let _inventory = [];

  /* Flags to suppress alerts on the initial snapshot load */
  let _ordersReady    = false;
  let _bellsReady     = false;

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */
  function init() {
    Pho10.startClock('kitchen-clock');
    ensureInventorySeeded();
    attachListeners();
    listenFirestore();
  }

  /* Seed Firestore inventory collection on very first kitchen open */
  function ensureInventorySeeded() {
    db.collection('inventory').get().then(function (snap) {
      if (!snap.empty) return;
      const batch = db.batch();
      MENU_ORDER.forEach(function (name) {
        batch.set(
          db.collection('inventory').doc(name),
          { available: true, label: MENU[name].label, price: MENU[name].price }
        );
      });
      batch.commit();
    });
  }

  /* ════════════════════════════════════════════════════════════
     DATA HELPERS
  ════════════════════════════════════════════════════════════ */
  function getWaitingOrders(orders) {
    return orders.filter(function (t) { return t.status === 'waiting'; });
  }

  function getActiveOrders(orders) {
    return orders.filter(function (t) {
      return t.status === 'waiting' || t.status === 'in_progress';
    });
  }

  /*
   * Aggregate waiting orders by dish name.
   * Returns array (in MENU_ORDER) of:
   *   { name, label, total, tables: [{ticketId, tableNumber, queueNumber, quantity, createdAt}] }
   * tables sorted oldest-first (longest waiting first).
   */
  function aggregateByDish(waitingOrders) {
    const map = {};
    waitingOrders.forEach(function (ticket) {
      ticket.dishes.forEach(function (dish) {
        if (!map[dish.name]) {
          map[dish.name] = {
            name:   dish.name,
            label:  MENU[dish.name] ? MENU[dish.name].label : dish.label,
            total:  0,
            tables: [],
          };
        }
        map[dish.name].total += dish.quantity;
        map[dish.name].tables.push({
          ticketId:    ticket.id,
          tableNumber: ticket.tableNumber,
          queueNumber: ticket.queueNumber,
          quantity:    dish.quantity,
          createdAt:   ticket.createdAt,
        });
      });
    });
    Object.values(map).forEach(function (d) {
      d.tables.sort(function (a, b) { return a.createdAt - b.createdAt; });
    });
    return MENU_ORDER
      .filter(function (name) { return map[name] && map[name].total > 0; })
      .map(function (name) { return map[name]; });
  }

  /* ════════════════════════════════════════════════════════════
     KPI CARDS
  ════════════════════════════════════════════════════════════ */
  function renderKPIs(waiting, active, bells) {
    const totalPortions = waiting.reduce(function (sum, t) {
      return sum + t.dishes.reduce(function (s, d) { return s + d.quantity; }, 0);
    }, 0);

    const tableSet = {};
    active.forEach(function (t) { tableSet[t.tableNumber] = true; });
    const activeTables = Object.keys(tableSet).length;

    const unacked = bells.filter(function (b) { return !b.acknowledged; }).length;

    function setKPI(id, newVal) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.textContent !== String(newVal)) {
        el.textContent = newVal;
        el.classList.remove('kpi-pulse');
        void el.offsetWidth;
        el.classList.add('kpi-pulse');
        setTimeout(function () { el.classList.remove('kpi-pulse'); }, 600);
      }
    }
    setKPI('kpi-orders', totalPortions);
    setKPI('kpi-tables', activeTables);
    setKPI('kpi-bells',  unacked);

    const bellCard = document.getElementById('kpi-bells').closest('article');
    if (bellCard) {
      if (unacked > 0) {
        bellCard.style.borderColor     = 'rgba(239,68,68,0.7)';
        bellCard.style.backgroundColor = 'rgba(239,68,68,0.08)';
        bellCard.style.boxShadow       = '0 0 0 1px rgba(239,68,68,0.3)';
      } else {
        bellCard.style.borderColor     = '';
        bellCard.style.backgroundColor = '';
        bellCard.style.boxShadow       = '';
      }
    }
  }

  /* ════════════════════════════════════════════════════════════
     AGGREGATED ORDERS PANEL
  ════════════════════════════════════════════════════════════ */
  function renderOrders(dishes) {
    const container = document.getElementById('orders-list');

    if (dishes.length === 0) {
      container.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
                    'padding:56px 24px;text-align:center">' +
          '<div style="width:80px;height:80px;border-radius:50%;background:#0F172A;border:2px solid #1E293B;' +
                      'display:flex;align-items:center;justify-content:center;margin-bottom:20px;' +
                      'animation:float 3s ease-in-out infinite">' +
            '<i class="fa-solid fa-bowl-hot" style="font-size:2rem;color:#334155"></i>' +
          '</div>' +
          '<p style="color:#94A3B8;font-size:15px;font-weight:700;margin-bottom:6px">Chưa có đơn hàng</p>' +
          '<p style="color:#475569;font-size:12px;max-width:220px;line-height:1.6">' +
            'Đơn hàng từ khách sẽ tự động xuất hiện ở đây sau khi họ thanh toán' +
          '</p>' +
          '<div style="display:flex;gap:6px;margin-top:20px;align-items:center">' +
            '<div style="width:7px;height:7px;border-radius:50%;background:#1E3A5F;' +
                        'animation:dot-pulse 1.4s 0s ease-in-out infinite"></div>' +
            '<div style="width:7px;height:7px;border-radius:50%;background:#1E3A5F;' +
                        'animation:dot-pulse 1.4s 0.2s ease-in-out infinite"></div>' +
            '<div style="width:7px;height:7px;border-radius:50%;background:#1E3A5F;' +
                        'animation:dot-pulse 1.4s 0.4s ease-in-out infinite"></div>' +
          '</div>' +
        '</div>';
      return;
    }

    container.innerHTML = dishes.map(function (dish) {
      const oldest      = dish.tables[0];
      const tableSummary = dish.tables
        .map(function (t) { return 'Bàn&nbsp;' + t.tableNumber + '&thinsp;(×' + t.quantity + ')'; })
        .join(' · ');

      return (
        '<div class="dish-row" style="display:grid;grid-template-columns:repeat(12,1fr);gap:12px;' +
              'align-items:center;padding:16px 20px;transition:background 0.15s;cursor:default" ' +
              'data-dish="' + dish.name + '"' +
              ' onmouseenter="this.style.background=\'rgba(51,65,85,0.4)\'"' +
              ' onmouseleave="this.style.background=\'\'">' +

          '<div style="grid-column:span 4;display:flex;align-items:center;gap:12px">' +
            '<div style="width:44px;height:44px;border-radius:12px;background:rgba(59,130,246,0.15);' +
                        'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
              '<i class="fa-solid fa-bowl-hot" style="color:#60A5FA;font-size:1rem"></i>' +
            '</div>' +
            '<div style="min-width:0">' +
              '<p style="color:white;font-weight:700;font-size:15px;line-height:1.25">' + dish.label + '</p>' +
              '<p style="color:#64748B;font-size:11px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + tableSummary + '</p>' +
            '</div>' +
          '</div>' +

          '<div style="grid-column:span 2;text-align:center">' +
            '<p style="color:white;font-size:2.75rem;font-weight:900;line-height:1;font-variant-numeric:tabular-nums">' + dish.total + '</p>' +
            '<p style="color:#64748B;font-size:11px">phần</p>' +
          '</div>' +

          '<div style="grid-column:span 3">' +
            '<p style="color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Bưng ra trước</p>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<i class="fa-solid fa-arrow-right" style="color:#FBBF24;font-size:11px"></i>' +
              '<p style="color:#FBBF24;font-weight:700;font-size:14px">Bàn ' + oldest.tableNumber + '</p>' +
            '</div>' +
            '<p style="color:#475569;font-size:10px;margin-top:2px">Chờ lâu nhất</p>' +
          '</div>' +

          '<div style="grid-column:span 3;display:flex;justify-content:flex-end">' +
            '<button class="btn-serve"' +
                    ' data-dish="' + dish.name + '"' +
                    ' data-ticket="' + oldest.ticketId + '"' +
                    ' data-table="' + oldest.tableNumber + '"' +
                    ' data-label="' + dish.label + '"' +
                    ' style="background:#2563EB;color:white;font-weight:700;padding:10px 16px;' +
                            'border-radius:12px;font-size:13px;border:none;cursor:pointer;' +
                            'display:flex;align-items:center;gap:8px;min-height:44px;' +
                            'transition:background 0.15s,transform 0.1s"' +
                    ' onmouseenter="this.style.background=\'#1D4ED8\'"' +
                    ' onmouseleave="this.style.background=\'#2563EB\'"' +
                    ' onmousedown="this.style.transform=\'scale(0.95)\'"' +
                    ' onmouseup="this.style.transform=\'\'">' +
              '<i class="fa-solid fa-circle-check"></i>' +
              'Bưng Bàn ' + oldest.tableNumber +
            '</button>' +
          '</div>' +

        '</div>'
      );
    }).join('<div style="border-top:1px solid #334155"></div>');
  }

  /* ── Advance ticket status: waiting → in_progress → served ── */
  function handleServe(dishName, ticketId, tableNumber, dishLabel) {
    db.collection('orders').doc(ticketId).get().then(function (snap) {
      if (!snap.exists) return;
      const ticket    = snap.data();
      const newStatus = ticket.status === 'waiting' ? 'in_progress' : 'served';
      db.collection('orders').doc(ticketId).update({ status: newStatus });
      showServingToast(tableNumber, dishLabel, newStatus);
      /* UI re-renders automatically via orders onSnapshot */
    });
  }

  function showServingToast(tableNumber, dishLabel, newStatus) {
    const served = newStatus === 'served';
    const msg  = served
      ? 'Hoàn thành — Bàn ' + tableNumber + ' đã được phục vụ!'
      : 'Bưng ' + dishLabel + ' ra Bàn ' + tableNumber + ' trước!';
    const bg   = served ? '#16A34A' : '#D97706';
    const icon = served ? 'fa-circle-check' : 'fa-utensils';
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'top:68px', 'right:20px', 'z-index:9998',
      'background:' + bg, 'color:white',
      'padding:14px 20px', 'border-radius:16px',
      'font-size:15px', 'font-weight:700',
      'box-shadow:0 8px 32px rgba(0,0,0,0.35)',
      'display:flex', 'align-items:center', 'gap:10px',
      'animation:toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      'max-width:320px',
    ].join(';');
    el.innerHTML = '<i class="fa-solid ' + icon + '"></i><span>' + msg + '</span>';
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.animation = 'toast-out 0.25s ease-in forwards';
      setTimeout(function () { el.remove(); }, 280);
    }, 4500);
  }

  /* ════════════════════════════════════════════════════════════
     BELL ALERTS PANEL
  ════════════════════════════════════════════════════════════ */
  function renderBells(bells) {
    const container = document.getElementById('bell-list');
    const badge     = document.getElementById('bell-badge');
    const unacked   = bells.filter(function (b) { return !b.acknowledged; });

    if (unacked.length > 0) {
      badge.textContent = unacked.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (bells.length === 0) {
      container.innerHTML =
        '<p style="color:#64748B;font-size:12px;text-align:center;padding:16px">Không có chuông báo</p>';
      return;
    }

    const sorted = bells.slice().sort(function (a, b) { return b.pressedAt - a.pressedAt; });
    container.innerHTML = sorted.slice(0, 6).map(function (bell) {
      const mins    = Math.floor((Date.now() - bell.pressedAt) / 60000);
      const timeStr = mins < 1 ? 'Vừa xong' : mins + ' phút trước';
      const isNew   = !bell.acknowledged;

      return (
        '<div style="border-radius:12px;padding:10px 12px;margin-bottom:6px;' +
              (isNew
                ? 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3)'
                : 'background:rgba(51,65,85,0.25);border:1px solid transparent') + '">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
            '<div style="min-width:0">' +
              '<p style="color:white;font-size:12px;font-weight:700;line-height:1.3">' +
                '<i class="fa-solid fa-bell" style="color:' + (isNew ? '#F87171' : '#475569') + ';margin-right:5px;font-size:10px"></i>' +
                'Bàn ' + bell.tableNumber +
                ' <span style="color:#64748B;font-weight:400">#' + bell.queueNumber + '</span>' +
              '</p>' +
              '<p style="color:#64748B;font-size:10px;margin-top:2px">' + timeStr + '</p>' +
            '</div>' +
            (isNew
              ? '<button class="btn-ack" data-ticket="' + bell.ticketId + '"' +
                        ' style="flex-shrink:0;background:#475569;color:white;border:none;cursor:pointer;' +
                                'padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;' +
                                'transition:background 0.15s"' +
                        ' onmouseenter="this.style.background=\'#334155\'"' +
                        ' onmouseleave="this.style.background=\'#475569\'">' +
                  'OK' +
                '</button>'
              : '<i class="fa-solid fa-circle-check" style="color:#334155;flex-shrink:0"></i>') +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* Bell doc ID = ticketId (from customer.js write), so update by doc ID directly */
  function acknowledgeBell(ticketId) {
    db.collection('bells').doc(ticketId).update({ acknowledged: true });
    /* UI re-renders via bells onSnapshot */
  }

  /* ════════════════════════════════════════════════════════════
     INVENTORY PANEL (toggle switches)
  ════════════════════════════════════════════════════════════ */
  function renderInventory(inventory) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = inventory.map(function (item) {
      const meta  = MENU[item.dishName];
      const label = meta ? meta.label : item.dishName;
      return (
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 4px">' +
          '<span style="color:' + (item.available ? '#E2E8F0' : '#64748B') + ';font-size:14px;font-weight:500">' +
            label +
            (!item.available ? ' <span style="color:#EF4444;font-size:11px;font-weight:700">(Hết)</span>' : '') +
          '</span>' +
          '<label class="toggle-switch">' +
            '<input type="checkbox" class="inv-toggle" data-dish="' + item.dishName + '"' +
              (item.available ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>'
      );
    }).join('<div style="border-top:1px solid #1E293B"></div>');
  }

  /* ════════════════════════════════════════════════════════════
     QUICK "HẾT MÓN" BUTTONS (fixed bottom-right)
  ════════════════════════════════════════════════════════════ */
  function renderQuickButtons(inventory) {
    let container = document.getElementById('quick-inv-btns');
    if (!container) {
      container = document.createElement('div');
      container.id = 'quick-inv-btns';
      container.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:500',
        'display:flex', 'flex-direction:column', 'gap:8px', 'align-items:flex-end',
      ].join(';');
      document.body.appendChild(container);
    }

    container.innerHTML = inventory.map(function (item) {
      const meta   = MENU[item.dishName];
      const label  = meta ? meta.label : item.dishName;
      const isOut  = !item.available;
      const bg     = isOut ? '#16A34A' : '#DC2626';
      const icon   = isOut ? 'fa-circle-check' : 'fa-triangle-exclamation';
      const prefix = isOut ? 'Còn: ' : 'Hết: ';
      return (
        '<button class="btn-quick-inv"' +
                ' data-dish="' + item.dishName + '"' +
                ' style="background:' + bg + ';color:white;border:none;cursor:pointer;' +
                        'padding:8px 16px;border-radius:12px;font-size:13px;font-weight:700;' +
                        'display:flex;align-items:center;gap:8px;min-height:40px;' +
                        'box-shadow:0 4px 16px rgba(0,0,0,0.3);transition:transform 0.1s,opacity 0.15s"' +
                ' onmouseenter="this.style.opacity=\'0.85\'"' +
                ' onmouseleave="this.style.opacity=\'1\'"' +
                ' onmousedown="this.style.transform=\'scale(0.95)\'"' +
                ' onmouseup="this.style.transform=\'\'">' +
          '<i class="fa-solid ' + icon + '"></i>' +
          prefix + label +
        '</button>'
      );
    }).join('');
  }

  /* ── Write availability change to Firestore ───────────────── */
  function toggleInventory(dishName, makeAvailable) {
    db.collection('inventory').doc(dishName).update({ available: makeAvailable });
    /* UI re-renders via inventory onSnapshot — no need to call render manually */
    const label = MENU[dishName] ? MENU[dishName].label : dishName;
    Pho10.showToast(
      makeAvailable
        ? '<i class="fa-solid fa-toggle-on" style="margin-right:8px"></i>' + label + ' — Còn hàng'
        : '<i class="fa-solid fa-triangle-exclamation" style="margin-right:8px"></i>Hết ' + label + '!'
    );
  }

  /* ════════════════════════════════════════════════════════════
     BELL ALERT VISUAL FLASH
  ════════════════════════════════════════════════════════════ */
  function flashBellAlert() {
    const bellSection = document.getElementById('section-bells');
    if (bellSection) {
      bellSection.classList.add('bell-flash-anim');
      setTimeout(function () { bellSection.classList.remove('bell-flash-anim'); }, 2400);
    }
    let overlay = document.getElementById('bell-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bell-overlay';
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9990', 'pointer-events:none',
        'border:6px solid transparent', 'border-radius:0', 'transition:border-color 0.15s',
      ].join(';');
      document.body.appendChild(overlay);
    }
    let flashes = 0;
    const interval = setInterval(function () {
      overlay.style.borderColor = flashes % 2 === 0 ? 'rgba(239,68,68,0.75)' : 'transparent';
      flashes++;
      if (flashes >= 6) { clearInterval(interval); overlay.style.borderColor = 'transparent'; }
    }, 200);
  }

  /* ════════════════════════════════════════════════════════════
     EVENT LISTENERS (all delegated)
  ════════════════════════════════════════════════════════════ */
  function attachListeners() {
    document.getElementById('orders-list').addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-serve');
      if (!btn) return;
      handleServe(btn.dataset.dish, btn.dataset.ticket, btn.dataset.table, btn.dataset.label);
    });

    document.getElementById('bell-list').addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-ack');
      if (!btn) return;
      acknowledgeBell(btn.dataset.ticket);
    });

    document.getElementById('inventory-list').addEventListener('change', function (e) {
      const input = e.target.closest('.inv-toggle');
      if (!input) return;
      toggleInventory(input.dataset.dish, input.checked);
    });

    /* Quick inventory buttons — use cached _inventory for current state */
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-quick-inv');
      if (!btn) return;
      const item = _inventory.find(function (i) { return i.dishName === btn.dataset.dish; });
      if (item) toggleInventory(item.dishName, !item.available);
    });
  }

  /* ════════════════════════════════════════════════════════════
     FIRESTORE REAL-TIME LISTENERS
  ════════════════════════════════════════════════════════════ */
  function listenFirestore() {

    /* ── Orders ────────────────────────────────────────────── */
    db.collection('orders').onSnapshot(function (snap) {
      _orders = snap.docs.map(function (d) { return d.data(); });

      const waiting = getWaitingOrders(_orders);
      const active  = getActiveOrders(_orders);
      renderKPIs(waiting, active, _bells);
      renderOrders(aggregateByDish(waiting));

      /* Flash the orders panel on new orders (not on initial load) */
      if (_ordersReady) {
        const hasNew = snap.docChanges().some(function (c) { return c.type === 'added'; });
        if (hasNew) {
          const panel = document.getElementById('section-orders');
          if (panel) {
            panel.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.6)';
            setTimeout(function () { panel.style.boxShadow = ''; }, 1500);
          }
        }
      }
      _ordersReady = true;
    });

    /* ── Bells ─────────────────────────────────────────────── */
    db.collection('bells').onSnapshot(function (snap) {
      _bells = snap.docs.map(function (d) { return d.data(); });

      const waiting = getWaitingOrders(_orders);
      const active  = getActiveOrders(_orders);
      renderKPIs(waiting, active, _bells);
      renderBells(_bells);

      /* Alert only for newly added unacknowledged bells (not on initial load) */
      if (_bellsReady) {
        snap.docChanges().forEach(function (change) {
          if (change.type === 'added') {
            const bell = change.doc.data();
            if (!bell.acknowledged) {
              Pho10.playBellSound();
              flashBellAlert();
              Pho10.showToast(
                '<i class="fa-solid fa-bell" style="margin-right:8px"></i>' +
                'Chuông báo từ Bàn ' + bell.tableNumber + '!'
              );
            }
          }
        });
      }
      _bellsReady = true;
    });

    /* ── Inventory ─────────────────────────────────────────── */
    db.collection('inventory').onSnapshot(function (snap) {
      /* Preserve MENU_ORDER sort order */
      _inventory = MENU_ORDER
        .map(function (name) {
          const doc = snap.docs.find(function (d) { return d.id === name; });
          return doc ? Object.assign({ dishName: doc.id }, doc.data()) : null;
        })
        .filter(Boolean);

      renderInventory(_inventory);
      renderQuickButtons(_inventory);
    });
  }

  /* ── Boot ────────────────────────────────────────────────── */
  init();

})();
