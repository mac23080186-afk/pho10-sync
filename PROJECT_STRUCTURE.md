# PROJECT STRUCTURE — Pho 10 Sync System

## Current Stage: Stage 8 — UI Polish COMPLETE

```
Final Group 5/
├── CLAUDE.md                  <- Developer guide (Stage 1 ✓)
├── SPEC.md                    <- Functional specification (Stage 1 ✓)
├── PROJECT_STRUCTURE.md       <- This file
├── index.html                 <- Role selection landing page (Stage 2 ✓)
├── customer.html              <- Customer mobile view scaffold (Stage 2 ✓)
├── kitchen.html               <- Kitchen tablet dashboard scaffold (Stage 2 ✓)
├── css/
│   └── style.css              <- Shared CSS variables, animations (Stage 2 ✓)
├── js/
│   ├── script.js              <- Shared utilities: Pho10 namespace, storage, clock (Stage 2 ✓)
│   ├── customer.js            <- Customer logic — table param only (Stage 3 pending)
│   └── kitchen.js             <- Kitchen logic — clock only (Stage 4 pending)
└── assets/
    └── (empty — qr-placeholder.png added in Stage 10)
```

## Stage Checklist
- [x] Stage 1 — Project Memory (SPEC.md, CLAUDE.md, PROJECT_STRUCTURE.md)
- [x] Stage 2 — Project Scaffold (index.html, customer.html, kitchen.html, style.css, script.js)
- [x] Stage 3 — Customer View (queue #45, menu +/-, checkout, 5-min countdown, bell logic)
- [x] Stage 4 — Kitchen Dashboard (aggregated orders, KPI cards, serve flow, quick inventory buttons)
- [x] Stage 5 — Synchronization (storage events wired both directions)
- [x] Stage 6 — Inventory (kitchen toggle → customer menu greys out instantly)
- [x] Stage 7 — Bell System (bell → kitchen sound + red edge flash + toast; kitchen serve → customer "Phở đang tới")
- [x] Stage 8 — UI Polish (loading state, empty state, section-reveal, KPI pulse, responsive)
- [ ] Stage 9 — Testing (all business rules verified manually)
- [ ] Stage 10 — Deployment (static demo ready, QR code)

## Pho10 Namespace (js/script.js)
- Pho10.KEYS           — localStorage key constants
- Pho10.TOTAL_WAIT_MS  — 15 min (countdown duration)
- Pho10.WAIT_THRESHOLD_MS — 10 min (bell unlock threshold)
- Pho10.readStorage(key, fallback) — safe JSON read
- Pho10.writeStorage(key, value)   — safe JSON write
- Pho10.uid()          — unique ID generator
- Pho10.formatTime(ms) — format ms as MM:SS
- Pho10.startClock(id) — live HH:MM:SS clock for kitchen header
- Pho10.showToast(msg) — red toast notification (kitchen)
