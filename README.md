# Passable Vehicle Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-v1.1.0-blue.svg)](https://github.com/GBear09/passable-vehicle-card/releases)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A sleek, customizable, and universal vehicle dashboard card for Home Assistant. Designed to monitor and control any electric vehicle (EV), internal combustion engine (ICE), or hybrid vehicle with dynamic animations, modern glassmorphism styling, and **intelligent entity auto-discovery**.

---

## ✨ Features

- 🔍 **Smart Auto-Discovery**: Simply provide **one single entity** (e.g. `entity: sensor.ev9_ev_battery_level`) or a `prefix` (e.g. `prefix: ev9`), and the card will automatically discover all matching sensors, binary sensors, climate entities, charge limit sliders, and scripts!
- 🚗 **Universal Support**: Flexible configuration for EVs, Gas/ICE vehicles, and Hybrids.
- 📱 **Interactive Views**:
  - **Home View**: Vehicle image overlay, real-time door open/closed monitor, quick lock toggle, battery/fuel circular gauge with remaining range, odometer, tire pressure, and relative update timestamp.
  - **Climate View**: Steering wheel heater, front/rear defrost toggles, individual seat heating/cooling levels (Driver, Passenger, Rear), dynamic temperature gauge, defrost duration selector, and driver profile presets.
  - **Charge / Fuel View**: AC/DC charging limit sliders, AC charging current selector, estimated remaining charging time display, and start/stop controls.
- ⚡ **Dynamic Visual Effects**:
  - Charging beam animation when actively charging.
  - Climate airflow stream animation when climate control is active.
  - Dynamic temperature color gradient from blue to neutral to orange.
- 👆 **Touch Gesture Support**: Swipe left/right on touch devices to switch views seamlessly.
- 🎨 **Modern Navigation**: Animated pill-expanding tab bar showing text labels on active selection.

---

## ⚡ Quick Start (Minimal Configuration)

Thanks to **intelligent entity auto-discovery**, you only need to specify **one single entity**:

```yaml
type: custom:passable-vehicle-card
entity: sensor.ev9_ev_battery_level
```

Or specify a prefix:

```yaml
type: custom:passable-vehicle-card
title: Kia EV9
prefix: ev9
```

The card will automatically scan Home Assistant and find range, lock status, door binary sensors, climate controls, charging sliders, and scripts!

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
   - **URL**: `/local/passable-vehicle-card.js?v=1.1.0`
   - **Resource Type**: `JavaScript Module`

---

