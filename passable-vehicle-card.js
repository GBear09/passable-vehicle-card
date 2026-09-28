/**
 * Passable Vehicle Card
 * Version: 1.5.4
 * GitHub: https://github.com/GBear09/passable-vehicle-card
 * Description: A customizable, universal vehicle dashboard card for Home Assistant with native ha-entity-picker visual UI editor, custom drag-and-drop image upload, and entity auto-discovery.
 */

const CARD_VERSION = "1.5.4";

const DEFAULT_CLIMATE_PROFILES = [
  {
    id: "driver_1",
    name: "Driver 1",
    icon: "mdi:account",
    temp: 72,
    duration: 15,
    defrost: false,
    heating: 0,
    steering_wheel: 0,
    seats: { fl: 0, fr: 0, rl: 0, rr: 0 },
  },
  {
    id: "driver_2",
    name: "Driver 2",
    icon: "mdi:account",
    temp: 70,
    duration: 15,
    defrost: false,
    heating: 0,
    steering_wheel: 0,
    seats: { fl: 0, fr: 0, rl: 0, rr: 0 },
  },
];

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
  description: "A customizable, universal vehicle dashboard card for Home Assistant with entity auto-discovery and native visual UI picker.",
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
      _selectedProfileId: { type: String },
      _stagedTemp: { type: Number },
      _stagedDuration: { type: Number },
      _stagedDefrost: { type: Boolean },
      _stagedHeating: { type: Number },
      _stagedWheel: { type: Number },
      _stagedSeats: { type: Object },
    };
  }

  constructor() {
    super();
    this._currentView = "home";
    this._animDirection = "none";
    this._toastMsg = null;
    this._touchStartX = null;
    this._touchStartY = null;
    this._climateProfiles = DEFAULT_CLIMATE_PROFILES;
    this._selectedProfileId = null;
    this._stagedTemp = null;
    this._stagedDuration = null;
    this._stagedDefrost = null;
    this._stagedHeating = null;
    this._stagedWheel = null;
    this._stagedSeats = null;
    this._countdownTimer = null;
  }

  setConfig(config) {
    this.config = {
      title: config.title !== undefined ? config.title : (config.name !== undefined ? config.name : "My Vehicle"),
      subtitle: config.subtitle !== undefined ? config.subtitle : "",
      fuel_type: config.fuel_type || "ev", // 'ev', 'ice', 'hybrid'
      icon: config.icon || "mdi:car-electric",
      image: config.image || "",
      device_id: config.device_id || "",
      prefix: config.prefix || "",
      ...config,
    };

    if (Array.isArray(config.climate_profiles) && config.climate_profiles.length > 0) {
      this._climateProfiles = JSON.parse(JSON.stringify(config.climate_profiles));
    } else {
      let localProfiles = null;
      try {
        const stored = localStorage.getItem(`pvc_profiles_${this.config.entity || "vehicle"}`);
        if (stored) localProfiles = JSON.parse(stored);
      } catch (e) {}
      this._climateProfiles = localProfiles || DEFAULT_CLIMATE_PROFILES;
    }

    const currentProfileId = this._selectedProfileId || this._climateProfiles[0].id;
    const targetProfile = this._climateProfiles.find((p) => p.id === currentProfileId) || this._climateProfiles[0];
    this._selectProfile(targetProfile.id);
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
    if (this.config.device_id) return this.config.device_id;
    const primary = this.config.entity || this.config.battery_entity;
    if (primary && this.hass?.entities?.[primary]?.device_id) {
      return this.hass.entities[primary].device_id;
    }
    return "";
  }

  // --- HELPER: PROFILE SELECTION ---
  _selectProfile(profileId) {
    this._selectedProfileId = profileId;
    const p = (this._climateProfiles || []).find((pr) => pr.id === profileId) || this._climateProfiles[0];
    if (p) {
      this._stagedTemp = p.temp !== undefined ? p.temp : 72;
      this._stagedDuration = p.duration !== undefined ? p.duration : 15;
      this._stagedDefrost = !!p.defrost;
      this._stagedHeating = p.heating !== undefined ? p.heating : 0;
      this._stagedWheel = p.steering_wheel !== undefined ? p.steering_wheel : 0;
      this._stagedSeats = p.seats ? { ...p.seats } : { fl: 0, fr: 0, rl: 0, rr: 0 };
      this.requestUpdate();
    }
  }

  // --- HELPER: AUTO DISCOVERY SYSTEM ---
  _discoverEntities() {
    if (!this.hass || !this.hass.states) return {};

    const cfg = this.config || {};
    const allStates = Object.keys(this.hass.states);

    // Determine prefix candidates
    const prefixes = new Set();
    if (cfg.prefix) {
      const p = cfg.prefix.toLowerCase();
      prefixes.add(p);
      prefixes.add(`kia_${p}`);
      prefixes.add(`${p}_ev`);
    }

    const primaryEntity = cfg.entity || cfg.battery_entity || cfg.range_entity || cfg.lock_entity;
    if (primaryEntity) {
      const objectId = primaryEntity.split(".")[1] || "";
      const parts = objectId.split("_");
      if (parts.length > 0) {
        prefixes.add(parts[0]); // e.g. "ev9"
        prefixes.add(`kia_${parts[0]}`); // e.g. "kia_ev9"
        if (parts.length > 1) {
          prefixes.add(`${parts[0]}_${parts[1]}`); // e.g. "ev9_ev"
        }
      }
    }

    const entityPatterns = {
      battery: {
        domains: ["sensor"],
        patterns: ["ev_battery_level", "battery_level", "battery", "soc", "fuel_level", "fuel_percent"],
      },
      range: {
        domains: ["sensor"],
        patterns: ["ev_range", "range", "battery_range", "fuel_range", "remaining_range"],
      },
      charging: {
        domains: ["binary_sensor", "sensor"],
        patterns: ["ev_battery_charge", "charging_status", "is_charging", "battery_charging", "charging"],
      },
      plug: {
        domains: ["binary_sensor", "sensor"],
        patterns: ["ev_battery_plug", "plugged_in", "charge_port", "plug_status", "plug"],
      },
      lock: {
        domains: ["lock"],
        patterns: ["door_lock", "lock", "vehicle_lock"],
      },
      odometer: {
        domains: ["sensor"],
        patterns: ["odometer", "total_distance", "mileage"],
      },
      last_updated: {
        domains: ["sensor"],
        patterns: ["last_updated_at", "last_updated", "last_seen", "status_updated"],
      },
      charging_power: {
        domains: ["sensor"],
        patterns: ["ev_charging_power", "charging_power", "charger_power"],
      },
      tire_pressure: {
        domains: ["binary_sensor", "sensor"],
        patterns: ["tire_pressure_all", "tire_pressure", "tpms", "tire_pressure_warning"],
      },
      hood: {
        domains: ["binary_sensor"],
        patterns: ["hood", "hood_status", "engine_hood"],
      },
      trunk: {
        domains: ["binary_sensor"],
        patterns: ["trunk", "trunk_status", "tailgate", "boot"],
      },
      door_fl: {
        domains: ["binary_sensor"],
        patterns: ["front_left_door", "door_front_left", "door_fl", "driver_door"],
      },
      door_fr: {
        domains: ["binary_sensor"],
        patterns: ["front_right_door", "door_front_right", "door_fr", "passenger_door"],
      },
      door_rl: {
        domains: ["binary_sensor"],
        patterns: ["back_left_door", "rear_left_door", "door_back_left", "door_rear_left", "door_rl"],
      },
      door_rr: {
        domains: ["binary_sensor"],
        patterns: ["back_right_door", "rear_right_door", "door_back_right", "door_rear_right", "door_rr"],
      },
      hvac_active: {
        domains: ["binary_sensor", "climate", "switch", "sensor"],
        patterns: ["air_conditioner", "hvac", "climate", "climate_status", "air_conditioning"],
      },
      ac_limit: {
        domains: ["number"],
        patterns: ["ac_charging_limit", "ac_limit", "charge_limit_ac"],
      },
      dc_limit: {
        domains: ["number"],
        patterns: ["dc_charging_limit", "dc_limit", "charge_limit_dc"],
      },
      ac_current: {
        domains: ["input_select", "select"],
        patterns: ["ac_charging_current", "ac_current"],
      },
      charge_time: {
        domains: ["sensor"],
        patterns: ["estimated_charge_duration", "charge_time_remaining", "time_to_full"],
      },
    };

    const discovered = {};

    for (const [key, def] of Object.entries(entityPatterns)) {
      const configKey = key === "battery" ? "entity" : `${key}_entity`;
      if (cfg[configKey]) {
        discovered[key] = cfg[configKey];
        continue;
      }
      if (key === "battery" && cfg.battery_entity) {
        discovered[key] = cfg.battery_entity;
        continue;
      }
      if (key === "hvac_active" && (cfg.hvac_status_entity || cfg.hvac_active_entity)) {
        discovered[key] = cfg.hvac_status_entity || cfg.hvac_active_entity;
        continue;
      }

      const { domains, patterns } = def;
      let found = null;

      for (const pattern of patterns) {
        for (const prefix of prefixes) {
          found = allStates.find((id) => {
            const [domain, objId] = id.split(".");
            if (domains && !domains.includes(domain)) return false;
            return (
              objId === `${prefix}_${pattern}` ||
              objId === `${prefix}_ev_${pattern}` ||
              objId === `${prefix}_kia_${pattern}` ||
              objId === `kia_${prefix}_${pattern}` ||
              objId.includes(`${prefix}_${pattern}`) ||
              (objId.includes(pattern) && (objId.includes(prefix) || prefixes.size === 0))
            );
          });
          if (found) break;
        }
        if (found) break;

        found = allStates.find((id) => {
          const [domain, objId] = id.split(".");
          if (domains && !domains.includes(domain)) return false;
          return objId === pattern || objId.endsWith(`_${pattern}`);
        });
        if (found) break;
      }

      if (found) {
        discovered[key] = found;
      }
    }

    return discovered;
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
            ${this.config.title || titleIcon
              ? html`
                  <h1 class="title">
                    ${titleIcon
                      ? html`<ha-icon
                          icon="${titleIcon}"
                          style="margin-right: 8px; color: var(--primary-color)"
                        ></ha-icon>`
                      : ""}
                    ${this.config.title || ""}
                  </h1>
                `
              : ""}
            ${this.config.subtitle ? html`<p class="subtitle">${this.config.subtitle}</p>` : ""}
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

          ${doors.length > 0
            ? html`
                <div class="door-overlay top-left ${doorColorClass}">
                  <ha-icon icon="${doorIcon}"></ha-icon>
                  <span>${doorSummary}</span>
                </div>
              `
            : ""}

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

        ${entities.last_updated && this.hass.states[entities.last_updated]?.state
          ? html`
              <div class="last-updated-bar">
                <ha-icon icon="mdi:clock-outline"></ha-icon>
                Updated ${relativeTime}
              </div>
            `
          : ""}

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
    const profiles = this._climateProfiles || DEFAULT_CLIMATE_PROFILES;

    return html`
      <div class="view-container controls ${this._animDirection}">
        <div class="controls-header">
          <div class="profile-selector">
            ${profiles.map(
              (p) => html`
                <div
                  class="profile-chip ${p.id === this._selectedProfileId ? "active" : ""}"
                  @click=${() => this._selectProfile(p.id)}
                >
                  <ha-icon icon="${p.icon || "mdi:account"}"></ha-icon>
                  <span>${p.name}</span>
                </div>
              `
            )}
          </div>
        </div>
        <div class="divider"></div>

        <div class="interior-grid tight-gap">
          <div class="interior-row three-cols">
            <div class="interior-col">
              ${this._renderStagedWheel("Wheel")}
            </div>
            <div class="interior-col">
              ${this._renderStagedDefrost("Front")}
            </div>
            <div class="interior-col">
              ${this._renderStagedHeating("Rear")}
            </div>
          </div>

          <div class="interior-row three-cols">
            <div class="interior-col">
              ${this._renderStagedSeat("fl", "Driver")}
            </div>
            <div class="interior-col">
              ${this._renderStagedTempGauge("Temp", "°F", 60, 85)}
            </div>
            <div class="interior-col">
              ${this._renderStagedSeat("fr", "Pass.")}
            </div>
          </div>

          <div class="interior-row three-cols">
            <div class="interior-col">
              ${this._renderStagedSeat("rl", "Rear L")}
            </div>
            <div class="interior-col">
              ${this._renderStagedDurationGauge("Duration", "min", 5, 30, 5)}
            </div>
            <div class="interior-col">
              ${this._renderStagedSeat("rr", "Rear R")}
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
          <button
            class="action-btn save"
            title="Save current settings to active profile"
            @click=${() => this._saveCurrentToProfile()}
          >
            <ha-icon icon="mdi:content-save"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _renderStagedWheel(label = "Wheel") {
    const level = this._stagedWheel || 0;
    const isActive = level > 0;
    const dots = [];
    for (let i = 0; i < 3; i++) {
      dots.push(
        html`<div class="dot ${i < (level === 2 ? 3 : level) ? "dot-active-heat" : ""}"></div>`
      );
    }
    const stateText = level === 2 ? "HIGH" : level === 1 ? "LOW" : "OFF";

    return html`
      <div
        class="seat-widget small-widget ${isActive ? "heat" : "off"}"
        @click=${() => this._cycleWheel()}
      >
        <ha-icon icon="mdi:steering"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container">${dots}</div>
        <span class="seat-state">${stateText}</span>
      </div>
    `;
  }

  _cycleWheel() {
    let next = 0;
    if (this._stagedWheel === 0) next = 1;
    else if (this._stagedWheel === 1) next = 2;
    else next = 0;
    this._stagedWheel = next;
    this.requestUpdate();
  }

  _renderStagedDefrost(label = "Front") {
    const isActive = !!this._stagedDefrost;
    return html`
      <div
        class="seat-widget small-widget ${isActive ? "heat" : "off"}"
        @click=${() => {
          this._stagedDefrost = !this._stagedDefrost;
          this.requestUpdate();
        }}
      >
        <ha-icon icon="mdi:car-defrost-front"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container"><div class="dot-spacer"></div></div>
        <span class="seat-state">${isActive ? "ON" : "OFF"}</span>
      </div>
    `;
  }

  _renderStagedHeating(label = "Rear") {
    const isActive = (this._stagedHeating || 0) > 0;
    return html`
      <div
        class="seat-widget small-widget ${isActive ? "heat" : "off"}"
        @click=${() => {
          this._stagedHeating = isActive ? 0 : 4;
          this.requestUpdate();
        }}
      >
        <ha-icon icon="mdi:car-defrost-rear"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container"><div class="dot-spacer"></div></div>
        <span class="seat-state">${isActive ? "ON" : "OFF"}</span>
      </div>
    `;
  }

  _renderStagedSeat(seatKey, label) {
    const level = (this._stagedSeats && this._stagedSeats[seatKey]) || 0;
    let mode = "off";
    let dotCount = 0;
    let stateText = "OFF";

    if (level >= 3 && level <= 5) {
      mode = "cool";
      dotCount = level - 2;
      stateText = dotCount === 3 ? "COOL HIGH" : dotCount === 2 ? "COOL MID" : "COOL LOW";
    } else if (level >= 6 && level <= 8) {
      mode = "heat";
      dotCount = level - 5;
      stateText = dotCount === 3 ? "HEAT HIGH" : dotCount === 2 ? "HEAT MID" : "HEAT LOW";
    }

    const dots = [];
    for (let i = 0; i < 3; i++) {
      const dotClass =
        i < dotCount
          ? mode === "heat"
            ? "dot-active-heat"
            : "dot-active-cool"
          : "";
      dots.push(html`<div class="dot ${dotClass}"></div>`);
    }

    let seatIcon = "mdi:car-seat";
    if (mode === "heat") {
      seatIcon = "mdi:car-seat-heater";
    } else if (mode === "cool") {
      seatIcon = "mdi:car-seat-cooler";
    }

    return html`
      <div
        class="seat-widget ${mode}"
        @click=${() => this._cycleSeat(seatKey)}
      >
        <ha-icon icon="${seatIcon}"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container">${dots}</div>
        <span class="seat-state">${stateText}</span>
      </div>
    `;
  }

  _cycleSeat(seatKey) {
    const levels = [0, 6, 7, 8, 3, 4, 5];
    const current = (this._stagedSeats && this._stagedSeats[seatKey]) || 0;
    const idx = levels.indexOf(current);
    const next = levels[(idx + 1) % levels.length];
    this._stagedSeats = {
      ...(this._stagedSeats || {}),
      [seatKey]: next,
    };
    this.requestUpdate();
  }

  _renderStagedTempGauge(label = "Temp", unit = "°F", min = 60, max = 85) {
    const val = this._stagedTemp || 72;
    const radius = 34;
    const circ = 2 * Math.PI * radius;
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
    const offset = circ - ratio * circ;
    const color = this._getTempColor(val);

    return html`
      <div class="gauge-control" style="width: 80px; height: 80px;">
        <div
          class="gauge-btn minus"
          @click=${() => {
            this._stagedTemp = Math.max(min, val - 1);
            this.requestUpdate();
          }}
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
            <span class="gauge-val" style="color: ${color}">${Math.round(val)}</span>
            <span class="gauge-unit">${unit}</span>
          </div>
          <div class="gauge-label">${label}</div>
        </div>

        <div
          class="gauge-btn plus"
          @click=${() => {
            this._stagedTemp = Math.min(max, val + 1);
            this.requestUpdate();
          }}
        >
          <ha-icon icon="mdi:plus"></ha-icon>
        </div>
      </div>
    `;
  }

  _renderStagedDurationGauge(label = "Duration", unit = "min", min = 5, max = 30, step = 5) {
    const val = this._stagedDuration || 15;
    const radius = 34;
    const circ = 2 * Math.PI * radius;
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
    const offset = circ - ratio * circ;
    const color = "var(--primary-color)";

    return html`
      <div class="gauge-control" style="width: 80px; height: 80px;">
        <div
          class="gauge-btn minus"
          @click=${() => {
            this._stagedDuration = Math.max(min, val - step);
            this.requestUpdate();
          }}
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
            <span class="gauge-val" style="color: ${color}">${Math.round(val)}</span>
            <span class="gauge-unit">${unit}</span>
          </div>
          <div class="gauge-label">${label}</div>
        </div>

        <div
          class="gauge-btn plus"
          @click=${() => {
            this._stagedDuration = Math.min(max, val + step);
            this.requestUpdate();
          }}
        >
          <ha-icon icon="mdi:plus"></ha-icon>
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

  async _handleClimateStart(entities) {
    const deviceId = this._getDeviceId();

    if (this.config.start_climate_service || this.config.start_climate_script) {
      const target = this.config.start_climate_service || this.config.start_climate_script;
      const [domain, service] = target.split(".");
      await this.hass.callService(domain, service, {
        device_id: deviceId || undefined,
        temperature: this._stagedTemp,
        duration: this._stagedDuration,
        climate: true,
        defrost: this._stagedDefrost,
        heating: this._stagedHeating,
        steering_wheel: this._stagedWheel,
        flseat: this._stagedSeats.fl,
        frseat: this._stagedSeats.fr,
        rlseat: this._stagedSeats.rl,
        rrseat: this._stagedSeats.rr,
      });
      this._showToast("Climate Started. Confirming in 20s...");
      this._startPostClimateCountdown();
      return;
    }

    if (this.hass.services?.kia_uvo?.start_climate) {
      try {
        await this.hass.callService("kia_uvo", "start_climate", {
          device_id: deviceId || undefined,
          temperature: this._stagedTemp,
          duration: this._stagedDuration,
          climate: true,
          defrost: this._stagedDefrost,
          heating: this._stagedHeating,
          steering_wheel: this._stagedWheel,
          flseat: this._stagedSeats.fl,
          frseat: this._stagedSeats.fr,
          rlseat: this._stagedSeats.rl,
          rrseat: this._stagedSeats.rr,
        });
        this._showToast("Climate Started. Confirming in 20s...");
        this._startPostClimateCountdown();
      } catch (err) {
        this._showToast("Error starting climate: " + (err.message || err));
      }
      return;
    }

    if (entities.hvac_active && entities.hvac_active.startsWith("climate.")) {
      await this.hass.callService("climate", "set_temperature", {
        entity_id: entities.hvac_active,
        temperature: this._stagedTemp,
      });
      await this.hass.callService("climate", "set_hvac_mode", {
        entity_id: entities.hvac_active,
        hvac_mode: "heat_cool",
      });
      this._showToast("Climate Started");
      return;
    }

    this._showToast("No climate service configured");
  }

  async _handleClimateStop(entities) {
    const deviceId = this._getDeviceId();
    if (this.config.stop_climate_service || this.config.stop_climate_script) {
      const target = this.config.stop_climate_service || this.config.stop_climate_script;
      const [domain, service] = target.split(".");
      await this.hass.callService(domain, service, deviceId ? { device_id: deviceId } : {});
      this._showToast("Climate Stopped. Confirming in 20s...");
      this._startPostClimateCountdown();
      return;
    }

    if (this.hass.services?.kia_uvo?.stop_climate) {
      await this.hass.callService("kia_uvo", "stop_climate", deviceId ? { device_id: deviceId } : {});
      this._showToast("Climate Stopped. Confirming in 20s...");
      this._startPostClimateCountdown();
      return;
    }

    if (entities.hvac_active && entities.hvac_active.startsWith("climate.")) {
      await this.hass.callService("climate", "set_hvac_mode", {
        entity_id: entities.hvac_active,
        hvac_mode: "off",
      });
      this._showToast("Climate Stopped");
      return;
    }

    this._showToast("No climate stop service configured");
  }

  async _saveCurrentToProfile() {
    const profile = (this._climateProfiles || []).find((p) => p.id === this._selectedProfileId);
    if (!profile) return;

    profile.temp = this._stagedTemp;
    profile.duration = this._stagedDuration;
    profile.defrost = this._stagedDefrost;
    profile.heating = this._stagedHeating;
    profile.steering_wheel = this._stagedWheel;
    profile.seats = { ...(this._stagedSeats || { fl: 0, fr: 0, rl: 0, rr: 0 }) };

    this.config = {
      ...this.config,
      climate_profiles: JSON.parse(JSON.stringify(this._climateProfiles)),
    };

    try {
      localStorage.setItem(`pvc_profiles_${this.config.entity || "vehicle"}`, JSON.stringify(this._climateProfiles));
    } catch (e) {}

    let saved = false;
    try {
      saved = await this._saveConfigToLovelace();
    } catch (e) {
      console.warn("Could not save to Lovelace dashboard config:", e);
    }

    if (saved) {
      this._showToast(`Saved settings to "${profile.name}"`);
    } else {
      this._showToast(`Saved "${profile.name}" (local)`);
    }
  }

  async _saveConfigToLovelace() {
    if (!this.hass || !this.hass.callWS) return false;

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    let urlPath = null;
    if (pathParts.length > 0 && pathParts[0] !== "lovelace" && pathParts[0] !== "config") {
      urlPath = pathParts[0];
    }

    let dashboardConfig = null;
    try {
      dashboardConfig = await this.hass.callWS({
        type: "lovelace/config",
        url_path: urlPath,
      });
    } catch (e) {
      if (urlPath !== null) {
        try {
          dashboardConfig = await this.hass.callWS({
            type: "lovelace/config",
            url_path: null,
          });
          urlPath = null;
        } catch (e2) {}
      }
    }
    if (!dashboardConfig || !dashboardConfig.views) return false;

    let cardFound = false;
    const updateCard = (card) => {
      if (!card || cardFound) return card;
      const cardType = card.type || "";
      const isMatch =
        (cardType === "custom:passable-vehicle-card" || cardType === "passable-vehicle-card") &&
        (card.entity === this.config.entity ||
          card.battery_entity === this.config.battery_entity ||
          card.title === this.config.title ||
          (!card.entity && !this.config.entity));

      if (isMatch) {
        cardFound = true;
        return {
          ...card,
          climate_profiles: JSON.parse(JSON.stringify(this._climateProfiles)),
        };
      }
      if (card.cards && Array.isArray(card.cards)) {
        return { ...card, cards: card.cards.map(updateCard) };
      }
      if (card.card && typeof card.card === "object") {
        return { ...card, card: updateCard(card.card) };
      }
      return card;
    };

    const newViews = dashboardConfig.views.map((view) => {
      let updatedView = { ...view };
      if (updatedView.cards && Array.isArray(updatedView.cards)) {
        updatedView.cards = updatedView.cards.map(updateCard);
      }
      if (updatedView.sections && Array.isArray(updatedView.sections)) {
        updatedView.sections = updatedView.sections.map((section) => {
          if (!section.cards || !Array.isArray(section.cards)) return section;
          return {
            ...section,
            cards: section.cards.map(updateCard),
          };
        });
      }
      return updatedView;
    });

    if (!cardFound) return false;

    await this.hass.callWS({
      type: "lovelace/config/save",
      url_path: urlPath,
      config: { ...dashboardConfig, views: newViews },
    });

    return true;
  }

  _startPostClimateCountdown() {
    let seconds = 20;
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(this._countdownTimer);
        this._countdownTimer = null;
        this._forceUpdate();
      }
    }, 1000);
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
        this._showToast("Vehicle Status Refreshed");
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

