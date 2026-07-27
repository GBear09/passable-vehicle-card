# Passable Vehicle Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-v1.2.0-blue.svg)](https://github.com/GBear09/passable-vehicle-card/releases)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A sleek, customizable, and universal vehicle dashboard card for Home Assistant. Designed to monitor and control any electric vehicle (EV), internal combustion engine (ICE), or hybrid vehicle with dynamic animations, modern glassmorphism styling, **Visual UI Editor support**, and **intelligent entity auto-discovery**.

---

## ✨ Features

- 🛠️ **Full Visual UI Editor**: Configure your card directly in the Home Assistant UI without touching YAML code!
- 🔍 **Smart Auto-Discovery**: Simply provide **one single entity** (e.g. `entity: sensor.ev9_ev_battery_level`) or a `prefix` (e.g. `prefix: ev9`), and the card will automatically discover all matching sensors, binary sensors, climate entities, charge limit sliders, and scripts!
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

When editing your dashboard in Home Assistant, simply select **Passable Vehicle Card**. The built-in visual editor allows you to configure:
1. **Title & Subtitle**
2. **Fuel Type** (EV, Gasoline/ICE, or Hybrid)
3. **Primary Entity / Prefix** (auto-discovers all remaining entities)
4. **Custom Vehicle Image URL**
5. **Advanced Entity Overrides** (optional dropdown/text pickers for fine-tuning individual sensors)

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
   - **URL**: `/local/passable-vehicle-card.js?v=1.2.0`
   - **Resource Type**: `JavaScript Module`

---

## 📄 License

Distributed under the [MIT License](LICENSE).
