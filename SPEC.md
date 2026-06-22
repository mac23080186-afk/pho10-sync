# PHO 10 SYNC SYSTEM — SPEC.md
## Functional Specification for Digital Transformation MVP

---

## 1. Project Overview

**Project Name:** Pho 10 Sync System
**Type:** Browser-based MVP (no backend)
**Purpose:** Academic demonstration of digital transformation in restaurant operations
**Context:** University Final Project — Digital Transformation Course

The system demonstrates how digital technology bridges the gap between Front-of-House (FOH) and Back-of-House (BOH) operations in a Vietnamese pho restaurant. It is not intended for production deployment.

**Four DT Objectives Demonstrated:**
1. Improve operational visibility — kitchen sees all orders in real time
2. Reduce information gaps — shared state via localStorage eliminates verbal relay
3. Improve customer waiting experience — digital ticket with countdown and status
4. Improve kitchen coordination — aggregated batch cooking view

---

## 2. User Roles

### 2.1 Customer
- Arrives, scans QR code on table to open customer.html
- Receives a digital waiting ticket (queue number + table number)
- Browses menu, selects dishes, and submits one order
- Watches countdown timer and progress bar
- Presses Bell once if waiting too long (after threshold)
- Receives status update: "Your Pho is on the way."

### 2.2 Kitchen Staff
- Opens kitchen.html on a tablet
- Views orders aggregated by dish type (not by individual ticket)
- Completes cooking batches and marks them done
- Receives Bell alerts from customers
- Manages inventory availability

### 2.3 Manager
- Uses kitchen.html (same view as Kitchen Staff)
- Monitors live KPI cards (active orders, queue length, bell count)
- Toggles dish availability in inventory panel
- Observes real-time sync between customer and kitchen views

---

## 3. User Journeys

### 3.1 Customer Journey

```
1.  Scan QR Code on table
2.  customer.html opens in mobile browser
3.  System assigns queue number (auto-increment) and table number (from URL param or default)
4.  Customer sees: Queue #, Table #, and dish menu
5.  Customer selects dishes (only available dishes are selectable)
6.  Customer taps Checkout — order is locked (cannot reorder)
7.  Countdown timer starts (e.g. 15 minutes)
8.  Progress bar fills as time passes
9.  Bell button is disabled and greyed out until waiting threshold (e.g. 10 minutes elapsed)
10. After threshold: Bell becomes active
11. Customer presses Bell once — Bell is immediately disabled again
12. Kitchen sees Bell alert on their dashboard
13. Kitchen acknowledges (marks order in progress / served)
14. Customer sees status: "Your Pho is on the way."
15. When order is marked complete: status updates to "Served"
```

### 3.2 Kitchen Journey

```
1. kitchen.html is open on tablet in landscape mode
2. New order appears in aggregated cooking queue
3. Kitchen views KPI summary (total dishes pending, active tables, bell alerts)
4. Cooking panel shows: Dish Name | Total Quantity | Tables Waiting
5. Kitchen taps "Complete Batch" for a dish
6. System recommends the oldest waiting table to serve first
7. Order status updates — customer view reflects change
8. If Bell alert received: toast notification appears, Bell counter increments
9. Kitchen acknowledges Bell alert
10. Inventory panel: staff toggles dish on/off
11. Toggle immediately hides dish from customer menu
```

---

## 4. Features

### Feature 1 — Interactive Waiting Ticket (customer.html)

| Element | Description |
|---|---|
| Queue Number | Auto-assigned on page load, displayed prominently |
| Table Number | Derived from URL parameter ?table=X or default Table 1 |
| Menu | List of available dishes with quantity selector |
| Checkout Button | Submits order, locks menu, starts countdown |
| Countdown Timer | Counts down from configured wait time |
| Progress Bar | Visual fill from 0% to 100% as time elapses |
| Bell Button | Disabled until threshold; pressable exactly once |
| Status Display | Shows current order state (Waiting / In Progress / Served) |

### Feature 2 — Kitchen Command Center (kitchen.html)

| Element | Description |
|---|---|
| KPI Cards | Active Orders, Queue Length, Bell Alerts (live counts) |
| Aggregated Orders Panel | Groups dishes across all tickets by dish name |
| Batch Complete Button | Marks a dish batch as done; recommends oldest table |
| Table Recommendation | Highlights oldest waiting table for next service |
| Bell Alert Panel | Shows customer bell alerts with table number and time |
| Inventory Toggle | Per-dish on/off switch; syncs to customer view instantly |

### Feature 3 — Real-Time Synchronization

All synchronization uses localStorage + window.addEventListener("storage").

