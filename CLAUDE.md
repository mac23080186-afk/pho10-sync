# PHO 10 SYNC SYSTEM — CLAUDE.md
## Developer Guide for AI Pair Programmer

---

## 1. Project Context

This is a browser-only MVP for a university Digital Transformation final project.
There is no backend, no build step, and no package manager.
Every file must open directly in a browser via the file:// protocol or a simple static server.

---

## 2. Technology Stack

### Mandatory
- HTML5 — semantic markup
- CSS3 — custom properties for theming
- Vanilla JavaScript (ES6+) — no frameworks
- Tailwind CSS via CDN (cdn.tailwindcss.com)
- Font Awesome 6 via CDN — icons only
- Firebase Firestore via CDN — primary real-time database (replaces localStorage for orders/inventory/bells)
- Firebase Authentication via CDN — Email/Password login to protect kitchen.html
- db.collection(...).onSnapshot() — real-time listener, replaces window.addEventListener("storage")
- localStorage — session data only (ticketId, table number — not synced cross-device)

### Prohibited
- React, Vue, Angular, Svelte, or any component framework
- Node.js, Express, or any backend runtime
- npm, webpack, vite, or any build tool
- TypeScript (plain JS only for zero tooling)
- Firebase Admin SDK — server-side credentials only, never embed in browser-facing code
- Any third-party authentication library other than Firebase Auth (CDN)
- Supabase or any other cloud database