## ⚙️ Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `string` | **Required** | Must be `custom:passable-vehicle-card` |
| `entity` | `string` | Optional | **Primary entity (e.g. battery or fuel level)**. Triggers auto-discovery of all related vehicle sensors. |
| `prefix` | `string` | Optional | **Entity prefix (e.g. `ev9` or `my_car`)**. Used to auto-discover vehicle entities. |
| `title` | `string` | `My Vehicle` | Card title / vehicle name |
| `subtitle` | `string` | `Vehicle Status` | Card subtitle text |
| `fuel_type` | `string` | `ev` | Vehicle type: `ev`, `ice`, or `hybrid` |
| `icon` | `string` | `mdi:car-electric` | MDI icon for header |
| `image` | `string` | `""` | URL path to vehicle transparent PNG image |
| `device_id` | `string` | `""` | Integration device ID for force updates & commands |
| `range_entity` | `string` | Auto | Override auto-discovered remaining driving range sensor entity |
| `charging_entity` | `string` | Auto | Override auto-discovered charging binary sensor (`on`/`off`) |
| `plug_entity` | `string` | Auto | Override auto-discovered plug binary sensor (`on`/`off`) |
| `lock_entity` | `string` | Auto | Override auto-discovered door lock entity (`lock.vehicle_lock`) |
| `odometer_entity` | `string` | Auto | Override auto-discovered odometer sensor entity |
| `tire_pressure_entity` | `string` | Auto | Override auto-discovered tire pressure binary sensor entity |
| `last_updated_entity` | `string` | Auto | Override auto-discovered last update timestamp sensor entity |
| `charging_power_entity` | `string` | Auto | Override auto-discovered charging power sensor entity (kW) |
| `hood_entity` | `string` | Auto | Override auto-discovered hood binary sensor entity |
| `trunk_entity` | `string` | Auto | Override auto-discovered trunk binary sensor entity |
| `door_fl_entity` | `string` | Auto | Override auto-discovered front left door binary sensor entity |
| `door_fr_entity` | `string` | Auto | Override auto-discovered front right door binary sensor entity |
| `door_rl_entity` | `string` | Auto | Override auto-discovered rear left door binary sensor entity |
| `door_rr_entity` | `string` | Auto | Override auto-discovered rear right door binary sensor entity |
| `hvac_status_entity` | `string` | Auto | Override auto-discovered HVAC active binary sensor entity |
| `climate_temp_entity` | `string` | Auto | Override auto-discovered climate target temperature entity |
| `climate_duration_entity` | `string` | Auto | Override auto-discovered defrost duration entity |
| `climate_defrost_entity` | `string` | Auto | Override auto-discovered front defrost boolean entity |
| `climate_heat_entity` | `string` | Auto | Override auto-discovered rear defrost boolean entity |
| `wheel_heat_entity` | `string` | Auto | Override auto-discovered steering wheel heat select entity |
| `seat_fl_entity` | `string` | Auto | Override auto-discovered driver seat heat/cool select entity |
| `seat_fr_entity` | `string` | Auto | Override auto-discovered passenger seat heat/cool select entity |
| `seat_rl_entity` | `string` | Auto | Override auto-discovered rear left seat heat/cool select entity |
| `seat_rr_entity` | `string` | Auto | Override auto-discovered rear right seat heat/cool select entity |
| `ac_limit_entity` | `string` | Auto | Override auto-discovered AC charge limit number entity |
| `dc_limit_entity` | `string` | Auto | Override auto-discovered DC charge limit number entity |
| `ac_current_entity` | `string` | Auto | Override auto-discovered AC charging current select entity |
| `charge_time_entity` | `string` | Auto | Override auto-discovered charge time remaining sensor entity |
| `start_climate_script` | `string` | Auto | Override auto-discovered climate start script/service |
| `stop_climate_script` | `string` | Auto | Override auto-discovered climate stop script/service |
| `save_profile_script` | `string` | Auto | Override auto-discovered profile save script |

---

## 📝 Configuration Examples

### Minimal Setup (Using Auto-Discovery)
```yaml
type: custom:passable-vehicle-card
title: Kia EV9
entity: sensor.ev9_ev_battery_level
image: /local/images/kia_ev9.png
```

### Full Custom Override Setup
```yaml
type: custom:passable-vehicle-card
title: Kia EV9
subtitle: Vehicle Status
fuel_type: ev
image: /local/images/kia_ev9.png
entity: sensor.ev9_ev_battery_level
range_entity: sensor.ev9_ev_range
charging_entity: binary_sensor.ev9_ev_battery_charge
plug_entity: binary_sensor.ev9_ev_battery_plug
lock_entity: lock.ev9_door_lock
odometer_entity: sensor.ev9_odometer
last_updated_entity: sensor.ev9_last_updated_at
charging_power_entity: sensor.ev9_ev_charging_power
tire_pressure_entity: binary_sensor.ev9_tire_pressure_all
hood_entity: binary_sensor.ev9_hood
trunk_entity: binary_sensor.ev9_trunk
door_fl_entity: binary_sensor.ev9_front_left_door
door_fr_entity: binary_sensor.ev9_front_right_door
door_rl_entity: binary_sensor.ev9_back_left_door
door_rr_entity: binary_sensor.ev9_back_right_door
climate_temp_entity: input_number.kia_ev9_climate_temperature
climate_duration_entity: input_number.kia_ev9_climate_duration
climate_defrost_entity: input_boolean.kia_ev9_climate_defrost
climate_heat_entity: input_boolean.kia_ev9_climate_heating
wheel_heat_entity: input_select.kia_ev9_steering_wheel_heat
seat_fl_entity: input_select.kia_ev9_fl_seat
seat_fr_entity: input_select.kia_ev9_fr_seat
seat_rl_entity: input_select.kia_ev9_rl_seat
seat_rr_entity: input_select.kia_ev9_rr_seat
hvac_status_entity: binary_sensor.ev9_air_conditioner
ac_limit_entity: number.ev9_ac_charging_limit
dc_limit_entity: number.ev9_dc_charging_limit
ac_current_entity: input_select.kia_ev9_ac_charging_current
charge_time_entity: sensor.ev9_estimated_charge_duration
start_climate_script: script.kia_ev9_start_climate
stop_climate_script: script.kia_ev9_stop_climate
save_profile_script: script.kia_ev9_save_profile
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