// Custom Card Visual Editor Component with Native HA-Entity-Picker Integration
class PassableVehicleCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: {},
      _uploading: { type: Boolean },
      _uploadError: { type: String },
      _isDragging: { type: Boolean },
    };
  }

  constructor() {
    super();
    this._uploading = false;
    this._uploadError = "";
    this._isDragging = false;
  }

  setConfig(config) {
    this._config = config || {};
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const configValue = target.configValue || target.getAttribute("configValue");
    if (!configValue) return;

    const value = ev.detail && ev.detail.value !== undefined ? ev.detail.value : target.value;

    if (this._config[configValue] === value) return;

    let newConfig = { ...this._config };
    if (configValue === "subtitle" || configValue === "title") {
      newConfig[configValue] = value || "";
    } else if (value === "" || value === undefined || value === null) {
      delete newConfig[configValue];
    } else {
      newConfig[configValue] = value;
    }

    if (configValue === "image") {
      this._uploadError = "";
    }

    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
  }

  _setImage(url) {
    if (!this._config) return;
    let newConfig = { ...this._config };
    if (!url) {
      delete newConfig.image;
    } else {
      newConfig.image = url;
    }
    this._uploadError = "";
    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
    this.requestUpdate();
  }

  _removeImage(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    this._setImage("");
  }

  _handleDragOver(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer) {
      ev.dataTransfer.dropEffect = "copy";
    }
    if (!this._isDragging) {
      this._isDragging = true;
      this.requestUpdate();
    }
  }

  _handleDragLeave(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.currentTarget && ev.currentTarget.contains(ev.relatedTarget)) {
      return;
    }
    this._isDragging = false;
    this.requestUpdate();
  }

  async _handleDrop(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this._isDragging = false;
    this.requestUpdate();

    const dt = ev.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      await this._uploadFile(dt.files[0]);
    }
  }

  _openFilePicker(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const fileInput = this.shadowRoot && this.shadowRoot.getElementById("car-image-file-input");
    if (fileInput) {
      fileInput.click();
    }
  }

  async _handleFileInputChange(ev) {
    const files = ev.target && ev.target.files;
    if (files && files.length > 0) {
      await this._uploadFile(files[0]);
    }
    if (ev.target) {
      ev.target.value = "";
    }
  }

  async _uploadFile(file) {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      this._uploadError = "Please select a valid image file (PNG, JPG, SVG, WebP).";
      this.requestUpdate();
      return;
    }

    if (!this.hass) {
      this._uploadError = "Home Assistant connection unavailable.";
      this.requestUpdate();
      return;
    }

    this._uploading = true;
    this._uploadError = "";
    this.requestUpdate();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await this.hass.fetchWithAuth("/api/image/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status} ${res.statusText}): ${errorText || "Server error"}`);
      }

      const data = await res.json();
      if (data && data.id) {
        const imageUrl = `/api/image/serve/${data.id}/original`;
        this._setImage(imageUrl);
      } else {
        throw new Error("Invalid response received from Home Assistant image service.");
      }
    } catch (err) {
      console.error("Passable Vehicle Card image upload failed:", err);
      this._uploadError = err.message || "Failed to upload image. Please try again.";
    } finally {
      this._uploading = false;
      this.requestUpdate();
    }
  }

  _renderImageUploader() {
    const hasImage = Boolean(this._config && this._config.image);

    return html`
      <div class="option-row">
        <label class="label">Vehicle Image (Drag & Drop or Browse)</label>

        <input
          type="file"
          id="car-image-file-input"
          accept="image/*"
          style="display: none;"
          @change=${this._handleFileInputChange}
        />

        <div
          class="image-dropzone ${this._isDragging ? "dragging" : ""} ${hasImage ? "has-image" : ""}"
          @dragover=${this._handleDragOver}
          @dragleave=${this._handleDragLeave}
          @drop=${this._handleDrop}
          @click=${!hasImage && !this._uploading ? this._openFilePicker : null}
        >
          ${this._uploading
            ? html`
                <div class="dropzone-status">
                  <div class="spinner"></div>
                  <div class="dropzone-text">Uploading image to Home Assistant...</div>
                </div>
              `
            : hasImage
            ? html`
                <div class="dropzone-preview-content">
                  <div class="preview-img-container">
                    <img
                      src="${this._config.image}"
                      alt="Vehicle preview"
                      class="preview-img"
                    />
                  </div>
                  <div class="preview-actions">
                    <button
                      type="button"
                      class="btn-preview-action"
                      @click=${this._openFilePicker}
                    >
                      <ha-icon icon="mdi:camera-retake"></ha-icon>
                      <span>Change Image</span>
                    </button>
                    <button
                      type="button"
                      class="btn-preview-action delete"
                      @click=${this._removeImage}
                    >
                      <ha-icon icon="mdi:delete-outline"></ha-icon>
                      <span>Remove</span>
                    </button>
                  </div>
                  <div class="dropzone-subhint">
                    Drag & drop a new file here to replace, or click Change Image
                  </div>
                </div>
              `
            : html`
                <div class="dropzone-empty-content">
                  <ha-icon icon="mdi:cloud-upload" class="upload-icon"></ha-icon>
                  <div class="dropzone-title">Drag & drop your vehicle image here</div>
                  <div class="dropzone-hint">
                    or <span class="browse-link">click to browse</span> from your device
                  </div>
                  <div class="dropzone-formats">Supports PNG, JPG, WebP, SVG</div>
                </div>
              `}
        </div>

        ${this._uploadError
          ? html`
              <div class="upload-error-msg">
                <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
                <span>${this._uploadError}</span>
              </div>
            `
          : ""}

        <details class="manual-url-accordion">
          <summary>Or enter direct path / web URL</summary>
          <div class="manual-url-input-container">
            <input
              class="input-text"
              .value=${(this._config && this._config.image) || ""}
              .configValue=${"image"}
              @input=${this._valueChanged}
              placeholder="/local/images/ev9.png or https://..."
            />
          </div>
        </details>
      </div>
    `;
  }

  _renderEntityPicker(configValue, label, domainFilter = null, helpText = "") {
    const currentValue = this._config[configValue] || "";

    return html`
      <div class="option-row">
        <ha-entity-picker
          .hass=${this.hass}
          .value=${currentValue}
          .configValue=${configValue}
          .label=${label}
          .includeDomains=${domainFilter}
          @value-changed=${this._valueChanged}
          allow-custom-entity
        ></ha-entity-picker>
        ${helpText ? html`<span class="help-text">${helpText}</span>` : ""}
      </div>
    `;
  }

  _addProfile() {
    const profiles = [
      ...(this._config.climate_profiles || DEFAULT_CLIMATE_PROFILES),
    ];
    const num = profiles.length + 1;
    const newProfile = {
      id: `profile_${Date.now()}`,
      name: `Driver ${num}`,
      icon: "mdi:account",
      temp: 72,
      duration: 15,
      defrost: false,
      heating: 0,
      steering_wheel: 0,
      seats: { fl: 0, fr: 0, rl: 0, rr: 0 },
    };
    profiles.push(newProfile);
    this._updateProfiles(profiles);
  }

  _deleteProfile(index) {
    const profiles = [
      ...(this._config.climate_profiles || DEFAULT_CLIMATE_PROFILES),
    ];
    if (profiles.length <= 1) return;
    profiles.splice(index, 1);
    this._updateProfiles(profiles);
  }

  _updateProfileField(index, field, value) {
    const profiles = [
      ...(this._config.climate_profiles || DEFAULT_CLIMATE_PROFILES),
    ];
    if (!profiles[index]) return;

    if (field.startsWith("seats.")) {
      const seatKey = field.split(".")[1];
      profiles[index] = {
        ...profiles[index],
        seats: {
          ...(profiles[index].seats || { fl: 0, fr: 0, rl: 0, rr: 0 }),
          [seatKey]: parseInt(value) || 0,
        },
      };
    } else if (
      field === "temp" ||
      field === "duration" ||
      field === "steering_wheel" ||
      field === "heating"
    ) {
      profiles[index] = {
        ...profiles[index],
        [field]: Number(value),
      };
    } else if (field === "defrost") {
      profiles[index] = {
        ...profiles[index],
        [field]: Boolean(value),
      };
    } else {
      profiles[index] = {
        ...profiles[index],
        [field]: value,
      };
    }
    this._updateProfiles(profiles);
  }

  _updateProfiles(profiles) {
    this._config = {
      ...this._config,
      climate_profiles: profiles,
    };
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: this._config } })
    );
    this.requestUpdate();
  }

  render() {
    if (!this.hass) return html``;
    const profiles = this._config.climate_profiles || DEFAULT_CLIMATE_PROFILES;

    return html`
      <div class="card-config">
        <div class="option-row">
          <label class="label">Vehicle Title</label>
          <input
            class="input-text"
            .value=${this._config.title !== undefined ? this._config.title : ""}
            .configValue=${"title"}
            @input=${this._valueChanged}
            placeholder="My Vehicle (or leave blank)"
          />
        </div>

        <div class="option-row">
          <label class="label">Subtitle</label>
          <input
            class="input-text"
            .value=${this._config.subtitle !== undefined ? this._config.subtitle : ""}
            .configValue=${"subtitle"}
            @input=${this._valueChanged}
            placeholder="Optional subtitle (leave blank for none)"
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

        ${this._renderEntityPicker(
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

        ${this._renderImageUploader()}

        <!-- CLIMATE PROFILES SECTION -->
        <div class="profiles-section">
          <div class="section-header-row">
            <h4 class="section-header" style="margin: 0; border: none;">Climate Presets & Profiles</h4>
            <button type="button" class="btn-add" @click=${this._addProfile}>+ Add Profile</button>
          </div>
          <span class="help-text">Configure driver presets. You can rename profiles (e.g. Megan, Myles), set defaults for temp, seats, wheel, and defrost.</span>

          <div class="profiles-list">
            ${profiles.map(
              (p, idx) => html`
                <div class="profile-card">
                  <div class="profile-card-top">
                    <div class="profile-name-group">
                      <label class="sub-label">Profile Name</label>
                      <input
                        class="input-text"
                        .value=${p.name || ""}
                        @input=${(e) => this._updateProfileField(idx, "name", e.target.value)}
                        placeholder="Driver Name"
                      />
                    </div>
                    <div class="profile-icon-group">
                      <label class="sub-label">Icon</label>
                      <input
                        class="input-text"
                        .value=${p.icon || "mdi:account"}
                        @input=${(e) => this._updateProfileField(idx, "icon", e.target.value)}
                        placeholder="mdi:account"
                      />
                    </div>
                    ${profiles.length > 1
                      ? html`
                          <button
                            type="button"
                            class="btn-delete"
                            title="Delete Profile"
                            @click=${() => this._deleteProfile(idx)}
                          >
                            <ha-icon icon="mdi:delete-outline"></ha-icon>
                          </button>
                        `
                      : ""}
                  </div>

                  <div class="profile-settings-grid">
                    <div class="sub-col">
                      <label class="sub-label">Default Temp (°F)</label>
                      <input
                        type="number"
                        class="input-text"
                        min="60"
                        max="85"
                        .value=${p.temp || 72}
                        @change=${(e) => this._updateProfileField(idx, "temp", e.target.value)}
                      />
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Duration (min)</label>
                      <input
                        type="number"
                        class="input-text"
                        min="5"
                        max="30"
                        step="5"
                        .value=${p.duration || 15}
                        @change=${(e) => this._updateProfileField(idx, "duration", e.target.value)}
                      />
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Steering Wheel</label>
                      <select
                        class="input-select"
                        .value=${String(p.steering_wheel || 0)}
                        @change=${(e) => this._updateProfileField(idx, "steering_wheel", e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="1">Low</option>
                        <option value="2">High</option>
                      </select>
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Front Defrost</label>
                      <select
                        class="input-select"
                        .value=${p.defrost ? "true" : "false"}
                        @change=${(e) => this._updateProfileField(idx, "defrost", e.target.value === "true")}
                      >
                        <option value="false">Off</option>
                        <option value="true">On</option>
                      </select>
                    </div>
                  </div>

                  <div class="profile-seats-grid">
                    <div class="sub-col">
                      <label class="sub-label">Driver Seat (FL)</label>
                      <select
                        class="input-select"
                        .value=${String(p.seats?.fl || 0)}
                        @change=${(e) => this._updateProfileField(idx, "seats.fl", e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="3">Cool Low</option>
                        <option value="4">Cool Mid</option>
                        <option value="5">Cool High</option>
                        <option value="6">Heat Low</option>
                        <option value="7">Heat Mid</option>
                        <option value="8">Heat High</option>
                      </select>
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Pass. Seat (FR)</label>
                      <select
                        class="input-select"
                        .value=${String(p.seats?.fr || 0)}
                        @change=${(e) => this._updateProfileField(idx, "seats.fr", e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="3">Cool Low</option>
                        <option value="4">Cool Mid</option>
                        <option value="5">Cool High</option>
                        <option value="6">Heat Low</option>
                        <option value="7">Heat Mid</option>
                        <option value="8">Heat High</option>
                      </select>
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Rear L Seat</label>
                      <select
                        class="input-select"
                        .value=${String(p.seats?.rl || 0)}
                        @change=${(e) => this._updateProfileField(idx, "seats.rl", e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="3">Cool Low</option>
                        <option value="4">Cool Mid</option>
                        <option value="5">Cool High</option>
                        <option value="6">Heat Low</option>
                        <option value="7">Heat Mid</option>
                        <option value="8">Heat High</option>
                      </select>
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Rear R Seat</label>
                      <select
                        class="input-select"
                        .value=${String(p.seats?.rr || 0)}
                        @change=${(e) => this._updateProfileField(idx, "seats.rr", e.target.value)}
                      >
                        <option value="0">Off</option>
                        <option value="3">Cool Low</option>
                        <option value="4">Cool Mid</option>
                        <option value="5">Cool High</option>
                        <option value="6">Heat Low</option>
                        <option value="7">Heat Mid</option>
                        <option value="8">Heat High</option>
                      </select>
                    </div>
                  </div>
                </div>
              `
            )}
          </div>
        </div>

        <details class="advanced-section">
          <summary>Advanced Entity Overrides</summary>
          <div class="details-content">
            <h4 class="section-header">Status & Sensor Overrides</h4>
            ${this._renderEntityPicker("range_entity", "Remaining Range", ["sensor"])}
            ${this._renderEntityPicker("lock_entity", "Vehicle Lock", ["lock"])}
            ${this._renderEntityPicker("charging_entity", "Charging Status", ["binary_sensor", "sensor"])}
            ${this._renderEntityPicker("plug_entity", "Plug Status", ["binary_sensor", "sensor"])}
            ${this._renderEntityPicker("odometer_entity", "Odometer", ["sensor"])}
            ${this._renderEntityPicker("tire_pressure_entity", "Tire Pressure Warning", ["binary_sensor", "sensor"])}
            ${this._renderEntityPicker("last_updated_entity", "Last Update Timestamp", ["sensor"])}
            ${this._renderEntityPicker("charging_power_entity", "Charging Power (kW)", ["sensor"])}

            <h4 class="section-header">Doors & Hatch Overrides</h4>
            ${this._renderEntityPicker("hood_entity", "Hood Status", ["binary_sensor"])}
            ${this._renderEntityPicker("trunk_entity", "Trunk / Tailgate Status", ["binary_sensor"])}
            ${this._renderEntityPicker("door_fl_entity", "Front Left Door", ["binary_sensor"])}
            ${this._renderEntityPicker("door_fr_entity", "Front Right Door", ["binary_sensor"])}
            ${this._renderEntityPicker("door_rl_entity", "Rear Left Door", ["binary_sensor"])}
            ${this._renderEntityPicker("door_rr_entity", "Rear Right Door", ["binary_sensor"])}

            <h4 class="section-header">Climate & Comfort Overrides</h4>
            ${this._renderEntityPicker("hvac_status_entity", "HVAC / Air Conditioner Active Status", ["binary_sensor", "climate", "switch", "sensor"])}

            <h4 class="section-header">Charging & Limits Overrides</h4>
            ${this._renderEntityPicker("ac_limit_entity", "AC Charge Limit", ["number"])}
            ${this._renderEntityPicker("dc_limit_entity", "DC Charge Limit", ["number"])}
            ${this._renderEntityPicker("ac_current_entity", "AC Charging Current", ["input_select", "select"])}
            ${this._renderEntityPicker("charge_time_entity", "Charge Time Remaining", ["sensor"])}

            <h4 class="section-header">Integration & Service Overrides</h4>
            <div class="option-row">
              <label class="label">Device ID (For Kia UVO / Force Update)</label>
              <input class="input-text" .value=${this._config.device_id || ""} .configValue=${"device_id"} @input=${this._valueChanged} placeholder="Auto-detected if left blank" />
            </div>
            ${this._renderEntityPicker("start_climate_service", "Custom Start Climate Service / Script (Optional)", ["script"])}
            ${this._renderEntityPicker("stop_climate_service", "Custom Stop Climate Service / Script (Optional)", ["script"])}
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
      ha-entity-picker {
        width: 100%;
        display: block;
      }
      /* Custom Image Dropzone */
      .image-dropzone {
        border: 2px dashed var(--divider-color, #ccc);
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        background: var(--card-background-color, #fafafa);
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        position: relative;
        min-height: 110px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .image-dropzone:hover {
        border-color: var(--primary-color, #2196f3);
        background: rgba(33, 150, 243, 0.04);
      }
      .image-dropzone.dragging {
        border-color: var(--primary-color, #2196f3);
        border-style: solid;
        background: rgba(33, 150, 243, 0.12);
        box-shadow: 0 0 10px rgba(33, 150, 243, 0.2);
      }
      .image-dropzone.has-image {
        cursor: default;
        padding: 12px;
      }
      .dropzone-empty-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .dropzone-empty-content * {
        pointer-events: none;
      }
      .upload-icon {
        --mdc-icon-size: 36px;
        color: var(--primary-color, #2196f3);
      }
      .dropzone-title {
        font-weight: 600;
        font-size: 0.9em;
        color: var(--primary-text-color, #333);
      }
      .dropzone-hint {
        font-size: 0.78em;
        color: var(--secondary-text-color, #666);
      }
      .browse-link {
        color: var(--primary-color, #2196f3);
        text-decoration: underline;
        font-weight: 600;
      }
      .dropzone-formats {
        font-size: 0.7em;
        color: var(--secondary-text-color, #888);
      }
      .dropzone-preview-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        gap: 10px;
      }
      .preview-img-container {
        max-width: 100%;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.03));
        border-radius: 6px;
        padding: 8px;
        box-sizing: border-box;
      }
      .preview-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .preview-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      .btn-preview-action {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--secondary-background-color, #eee);
        color: var(--primary-text-color, #333);
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 0.8em;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
      }
      .btn-preview-action:hover {
        background: var(--primary-color, #2196f3);
        color: #fff;
        border-color: var(--primary-color, #2196f3);
      }
      .btn-preview-action.delete:hover {
        background: var(--error-color, #f44336);
        color: #fff;
        border-color: var(--error-color, #f44336);
      }
      .btn-preview-action ha-icon {
        --mdc-icon-size: 16px;
      }
      .dropzone-subhint {
        font-size: 0.72em;
        color: var(--secondary-text-color, #777);
      }
      .dropzone-status {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 12px;
      }
      .spinner {
        width: 28px;
        height: 28px;
        border: 3px solid rgba(33, 150, 243, 0.2);
        border-top-color: var(--primary-color, #2196f3);
        border-radius: 50%;
        animation: dropzone-spin 0.8s linear infinite;
      }
      @keyframes dropzone-spin {
        to { transform: rotate(360deg); }
      }
      .upload-error-msg {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        color: var(--error-color, #f44336);
        font-size: 0.8em;
        font-weight: 500;
      }
      .upload-error-msg ha-icon {
        --mdc-icon-size: 16px;
      }
      .manual-url-accordion {
        margin-top: 6px;
      }
      .manual-url-accordion summary {
        font-size: 0.75em;
        color: var(--secondary-text-color, #666);
        cursor: pointer;
        outline: none;
      }
      .manual-url-accordion summary:hover {
        color: var(--primary-color, #2196f3);
      }
      .manual-url-input-container {
        margin-top: 6px;
      }
      .profiles-section {
        margin-top: 12px;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 8px;
        padding: 12px;
        background: var(--secondary-background-color, #fafafa);
      }
      .section-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .btn-add {
        background: var(--primary-color, #2196f3);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 0.8em;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .profile-card {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        padding: 10px;
        margin-top: 10px;
        background: var(--card-background-color, #fff);
      }
      .profile-card-top {
        display: flex;
        gap: 10px;
        align-items: flex-end;
      }
      .profile-name-group {
        flex: 2;
      }
      .profile-icon-group {
        flex: 1;
      }
      .btn-delete {
        background: transparent;
        color: var(--error-color, #f44336);
        border: 1px solid var(--error-color, #f44336);
        border-radius: 6px;
        padding: 6px 8px;
        cursor: pointer;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .profile-settings-grid, .profile-seats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .sub-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sub-label {
        font-size: 0.75em;
        font-weight: 500;
        color: var(--secondary-text-color, #666);
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
