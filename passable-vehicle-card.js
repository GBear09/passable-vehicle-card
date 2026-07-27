/**
 * Passable Vehicle Card
 * Version: 1.3.0
 * GitHub: https://github.com/GBear09/passable-vehicle-card
 * Description: A customizable, universal vehicle dashboard card for Home Assistant with visual UI dropdown editor and entity auto-discovery.
 */

const CARD_VERSION = "1.3.0";

console.info(
  `%c PASSABLE VEHICLE CARD %c v${CARD_VERSION} `,
  "color: white; background: #2196F3; font-weight: bold;",
  "color: #2196F3; background: white; font-weight: bold;"
);

// Register card in Home Assistant custom card registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: "passable-vehicle-card",
  name: "Passable Vehicle Card",
  description: "A customizable, universal vehicle dashboard card for Home Assistant with entity auto-discovery and visual UI editor.",
  preview: true,
});

const LitElement = Object.getPrototypeOf(
  customElements.get("hui-entities-card")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class PassableVehicleCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _currentView: { type: String }, // 'home', 'controls', 'charging'
      _animDirection: { type: String },
      _toastMsg: { type: String },
    };
  }

  constructor() {
    super();
    this._currentView = "home";
    this._animDirection = "none";
    this._toastMsg = null;
    this._touchStartX = null;
    this._touchStartY = null;
  }

  setConfig(config) {
    this.config = {
      title: config.title || config.name || "My Vehicle",
      subtitle: config.subtitle || "Vehicle Status",
      fuel_type: config.fuel_type || "ev", // 'ev', 'ice', 'hybrid'
      icon: config.icon || "mdi:car-electric",
      image: config.image || "",
      device_id: config.device_id || "",
      prefix: config.prefix || "",
      ...config,
    };
  }

  getCardSize() {
    return 8;
  }

  static getConfigElement() {
    return document.createElement("passable-vehicle-card-editor");
  }

  static getStubConfig() {
    return {
      title: "My Vehicle",
      entity: "sensor.vehicle_battery_level",
    };
  }

  // --- HELPER: GET DEVICE ID ---
  _getDeviceId() {
    return this.config.device_id || "";
  }

  // --- HELPER: AUTO DISCOVERY SYSTEM ---
  _discoverEntities() {
    if (!this.hass || !this.hass.states) return {};

    const cfg = this.config || {};
    const allStates = Object.keys(this.hass.states);

    // Determine prefix candidates
    const prefixes = new Set();
    if (cfg.prefix) prefixes.add(cfg.prefix.toLowerCase());

    const primaryEntity = cfg.entity || cfg.battery_entity || cfg.range_entity || cfg.lock_entity;
    if (primaryEntity) {
      const objectId = primaryEntity.split(".")[1] || "";
      const parts = objectId.split("_");
      if (parts.length > 0) {
        prefixes.add(parts[0]); // e.g. "ev9"
        if (parts.length > 1) prefixes.add(`${parts[0]}_${parts[1]}`); // e.g. "ev9_ev" or "kia_ev9"
      }
    }

    const entityPatterns = {
      battery: ["battery_level", "ev_battery_level", "battery", "soc", "fuel_level", "fuel_percent"],
      range: ["ev_range", "range", "battery_range", "fuel_range", "remaining_range"],
      charging: ["ev_battery_charge", "charging_status", "is_charging", "battery_charging", "charging"],
      plug: ["ev_battery_plug", "plugged_in", "charge_port", "plug_status", "plug"],
      lock: ["door_lock", "lock", "vehicle_lock", "doors_locked"],
      odometer: ["odometer", "total_distance", "mileage"],
      last_updated: ["last_updated_at", "last_updated", "last_seen", "status_updated"],
      charging_power: ["ev_charging_power", "charging_power", "charger_power"],
      tire_pressure: ["tire_pressure_all", "tire_pressure", "tpms", "tire_pressure_warning"],
      hood: ["hood", "hood_status", "engine_hood"],
      trunk: ["trunk", "trunk_status", "tailgate", "boot"],
      door_fl: ["front_left_door", "door_front_left", "door_fl", "driver_door"],
      door_fr: ["front_right_door", "door_front_right", "door_fr", "passenger_door"],
      door_rl: ["back_left_door", "rear_left_door", "door_back_left", "door_rear_left", "door_rl"],
      door_rr: ["back_right_door", "rear_right_door", "door_back_right", "door_rear_right", "door_rr"],
      hvac_active: ["air_conditioner", "hvac", "climate", "climate_status", "air_conditioning"],
      climate_temp: ["climate_temperature", "target_temperature", "hvac_temp"],
      climate_duration: ["climate_duration", "defrost_duration", "hvac_duration"],
      climate_defrost: ["climate_defrost", "defrost_front", "front_defrost"],
      climate_heat: ["climate_heating", "defrost_rear", "rear_defrost"],
      wheel_heat: ["steering_wheel_heat", "steering_wheel_heater", "heated_steering_wheel"],
      seat_fl: ["fl_seat", "driver_seat", "front_left_seat"],
      seat_fr: ["fr_seat", "passenger_seat", "front_right_seat"],
      seat_rl: ["rl_seat", "rear_left_seat", "back_left_seat"],
      seat_rr: ["rr_seat", "rear_right_seat", "back_right_seat"],
      ac_limit: ["ac_charging_limit", "ac_limit", "charge_limit_ac"],
      dc_limit: ["dc_charging_limit", "dc_limit", "charge_limit_dc"],
      ac_current: ["ac_charging_current", "ac_current"],
      charge_time: ["estimated_charge_duration", "charge_time_remaining", "time_to_full"],
      profile: ["profile", "driver_profile"],
    };

    const discovered = {};

    for (const [key, patterns] of Object.entries(entityPatterns)) {
      const configKey = key === "battery" ? "entity" : `${key}_entity`;
      if (cfg[configKey]) {
        discovered[key] = cfg[configKey];
        continue;
      }
      if (key === "battery" && cfg.battery_entity) {
        discovered[key] = cfg.battery_entity;
        continue;
      }

      let found = null;

      for (const pattern of patterns) {
        for (const prefix of prefixes) {
          found = allStates.find((id) => {
            const objId = id.split(".")[1];
            return (
              objId === `${prefix}_${pattern}` ||
              objId === `${prefix}_ev_${pattern}` ||
              objId === `${prefix}_kia_${pattern}` ||
              objId.includes(`${prefix}_${pattern}`) ||
              (objId.includes(pattern) && (objId.includes(prefix) || prefixes.size === 0))
            );
          });
          if (found) break;
        }
        if (found) break;

        found = allStates.find((id) => {
          const objId = id.split(".")[1];
          return objId === pattern || objId.endsWith(`_${pattern}`);
        });
        if (found) break;
      }

      if (found) {
        discovered[key] = found;
      }
    }

    discovered.start_climate_script = cfg.start_climate_script || this._findScript(prefixes, "start_climate");
    discovered.stop_climate_script = cfg.stop_climate_script || this._findScript(prefixes, "stop_climate");
    discovered.save_profile_script = cfg.save_profile_script || this._findScript(prefixes, "save_profile");

    return discovered;
  }

  _findScript(prefixes, scriptName) {
    if (!this.hass || !this.hass.states) return "";
    const allStates = Object.keys(this.hass.states);
    for (const prefix of prefixes) {
      const candidate = allStates.find(
        (id) =>
          id.startsWith("script.") &&
          (id.includes(`${prefix}_${scriptName}`) || id.includes(`${scriptName}_${prefix}`))
      );
      if (candidate) return candidate;
    }
    return allStates.find((id) => id.startsWith("script.") && id.includes(scriptName)) || "";
  }

  // --- HELPER: RELATIVE TIME ---
  _computeRelativeTime(timestamp) {
    if (!timestamp || timestamp === "unavailable" || timestamp === "unknown") return "Never";
    const now = new Date();
    const then = new Date(timestamp);
    if (isNaN(then.getTime())) return timestamp;
    const diffInSeconds = Math.floor((now - then) / 1000);

    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }

  // --- SWIPE LOGIC ---
  _handleTouchStart(e) {
    const path = e.composedPath();
    if (path.some((el) => el.tagName === "HA-SLIDER")) {
      this._touchStartX = null;
      return;
    }

    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  _handleTouchEnd(e) {
    if (this._touchStartX === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = this._touchStartX - touchEndX;
    const diffY = this._touchStartY - touchEndY;

    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        this._navigate("next");
      } else {
        this._navigate("prev");
      }
    }
    this._touchStartX = null;
    this._touchStartY = null;
  }

  _navigate(direction) {
    const views = ["home", "controls", "charging"];
    const currentIdx = views.indexOf(this._currentView);

    let nextIdx = currentIdx;
    if (direction === "next" && currentIdx < views.length - 1) nextIdx++;
    else if (direction === "prev" && currentIdx > 0) nextIdx--;
    else if (typeof direction === "string" && views.includes(direction))
      nextIdx = views.indexOf(direction);

    if (nextIdx !== currentIdx) {
      this._animDirection = nextIdx > currentIdx ? "slide-left" : "slide-right";
      this._currentView = views[nextIdx];
    }
  }

  _showToast(msg) {
    this._toastMsg = msg;
    setTimeout(() => {
      this._toastMsg = null;
    }, 3000);
  }

  // --- DYNAMIC TEMP COLOR ---
  _getThemeTextColor() {
    const defaultColor = [255, 255, 255];
    try {
      const style = getComputedStyle(this);
      const color = style.getPropertyValue("--primary-text-color").trim();

      if (!color) return defaultColor;

      if (color.startsWith("#")) {
        let hex = color.slice(1);
        if (hex.length === 3)
          hex = hex
            .split("")
            .map((c) => c + c)
            .join("");
        return [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16),
        ];
      } else if (color.startsWith("rgb")) {
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
          return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
        }
      }
    } catch (e) {}
    return defaultColor;
  }

  _getTempColor(temp) {
    const t = Math.max(62, Math.min(82, temp));
    const mid = 72;

    const interp = (c1, c2, ratio) => {
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * ratio);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * ratio);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const colBlue = [49, 130, 206];
    const colNeutral = this._getThemeTextColor();
    const colOrange = [255, 152, 0];

    if (t <= mid) {
      const ratio = (t - 62) / (mid - 62);
      return interp(colBlue, colNeutral, ratio);
    } else {
      const ratio = (t - mid) / (82 - mid);
      return interp(colNeutral, colOrange, ratio);
    }
  }

  render() {
    if (!this.hass || !this.config) return html``;

    const entities = this._discoverEntities();

    const get = (id) => (id ? this.hass.states[id] : undefined);
    const val = (id) => (get(id) ? get(id).state : "N/A");

    const batteryLevel = parseFloat(val(entities.battery)) || 0;
    const isCharging = entities.charging ? val(entities.charging) === "on" : false;
    const isClimateOn = entities.hvac_active ? val(entities.hvac_active) === "on" : false;

    let content;
    switch (this._currentView) {
      case "controls":
        content = this._renderControlsView(entities);
        break;
      case "charging":
        content = this._renderChargingView(entities);
        break;
      case "home":
      default:
        content = this._renderHomeView(
          entities,
          batteryLevel,
          isCharging,
          isClimateOn
        );
        break;
    }

    const titleIcon = this.config.icon || (this.config.fuel_type === "ice" ? "mdi:car" : "mdi:car-electric");

    return html`
      <ha-card
        @touchstart=${this._handleTouchStart}
        @touchend=${this._handleTouchEnd}
      >
        <div class="toast ${this._toastMsg ? "show" : ""}">
          <ha-icon icon="mdi:check-circle"></ha-icon> ${this._toastMsg}
        </div>

        <div class="header">
          <div class="header-left">
            <h1 class="title">
              <ha-icon
                icon="${titleIcon}"
                style="margin-right: 8px; color: var(--primary-color)"
              ></ha-icon>
              ${this.config.title}
            </h1>
            <p class="subtitle">${this.config.subtitle}</p>
          </div>
          <div class="header-right">
            <div
              class="status-chip ${isCharging
                ? "charging"
                : isClimateOn
                ? "climate"
                : ""}"
            >
              ${isCharging ? "CHARGING" : isClimateOn ? "CLIMATE ON" : "IDLE"}
            </div>
          </div>
        </div>

        <!-- EXPANDING NAVIGATION TABS -->
        <div class="nav-bar">
          <div
            class="nav-item ${this._currentView === "home" ? "active" : ""}"
            @click=${() => this._navigate("home")}
          >
            <ha-icon icon="mdi:home-outline"></ha-icon>
            <span>Home</span>
          </div>
          <div
            class="nav-item ${this._currentView === "controls" ? "active" : ""}"
            @click=${() => this._navigate("controls")}
          >
            <ha-icon icon="mdi:fan"></ha-icon>
            <span>Climate</span>
          </div>
          <div
            class="nav-item ${this._currentView === "charging" ? "active" : ""}"
            @click=${() => this._navigate("charging")}
          >
            <ha-icon icon="${this.config.fuel_type === "ice" ? "mdi:gas-station" : "mdi:lightning-bolt"}"></ha-icon>
            <span>${this.config.fuel_type === "ice" ? "Fuel" : "Charge"}</span>
          </div>
        </div>

        <div class="card-content">${content}</div>
      </ha-card>
    `;
  }

  // --- VIEW: HOME ---
  _renderHomeView(entities, batteryLevel, isCharging, isClimateOn) {
    const rangeState = entities.range ? this.hass.states[entities.range] : null;
    const rangeVal = rangeState ? Math.round(parseFloat(rangeState.state) || 0) : "--";
    const rangeUnit = rangeState?.attributes?.unit_of_measurement || "mi";

    const setTemp = entities.climate_temp
      ? parseFloat(this.hass.states[entities.climate_temp]?.state) || 72
      : 72;
    const isPlugged = entities.plug ? this.hass.states[entities.plug]?.state === "on" : false;
    const isLocked = entities.lock ? this.hass.states[entities.lock]?.state === "locked" : true;

    const lastUpdatedState = entities.last_updated ? this.hass.states[entities.last_updated]?.state : null;
    const relativeTime = this._computeRelativeTime(lastUpdatedState);

    let chargePower = 0;
    if (entities.charging_power && this.hass.states[entities.charging_power]) {
      chargePower =
        parseFloat(this.hass.states[entities.charging_power].state) || 0;
    }

    let animDuration = 2.0;
    if (chargePower > 0) {
      if (chargePower < 10) animDuration = 3.0;
      else if (chargePower < 50) animDuration = 1.5;
      else if (chargePower < 100) animDuration = 0.8;
      else animDuration = 0.5;
    }
    const animStyle = `animation-duration: ${animDuration}s`;
    const tempColor = this._getTempColor(setTemp);

    const doors = [
      { id: entities.hood, name: "Hood", icon: "mdi:car-convertible" },
      { id: entities.trunk, name: "Trunk", icon: "mdi:car-back" },
      { id: entities.door_fl, name: "Driver Door", icon: "mdi:car-door" },
      { id: entities.door_fr, name: "Pass. Door", icon: "mdi:car-door" },
      { id: entities.door_rl, name: "Rear L Door", icon: "mdi:car-door" },
      { id: entities.door_rr, name: "Rear R Door", icon: "mdi:car-door" },
    ].filter((d) => d.id);

    let openItems = doors.filter((d) => this.hass.states[d.id]?.state === "on");
    let doorSummary, doorIcon, doorColorClass;

    if (doors.length === 0) {
      doorSummary = "Closed";
      doorIcon = "mdi:shield-check";
      doorColorClass = "closed";
    } else if (openItems.length === 0) {
      doorSummary = "All Closed";
      doorIcon = "mdi:check-circle-outline";
      doorColorClass = "closed";
    } else if (openItems.length === 1) {
      doorSummary = `${openItems[0].name} Open`;
      doorIcon = openItems[0].icon;
      doorColorClass = "open";
    } else {
      doorSummary = `${openItems.length} Doors Open`;
      doorIcon = "mdi:car-door-lock-open";
      doorColorClass = "open";
    }

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (batteryLevel / 100) * circumference;
    let batColor = "#25f609";
    if (batteryLevel < 20) batColor = "#f60909";
    else if (batteryLevel < 40) batColor = "#cf9a07";

    const imageUrl = this.config.image || "";

    return html`
      <div class="view-container home ${this._animDirection}">
        <div class="viz-container">
          ${isCharging
            ? html`
                <div class="charging-effect">
                  <div class="charge-beam b1" style="${animStyle}"></div>
                  <div
                    class="charge-beam b2"
                    style="${animStyle}; animation-delay: 0.2s"
                  ></div>
                  <div
                    class="charge-beam b3"
                    style="${animStyle}; animation-delay: 0.5s"
                  ></div>
                </div>
              `
            : ""}
          ${isClimateOn
            ? html`
                <div class="climate-flow-container">
                  <div class="flow-stream s1"></div>
                  <div class="flow-stream s2"></div>
                  <div class="flow-stream s3"></div>
                </div>
              `
            : ""}

          <div class="car-image-wrapper">
            ${imageUrl
              ? html`<img
                  src="${imageUrl}"
                  alt="${this.config.title}"
                  class="car-img"
                  @error=${(e) => (e.target.style.display = "none")}
                />`
              : html`<ha-icon icon="${this.config.fuel_type === "ice" ? "mdi:car-side" : "mdi:car-electric"}" class="fallback-icon"></ha-icon>`}
          </div>

          <div class="door-overlay top-left ${doorColorClass}">
            <ha-icon icon="${doorIcon}"></ha-icon>
            <span>${doorSummary}</span>
          </div>

          ${entities.lock
            ? html`
                <div
                  class="overlay-icon top-right"
                  @click=${() => this._toggleLock(entities.lock)}
                >
                  <ha-icon
                    icon="${isLocked ? "mdi:lock" : "mdi:lock-open-variant"}"
                    style="color: ${isLocked
                      ? "var(--success-color)"
                      : "var(--error-color)"}"
                  ></ha-icon>
                </div>
              `
            : ""}

          <div
            class="overlay-icon bottom-right"
            @click=${() => this._forceUpdate()}
          >
            <ha-icon icon="mdi:refresh"></ha-icon>
          </div>

          ${isPlugged
            ? html`
                <div
                  class="overlay-icon bottom-left ${isCharging
                    ? "pulse-charge"
                    : ""}"
                >
                  <ha-icon
                    icon="mdi:power-plug"
                    style="color: ${isCharging
                      ? "var(--success-color)"
                      : "var(--primary-text-color)"}"
                  ></ha-icon>
                </div>
              `
            : ""}
          ${isClimateOn && entities.climate_temp
            ? html`
                <div
                  class="climate-bubble"
                  style="color: ${tempColor}; border-color: ${tempColor};"
                >
                  <ha-icon icon="mdi:thermometer"></ha-icon>
                  <span>${Math.round(setTemp)}°F</span>
                </div>
              `
            : ""}

          ${entities.battery
            ? html`
                <div
                  class="battery-ring-container"
                  @click=${() => this._moreInfo(entities.battery)}
                >
                  <svg class="battery-ring" viewBox="0 0 100 100">
                    <circle class="ring-bg" cx="50" cy="50" r="${radius}" />
                    <circle
                      class="ring-progress"
                      cx="50"
                      cy="50"
                      r="${radius}"
                      stroke="${batColor}"
                      stroke-dasharray="${circumference}"
                      stroke-dashoffset="${offset}"
                    />
                  </svg>
                  <div class="battery-ring-content">
                    ${isCharging
                      ? html`<ha-icon
                          icon="mdi:lightning-bolt"
                          class="ring-charge-icon"
                        ></ha-icon>`
                      : ""}
                    <span class="ring-val">${batteryLevel}%</span>
                    <span class="ring-range">${rangeVal} ${rangeUnit}</span>
                  </div>
                </div>
              `
            : ""}
        </div>

        <div class="last-updated-bar">
          <ha-icon icon="mdi:clock-outline"></ha-icon>
          Updated ${relativeTime}
        </div>

        <div class="stats-grid">
          ${entities.odometer
            ? this._renderStatItem(
                entities.odometer,
                "mdi:counter",
                "Odometer",
                ""
              )
            : ""}
          ${entities.tire_pressure
            ? this._renderStatItem(
                entities.tire_pressure,
                "mdi:car-tire-alert",
                "Tire Pressure",
                "",
                true
              )
            : ""}
        </div>
      </div>
    `;
  }

  // --- VIEW: CONTROLS ---
  _renderControlsView(entities) {
    const profileState = entities.profile ? this.hass.states[entities.profile] : null;
    const profileOptions = profileState?.attributes?.options || ["Driver 1", "Driver 2"];

    return html`
      <div class="view-container controls ${this._animDirection}">
        ${entities.profile
          ? html`
              <div class="controls-header">
                <div class="profile-selector">
                  ${profileOptions.map((opt) => this._renderProfileChip(entities.profile, opt))}
                </div>
              </div>
              <div class="divider"></div>
            `
          : ""}

        <div class="interior-grid tight-gap">
          <div class="interior-row three-cols">
            <div class="interior-col">
              ${entities.wheel_heat
                ? this._renderSimpleWidget(
                    entities.wheel_heat,
                    "mdi:steering",
                    "Wheel",
                    true
                  )
                : ""}
            </div>
            <div class="interior-col">
              ${entities.climate_defrost
                ? this._renderSimpleWidget(
                    entities.climate_defrost,
                    "mdi:car-defrost-front",
                    "Front"
                  )
                : ""}
            </div>
            <div class="interior-col">
              ${entities.climate_heat
                ? this._renderSimpleWidget(
                    entities.climate_heat,
                    "mdi:car-defrost-rear",
                    "Rear"
                  )
                : ""}
            </div>
          </div>

          <div class="interior-row three-cols">
            <div class="interior-col">
              ${entities.seat_fl
                ? this._renderSeat(entities.seat_fl, "Driver")
                : ""}
            </div>
            <div class="interior-col">
              ${entities.climate_temp
                ? this._renderGaugeControl(
                    entities.climate_temp,
                    "Temp",
                    "°F",
                    62,
                    82,
                    1,
                    true
                  )
                : ""}
            </div>
            <div class="interior-col">
              ${entities.seat_fr
                ? this._renderSeat(entities.seat_fr, "Pass.")
                : ""}
            </div>
          </div>

          <div class="interior-row three-cols">
            <div class="interior-col">
              ${entities.seat_rl
                ? this._renderSeat(entities.seat_rl, "Rear L")
                : ""}
            </div>
            <div class="interior-col">
              ${entities.climate_duration
                ? this._renderGaugeControl(
                    entities.climate_duration,
                    "Duration",
                    "min",
                    5,
                    30,
                    5,
                    false
                  )
                : ""}
            </div>
            <div class="interior-col">
              ${entities.seat_rr
                ? this._renderSeat(entities.seat_rr, "Rear R")
                : ""}
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="action-buttons with-gap">
          <button
            class="action-btn start"
            @click=${() => this._handleClimateStart(entities)}
          >
            <ha-icon icon="mdi:fan"></ha-icon> Start
          </button>
          <button
            class="action-btn stop"
            @click=${() => this._handleClimateStop(entities)}
          >
            <ha-icon icon="mdi:stop"></ha-icon> Stop
          </button>
          ${entities.save_profile_script || entities.profile
            ? html`
                <button
                  class="action-btn save"
                  @click=${() => this._handleSaveProfile(entities)}
                >
                  <ha-icon icon="mdi:content-save"></ha-icon>
                </button>
              `
            : ""}
        </div>
      </div>
    `;
  }

  // --- VIEW: CHARGING ---
  _renderChargingView(entities) {
    const chargeTime = entities.charge_time && this.hass.states[entities.charge_time]
      ? this.hass.states[entities.charge_time].state
      : "--";

    return html`
      <div class="view-container charging ${this._animDirection}">
        ${entities.ac_limit || entities.dc_limit
          ? html`
              <div class="charging-section top-section">
                <div class="section-title">Charging Limits</div>
                <div class="slider-group">
                  ${entities.ac_limit
                    ? this._renderSliderControl(
                        entities.ac_limit,
                        "AC Charging Limit",
                        "%",
                        50,
                        100,
                        10
                      )
                    : ""}
                  ${entities.dc_limit
                    ? this._renderSliderControl(
                        entities.dc_limit,
                        "DC Charging Limit",
                        "%",
                        50,
                        100,
                        10
                      )
                    : ""}
                </div>
              </div>
              <div class="divider"></div>
            `
          : ""}

        ${entities.ac_current
          ? html`
              <div class="charging-section middle-section">
                <div class="section-title">AC Charging Current</div>
                <div class="current-selector">
                  ${this._renderCurrentChip(entities.ac_current, "60%")}
                  ${this._renderCurrentChip(entities.ac_current, "90%")}
                  ${this._renderCurrentChip(entities.ac_current, "100%")}
                </div>
              </div>
              <div class="divider"></div>
            `
          : ""}

        <div class="charging-section bottom-section">
          ${entities.charge_time
            ? html`
                <div class="charge-stats">
                  <div class="stat-item">
                    <ha-icon icon="mdi:clock-end"></ha-icon>
                    <div class="stat-text">
                      <span class="value">${chargeTime} min</span>
                      <span class="label">Time Remaining</span>
                    </div>
                  </div>
                </div>
              `
            : ""}

          <div class="action-buttons with-gap">
            <button
              class="action-btn start"
              @click=${() => this._handleChargeAction("start", "Charge Started")}
            >
              <ha-icon icon="mdi:lightning-bolt"></ha-icon> Start
            </button>
            <button
              class="action-btn stop"
              @click=${() => this._handleChargeAction("stop", "Charge Stopped")}
            >
              <ha-icon icon="mdi:stop"></ha-icon> Stop
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderSliderControl(entityId, label, unit, min, max, step) {
    const stateObj = this.hass.states[entityId];
    if (!stateObj) return html``;

    const val = parseFloat(stateObj.state) || min;

    return html`
      <div class="slider-control">
        <div class="slider-header">
          <span class="slider-label">${label}</span>
          <span class="slider-value">${val}${unit}</span>
        </div>
        <ha-slider
          .min=${min}
          .max=${max}
          .step=${step}
          .value=${val}
          pin
          @change=${(e) => this._setLimitValue(entityId, e.target.value)}
        ></ha-slider>
        <div class="slider-ticks">
          <span>${min}%</span>
          <span>${max}%</span>
        </div>
      </div>
    `;
  }

  _renderGaugeControl(
    entityId,
    label,
    unit,
    min,
    max,
    step,
    isTemp,
    size = 80
  ) {
    const stateObj = this.hass.states[entityId];
    if (!stateObj) return html``;

    const val = parseFloat(stateObj.state) || min;
    const radius = 34;
    const circ = 2 * Math.PI * radius;
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
    const offset = circ - ratio * circ;
    const color = isTemp ? this._getTempColor(val) : "var(--primary-color)";
    const isNumberEntity = entityId.startsWith("number.");
    const domain = isNumberEntity ? "number" : "input_number";
    const isLarge = size > 100;

    return html`
      <div
        class="gauge-control ${isLarge ? "large-gauge" : ""}"
        style="width: ${size}px; height: ${size}px;"
      >
        <div
          class="gauge-btn minus"
          @click=${() =>
            this.hass.callService(domain, "set_value", {
              entity_id: entityId,
              value: Math.max(min, val - step),
            })}
        >
          <ha-icon icon="mdi:minus"></ha-icon>
        </div>

        <div class="gauge-viz">
          <svg viewBox="0 0 80 80" class="mini-ring">
            <circle cx="40" cy="40" r="${radius}" class="ring-bg" />
            <circle
              cx="40"
              cy="40"
              r="${radius}"
              class="ring-progress"
              style="stroke: ${color}; stroke-dasharray: ${circ}; stroke-dashoffset: ${offset}"
            />
          </svg>
          <div class="gauge-text">
            <span class="gauge-val" style="color: ${color}"
              >${Math.round(val)}</span
            >
            <span class="gauge-unit">${unit}</span>
          </div>
          <div class="gauge-label">${label}</div>
        </div>

        <div
          class="gauge-btn plus"
          @click=${() =>
            this.hass.callService(domain, "set_value", {
              entity_id: entityId,
              value: Math.min(max, val + step),
            })}
        >
          <ha-icon icon="mdi:plus"></ha-icon>
        </div>
      </div>
    `;
  }

  _renderCurrentChip(entityId, option) {
    const current = this.hass.states[entityId]?.state;
    const isActive = current === option;
    return html`
      <div
        class="profile-chip ${isActive ? "active" : ""}"
        @click=${() => this._setInputSelect(entityId, option)}
      >
        ${option}
      </div>
    `;
  }

  _renderStatItem(entityId, icon, label, unitOverride, isBinary = false) {
    const stateObj = this.hass.states[entityId];
    if (!stateObj) return html``;
    let val = stateObj.state;
    let color = "inherit";

    if (isBinary) {
      val = stateObj.state === "on" ? "Warning" : "OK";
      color =
        stateObj.state === "on" ? "var(--error-color)" : "var(--success-color)";
    } else {
      if (!isNaN(parseFloat(val)))
        val = Math.floor(parseFloat(val)).toLocaleString();
    }

    return html`
      <div class="stat-item" @click=${() => this._moreInfo(entityId)}>
        <ha-icon icon="${icon}" style="color: ${color}"></ha-icon>
        <div class="stat-text">
          <span class="value"
            >${val}
            ${unitOverride ||
            stateObj.attributes?.unit_of_measurement ||
            ""}</span
          >
          <span class="label">${label}</span>
        </div>
      </div>
    `;
  }

  _renderProfileChip(entityId, option) {
    const current = this.hass.states[entityId]?.state;
    const isActive = current === option;

    return html`
      <div
        class="profile-chip ${isActive ? "active" : ""}"
        @click=${() => this._setInputSelect(entityId, option)}
      >
        <ha-icon icon="mdi:account"></ha-icon>
        ${option}
      </div>
    `;
  }

  _renderSimpleWidget(entityId, icon, label, isSteering = false) {
    const stateObj = this.hass.states[entityId];
    if (!stateObj) return html``;
    const val = stateObj.state;
    const isActive = isSteering ? val !== "Off" && val !== "off" : val === "on";
    let level = 0;
    if (isSteering) {
      if (val === "Low" || val === "low") level = 1;
      if (val === "High" || val === "high") level = 3;
    }
    const dots = [];
    if (isSteering) {
      for (let i = 0; i < 3; i++) {
        dots.push(
          html`<div class="dot ${i < level ? "dot-active-heat" : ""}"></div>`
        );
      }
    } else {
      dots.push(html`<div class="dot-spacer"></div>`);
    }
    const activeClass = isActive ? "heat" : "off";

    return html`
      <div
        class="seat-widget small-widget ${activeClass}"
        @click=${() =>
          isSteering
            ? this._cycleWheel(entityId, val)
            : this._toggleEntity(entityId)}
      >
        <ha-icon icon="${icon}"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container">${dots}</div>
        <span class="seat-state"
          >${isActive ? (isSteering ? val.toUpperCase() : "ON") : "OFF"}</span
        >
      </div>
    `;
  }

  _renderSeat(entityId, label) {
    const stateObj = this.hass.states[entityId];
    if (!stateObj) return html``;
    const val = stateObj.state;
    let mode = "off";
    let level = 0;
    if (val.includes("Heat")) {
      mode = "heat";
      if (val.includes("High")) level = 3;
      else if (val.includes("Mid")) level = 2;
      else level = 1;
    } else if (val.includes("Cool")) {
      mode = "cool";
      if (val.includes("High")) level = 3;
      else if (val.includes("Mid")) level = 2;
      else level = 1;
    }
    const dots = [];
    for (let i = 0; i < 3; i++) {
      const dotClass =
        i < level
          ? mode === "heat"
            ? "dot-active-heat"
            : "dot-active-cool"
          : "";
      dots.push(html`<div class="dot ${dotClass}"></div>`);
    }

    return html`
      <div
        class="seat-widget ${mode}"
        @click=${() => this._cycleSeat(entityId, val)}
      >
        <ha-icon icon="mdi:car-seat"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container">${dots}</div>
        <span class="seat-state"
          >${mode === "off" ? "OFF" : mode.toUpperCase()}</span
        >
      </div>
    `;
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _toggleLock(entityId) {
    if (!entityId || !this.hass.states[entityId]) return;
    const isLocked = this.hass.states[entityId].state === "locked";
    const service = isLocked ? "unlock" : "lock";
    this.hass.callService("lock", service, { entity_id: entityId });
    this._showToast(`Sent ${service.toUpperCase()} command`);
  }

  _toggleEntity(entityId) {
    if (!entityId) return;
    const domain = entityId.split(".")[0];
    const service = domain === "input_boolean" ? "toggle" : "toggle";
    this.hass.callService(domain, service, { entity_id: entityId });
  }

  _setInputSelect(entityId, option) {
    if (!entityId) return;
    const domain = entityId.split(".")[0];
    this.hass.callService(domain, "select_option", {
      entity_id: entityId,
      option: option,
    });
  }

  _setLimitValue(entityId, value) {
    if (!entityId) return;
    const domain = entityId.startsWith("number.") ? "number" : "input_number";
    this.hass.callService(domain, "set_value", {
      entity_id: entityId,
      value: value,
    });
    this._showToast(`Setting Limit to ${value}%`);
  }

  _handleClimateStart(entities) {
    const targetScript = this.config.start_climate_script || entities.start_climate_script;
    if (targetScript) {
      const [domain, service] = targetScript.split(".");
      if (domain === "script") {
        this.hass.callService("script", "turn_on", { entity_id: targetScript });
      } else {
        this.hass.callService(domain, service, {});
      }
      this._showToast("Climate Started");
    } else {
      this._showToast("No climate start script found");
    }
  }

  _handleClimateStop(entities) {
    const targetScript = this.config.stop_climate_script || entities.stop_climate_script;
    if (targetScript) {
      const [domain, service] = targetScript.split(".");
      if (domain === "script") {
        this.hass.callService("script", "turn_on", { entity_id: targetScript });
      } else {
        this.hass.callService(domain, service, {});
      }
      this._showToast("Climate Stopped");
    } else {
      this._showToast("No climate stop script found");
    }
  }

  _handleSaveProfile(entities) {
    const targetScript = this.config.save_profile_script || entities.save_profile_script;
    if (targetScript) {
      this.hass.callService("script", "turn_on", { entity_id: targetScript });
      this._showToast("Settings Saved");
    }
  }

  _forceUpdate() {
    if (this.config.force_update_service) {
      const [domain, service] = this.config.force_update_service.split(".");
      const payload = this._getDeviceId() ? { device_id: this._getDeviceId() } : {};
      this.hass.callService(domain, service, payload);
      this._showToast("Force Update Sent");
    } else {
      if (this.hass.services?.kia_uvo?.force_update) {
        this.hass.callService("kia_uvo", "force_update", this._getDeviceId() ? { device_id: this._getDeviceId() } : {});
        this._showToast("Force Update Sent");
      } else {
        this._showToast("Refreshing Status");
      }
    }
  }

  _handleChargeAction(action, msg) {
    const serviceKey = action === "start" ? "start_charge_service" : "stop_charge_service";
    if (this.config[serviceKey]) {
      const [domain, service] = this.config[serviceKey].split(".");
      const payload = this._getDeviceId() ? { device_id: this._getDeviceId() } : {};
      this.hass.callService(domain, service, payload);
      this._showToast(msg);
    } else if (this.hass.services?.kia_uvo?.[`${action}_charge`]) {
      this.hass.callService("kia_uvo", `${action}_charge`, this._getDeviceId() ? { device_id: this._getDeviceId() } : {});
      this._showToast(msg);
    } else {
      this._showToast(`No charge ${action} service configured`);
    }
  }

  _cycleWheel(entityId, current) {
    let next = "Off";
    if (current === "Off" || current === "off") next = "Low";
    else if (current === "Low" || current === "low") next = "High";
    else next = "Off";
    this._setInputSelect(entityId, next);
  }

  _cycleSeat(entityId, current) {
    let next = "Off";
    switch (current) {
      case "Off":
      case "off":
        next = "Heat High";
        break;
      case "Heat High":
        next = "Heat Mid";
        break;
      case "Heat Mid":
        next = "Heat Low";
        break;
      case "Heat Low":
        next = "Cool High";
        break;
      case "Cool High":
        next = "Cool Mid";
        break;
      case "Cool Mid":
        next = "Cool Low";
        break;
      case "Cool Low":
        next = "Off";
        break;
      default:
        next = "Off";
    }
    this._setInputSelect(entityId, next);
  }

  static get styles() {
    return css`
      :host {
        --seat-heat-color: #ff9800;
        --seat-cool-color: #3182ce;
        --seat-off-color: var(--secondary-text-color);
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
      ha-card {
        background: var(--ha-card-background, #fff);
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        overflow: hidden;
        color: var(--primary-text-color);
        border-radius: var(--ha-card-border-radius, 12px);
        display: flex;
        flex-direction: column;
        position: relative;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }

      .toast {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: rgba(30, 30, 30, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.85em;
        font-weight: 500;
        pointer-events: none;
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .header {
        padding: 16px 16px 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        padding-bottom: 16px;
        margin-bottom: 16px;
        flex-shrink: 0;
      }
      .header-left {
        display: flex;
        flex-direction: column;
      }
      .title {
        font-size: 24px;
        font-weight: 500;
        margin: 0;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
      }
      .subtitle {
        color: var(--secondary-text-color, #757575);
        font-size: 14px;
        margin-top: 4px;
        margin-bottom: 0;
      }
      .status-chip {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        background: rgba(128, 128, 128, 0.15);
        color: var(--secondary-text-color);
      }

      /* EXPANDING PILLS NAVIGATION BAR */
      .nav-bar {
        display: flex;
        justify-content: center;
        gap: 24px;
        background: transparent;
        padding: 0 16px 12px 16px;
        margin-bottom: 12px;
        border-bottom: 1px solid var(--divider-color);
        flex-shrink: 0;
      }

      .nav-item {
        padding: 8px 16px;
        cursor: pointer;
        color: var(--secondary-text-color);
        border-radius: 24px;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        margin-bottom: 0;
      }

      .nav-item:hover {
        background-color: rgba(var(--primary-color-rgb), 0.05);
      }

      .nav-item.active {
        background-color: var(--primary-color);
        color: var(--text-primary-color, var(--primary-text-color, #fff));
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      }

      .nav-item ha-icon {
        --mdc-icon-size: 20px;
      }

      .nav-item span {
        max-width: 0;
        opacity: 0;
        overflow: hidden;
        white-space: nowrap;
        transition: all 0.3s ease;
        font-weight: 600;
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .nav-item.active span {
        max-width: 80px;
        opacity: 1;
        margin-left: 8px;
      }

      .card-content {
        padding: 12px 12px 12px;
        height: 500px;
        overflow-y: hidden;
        display: block;
        box-sizing: border-box;
        position: relative;
        width: 100%;
      }

      .view-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        justify-content: flex-start;
        gap: 2px;
        animation-duration: 0.3s;
        animation-fill-mode: both;
      }
      .view-container.controls {
        padding-top: 0px;
        padding-bottom: 0px;
      }
      .view-container.charging {
        padding-top: 12px;
        padding-bottom: 12px;
        gap: 0px;
        justify-content: space-between;
      }

      .charging-section.top-section {
        margin-bottom: 0;
      }
      .charging-section.middle-section {
        margin-top: 0;
        margin-bottom: 0;
      }
      .charging-section.bottom-section {
        margin-top: 0;
      }

      .controls-header {
        margin-bottom: 8px;
      }

      .slide-left {
        animation-name: slideLeft;
      }
      .slide-right {
        animation-name: slideRight;
      }
      @keyframes slideLeft {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes slideRight {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .status-chip.charging {
        background-color: rgba(var(--success-color-rgb, 37, 246, 9), 0.15);
        color: var(--success-color, #25f609);
        animation: pulse-text 2s infinite;
      }
      .status-chip.climate {
        background-color: rgba(var(--info-color-rgb, 49, 130, 206), 0.15);
        color: var(--info-color, #3182ce);
      }

      .viz-container {
        position: relative;
        flex-grow: 1;
        min-height: 200px;
        margin-bottom: 4px;
        background: radial-gradient(
          circle at center,
          rgba(0, 0, 0, 0.05) 0%,
          rgba(0, 0, 0, 0) 70%
        );
        border-radius: var(--ha-card-border-radius, 12px);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .charging-effect {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .charge-beam {
        position: absolute;
        bottom: 0;
        width: 40px;
        background: linear-gradient(to top, rgba(37, 246, 9, 0.4), transparent);
        filter: blur(8px);
        opacity: 0;
        transform-origin: bottom;
      }
      .b1 {
        left: 20%;
        height: 60%;
        animation: chargeRise infinite ease-in;
      }
      .b2 {
        left: 50%;
        height: 80%;
        transform: translateX(-50%);
        animation: chargeRise infinite ease-in;
      }
      .b3 {
        right: 20%;
        height: 50%;
        animation: chargeRise infinite ease-in;
      }

      @keyframes chargeRise {
        0% {
          transform: scaleY(0);
          opacity: 0;
        }
        20% {
          opacity: 0.6;
        }
        100% {
          transform: scaleY(1.2);
          opacity: 0;
        }
      }

      .climate-flow-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 5;
        pointer-events: none;
        overflow: hidden;
      }

      .flow-stream {
        position: absolute;
        background: linear-gradient(
          90deg,
          rgba(var(--info-color-rgb, 49, 130, 206), 0) 0%,
          rgba(var(--info-color-rgb, 49, 130, 206), 0.4) 50%,
          rgba(var(--info-color-rgb, 49, 130, 206), 0) 100%
        );
        border-radius: 10px;
        filter: blur(5px);
        opacity: 0;
      }

      .s1 {
        top: 35%;
        left: 10%;
        width: 40%;
        height: 15px;
        animation: windFlow 3s infinite linear;
        animation-delay: 0s;
      }
      .s2 {
        top: 50%;
        left: 5%;
        width: 60%;
        height: 25px;
        animation: windFlow 4s infinite linear;
        animation-delay: 1.5s;
      }
      .s3 {
        top: 60%;
        left: 15%;
        width: 50%;
        height: 12px;
        animation: windFlow 3.5s infinite linear;
        animation-delay: 0.5s;
      }

      @keyframes windFlow {
        0% {
          transform: translateX(-100px) scaleX(0.5);
          opacity: 0;
        }
        20% {
          opacity: 0.6;
        }
        80% {
          opacity: 0.6;
        }
        100% {
          transform: translateX(100px) scaleX(1.2);
          opacity: 0;
        }
      }

      .car-image-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        pointer-events: none;
      }
      .car-img {
        width: auto;
        height: auto;
        max-width: 85%;
        max-height: 85%;
        object-fit: contain;
        filter: drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.2));
      }
      .fallback-icon {
        --mdc-icon-size: 140px;
        color: var(--secondary-text-color);
        opacity: 0.4;
      }

      .door-overlay {
        position: absolute;
        top: 10px;
        left: 10px;
        background: var(--ha-card-background, #fff);
        padding: 6px 12px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8em;
        font-weight: 600;
        z-index: 2;
        border: 1px solid var(--divider-color);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      }
      .door-overlay.closed {
        color: var(--success-color);
      }
      .door-overlay.open {
        color: var(--error-color);
      }
      .door-overlay ha-icon {
        --mdc-icon-size: 18px;
      }

      .climate-bubble {
        position: absolute;
        top: 48%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(2px);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        border: 2px solid;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 2px;
        z-index: 10;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }
      .climate-bubble ha-icon {
        --mdc-icon-size: 28px;
      }
      .climate-bubble span {
        font-size: 1.1em;
        font-weight: 800;
        line-height: 1;
      }

      .battery-ring-container {
        position: absolute;
        bottom: 5px;
        left: 50%;
        transform: translateX(-50%);
        width: 90px;
        height: 90px;
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .battery-ring {
        width: 100%;
        height: 100%;
        transform: rotate(90deg);
      }
      .ring-bg {
        fill: var(--ha-card-background, #fff);
        stroke: var(--divider-color);
        stroke-width: 8;
      }
      .ring-progress {
        fill: none;
        stroke-width: 8;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.5s ease;
      }
      .battery-ring-content {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .ring-val {
        font-size: 1.2em;
        font-weight: 800;
        line-height: 1;
        color: var(--primary-text-color);
      }
      .ring-range {
        font-size: 0.7em;
        color: var(--secondary-text-color);
        font-weight: 500;
      }
      .ring-charge-icon {
        --mdc-icon-size: 16px;
        color: var(--success-color);
        animation: flash 1s infinite;
      }

      .overlay-icon {
        position: absolute;
        background: var(--ha-card-background, #fff);
        border-radius: 50%;
        padding: 8px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        z-index: 2;
        border: 1px solid var(--divider-color);
      }
      .top-right {
        top: 10px;
        right: 10px;
      }
      .bottom-left {
        bottom: 10px;
        left: 10px;
      }
      .bottom-right {
        bottom: 10px;
        right: 10px;
      }

      .last-updated-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.75em;
        color: var(--secondary-text-color);
        margin-bottom: 8px;
        font-weight: 500;
        opacity: 0.8;
      }
      .last-updated-bar ha-icon {
        --mdc-icon-size: 14px;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 0px;
        margin-bottom: 12px;
        flex-shrink: 0;
        width: 100%;
        box-sizing: border-box;
      }
      .stat-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        background: var(--secondary-background-color);
        border-radius: var(--ha-card-border-radius, 8px);
        cursor: pointer;
        min-width: 0;
      }
      .stat-text {
        display: flex;
        flex-direction: column;
        white-space: nowrap;
        overflow: hidden;
      }
      .stat-text .value {
        font-weight: 600;
        font-size: 0.9em;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .stat-text .label {
        font-size: 0.7em;
        color: var(--secondary-text-color);
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .interior-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: rgba(0, 0, 0, 0.02);
        padding: 0 4px;
        border-radius: var(--ha-card-border-radius, 12px);
        flex-grow: 1;
        justify-content: center;
        width: 100%;
        box-sizing: border-box;
      }
      .interior-grid.tight-gap {
        gap: 12px;
      }
      .interior-row {
        display: grid;
        gap: 4px;
        justify-items: center;
        align-items: center;
        width: 100%;
      }
      .three-cols {
        grid-template-columns: repeat(3, 1fr);
      }
      .interior-col {
        display: flex;
        justify-content: center;
        width: 100%;
      }

      .section-title {
        font-size: 0.8em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .divider {
        height: 1px;
        background: var(--divider-color);
        margin: 4px 0;
        flex-shrink: 0;
      }
      .profile-selector {
        display: flex;
        gap: 8px;
        width: 100%;
        flex-shrink: 0;
      }
      .profile-chip {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px;
        border: 1px solid var(--divider-color);
        border-radius: var(--ha-card-border-radius, 8px);
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
        min-width: 0;
      }
      .profile-chip.active {
        background-color: var(--primary-color);
        color: var(--text-primary-color, var(--primary-text-color, #fff));
        border-color: var(--primary-color);
      }

      .slider-group {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 8px 16px;
        width: 100%;
        box-sizing: border-box;
      }
      .slider-control {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.9em;
        font-weight: 600;
      }
      .slider-value {
        color: var(--primary-color);
      }
      .slider-ticks {
        display: flex;
        justify-content: space-between;
        font-size: 0.6em;
        color: var(--secondary-text-color);
        margin-top: -4px;
      }

      ha-slider {
        width: 100%;
      }

      .gauge-control {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .gauge-viz {
        position: relative;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .mini-ring {
        width: 100%;
        height: 100%;
        transform: rotate(90deg);
      }
      .gauge-text {
        position: absolute;
        top: 40%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        line-height: 1;
      }
      .gauge-val {
        font-size: 1.5em;
        font-weight: 800;
        line-height: 0.9;
      }
      .gauge-unit {
        font-size: 0.6em;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }
      .gauge-label {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.55em;
        color: var(--secondary-text-color);
        font-weight: 700;
        text-transform: uppercase;
      }

      .gauge-btn {
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.5);
        backdrop-filter: blur(4px);
        border: 1px solid var(--divider-color);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1em;
        font-weight: bold;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        z-index: 5;
        pointer-events: auto;
      }
      .gauge-btn.minus {
        top: 50%;
        left: -10px;
        transform: translateY(-50%);
      }
      .gauge-btn.plus {
        top: 50%;
        right: -10px;
        transform: translateY(-50%);
      }

      .gauge-btn:active {
        transform: translateY(-50%) scale(0.9);
      }

      .current-selector {
        display: flex;
        gap: 8px;
        width: 100%;
        padding-bottom: 8px;
      }
      .charge-stats {
        margin-bottom: 24px;
      }

      .seat-widget {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        width: 80px;
        gap: 2px;
        border-radius: var(--ha-card-border-radius, 8px);
        padding: 4px;
        transition: background-color 0.2s;
      }
      .seat-widget ha-icon {
        --mdc-icon-size: 48px;
        transition: color 0.2s;
      }
      .seat-widget.small-widget ha-icon {
        --mdc-icon-size: 32px;
      }
      .seat-label {
        font-size: 0.7em;
        color: var(--secondary-text-color);
      }
      .seat-state {
        font-size: 0.6em;
        font-weight: bold;
        height: 1em;
      }

      .dots-container {
        display: flex;
        gap: 2px;
        height: 6px;
        margin-bottom: 2px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--disabled-text-color);
        opacity: 0.3;
      }
      .dot-spacer {
        height: 6px;
        width: 1px;
      }
      .dot-active-heat {
        background-color: var(--seat-heat-color) !important;
        opacity: 1 !important;
      }
      .dot-active-cool {
        background-color: var(--seat-cool-color) !important;
        opacity: 1 !important;
      }

      .seat-widget.heat ha-icon,
      .seat-widget.heat .seat-state {
        color: var(--seat-heat-color) !important;
      }
      .seat-widget.cool ha-icon,
      .seat-widget.cool .seat-state {
        color: var(--seat-cool-color) !important;
      }
      .seat-widget.off ha-icon {
        color: var(--seat-off-color);
      }
      .seat-widget.off .seat-state {
        opacity: 0;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        margin-top: auto;
        flex-shrink: 0;
        padding-bottom: 4px;
      }
      .action-buttons.with-gap {
        margin-bottom: 4px;
      }
      .action-btn {
        border: none;
        padding: 10px;
        border-radius: var(--ha-card-border-radius, 8px);
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex: 1;
        font-size: 0.9em;
      }
      .action-btn.start {
        background: var(--primary-color);
        color: var(--text-primary-color, var(--primary-text-color, #fff));
      }
      .action-btn.stop {
        background: var(--error-color);
        color: white;
      }
      .action-btn.save {
        flex: 0 0 50px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
      }
    `;
  }
}

// Custom Card Visual Editor Component with Filtered Dropdown Entity Selectors
class PassableVehicleCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
    };
  }

  setConfig(config) {
    this._config = config || {};
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const configValue = target.configValue;
    if (!configValue) return;

    const value = target.value;

    if (this._config[configValue] === value) return;

    let newConfig = { ...this._config };
    if (value === "" || value === undefined) {
      delete newConfig[configValue];
    } else {
      newConfig[configValue] = value;
    }

    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
  }

  _renderEntitySelect(configValue, label, domainFilter = [], helpText = "") {
    if (!this.hass || !this.hass.states) return html``;

    const allEntities = Object.keys(this.hass.states).sort();
    const filtered = allEntities.filter((id) => {
      if (!domainFilter || domainFilter.length === 0) return true;
      const domain = id.split(".")[0];
      return domainFilter.includes(domain);
    });

    const currentValue = this._config[configValue] || "";

    return html`
      <div class="option-row">
        <label class="label">${label}</label>
        <select
          class="input-select"
          .value=${currentValue}
          .configValue=${configValue}
          @change=${this._valueChanged}
        >
          <option value="" ?selected=${currentValue === ""}>-- Auto-Discover / None --</option>
          ${filtered.map((id) => {
            const friendlyName = this.hass.states[id]?.attributes?.friendly_name || id;
            return html`
              <option value="${id}" ?selected=${id === currentValue}>
                ${id} (${friendlyName})
              </option>
            `;
          })}
        </select>
        ${helpText ? html`<span class="help-text">${helpText}</span>` : ""}
      </div>
    `;
  }

  render() {
    if (!this.hass) return html``;

    return html`
      <div class="card-config">
        <div class="option-row">
          <label class="label">Vehicle Title</label>
          <input
            class="input-text"
            .value=${this._config.title || ""}
            .configValue=${"title"}
            @input=${this._valueChanged}
            placeholder="My Vehicle"
          />
        </div>

        <div class="option-row">
          <label class="label">Subtitle</label>
          <input
            class="input-text"
            .value=${this._config.subtitle || ""}
            .configValue=${"subtitle"}
            @input=${this._valueChanged}
            placeholder="Vehicle Status"
          />
        </div>

        <div class="option-row">
          <label class="label">Fuel Type</label>
          <select
            class="input-select"
            .value=${this._config.fuel_type || "ev"}
            .configValue=${"fuel_type"}
            @change=${this._valueChanged}
          >
            <option value="ev">Electric Vehicle (EV)</option>
            <option value="ice">Gasoline / ICE</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        ${this._renderEntitySelect(
          "entity",
          "Primary Vehicle Entity (Battery / Fuel Level)",
          ["sensor", "binary_sensor"],
          "Select primary sensor to auto-discover all related car entities!"
        )}

        <div class="option-row">
          <label class="label">Entity Prefix (Optional)</label>
          <input
            class="input-text"
            .value=${this._config.prefix || ""}
            .configValue=${"prefix"}
            @input=${this._valueChanged}
            placeholder="ev9"
          />
        </div>

        <div class="option-row">
          <label class="label">Car Image URL (Optional)</label>
          <input
            class="input-text"
            .value=${this._config.image || ""}
            .configValue=${"image"}
            @input=${this._valueChanged}
            placeholder="/local/images/car.png"
          />
        </div>

        <details class="advanced-section">
          <summary>Advanced Entity Overrides</summary>
          <div class="details-content">
            <h4 class="section-header">Status & Sensor Overrides</h4>
            ${this._renderEntitySelect("range_entity", "Remaining Range", ["sensor"])}
            ${this._renderEntitySelect("lock_entity", "Vehicle Lock", ["lock"])}
            ${this._renderEntitySelect("charging_entity", "Charging Status", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("plug_entity", "Plug Status", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("odometer_entity", "Odometer", ["sensor"])}
            ${this._renderEntitySelect("tire_pressure_entity", "Tire Pressure Warning", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("last_updated_entity", "Last Update Timestamp", ["sensor"])}
            ${this._renderEntitySelect("charging_power_entity", "Charging Power (kW)", ["sensor"])}

            <h4 class="section-header">Doors & Hatch Overrides</h4>
            ${this._renderEntitySelect("hood_entity", "Hood Status", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("trunk_entity", "Trunk / Tailgate Status", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("door_fl_entity", "Front Left Door", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("door_fr_entity", "Front Right Door", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("door_rl_entity", "Rear Left Door", ["binary_sensor", "sensor"])}
            ${this._renderEntitySelect("door_rr_entity", "Rear Right Door", ["binary_sensor", "sensor"])}

            <h4 class="section-header">Climate & Comfort Overrides</h4>
            ${this._renderEntitySelect("hvac_status_entity", "HVAC / Air Conditioner Active", ["binary_sensor", "climate", "sensor"])}
            ${this._renderEntitySelect("climate_temp_entity", "Climate Temperature", ["input_number", "number", "sensor"])}
            ${this._renderEntitySelect("climate_duration_entity", "Defrost Duration", ["input_number", "number", "sensor"])}
            ${this._renderEntitySelect("climate_defrost_entity", "Front Defrost Toggle", ["input_boolean", "switch", "binary_sensor"])}
            ${this._renderEntitySelect("climate_heat_entity", "Rear Defrost Toggle", ["input_boolean", "switch", "binary_sensor"])}
            ${this._renderEntitySelect("wheel_heat_entity", "Steering Wheel Heat", ["input_select", "select", "sensor"])}
            ${this._renderEntitySelect("seat_fl_entity", "Driver Seat Heat/Cool", ["input_select", "select", "sensor"])}
            ${this._renderEntitySelect("seat_fr_entity", "Passenger Seat Heat/Cool", ["input_select", "select", "sensor"])}
            ${this._renderEntitySelect("seat_rl_entity", "Rear Left Seat Heat/Cool", ["input_select", "select", "sensor"])}
            ${this._renderEntitySelect("seat_rr_entity", "Rear Right Seat Heat/Cool", ["input_select", "select", "sensor"])}
            ${this._renderEntitySelect("profile_entity", "Driver Profile Entity", ["input_select", "select"])}

            <h4 class="section-header">Charging & Limits Overrides</h4>
            ${this._renderEntitySelect("ac_limit_entity", "AC Charge Limit", ["number", "input_number", "sensor"])}
            ${this._renderEntitySelect("dc_limit_entity", "DC Charge Limit", ["number", "input_number", "sensor"])}
            ${this._renderEntitySelect("ac_current_entity", "AC Charging Current", ["input_select", "select"])}
            ${this._renderEntitySelect("charge_time_entity", "Charge Time Remaining", ["sensor"])}

            <h4 class="section-header">Script & Service Overrides</h4>
            ${this._renderEntitySelect("start_climate_script", "Start Climate Script", ["script"])}
            ${this._renderEntitySelect("stop_climate_script", "Stop Climate Script", ["script"])}
            ${this._renderEntitySelect("save_profile_script", "Save Profile Script", ["script"])}
            <div class="option-row">
              <label class="label">Device ID (For Force Update / UVO)</label>
              <input class="input-text" .value=${this._config.device_id || ""} .configValue=${"device_id"} @input=${this._valueChanged} />
            </div>
          </div>
        </details>
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
      }
      .option-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .label {
        font-weight: 600;
        font-size: 0.9em;
        color: var(--primary-text-color);
      }
      .help-text {
        font-size: 0.75em;
        color: var(--secondary-text-color);
      }
      .input-text, .input-select {
        padding: 8px 12px;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #000);
        font-size: 0.9em;
        width: 100%;
        box-sizing: border-box;
      }
      .advanced-section {
        margin-top: 8px;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        padding: 8px 12px;
      }
      .advanced-section summary {
        font-weight: 600;
        cursor: pointer;
        color: var(--primary-color);
      }
      .details-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 10px;
      }
      .section-header {
        margin: 12px 0 4px 0;
        font-size: 0.85em;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color);
        border-bottom: 1px solid var(--divider-color);
        padding-bottom: 2px;
      }
    `;
  }
}

customElements.define("passable-vehicle-card", PassableVehicleCard);
customElements.define("passable-vehicle-card-editor", PassableVehicleCardEditor);
