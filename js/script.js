/* Phở 10 Sync — Shared utilities (window.Pho10 namespace) */

window.Pho10 = window.Pho10 || {};

(function (Pho10) {

  /* ── Storage Keys ─────────────────────────────────────── */
  Pho10.KEYS = {
    ORDERS:        'pho10_orders',
    INVENTORY:     'pho10_inventory',
    BELLS:         'pho10_bells',
    QUEUE_COUNTER: 'pho10_queue_counter',
  };

  /* ── Timing ───────────────────────────────────────────── */
  Pho10.TOTAL_WAIT_MS     = 15 * 60 * 1000;  // 15 min countdown
  Pho10.WAIT_THRESHOLD_MS = 10 * 60 * 1000;  // Bell unlocks at 10 min

  /* ── localStorage helpers ─────────────────────────────── */
  Pho10.readStorage = function (key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  };

  Pho10.writeStorage = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* quota exceeded — silent in MVP */
    }
  };

  /* ── ID generation ────────────────────────────────────── */
  Pho10.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /* ── Time formatting ──────────────────────────────────── */
  Pho10.formatTime = function (ms) {
    if (ms <= 0) return '00:00';
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return m + ':' + s;
  };

  /* ── Kitchen live clock ───────────────────────────────── */
  Pho10.startClock = function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const tick = function () {
      el.textContent = new Date().toLocaleTimeString('vi-VN', {
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    };
    tick();
    setInterval(tick, 1000);
  };

  /* ── Bell alert sound (Web Audio API, no file needed) ───*/
  Pho10.playBellSound = function () {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      function beep(t, freq, dur, vol) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol || 0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t);
        osc.stop(t + dur);
      }
      const now = ctx.currentTime;
      beep(now,        880, 0.25);
      beep(now + 0.28, 1100, 0.25);
      beep(now + 0.56, 880, 0.4);
    } catch (_) { /* audio not available — silent fallback */ }
  };

  /* ── Toast notification (kitchen) ───────────────────────*/
  Pho10.showToast = function (message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;   /* callers supply their own icon */
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('toast-exit');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3500);
  };

})(window.Pho10);
