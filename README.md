# Passable Vehicle Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-v2.1.4-blue.svg)](https://github.com/GBear09/passable-vehicle-card/releases)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A sleek, customizable, and universal vehicle dashboard card for Home Assistant aligned with the Passable Design System (`passable-hvac-card` & `passable-lighting-card`). Displays a compact, state-tinted vehicle summary directly on your dashboard and expands into a 4-tab **Command Center** modal/bottom sheet when tapped, featuring **custom drag-and-drop image upload**, **native Home Assistant `ha-entity-picker` Visual UI Editor support**, **direct vehicle climate & EVSE control**, **multi-vehicle support**, and **intelligent entity auto-discovery**.

---

## ✨ Features

- 🪪 **Passable Summary + Popup Packaging (`display_mode: summary | full`)**:
  - **Top Status Strip**: Live status dot (Charging, Engine On/Driving, Climate Active, Alert, Plugged, Idle), location indicator, relative sync timestamp, quick lock button, and Command Center trigger.
  - **Two Dashboard Summary Layouts**:
    - `layout: hero` *(default)* — Vehicle thumbnail/icon, live status chips, expandable `12V` quick-telemetry tray (`Odo`, `TPMS`, `EVSE`/`Service`), bold `%` & range readout, and hairline battery bar with AC charge limit tick and charging shimmer animation.
    - `layout: rings` — Dual circular SVG gauges for Battery/Fuel `%` and remaining range.
  - **Optional 24h Battery Sparkline** (`show_sparkline: true`) and **Quick-Action Footer Strip** (Lock, Climate, Charge/Limit pills).
  - **Full Inline Mode** (`display_mode: full`) for dedicated vehicle sub-views with swipeable tabs.
- 📱 **4-Tab Command Center Modal / Bottom Sheet** (with background scroll lock & `Escape` / swipe-down dismissal):
  - **Overview**: Vehicle hero stage with dynamic charging beams, climate airflow, and engine-on motion streaks; closure & lock badges; circular battery ring; 4-KPI grid (`12V Aux`, `Odometer`, `Tire Pressure`, `Next Service`); and expandable Location & Map card (auto-expands when Away, clickable from the Home/Away strip pill, with `Pin` / `2h` / `24h` route trail and Directions link).
  - **Climate**: Driver profile presets (save directly to dashboard config), target temperature & duration steppers, steering wheel heat, front/rear defrost, and individual seat heating/cooling tiles.
  - **Charge / Fuel**: AC & DC charging limit sliders, EVSE / wall charger current slider with live `~kW` estimation, optional vehicle AC current presets, ETA display, and Start/Stop controls.
  - **Health**: Doors, hood, trunk, and sunroof status grid; diagnostics & maintenance table (12V battery, TPMS, DTC count, washer fluid, key battery, odometer, next service, location); and one-tap cloud refresh.
- 🖼️ **Custom Drag & Drop Image Upload**: Upload vehicle photos directly to Home Assistant's image store (with optional separate `summary_image` override) or specify a local/web URL.
- 🚗 **Multi-Vehicle Support**: Configure a single vehicle with flat YAML/UI config or stack multiple vehicles via `vehicles[]` with a switcher in the Command Center popup.
- 🔍 **Smart Auto-Discovery**: Provide a single primary entity (e.g. `entity: sensor.ev9_ev_battery_level`) or `prefix` (e.g. `prefix: ev9`) to automatically discover battery, range, doors, trunk, hood, sunroof, engine, lock, climate, limits, EVSE charger, 12V, TPMS, odometer, service, and location entities.

---

## ⚙️ Configuration Examples

### Compact Summary + Popup (Default — Matches HVAC & Lighting Cards)
```yaml
type: custom:passable-vehicle-card
title: Kia EV9
entity: sensor.ev9_ev_battery_level
image: /api/image/serve/your_image_id/original
layout: hero
show_header: false
show_sparkline: false
show_ac_current: false
```

### Multi-Vehicle Stack
```yaml
type: custom:passable-vehicle-card
title: Garage
show_header: false
vehicles:
  - id: ev9
    title: Kia EV9
    entity: sensor.ev9_ev_battery_level
    image: /api/image/serve/ev9_image_id/original
  - id: second_car
    title: Family Sedan
    fuel_type: ice
    entity: sensor.sedan_fuel_level
```

---

## 📦 Installation

### Option 1: HACS (Recommended)

1. Open **HACS** in your Home Assistant instance.
2. Click the three dots `⋮` in the top right corner and select **Custom repositories**.
3. Paste the URL: `https://github.com/GBear09/passable-vehicle-card`
4. Set the category to **Dashboard** (Lovelace).
5. Click **Add**, then search for **Passable Vehicle Card** and click **Download**.
6. Hard refresh your browser (`Ctrl + Shift + R` or `Cmd + Shift + R`).

### Option 2: Manual Installation

1. Download `passable-vehicle-card.js` from the [latest release](https://github.com/GBear09/passable-vehicle-card/releases).
2. Copy `passable-vehicle-card.js` to your `www/` directory (`/config/www/passable-vehicle-card.js`).
3. Add `/local/passable-vehicle-card.js?v=2.1.4` as a JavaScript Module under **Settings** → **Dashboards** → **Resources**.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