### Architecture Migration (localStorage → Firestore)
The original prototype used localStorage + window.addEventListener("storage") for same-origin cross-tab sync.
The production architecture migrates all shared state to Firebase Firestore (CDN) with onSnapshot listeners.
localStorage is retained only for non-shared session data (e.g. the customer's own ticketId).

---

## 3. Folder Structure

```
Final Group 5/
├── CLAUDE.md              <- This file
├── SPEC.md                <- Functional specification
├── PROJECT_STRUCTURE.md   <- File map (update after each stage)
├── customer.html          <- Customer-facing mobile view
├── kitchen.html           <- Kitchen/Manager tablet dashboard
├── css/
│   ├── customer.css       <- Customer-specific styles
│   └── kitchen.css        <- Kitchen-specific styles
├── js/
│   ├── storage.js         <- All localStorage read/write helpers
│   ├── sync.js            <- storage event listeners and dispatchers
│   ├── customer.js        <- Customer view logic
│   └── kitchen.js         <- Kitchen view logic
└── assets/
    └── qr-placeholder.png <- Demo QR code image
```

Rules:
- Do not create subdirectories beyond the structure above.
- Do not create a node_modules directory or package.json.
- Do not generate a bundled or minified output file.

---

## 4. Coding Conventions

### JavaScript
- Use ES6+ syntax: const/let, arrow functions, template literals, destructuring.
- No var.
- Module pattern: wrap each JS file in an IIFE or use a single global namespace object (window.Pho10).
- No import/export (file:// protocol does not support ES modules without a server).
- Function names: camelCase verbs — e.g. submitOrder(), renderMenu(), acknowledgebell().
- Constants: UPPER_SNAKE_CASE — e.g. WAIT_THRESHOLD_MS, STORAGE_KEY_ORDERS.
- No console.log in final code; use comments to mark debug lines.

### HTML
- Use semantic elements: header, main, section, article, button, not generic divs for everything.
- All interactive elements must have an id attribute for JS targeting.
- data-* attributes for state that JS needs to read from DOM.
- No inline style attributes — use Tailwind utility classes or a css/ file.
- No inline event handlers (onclick="...") — attach listeners in JS files.

### CSS
- Customer brand color: #D62828 (red)
- Kitchen accent color: #1E3A5F (dark blue)
- Use CSS custom properties (variables) for all brand colors at :root.
- Tailwind utility classes for layout and spacing.
- Custom CSS files only for animations, transitions, and brand-specific overrides.

### localStorage
- All keys must be prefixed with pho10_ to avoid collisions.
- Always parse with JSON.parse and write with JSON.stringify.
- Always wrap localStorage reads in a try/catch in case of quota errors.
- Never read localStorage on every render — cache in a JS variable, update on storage event.

---

## 5. Data Storage Reference

### Firestore Collections (shared, real-time)

| Collection | Document ID | Fields | Description |
|---|---|---|---|
| orders | ticketId (uid) | tableNumber, queueNumber, items, status, createdAt, bellPressed | One document per customer order |
| inventory | dishName (e.g. "Tai") | available (boolean), label, price | One document per menu item |
| bells | bellId (uid) | ticketId, tableNumber, queueNumber, createdAt, acknowledged | One document per bell press |
| meta | "queue_counter" | value (integer) | Shared queue number counter |

### localStorage Keys (session-only, not synced)

| Key | Type | Description |
|---|---|---|
| pho10_ticket_id | String | Customer's own ticketId for this browser session |
| pho10_table_number | String | Table number from URL param, cached for refresh recovery |

---

## 5a. Firebase CDN Setup

Load in every HTML file that uses Firebase, before any app JS:
```html
<!-- Firebase App (required) -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<!-- Firestore -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<!-- Auth (kitchen.html only) -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
```

Initialize once in script.js using the Web App Config (NOT the Admin SDK JSON):
```javascript
// Web App Config — safe to include in browser code
const firebaseConfig = {
  apiKey:            "...",
  authDomain:        "....firebaseapp.com",
  projectId:         "...",
  storageBucket:     "....appspot.com",
  messagingSenderId: "...",
  appId:             "..."
};
firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();
```

IMPORTANT: The Admin SDK JSON file (pho10-sync-db-firebase-adminsdk-*.json) is for server-side use only.
Never paste its contents into any HTML or JS file that runs in the browser.
The Web App Config above (apiKey etc.) is the correct credential for client-side Firebase.

---

## 6. Design System

### Customer View (customer.html)
- Layout: single-column, max-width 420px, centered
- Background: white (#FFFFFF)
- Primary color: #D62828
- Text: #1A1A1A
- Font: system-ui, sans-serif
- Ticket card: rounded-2xl, shadow-lg, red header band
- Progress bar: red fill on grey track
- Bell button: large, rounded-full, red when active / grey when disabled
- Status badge: color-coded pill (yellow=waiting, blue=in_progress, green=served)

### Kitchen View (kitchen.html)
- Layout: landscape grid, sidebar + main content
- Background: #0F172A (dark slate)
- Card background: #1E293B
- Accent: #3B82F6 (blue) for actions
- Alert color: #EF4444 (red) for Bell notifications
- KPI cards: large number, icon, label — high contrast white on dark
- Font: system-ui, sans-serif
- Minimum touch target: 48px height for all buttons

### Icons (Font Awesome 6)
- Bell: fa-bell
- Queue: fa-ticket
- Kitchen: fa-utensils
- Complete: fa-circle-check
- Alert: fa-triangle-exclamation
- Inventory on: fa-toggle-on
- Inventory off: fa-toggle-off
- Table: fa-chair

---

## 7. Development Stages

Complete and validate each stage before starting the next. Do not skip stages.

| Stage | Deliverable | Validation |
|---|---|---|
| 1 | Project Memory (SPEC.md, CLAUDE.md) | Files reviewed and confirmed |
| 2 | Project Scaffold | Both HTML files open in browser with placeholder content |
| 3 | Customer View | Queue ticket, menu, checkout, countdown work in isolation |
| 4 | Kitchen Dashboard | Aggregated view renders from hardcoded test data |
| 5 | Synchronization | Order placed in customer.html appears in kitchen.html |
| 6 | Inventory | Kitchen toggle removes dish from customer menu in real time |
| 7 | Bell System | Bell fires from customer, appears as alert in kitchen |
| 8 | UI Polish | Animations, transitions, responsive checks |
| 9 | Testing | All business rules verified manually |
| 10 | Deployment | Static file demo ready; QR code points to correct URL |

---

## 8. Business Rules Enforcement (Code-Level)

These rules must be enforced in JavaScript, not just described:

| Rule | Where to enforce |
|---|---|
| One order per session | customer.js: check if pho10_orders contains entry with current ticketId before allowing checkout |
| Bell disabled until threshold | customer.js: compare Date.now() - orderSubmittedAt against WAIT_THRESHOLD_MS |
| Bell pressed once | customer.js: check ticket.bellPressed === true before writing bell alert |
| Bell disabled after served | customer.js: check ticket.status !== "served" before enabling bell |
| Oldest table first | kitchen.js: sort waiting tickets by createdAt ASC, take index 0 |
| Out-of-stock not selectable | customer.js: filter inventory before rendering menu; disable input if available === false |
| Status one-way progression | kitchen.js: only allow status transitions waiting→in_progress→served |

---

## 9. Synchronization Pattern

### New: Firestore onSnapshot (production architecture)

```javascript
// Writing — add/update a Firestore document
async function submitOrder(ticket) {
  await db.collection('orders').doc(ticket.id).set(ticket);
}

// Reading + reacting — real-time listener (fires on all tabs/devices including the writer)
db.collection('orders').onSnapshot((snapshot) => {
  const orders = snapshot.docs.map(doc => doc.data());
  renderOrders(orders);
});

// Inventory toggle
async function toggleInventory(dishName, available) {
  await db.collection('inventory').doc(dishName).update({ available });
}

// Bell press
async function writeBell(bell) {
  await db.collection('bells').doc(bell.id).set(bell);
}
```

Key difference from localStorage pattern:
- onSnapshot fires in ALL tabs/devices including the one that wrote the data.
- No need for "render immediately after write" workaround — the listener handles it.
- Requires internet connection; app will not function offline.

### Auth Guard — kitchen.html only

```javascript
firebase.auth().onAuthStateChanged((user) => {
  if (!user) {
    // Redirect to login page or show login modal
    showLoginModal();
  } else {
    initKitchenDashboard();
  }
});

function loginKitchen(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

function logoutKitchen() {
  return firebase.auth().signOut();
}
```

---

## 10. Constraints and Hard Rules

- No code generation until Stage 1 (SPEC.md + CLAUDE.md) is confirmed by the user.
- No moving to the next stage until the current stage is validated.
- No frameworks, bundlers, or build tools — ever.
- No external fonts beyond system-ui (keep offline-compatible).
- Allowed external CDN resources: Tailwind CSS, Font Awesome 6, Firebase SDK (compat v10).
- All JS must be loaded via `<script>` tags (no import/export — file:// incompatible with ES modules).
- Firestore requires internet connection — demo must have network access.
- The Admin SDK credential JSON must never appear in any browser-facing file.
- kitchen.html must check auth state on load via firebase.auth().onAuthStateChanged() before rendering any data.
- Demo must be fully functional with two browser windows/devices side by side.

---

## 11. Demo Setup Instructions

For the academic demonstration:
1. Ensure the machine has an active internet connection (required for Firebase).
2. Open kitchen.html in a browser window — log in with the kitchen Email/Password credentials.
3. Open customer.html in a second browser window (or on a second device/phone).
4. Both windows now sync through Firebase Firestore — no same-origin restriction.
5. Demonstrate the sync by placing an order in customer.html and watching kitchen.html update.
6. Demonstrate inventory toggle in kitchen.html and watch the dish disappear in customer.html.
7. Demonstrate Bell flow: wait threshold or use a shortened demo threshold (30 seconds).

### Firebase Project Checklist (before demo)
- [ ] Firebase project created at console.firebase.google.com
- [ ] Firestore database created (production or test mode)
- [ ] Authentication enabled with Email/Password provider
- [ ] Kitchen manager account created (e.g. kitchen@pho10.vn)
- [ ] Web App Config (apiKey, authDomain, etc.) pasted into js/script.js
- [ ] Firestore security rules set: customers can write orders/bells; kitchen (auth) can write inventory and update orders
- [ ] Admin SDK JSON file stored securely outside the project directory