| Data Synced | Direction | localStorage Key |
|---|---|---|
| New order submitted | Customer to Kitchen | pho10_orders |
| Inventory toggle | Kitchen to Customer | pho10_inventory |
| Bell pressed | Customer to Kitchen | pho10_bells |
| Order status update | Kitchen to Customer | pho10_orders |

The storage event fires across tabs/windows on the same origin, enabling real-time updates without a backend.

---

## 5. Business Logic

### 5.1 Order Rules
- A customer may submit exactly one order per session (page load).
- After checkout, the menu is locked — no additional items can be added.
- Order status progresses one-way: waiting → in_progress → served.

### 5.2 Bell Rules
- Bell button is disabled until the waiting threshold elapses (default: 10 minutes after order submission).
- Bell may be pressed exactly once per order.
- Once pressed, the button is permanently disabled for that session.
- If the order status is served, the Bell button remains disabled regardless of threshold.

### 5.3 Inventory Rules
- Inventory state is managed exclusively in kitchen.html.
- When a dish is toggled to unavailable, it becomes immediately unselectable in customer.html.
- Customers who have already ordered an out-of-stock dish are not affected (their order stands).
- Unavailable dishes are visually marked (greyed out, "Sold Out" label).

### 5.4 Queue and Table Rules
- Queue numbers are assigned sequentially from a localStorage counter, starting at 1.
- Table number is passed via URL query parameter (?table=3). Default is Table 1 if omitted.
- Kitchen always recommends the oldest waiting table (lowest createdAt timestamp) when completing a batch.
- Aggregation is by dish name, not by individual ticket.

### 5.5 Synchronization Rules
- All cross-tab communication uses the storage event on window.
- Both views listen for storage events; no interval polling is used.
- All data is JSON-serialized before writing to localStorage.

---

## 6. Data Model

### Ticket
```json
{
  "id": "uuid-string",
  "queueNumber": 3,
  "tableNumber": 2,
  "dishes": [
    { "name": "Pho Bo", "quantity": 2 },
    { "name": "Goi Cuon", "quantity": 1 }
  ],
  "status": "waiting",
  "orderSubmittedAt": 1700000000000,
  "waitingThresholdMs": 600000,
  "bellPressed": false,
  "bellPressedAt": null,
  "createdAt": 1700000000000
}
```

Status values: pending | waiting | in_progress | served

### Inventory Item
```json
{
  "dishName": "Pho Bo",
  "available": true,
  "price": 55000
}
```

### Bell Alert
```json
{
  "ticketId": "uuid-string",
  "tableNumber": 2,
  "queueNumber": 3,
  "pressedAt": 1700000000000,
  "acknowledged": false
}
```

### localStorage Keys
| Key | Writer | Content |
|---|---|---|
| pho10_orders | Customer (create), Kitchen (update status) | Array of Ticket objects |
| pho10_inventory | Kitchen | Array of Inventory items |
| pho10_bells | Customer (create), Kitchen (acknowledge) | Array of Bell alerts |
| pho10_queue_counter | Customer | Integer — next queue number |

---

## 7. Functional Requirements

### FR-1: Customer View
- FR-1.1: Page generates a unique queue number on load
- FR-1.2: Table number is read from ?table= URL param; defaults to 1
- FR-1.3: Menu only shows available dishes (inventory-gated)
- FR-1.4: Checkout submits order to pho10_orders and locks the menu
- FR-1.5: Countdown timer starts immediately after checkout
- FR-1.6: Progress bar reflects elapsed vs total wait time
- FR-1.7: Bell button is disabled until threshold time elapses
- FR-1.8: Bell can be pressed exactly once per session
- FR-1.9: Status display updates in real time via storage event

### FR-2: Kitchen View
- FR-2.1: KPI cards update in real time
- FR-2.2: Orders are aggregated by dish name across all active tickets
- FR-2.3: Each dish row shows name, total quantity, and tables waiting
- FR-2.4: Complete Batch button updates order status and recommends oldest table
- FR-2.5: Bell alerts display table number, queue number, and elapsed time
- FR-2.6: Inventory toggle updates pho10_inventory immediately
- FR-2.7: Acknowledged bells are visually distinguished from new alerts

### FR-3: Synchronization
- FR-3.1: Customer view updates within 500ms of a kitchen inventory toggle
- FR-3.2: Kitchen view updates within 500ms of a customer order or bell
- FR-3.3: All sync is event-driven (storage event), not polling

---

## 8. Out of Scope

- User authentication or login
- Payment processing (UI simulation only)
- Backend server or database
- Multi-device sync across different browsers or machines
- Print receipt
- Order history persistence across browser sessions
- Native push notifications
