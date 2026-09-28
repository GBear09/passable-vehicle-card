# Passable Vehicle Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-v1.5.1-blue.svg)](https://github.com/GBear09/passable-vehicle-card/releases)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A sleek, customizable, and universal vehicle dashboard card for Home Assistant. Designed to monitor and control any electric vehicle (EV), internal combustion engine (ICE), or hybrid vehicle with dynamic animations, modern glassmorphism styling, **custom drag-and-drop image upload**, **native Home Assistant `ha-entity-picker` Visual UI Editor support**, **direct vehicle climate service dispatch**, and **intelligent entity auto-discovery**.

---

## ✨ Features

- 🖼️ **Custom Drag & Drop Image Upload**: Seamlessly drag and drop vehicle images from your computer directly into the card editor (or click to browse). Uploads directly to Home Assistant's image store with live thumbnail preview and replace/remove controls. Also supports direct local/web URL input.
- ❄️ **Direct Climate Control & Staging**: No need for dozens of Home Assistant helper entities! Adjust temperature, defrost, steering wheel heat, and individual seat heating/cooling directly on the card. Hitting "Start Climate" compiles and dispatches commands directly to the vehicle (with automatic 20s confirmation refresh).
- 👤 **Customizable Climate Presets**: Add, rename, and configure driver profiles (e.g. "Megan", "Myles", "Winter Warmup") right in the visual editor. Tapping the Save (floppy disk) icon on the live card saves your current settings directly as the new defaults for that profile.
- 🛠️ **Native Visual UI Editor**: Uses Home Assistant's native entity pickers complete with search box, entity icons, area badges, and domain filtering!
- 🔍 **Smart Auto-Discovery**: Simply provide **one single entity** (e.g. `entity: sensor.ev9_ev_battery_level`) or a `prefix` (e.g. `prefix: ev9`), and the card will automatically discover all matching sensors, binary sensors, locks, doors, and limits with strict domain filtering.
- 🚗 **Universal Support**: Flexible configuration for EVs, Gas/ICE vehicles, and Hybrids.
- 📱 **Interactive Views**:
  - **Home View**: Vehicle image overlay, real-time door open/closed monitor, quick lock toggle, battery/fuel circular gauge with remaining range, odometer, tire pressure, and relative update timestamp.
  - **Climate View**: Steering wheel heater, front/rear defrost toggles, individual seat heating/cooling levels (Driver, Passenger, Rear), dynamic temperature gauge, defrost duration selector, and dynamic driver profile presets.
  - **Charge / Fuel View**: AC/DC charging limit sliders, AC charging current selector, estimated remaining charging time display, and start/stop controls.
- ⚡ **Dynamic Visual Effects**:
  - Charging beam animation when actively charging.
  - Climate airflow stream animation when climate control is active.
  - Dynamic temperature color gradient from blue to neutral to orange.
- 👆 **Touch Gesture Support**: Swipe left/right on touch devices to switch views seamlessly.
- 🎨 **Modern Navigation**: Animated pill-expanding tab bar showing text labels on active selection.

---

## 🛠️ Visual UI Editor

When editing your dashboard in Home Assistant, select **Passable Vehicle Card**. The native visual editor allows you to choose entities visually with full HA styling & icons:
1. **Vehicle Title & Subtitle**
2. **Fuel Type** (EV, Gasoline/ICE, or Hybrid)
3. **Primary Entity Dropdown** (filtered to sensors & binary sensors, auto-discovers all remaining entities)
4. **Entity Prefix** (Optional)
5. **Car Image Picker** (Drag and drop or browse files from computer, or specify local/web URL)
6. **Climate Presets Manager** (Add, rename, delete profiles, and set baseline defaults for temperature, seats, steering wheel, and defrost)
7. **Advanced Overrides Section**: Categorized dropdown pickers filtered specifically by entity domain:
   - **Status & Sensors**: Range, Lock, Charging, Plug, Odometer, Tire Pressure, Last Updated, Charging Power
   - **Doors & Trunk**: Hood, Trunk, Front Left, Front Right, Rear Left, Rear Right
   - **Climate & Comfort**: HVAC Active Status
   - **Charging & Limits**: AC Limit, DC Limit, AC Current, Charge Time Remaining
   - **Integration & Services**: Device ID, Custom Start/Stop Climate Services

---

## 📦 Installation

### Option 1: HACS (Recommended)

1. Open **HACS** in your Home Assistant instance.
2. Click the three dots `⋮` in the top right corner and select **Custom repositories**.
3. Paste the URL: `https://github.com/GBear09/passable-vehicle-card`
4. Set the category to **Lovelace** (Dashboard).
5. Click **Add**, then search for **Passable Vehicle Card** and click **Download**.
6. Refresh your browser page.

### Option 2: Manual Installation

1. Download `passable-vehicle-card.js` from the [latest release](https://github.com/GBear09/passable-vehicle-card/releases).
2. Copy `passable-vehicle-card.js` to your `www/` directory (`/config/www/passable-vehicle-card.js`).
3. In Home Assistant, go to **Settings** -> **Dashboards** -> **Three Dots (Top Right)** -> **Resources**.
4. Add resource:
   - **URL**: `/local/passable-vehicle-card.js?v=1.5.0`
   - **Resource Type**: `JavaScript Module`

---

## 📄 License

Distributed under the [MIT License](LICENSE).
