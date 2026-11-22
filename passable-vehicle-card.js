/**
 * Passable Vehicle Card
 * Version: 2.1.4
 * GitHub: https://github.com/GBear09/passable-vehicle-card
 *
 * Compact summary dashboard card with a 4-tab Command Center popup (Overview, Climate,
 * Charge/Fuel, Health & Doors) aligned with Passable HVAC and Smart Lighting cards.
 * Supports Hero & Dual-Ring summary layouts, multi-vehicle configurations, optional
 * 24h battery sparkline, direct climate/EVSE controls, interactive Home/Away map, and drag-and-drop image upload.
 */

const CARD_VERSION = "2.1.4";

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

const VEHICLE_TABS_EV = [
  { id: "overview", label: "Overview", icon: "mdi:car-info" },
  { id: "controls", label: "Climate", icon: "mdi:fan" },
  { id: "charging", label: "Charge", icon: "mdi:lightning-bolt" },
  { id: "health", label: "Health", icon: "mdi:shield-car" },
];

const VEHICLE_TABS_ICE = [
  { id: "overview", label: "Overview", icon: "mdi:car-info" },
  { id: "controls", label: "Climate", icon: "mdi:fan" },
  { id: "charging", label: "Fuel", icon: "mdi:gas-station" },
  { id: "health", label: "Health", icon: "mdi:shield-car" },
];

const PER_VEHICLE_ENTITY_KEYS = [
  "entity",
  "battery_entity",
  "range_entity",
  "charging_entity",
  "plug_entity",
  "lock_entity",
  "odometer_entity",
  "last_updated_entity",
  "charging_power_entity",
  "evse_power_entity",
  "tire_pressure_entity",
  "hood_entity",
  "trunk_entity",
  "door_fl_entity",
  "door_fr_entity",
  "door_rl_entity",
  "door_rr_entity",
  "sunroof_entity",
  "engine_entity",
  "hvac_status_entity",
  "hvac_active_entity",
  "climate_temp_entity",
  "defrost_status_entity",
  "wheel_heater_status_entity",
  "rear_heater_status_entity",
  "ac_limit_entity",
  "dc_limit_entity",
  "ac_current_entity",
  "evse_current_entity",
  "evse_charge_current_entity",
  "charge_time_entity",
  "charging_switch_entity",
  "location_entity",
  "aux_battery_entity",
  "next_service_entity",
  "dtc_count_entity",
  "washer_fluid_entity",
  "key_battery_entity",
  "force_refresh_entity",
  "device_id",
  "start_climate_service",
  "start_climate_script",
  "stop_climate_service",
  "stop_climate_script",
  "start_charge_service",
  "stop_charge_service",
  "force_update_service",
];

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace") ||
    customElements.get("hui-entities-card") ||
    customElements.get("hui-masonry-view") ||
    customElements.get("hc-main")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;
const svg =
  LitElement.prototype.svg ||
  ((strings, ...values) => {
    const result = html(strings, ...values);
    if (result && typeof result === "object") {
      return Object.assign({}, result, { _$litType$: 2, type: "svg" });
    }
    return result;
  });

console.info(
  `%c PASSABLE-VEHICLE-CARD %c v${CARD_VERSION} IS LOADED `,
  "color: white; background: #0284c7; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #0284c7; background: #e0f2fe; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "passable-vehicle-card",
  name: "Passable Vehicle Card",
  description:
    "Passable design-system vehicle summary card with a 4-tab Command Center popup, climate staging, EVSE current control, and entity auto-discovery.",
  preview: true,
  documentationURL: "https://github.com/GBear09/passable-vehicle-card",
});

class PassableVehicleCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _modalOpen: { state: true },
      _activeVehicleIndex: { state: true },
      _currentView: { state: true },
      _animDirection: { state: true },
      _toastMsg: { state: true },
      _expandedTelemetryKeys: { state: true },
      _historyCache: { state: true },
      _stagingRevision: { state: true },
      _stagedEvseCurrent: { state: true },
      _stagedLimits: { state: true },
      _mapExpandedOverrides: { state: true },
      _mapTrailHours: { state: true },
    };
  }

  constructor() {
    super();
    this._modalOpen = false;
    this._activeVehicleIndex = 0;
    this._currentView = "overview";
    this._animDirection = "none";
    this._toastMsg = null;
    this._expandedTelemetryKeys = {};
    this._historyCache = {};
    this._historyInFlight = new Set();
    this._stagingByVehicle = {};
    this._stagingRevision = 0;
    this._stagedEvseCurrent = null;
    this._stagedLimits = {};
    this._mapExpandedOverrides = {};
    this._mapTrailHours = 0;
    this._pendingScrollToMap = false;
    this._mapCardEl = null;
    this._mapCardConfigKey = "";
    this._mapHassCache = null;
    this._mapStatesSubscribers = new Map();
    this._squaredMarkerImages = new Map();
    this._squaredMarkerPending = new Set();
    this._mapCardHelpersPromise = null;
    this._mapResizeTimer = null;
    this._mapScrollTimer = null;
    this._countdownTimer = null;
    this._toastTimer = null;
    this._closeModalTimer = null;
    this._swipeResetTimer = null;
    this._touchStartX = null;
    this._touchStartY = null;
    this._popupTouchStartY = undefined;
    this._popupTouchStartX = undefined;
    this._popupTouchCurrentY = undefined;
    this._popupTouchTarget = null;
    this._popupTouchInScroll = false;
    this._popupTouchDragging = false;
    this._popupTouchLockedHorizontal = false;
    this._scrollLockedElements = null;
    this._scrollGuardOverlay = null;
    this._guardTouchY = 0;
    this._guardTouchX = 0;
    this._onMapContextRequest = this._onMapContextRequest.bind(this);
    this._onOverlayWheel = this._onOverlayWheel.bind(this);
    this._onOverlayTouchStart = this._onOverlayTouchStart.bind(this);
    this._onOverlayTouchMove = this._onOverlayTouchMove.bind(this);
    this._onKeyDown = (ev) => {
      if (ev.key === "Escape" && this._modalOpen) {
        this._closeModal();
      }
    };
  }

  static getConfigElement() {
    return document.createElement("passable-vehicle-card-editor");
  }

  static getStubConfig() {
    return {
      title: "My Vehicle",
      display_mode: "summary",
      layout: "hero",
      show_header: false,
      show_summary_strip: true,
      show_footer_strip: true,
      show_sparkline: false,
      entity: "sensor.vehicle_battery_level",
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    const displayMode = config.display_mode === "full" ? "full" : "summary";
    const defaultShowHeader = displayMode === "full";
    const prevConfig = this.config;
    this.config = {
      title:
        config.title !== undefined
          ? config.title
          : config.name !== undefined
          ? config.name
          : "My Vehicle",
      subtitle: config.subtitle !== undefined ? config.subtitle : "",
      fuel_type: config.fuel_type || "ev",
      icon:
        config.icon ||
        (config.fuel_type === "ice" ? "mdi:car" : "mdi:car-electric"),
      image: config.image || "",
      summary_image: config.summary_image || "",
      device_id: config.device_id || "",
      prefix: config.prefix || "",
      display_mode: displayMode,
      layout: config.layout === "rings" ? "rings" : "hero",
      show_header:
        config.show_header !== undefined
          ? config.show_header !== false
          : defaultShowHeader,
      show_summary_strip: config.show_summary_strip !== false,
      show_footer_strip: config.show_footer_strip !== false,
      show_sparkline: config.show_sparkline === true,
      sparkline_hours: Number(config.sparkline_hours) || 24,
      auto_expand_map_away: config.auto_expand_map_away !== false,
      ...config,
    };

    try {
      const savedView = sessionStorage.getItem(this._getStorageKey("pvc_view"));
      if (savedView) {
        const mapped = savedView === "home" ? "overview" : savedView;
        if (["overview", "controls", "charging", "health"].includes(mapped)) {
          this._currentView = mapped;
        }
      }
    } catch (e) {}

    if (
      prevConfig &&
      (JSON.stringify(prevConfig.climate_profiles) !==
        JSON.stringify(this.config.climate_profiles) ||
        JSON.stringify(prevConfig.vehicles) !==
          JSON.stringify(this.config.vehicles))
    ) {
      this._stagingByVehicle = {};
    }

    const vehicles = this._getVehicles();
    if (this._activeVehicleIndex >= vehicles.length) {
      this._activeVehicleIndex = 0;
    }
    vehicles.forEach((veh) => this._ensureVehicleStaging(veh));
  }

  getCardSize() {
    const c = this.config || {};
    if (c.display_mode === "full") return 8;
    const count = this._getVehicles().length;
    return Math.max(3, count * 2 + 1);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this._onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeyDown);
    this._detachOverlayScrollGuard();
    this._unlockBackgroundScroll();
    clearInterval(this._countdownTimer);
    this._countdownTimer = null;
    clearTimeout(this._toastTimer);
    clearTimeout(this._closeModalTimer);
    clearTimeout(this._swipeResetTimer);
    clearTimeout(this._mapResizeTimer);
    clearTimeout(this._mapScrollTimer);
    this._mapResizeTimer = null;
    this._mapScrollTimer = null;
    this._mapCardEl = null;
    this._mapCardConfigKey = "";
    this._mapHassCache = null;
    if (this._mapStatesSubscribers) this._mapStatesSubscribers.clear();
  }

  firstUpdated(changedProps) {
    super.firstUpdated && super.firstUpdated(changedProps);
    try {
      const pendingToast = sessionStorage.getItem(this._getStorageKey("pvc_toast"));
      if (pendingToast) {
        sessionStorage.removeItem(this._getStorageKey("pvc_toast"));
        this._showToast(pendingToast);
      }
    } catch (e) {}
    this._maybeFetchAllSparklines();
  }

  updated(changedProps) {
    super.updated && super.updated(changedProps);
    if (this._modalOpen && this.config?.display_mode !== "full") {
      this._attachOverlayScrollGuard();
    } else {
      this._detachOverlayScrollGuard();
    }
    if (changedProps.has("hass") || changedProps.has("config")) {
      this._maybeFetchAllSparklines();
    }
    this._syncEmbeddedMapCard();
    if (this._pendingScrollToMap) {
      const locCard = this.shadowRoot?.querySelector(".location-section-card");
      if (locCard) {
        this._pendingScrollToMap = false;
        clearTimeout(this._mapScrollTimer);
        this._mapScrollTimer = setTimeout(() => {
          locCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 90);
      }
    }
  }

  shouldUpdate(changedProps) {
    if (!changedProps.has("hass")) return true;
    for (const key of changedProps.keys()) {
      if (key !== "hass") return true;
    }
    const oldHass = changedProps.get("hass");
    const newHass = this.hass;
    if (!oldHass || !newHass || !oldHass.states || !newHass.states || !this.config) {
      return true;
    }
    if (this._mapCardEl && oldHass.themes?.darkMode !== newHass.themes?.darkMode) {
      return true;
    }

    const watched = new Set();
    const vehicles = this._getVehicles();
    for (const veh of vehicles) {
      const discovered = this._discoverEntities(veh);
      Object.values(discovered).forEach((id) => id && watched.add(id));
    }

    for (const id of watched) {
      if (oldHass.states[id] !== newHass.states[id]) {
        return true;
      }
    }
    return false;
  }

  // =========================================================================
  // VEHICLES & STAGING HELPERS
  // =========================================================================

  _getStorageKey(prefix, vehKey = null) {
    const base =
      vehKey ||
      (this.config &&
        (this.config.entity || this.config.battery_entity || this.config.title)) ||
      "vehicle";
    return `${prefix}_${base}`;
  }

  _getVehicles() {
    const c = this.config || {};
    if (Array.isArray(c.vehicles) && c.vehicles.length > 0) {
      return c.vehicles.map((v, idx) => {
        const item = v || {};
        const globalDefaults = {
          fuel_type: c.fuel_type || "ev",
          evse_voltage: c.evse_voltage,
          show_ac_current: c.show_ac_current,
          show_evse_current: c.show_evse_current,
          range_max: c.range_max,
          sparkline_hours: c.sparkline_hours,
        };
        const merged = { ...globalDefaults, ...item };
        return {
          ...merged,
          key: item.id || item.key || `vehicle_${idx}`,
          title: item.title || item.name || `Vehicle ${idx + 1}`,
          subtitle: item.subtitle !== undefined ? item.subtitle : "",
          fuel_type: merged.fuel_type || "ev",
          icon:
            item.icon ||
            (merged.fuel_type === "ice" ? "mdi:car" : "mdi:car-electric"),
          image: item.image || "",
          summary_image: item.summary_image || "",
          prefix: item.prefix || "",
          _index: idx,
          _isMultiItem: true,
        };
      });
    }

    return [
      {
        ...c,
        key: c.id || "vehicle_0",
        title:
          c.title !== undefined
            ? c.title
            : c.name !== undefined
            ? c.name
            : "My Vehicle",
        subtitle: c.subtitle !== undefined ? c.subtitle : "",
        fuel_type: c.fuel_type || "ev",
        icon: c.icon || (c.fuel_type === "ice" ? "mdi:car" : "mdi:car-electric"),
        image: c.image || "",
        summary_image: c.summary_image || "",
        prefix: c.prefix || "",
        _index: 0,
        _isMultiItem: false,
      },
    ];
  }

  _getProfilesForVehicle(vehCfg) {
    if (Array.isArray(vehCfg?.climate_profiles) && vehCfg.climate_profiles.length > 0) {
      return JSON.parse(JSON.stringify(vehCfg.climate_profiles));
    }
    if (
      !vehCfg?._isMultiItem &&
      Array.isArray(this.config?.climate_profiles) &&
      this.config.climate_profiles.length > 0
    ) {
      return JSON.parse(JSON.stringify(this.config.climate_profiles));
    }
    try {
      const storageId = vehCfg?.entity || vehCfg?.key || "vehicle";
      const stored = localStorage.getItem(`pvc_profiles_${storageId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_CLIMATE_PROFILES));
  }

  _ensureVehicleStaging(vehCfg) {
    const key = vehCfg.key || "vehicle_0";
    const profiles = this._getProfilesForVehicle(vehCfg);
    const existing = this._stagingByVehicle[key];
    if (existing) {
      existing.profiles = profiles;
      return existing;
    }

    let savedProfileId = null;
    try {
      savedProfileId = sessionStorage.getItem(
        this._getStorageKey("pvc_profile", key)
      );
    } catch (e) {}

    const target =
      profiles.find((p) => p.id === savedProfileId) || profiles[0];
    const entry = {
      profiles,
      selectedProfileId: target.id,
      temp: target.temp !== undefined ? target.temp : 72,
      duration: target.duration !== undefined ? target.duration : 15,
      defrost: !!target.defrost,
      heating: target.heating !== undefined ? target.heating : 0,
      wheel: target.steering_wheel !== undefined ? target.steering_wheel : 0,
      seats: target.seats
        ? { ...target.seats }
        : { fl: 0, fr: 0, rl: 0, rr: 0 },
    };
    this._stagingByVehicle[key] = entry;
    return entry;
  }

  _selectProfile(vehCfg, profileId) {
    const st = this._ensureVehicleStaging(vehCfg);
    const profiles = st.profiles || DEFAULT_CLIMATE_PROFILES;
    const p = profiles.find((pr) => pr.id === profileId) || profiles[0];
    if (!p) return;
    st.selectedProfileId = p.id;
    st.temp = p.temp !== undefined ? p.temp : 72;
    st.duration = p.duration !== undefined ? p.duration : 15;
    st.defrost = !!p.defrost;
    st.heating = p.heating !== undefined ? p.heating : 0;
    st.wheel = p.steering_wheel !== undefined ? p.steering_wheel : 0;
    st.seats = p.seats ? { ...p.seats } : { fl: 0, fr: 0, rl: 0, rr: 0 };
    try {
      sessionStorage.setItem(
        this._getStorageKey("pvc_profile", vehCfg.key),
        p.id
      );
    } catch (e) {}
    this._stagingRevision += 1;
  }

  // =========================================================================
  // ENTITY AUTO-DISCOVERY
  // =========================================================================

  _discoverEntities(vehCfg = null) {
    if (!this.hass || !this.hass.states) return {};

    const cfg = vehCfg || this.config || {};
    const allStates = Object.keys(this.hass.states);
    const isMulti = this._getVehicles().length > 1;

    const prefixes = new Set();
    if (cfg.prefix) {
      const p = String(cfg.prefix).toLowerCase();
      prefixes.add(p);
      prefixes.add(`kia_${p}`);
      prefixes.add(`${p}_ev`);
    }

    const primaryEntity =
      cfg.entity || cfg.battery_entity || cfg.range_entity || cfg.lock_entity;
    if (primaryEntity) {
      const objectId = primaryEntity.split(".")[1] || "";
      const parts = objectId.split("_");
      if (parts.length > 0 && parts[0]) {
        prefixes.add(parts[0]);
        prefixes.add(`kia_${parts[0]}`);
        if (parts.length > 1) {
          prefixes.add(`${parts[0]}_${parts[1]}`);
        }
      }
    }

    const entityPatterns = {
      battery: {
        domains: ["sensor"],
        patterns: [
          "ev_battery_level",
          "battery_level",
          "battery",
          "soc",
          "fuel_level",
          "fuel_percent",
        ],
      },
      range: {
        domains: ["sensor"],
        patterns: [
          "ev_range",
          "range",
          "battery_range",
          "fuel_range",
          "remaining_range",
          "total_driving_range",
        ],
      },
      charging: {
        domains: ["binary_sensor", "sensor"],
        patterns: [
          "ev_battery_charge",
          "charging_status",
          "is_charging",
          "battery_charging",
          "charging",
        ],
      },
      plug: {
        domains: ["binary_sensor", "sensor"],
        patterns: [
          "ev_battery_plug",
          "plugged_in",
          "charge_port",
          "plug_status",
          "plug",
        ],
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
        patterns: [
          "last_updated_at",
          "last_updated",
          "last_seen",
          "status_updated",
        ],
      },
      charging_power: {
        domains: ["sensor"],
        patterns: ["ev_charging_power", "charging_power", "charger_power"],
      },
      evse_power: {
        domains: ["sensor"],
        shared: true,
        patterns: [
          "evse_power",
          "car_charger_power",
          "wall_charger_power",
          "power",
        ],
      },
      tire_pressure: {
        domains: ["binary_sensor", "sensor"],
        patterns: [
          "tire_pressure_all",
          "tire_pressure",
          "tpms",
          "tire_pressure_warning",
        ],
      },
      hood: {
        domains: ["binary_sensor"],
        patterns: ["hood", "hood_status", "engine_hood", "frunk"],
      },
      trunk: {
        domains: ["binary_sensor"],
        patterns: ["trunk", "trunk_status", "tailgate", "boot", "hatch"],
      },
      door_fl: {
        domains: ["binary_sensor"],
        patterns: [
          "front_left_door",
          "door_front_left",
          "door_fl",
          "driver_door",
        ],
      },
      door_fr: {
        domains: ["binary_sensor"],
        patterns: [
          "front_right_door",
          "door_front_right",
          "door_fr",
          "passenger_door",
        ],
      },
      door_rl: {
        domains: ["binary_sensor"],
        patterns: [
          "back_left_door",
          "rear_left_door",
          "door_back_left",
          "door_rear_left",
          "door_rl",
        ],
      },
      door_rr: {
        domains: ["binary_sensor"],
        patterns: [
          "back_right_door",
          "rear_right_door",
          "door_back_right",
          "door_rear_right",
          "door_rr",
        ],
      },
      sunroof: {
        domains: ["binary_sensor"],
        patterns: ["sunroof", "moonroof", "panoramic_roof"],
      },
      engine: {
        domains: ["binary_sensor"],
        patterns: ["engine", "ignition", "driving", "is_driving", "ready_state"],
      },
      hvac_active: {
        domains: ["binary_sensor", "climate", "switch", "sensor"],
        patterns: [
          "air_conditioner",
          "hvac",
          "climate_control",
          "climate",
          "climate_status",
          "air_conditioning",
        ],
      },
      climate_temp: {
        domains: ["sensor"],
        patterns: [
          "set_temperature",
          "target_temperature",
          "climate_temperature",
        ],
      },
      defrost_status: {
        domains: ["binary_sensor"],
        patterns: ["defrost", "front_defrost"],
      },
      wheel_heater_status: {
        domains: ["binary_sensor"],
        patterns: ["steering_wheel_heater", "heated_steering_wheel"],
      },
      rear_heater_status: {
        domains: ["binary_sensor"],
        patterns: ["back_window_heater", "rear_window_heater", "rear_defrost"],
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
      evse_current: {
        domains: ["number", "input_number", "select", "input_select"],
        shared: true,
        patterns: [
          "evse_charge_current_limit",
          "evse_current_limit",
          "evse_charging_current",
          "evse_current",
          "charger_current_limit",
          "charge_current_limit",
          "charging_current_limit",
          "charger_current",
        ],
      },
      charge_time: {
        domains: ["sensor"],
        patterns: [
          "estimated_charge_duration",
          "charge_time_remaining",
          "time_to_full",
        ],
      },
      charging_switch: {
        domains: ["switch"],
        patterns: ["ev_charging", "charging"],
      },
      location: {
        domains: ["device_tracker"],
        patterns: ["location", "position", "tracker", "gps"],
      },
      aux_battery: {
        domains: ["sensor"],
        patterns: [
          "car_battery_level",
          "12v_battery",
          "aux_battery",
          "starter_battery",
        ],
      },
      next_service: {
        domains: ["sensor"],
        patterns: ["next_service", "service_due", "service_distance"],
      },
      dtc_count: {
        domains: ["sensor"],
        patterns: ["dtc_count", "diagnostic_trouble_codes", "fault_count"],
      },
      washer_fluid: {
        domains: ["binary_sensor"],
        patterns: ["washer_fluid_warning", "washer_fluid"],
      },
      key_battery: {
        domains: ["binary_sensor"],
        patterns: ["smart_key_battery_warning", "key_battery_warning"],
      },
      force_refresh: {
        domains: ["button"],
        patterns: ["force_refresh", "force_update", "refresh"],
      },
    };

    const discovered = {};

    for (const [key, def] of Object.entries(entityPatterns)) {
      const configKey = key === "battery" ? "entity" : `${key}_entity`;

      if (key === "ac_current") {
        if (
          cfg.show_ac_current === false ||
          cfg.ac_current_entity === "none" ||
          cfg.ac_current_entity === "disabled"
        ) {
          discovered[key] = null;
          continue;
        }
      }

      if (key === "evse_current") {
        if (
          cfg.show_evse_current === false ||
          cfg.evse_current_entity === "none" ||
          cfg.evse_current_entity === "disabled"
        ) {
          discovered[key] = null;
          continue;
        }
        if (
          cfg.evse_current_entity ||
          cfg.evse_charge_current_entity ||
          cfg.evse_current
        ) {
          discovered[key] =
            cfg.evse_current_entity ||
            cfg.evse_charge_current_entity ||
            cfg.evse_current;
          continue;
        }
      }

      if (cfg[configKey] === "none" || cfg[configKey] === "disabled") {
        discovered[key] = null;
        continue;
      }
      if (cfg[configKey]) {
        discovered[key] = cfg[configKey];
        continue;
      }
      if (key === "battery" && cfg.battery_entity) {
        discovered[key] = cfg.battery_entity;
        continue;
      }
      if (
        key === "hvac_active" &&
        (cfg.hvac_status_entity || cfg.hvac_active_entity)
      ) {
        discovered[key] = cfg.hvac_status_entity || cfg.hvac_active_entity;
        continue;
      }

      const { domains, patterns, shared } = def;
      let found = null;

      for (const pattern of patterns) {
        for (const prefix of prefixes) {
          found = allStates.find((id) => {
            const [domain, objId] = id.split(".");
            if (domains && !domains.includes(domain)) return false;
            return (
              objId === `${prefix}_${pattern}` ||
              objId === `${prefix}_${prefix}_${pattern}` ||
              objId === `${prefix}_ev_${pattern}` ||
              objId === `${prefix}_kia_${pattern}` ||
              objId === `kia_${prefix}_${pattern}` ||
              objId.includes(`${prefix}_${pattern}`) ||
              (objId.includes(pattern) &&
                (objId.includes(prefix) || prefixes.size === 0))
            );
          });
          if (found) break;
        }
        if (found) break;

        if ((!isMulti && (key !== "evse_power" || prefixes.size === 0)) || shared) {
          found = allStates.find((id) => {
            const [domain, objId] = id.split(".");
            if (domains && !domains.includes(domain)) return false;
            if (key === "evse_power" && pattern === "power") {
              return (
                objId.includes("charger") &&
                (objId.endsWith("_power") || objId.includes("evse"))
              );
            }
            return objId === pattern || objId.endsWith(`_${pattern}`);
          });
          if (found) break;
        }
      }

      if (found) {
        discovered[key] = found;
      }
    }

    return discovered;
  }

  // =========================================================================
  // TELEMETRY SNAPSHOT & FORMATTING
  // =========================================================================

  _getDeviceId(vehCfg = null) {
    const cfg = vehCfg || this.config || {};
    if (cfg.device_id) return cfg.device_id;
    const primary = cfg.entity || cfg.battery_entity;
    if (primary && this.hass?.entities?.[primary]?.device_id) {
      return this.hass.entities[primary].device_id;
    }
    return "";
  }

  _computeRelativeTime(timestamp) {
    if (!timestamp || timestamp === "unavailable" || timestamp === "unknown") {
      return "Never";
    }
    const now = new Date();
    const then = new Date(timestamp);
    if (isNaN(then.getTime())) return String(timestamp);
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

  _formatDurationMins(rawVal, unit = "") {
    const num = parseFloat(rawVal);
    if (isNaN(num) || num <= 0) return "--";
    const unitLow = String(unit || "").toLowerCase();
    const mins = unitLow.startsWith("h")
      ? Math.round(num * 60)
      : unitLow.startsWith("s")
      ? Math.round(num / 60)
      : Math.round(num);
    if (mins <= 0) return "--";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  _readPowerKw(entityId) {
    const st = entityId ? this.hass?.states?.[entityId] : null;
    if (!st) return 0;
    const num = parseFloat(st.state);
    if (isNaN(num)) return 0;
    const unit = String(st.attributes?.unit_of_measurement || "").toLowerCase();
    if (unit === "w") return Math.max(0, num / 1000);
    return Math.max(0, num);
  }

  _getVehicleSnapshot(vehCfg, idx = 0) {
    const entities = this._discoverEntities(vehCfg);
    const states = this.hass?.states || {};
    const getSt = (id) => (id ? states[id] : null);
    const numVal = (id, fallback = null) => {
      const raw = getSt(id)?.state;
      const parsed = raw !== undefined ? parseFloat(raw) : NaN;
      return !isNaN(parsed) ? parsed : fallback;
    };

    const batteryRaw = numVal(entities.battery, 0);
    const batteryLevel = Math.max(0, Math.min(100, Math.round(batteryRaw)));
    const rangeObj = getSt(entities.range);
    const rangeParsed = rangeObj ? parseFloat(rangeObj.state) : NaN;
    const rangeVal = !isNaN(rangeParsed) ? Math.round(rangeParsed) : "--";
    const rangeUnit = rangeObj?.attributes?.unit_of_measurement || "mi";
    const defaultRangeMax = vehCfg.fuel_type === "ice" ? 400 : 325;
    const rangeMax = Number(vehCfg.range_max) || defaultRangeMax;

    const isCharging = entities.charging
      ? ["on", "charging", "true"].includes(
          String(getSt(entities.charging)?.state || "").toLowerCase()
        )
      : false;
    const isPlugged = entities.plug
      ? ["on", "plugged", "connected", "true"].includes(
          String(getSt(entities.plug)?.state || "").toLowerCase()
        )
      : false;
    const isLocked = entities.lock
      ? getSt(entities.lock)?.state === "locked"
      : true;
    const hasLock = Boolean(entities.lock && getSt(entities.lock));
    const isEngineOn = entities.engine
      ? ["on", "true", "running"].includes(
          String(getSt(entities.engine)?.state || "").toLowerCase()
        )
      : false;

    const hvacObj = getSt(entities.hvac_active);
    const isClimateOn = hvacObj
      ? !["off", "unavailable", "unknown", "false", "0"].includes(
          String(hvacObj.state || "").toLowerCase()
        )
      : false;

    const setTempFromSensor = numVal(entities.climate_temp, null);
    const setTempFromAttr =
      hvacObj?.attributes?.temperature !== undefined
        ? parseFloat(hvacObj.attributes.temperature)
        : NaN;
    const staging = this._ensureVehicleStaging(vehCfg);
    const climateTemp =
      setTempFromSensor !== null
        ? Math.round(setTempFromSensor)
        : !isNaN(setTempFromAttr)
        ? Math.round(setTempFromAttr)
        : Math.round(staging.temp || 72);

    const vehPowerKw = this._readPowerKw(entities.charging_power);
    const evsePowerKw = this._readPowerKw(entities.evse_power);
    const chargePowerKw = vehPowerKw > 0.05 ? vehPowerKw : evsePowerKw;

    const acLimit = numVal(entities.ac_limit, null);
    const dcLimit = numVal(entities.dc_limit, null);
    const auxBattery = numVal(entities.aux_battery, null);
    const odoVal = numVal(entities.odometer, null);
    const odoUnit = getSt(entities.odometer)?.attributes?.unit_of_measurement || "mi";
    const nextServiceVal = numVal(entities.next_service, null);
    const dtcCount = numVal(entities.dtc_count, null);
    const evseAmps = numVal(entities.evse_current, null);

    const tpmsWarn = entities.tire_pressure
      ? ["on", "warning", "problem", "true"].includes(
          String(getSt(entities.tire_pressure)?.state || "").toLowerCase()
        )
      : false;
    const washerWarn = entities.washer_fluid
      ? getSt(entities.washer_fluid)?.state === "on"
      : false;
    const keyBatWarn = entities.key_battery
      ? getSt(entities.key_battery)?.state === "on"
      : false;

    const lastUpdatedRaw = entities.last_updated
      ? getSt(entities.last_updated)?.state
      : getSt(entities.battery)?.last_updated;
    const relativeTime = this._computeRelativeTime(lastUpdatedRaw);

    const chargeTimeObj = getSt(entities.charge_time);
    const chargeEta = this._formatDurationMins(
      chargeTimeObj?.state,
      chargeTimeObj?.attributes?.unit_of_measurement
    );

    const locationObj = getSt(entities.location);
    let locationLabel = "";
    const rawLocationState =
      locationObj &&
      locationObj.state &&
      !["unavailable", "unknown"].includes(locationObj.state)
        ? String(locationObj.state).toLowerCase()
        : "";
    if (rawLocationState) {
      const rawLoc = String(locationObj.state);
      locationLabel =
        rawLocationState === "home"
          ? "Home"
          : rawLocationState === "not_home"
          ? "Away"
          : rawLoc.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
    const latNum =
      locationObj?.attributes?.latitude !== undefined &&
      locationObj?.attributes?.latitude !== null
        ? Number(locationObj.attributes.latitude)
        : NaN;
    const lngNum =
      locationObj?.attributes?.longitude !== undefined &&
      locationObj?.attributes?.longitude !== null
        ? Number(locationObj.attributes.longitude)
        : NaN;
    const locationLat = Number.isFinite(latNum) ? latNum : null;
    const locationLng = Number.isFinite(lngNum) ? lngNum : null;
    const hasLocationCoords = locationLat !== null && locationLng !== null;
    const isAway = Boolean(rawLocationState && rawLocationState !== "home");
    const locationIcon =
      rawLocationState === "home"
        ? "mdi:home-map-marker"
        : isAway
        ? "mdi:map-marker-radius"
        : "mdi:map-marker-outline";
    const locationUpdatedRel = locationObj
      ? this._computeRelativeTime(locationObj.last_updated || locationObj.last_changed)
      : "";

    const closures = [
      { id: entities.door_fl, name: "Driver Door", short: "Driver", icon: "mdi:car-door" },
      { id: entities.door_fr, name: "Pass. Door", short: "Pass.", icon: "mdi:car-door" },
      { id: entities.door_rl, name: "Rear L Door", short: "Rear L", icon: "mdi:car-door" },
      { id: entities.door_rr, name: "Rear R Door", short: "Rear R", icon: "mdi:car-door" },
      { id: entities.hood, name: "Hood", short: "Hood", icon: "mdi:car-convertible" },
      { id: entities.trunk, name: "Trunk", short: "Trunk", icon: "mdi:car-back" },
      { id: entities.sunroof, name: "Sunroof", short: "Sunroof", icon: "mdi:car-convertible" },
    ]
      .filter((d) => d.id && getSt(d.id))
      .map((d) => ({
        ...d,
        isOpen: ["on", "open", "true"].includes(
          String(getSt(d.id)?.state || "").toLowerCase()
        ),
      }));

    const openClosures = closures.filter((c) => c.isOpen);
    const hasLowBattery = batteryLevel < 20;
    const hasDtcAlert = dtcCount !== null && dtcCount > 0;
    const hasAlert =
      (hasLock && !isLocked) ||
      openClosures.length > 0 ||
      tpmsWarn ||
      washerWarn ||
      keyBatWarn ||
      hasDtcAlert ||
      hasLowBattery;

    let stateTone = "idle";
    let statusLabel = isPlugged ? "Plugged In" : "Ready";
    if (isCharging) {
      stateTone = "charging";
      statusLabel =
        chargePowerKw > 0.05
          ? `Charging · ${chargePowerKw.toFixed(1)} kW`
          : "Charging";
    } else if (isEngineOn) {
      stateTone = "driving";
      statusLabel = "Engine On";
    } else if (isClimateOn) {
      stateTone = "climate";
      statusLabel = `Climate ${climateTemp}°F`;
    } else if (openClosures.length > 0) {
      stateTone = "alert";
      statusLabel =
        openClosures.length === 1
          ? `${openClosures[0].name} Open`
          : `${openClosures.length} Open`;
    } else if (hasLock && !isLocked) {
      stateTone = "alert";
      statusLabel = "Unlocked";
    } else if (tpmsWarn || hasDtcAlert || hasLowBattery) {
      stateTone = "alert";
      statusLabel = tpmsWarn
        ? "Tire Pressure Alert"
        : hasDtcAlert
        ? `${dtcCount} Fault Code${dtcCount === 1 ? "" : "s"}`
        : "Low Battery";
    }

    return {
      idx,
      vehCfg,
      entities,
      batteryLevel,
      rangeVal,
      rangeUnit,
      rangeMax,
      isCharging,
      isPlugged,
      isLocked,
      hasLock,
      isEngineOn,
      isClimateOn,
      climateTemp,
      chargePowerKw,
      acLimit,
      dcLimit,
      auxBattery,
      odoVal,
      odoUnit,
      nextServiceVal,
      dtcCount,
      evseAmps,
      tpmsWarn,
      washerWarn,
      keyBatWarn,
      relativeTime,
      chargeEta,
      locationLabel,
      rawLocationState,
      locationLat,
      locationLng,
      hasLocationCoords,
      isAway,
      locationIcon,
      locationUpdatedRel,
      closures,
      openClosures,
      hasLowBattery,
      hasDtcAlert,
      hasAlert,
      stateTone,
      statusLabel,
    };
  }

  _getBatteryColor(pct) {
    if (pct < 20) return "#ef4444";
    if (pct < 40) return "#f59e0b";
    return "#22c55e";
  }

  _getThemeTextColor() {
    const defaultColor = [255, 255, 255];
    try {
      const style = getComputedStyle(this);
      const color = style.getPropertyValue("--primary-text-color").trim();
      if (!color) return defaultColor;
      if (color.startsWith("#")) {
        let hex = color.slice(1);
        if (hex.length === 3) {
          hex = hex
            .split("")
            .map((c) => c + c)
            .join("");
        }
        return [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16),
        ];
      }
      if (color.startsWith("rgb")) {
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
    const colOrange = [249, 115, 22];
    if (t <= mid) {
      return interp(colBlue, colNeutral, (t - 62) / (mid - 62));
    }
    return interp(colNeutral, colOrange, (t - mid) / (82 - mid));
  }

  // =========================================================================
  // 24H BATTERY SPARKLINE HISTORY
  // =========================================================================

  _maybeFetchAllSparklines() {
    if (!this.hass || !this.config || this.config.show_sparkline !== true) return;
    const vehicles = this._getVehicles();
    for (const veh of vehicles) {
      const entities = this._discoverEntities(veh);
      if (entities.battery) {
        this._fetchSparklineHistory(veh.key, entities.battery);
      }
    }
  }

  async _fetchSparklineHistory(vehKey, entityId) {
    if (!this.hass || !entityId) return;
    const cached = this._historyCache?.[vehKey];
    if (cached && cached.entityId === entityId && Date.now() - cached.fetchedAt < 300000) {
      return;
    }
    if (this._historyInFlight.has(vehKey)) return;
    this._historyInFlight.add(vehKey);

    try {
      const hours = Math.max(1, Math.min(72, Number(this.config?.sparkline_hours) || 24));
      const now = new Date();
      const startIso = new Date(now.getTime() - hours * 3600 * 1000).toISOString();
      const endIso = now.toISOString();
      let rawStates = [];

      if (typeof this.hass.callWS === "function") {
        try {
          const wsRes = await this.hass.callWS({
            type: "history/history_during_period",
            start_time: startIso,
            end_time: endIso,
            entity_ids: [entityId],
            minimal_response: true,
            no_attributes: true,
          });
          if (wsRes && Array.isArray(wsRes[entityId])) {
            rawStates = wsRes[entityId];
          }
        } catch (e) {}
      }

      if (rawStates.length === 0 && typeof this.hass.callApi === "function") {
        const apiRes = await this.hass.callApi(
          "GET",
          `history/period/${startIso}?filter_entity_id=${entityId}&end_time=${endIso}&minimal_response`
        );
        if (Array.isArray(apiRes) && Array.isArray(apiRes[0])) {
          rawStates = apiRes[0];
        }
      }

      const points = rawStates
        .map((s) => parseFloat(s.s !== undefined ? s.s : s.state))
        .filter((n) => !isNaN(n));

      if (points.length === 1) {
        points.push(points[0]);
      }

      const sampled = [];
      if (points.length > 24) {
        const step = (points.length - 1) / 23;
        for (let i = 0; i < 24; i++) {
          sampled.push(points[Math.round(i * step)]);
        }
      } else {
        sampled.push(...points);
      }

      if (this.isConnected) {
        this._historyCache = {
          ...(this._historyCache || {}),
          [vehKey]: { entityId, points: sampled, fetchedAt: Date.now() },
        };
      }
    } catch (e) {
      // Ignore sparkline history errors gracefully
    } finally {
      this._historyInFlight.delete(vehKey);
    }
  }

  _renderSparklineSvg(vehKey, strokeColor) {
    if (this.config?.show_sparkline !== true) return "";
    const points = this._historyCache?.[vehKey]?.points;
    if (!Array.isArray(points) || points.length < 2) return "";

    const w = 320;
    const h = 64;
    const min = Math.max(0, Math.min(...points) - 5);
    const max = Math.min(100, Math.max(...points) + 5);
    const span = Math.max(8, max - min);
    const coords = points.map((val, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((val - min) / span) * (h - 14) - 6;
      return [x.toFixed(1), y.toFixed(1)];
    });
    const linePts = coords.map(([x, y]) => `${x},${y}`).join(" ");
    const areaPath =
      `M 0 ${h} ` +
      coords.map(([x, y]) => `L ${x} ${y}`).join(" ") +
      ` L ${w} ${h} Z`;
    const gradId = `pvcSpark_${String(vehKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    return html`
      <div class="summary-sparkline-layer">
        ${svg`
          <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="summary-sparkline-svg">
            <defs>
              <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.45"></stop>
                <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0"></stop>
              </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#${gradId})"></path>
            <polyline points="${linePts}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
        `}
      </div>
    `;
  }

  // =========================================================================
  // MODAL, 3-LAYER SCROLL LOCK & TOUCH GESTURES
  // =========================================================================

  _fireHaptic(type = "light") {
    const ev = new Event("haptic", { bubbles: true, composed: true });
    ev.detail = type;
    this.dispatchEvent(ev);
  }

  _showToast(msg) {
    this._toastMsg = msg;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toastMsg = null;
    }, 2800);
  }

  _resetMapState() {
    clearTimeout(this._mapResizeTimer);
    clearTimeout(this._mapScrollTimer);
    this._mapResizeTimer = null;
    this._mapScrollTimer = null;
    this._mapExpandedOverrides = {};
    this._pendingScrollToMap = false;
    this._mapCardEl = null;
    this._mapCardConfigKey = "";
    this._mapHassCache = null;
    if (this._mapStatesSubscribers) this._mapStatesSubscribers.clear();
  }

  _getIsMapExpanded(snap) {
    const key = snap?.vehCfg?.key || "vehicle_0";
    if (
      this._mapExpandedOverrides &&
      Object.prototype.hasOwnProperty.call(this._mapExpandedOverrides, key)
    ) {
      return Boolean(this._mapExpandedOverrides[key]);
    }
    return Boolean(
      this.config?.auto_expand_map_away !== false &&
        snap?.isAway &&
        (snap?.hasLocationCoords || snap?.entities?.location)
    );
  }

  _toggleLocationMap(vehKey, currentExpanded, ev = null) {
    if (ev) ev.stopPropagation();
    this._fireHaptic("light");
    this._mapExpandedOverrides = {
      ...(this._mapExpandedOverrides || {}),
      [vehKey]: !currentExpanded,
    };
  }

  _setMapTrailHours(hours, ev = null) {
    if (ev) ev.stopPropagation();
    this._fireHaptic("light");
    this._mapTrailHours = Number(hours) || 0;
  }

  _openLocationModal(vehIdx = 0, ev = null) {
    if (ev) ev.stopPropagation();
    const vehicles = this._getVehicles();
    const veh = vehicles[vehIdx] || vehicles[0];
    const vehKey = veh?.key || `vehicle_${vehIdx}`;
    this._mapExpandedOverrides = {
      ...(this._mapExpandedOverrides || {}),
      [vehKey]: true,
    };
    this._pendingScrollToMap = true;
    this._openModal(vehIdx, "overview", ev);
  }

  _getExternalMapsUrl(lat, lng, label = "Vehicle") {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isApple = /iPad|iPhone|iPod|Macintosh/i.test(ua) && !/Android/i.test(ua);
    if (isApple) {
      return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(
        label || "Vehicle"
      )}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  _buildMapHass(entityId, markerImage, markerIcon, markerName) {
    const baseHass = this.hass;
    if (
      !baseHass ||
      !baseHass.states ||
      !entityId ||
      !baseHass.states[entityId]
    ) {
      return baseHass;
    }
    const orig = baseHass.states[entityId];
    const cache = this._mapHassCache;
    if (
      cache &&
      cache.baseHass === baseHass &&
      cache.entityId === entityId &&
      cache.origState === orig &&
      cache.markerImage === markerImage &&
      cache.markerIcon === markerIcon &&
      cache.markerName === markerName
    ) {
      return cache.mapHass;
    }

    let patchedState;
    let patchedStates;
    if (
      cache &&
      cache.entityId === entityId &&
      cache.origState === orig &&
      cache.markerImage === markerImage &&
      cache.markerIcon === markerIcon &&
      cache.markerName === markerName
    ) {
      patchedState = cache.patchedState;
      patchedStates = cache.patchedStates;
    } else {
      const origAttrs = orig.attributes || {};
      const nextAttrs = {
        ...origAttrs,
        ...(markerName ? { friendly_name: markerName } : {}),
      };
      if (markerImage) {
        nextAttrs.entity_picture = markerImage;
      } else if (!origAttrs.entity_picture && markerIcon) {
        nextAttrs.icon = markerIcon;
      }
      patchedState = { ...orig, attributes: nextAttrs };
      patchedStates = { ...baseHass.states, [entityId]: patchedState };
    }

    const mapHass = new Proxy(baseHass, {
      get(target, prop) {
        if (prop === "states") return patchedStates;
        const val = Reflect.get(target, prop, target);
        return typeof val === "function" ? val.bind(target) : val;
      },
    });

    this._mapHassCache = {
      baseHass,
      entityId,
      origState: orig,
      markerImage,
      markerIcon,
      markerName,
      patchedState,
      patchedStates,
      mapHass,
    };
    return mapHass;
  }

  _onMapContextRequest(ev) {
    if (!ev || ev.context !== "states" || typeof ev.callback !== "function") {
      return;
    }
    const host =
      ev.currentTarget || this.shadowRoot?.querySelector(".vehicle-map-host");
    const entityId = host?.dataset?.entityId || "";
    const markerImage = host?.dataset?.markerImage || "";
    const markerIcon = host?.dataset?.markerIcon || "";
    const markerName = host?.dataset?.markerName || "";
    const effectiveMarkerImage = this._resolveEffectiveMarkerImage(markerImage);
    const mapHass = this._buildMapHass(
      entityId,
      effectiveMarkerImage,
      markerIcon,
      markerName
    );
    const patchedStates = mapHass?.states || this.hass?.states;
    if (!patchedStates) return;

    ev.stopPropagation();
    const cb = ev.callback;
    if (ev.subscribe) {
      let entry = this._mapStatesSubscribers.get(cb);
      if (!entry) {
        entry = {
          unsub: () => {
            this._mapStatesSubscribers.delete(cb);
          },
          lastStates: null,
        };
        this._mapStatesSubscribers.set(cb, entry);
      }
      entry.lastStates = patchedStates;
      cb(patchedStates, entry.unsub);
    } else {
      cb(patchedStates);
    }
  }

  _notifyMapStatesSubscribers(patchedStates) {
    if (!patchedStates) return;
    for (const [cb, entry] of Array.from(this._mapStatesSubscribers.entries())) {
      if (entry.lastStates === patchedStates) continue;
      entry.lastStates = patchedStates;
      try {
        cb(patchedStates, entry.unsub);
      } catch (e) {}
    }
  }

  _resolveEffectiveMarkerImage(srcUrl) {
    if (!srcUrl) return "";
    if (this._squaredMarkerImages && this._squaredMarkerImages.has(srcUrl)) {
      return this._squaredMarkerImages.get(srcUrl);
    }
    this._ensureSquaredMarkerImage(srcUrl);
    return srcUrl;
  }

  _ensureSquaredMarkerImage(srcUrl) {
    if (
      !srcUrl ||
      srcUrl.startsWith("data:") ||
      !this._squaredMarkerImages ||
      this._squaredMarkerImages.has(srcUrl) ||
      !this._squaredMarkerPending ||
      this._squaredMarkerPending.has(srcUrl) ||
      typeof Image === "undefined" ||
      typeof document === "undefined"
    ) {
      return;
    }
    this._squaredMarkerPending.add(srcUrl);
    const img = new Image();
    if (
      /^https?:\/\//i.test(srcUrl) &&
      typeof window !== "undefined" &&
      window.location &&
      !srcUrl.startsWith(window.location.origin)
    ) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      this._squaredMarkerPending.delete(srcUrl);
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) {
        this._squaredMarkerImages.set(srcUrl, srcUrl);
        return;
      }
      try {
        let sx = 0;
        let sy = 0;
        let sw = nw;
        let sh = nh;

        try {
          const scanMax = 256;
          const scanScale = Math.min(1, scanMax / Math.max(nw, nh));
          const aw = Math.max(1, Math.round(nw * scanScale));
          const ah = Math.max(1, Math.round(nh * scanScale));
          const scanCanvas = document.createElement("canvas");
          scanCanvas.width = aw;
          scanCanvas.height = ah;
          const scanCtx = scanCanvas.getContext("2d");
          if (scanCtx) {
            scanCtx.drawImage(img, 0, 0, aw, ah);
            const data = scanCtx.getImageData(0, 0, aw, ah).data;
            let minX = aw;
            let minY = ah;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < ah; y++) {
              const rowOffset = y * aw * 4;
              for (let x = 0; x < aw; x++) {
                if (data[rowOffset + x * 4 + 3] > 16) {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (maxX >= minX && maxY >= minY) {
              const invX = nw / aw;
              const invY = nh / ah;
              sx = Math.max(0, Math.floor(minX * invX));
              sy = Math.max(0, Math.floor(minY * invY));
              const ex = Math.min(nw, Math.ceil((maxX + 1) * invX));
              const ey = Math.min(nh, Math.ceil((maxY + 1) * invY));
              sw = Math.max(1, ex - sx);
              sh = Math.max(1, ey - sy);
            }
          }
        } catch (trimErr) {}

        const size = 128;
        const pad = 8;
        const maxDim = size - pad * 2;
        const outCanvas = document.createElement("canvas");
        outCanvas.width = size;
        outCanvas.height = size;
        const outCtx = outCanvas.getContext("2d");
        if (!outCtx) {
          this._squaredMarkerImages.set(srcUrl, srcUrl);
          return;
        }
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = "high";
        const scale = Math.min(maxDim / sw, maxDim / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (size - dw) / 2;
        const dy = (size - dh) / 2;
        outCtx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        const dataUrl = outCanvas.toDataURL("image/png");
        this._squaredMarkerImages.set(srcUrl, dataUrl || srcUrl);
        this._syncEmbeddedMapCard();
      } catch (e) {
        this._squaredMarkerImages.set(srcUrl, srcUrl);
      }
    };
    img.onerror = () => {
      this._squaredMarkerPending.delete(srcUrl);
      this._squaredMarkerImages.set(srcUrl, srcUrl);
    };
    img.src = srcUrl;
  }

  _syncEmbeddedMapCard() {
    const host = this.shadowRoot?.querySelector(".vehicle-map-host");
    if (!host) {
      this._mapCardEl = null;
      this._mapCardConfigKey = "";
      this._mapHassCache = null;
      if (this._mapStatesSubscribers) this._mapStatesSubscribers.clear();
      return;
    }
    const entityId = host.dataset.entityId || "";
    const hours = Number(host.dataset.hours) || 0;
    const markerImage = host.dataset.markerImage || "";
    const markerIcon = host.dataset.markerIcon || "";
    const markerName = host.dataset.markerName || "";
    const darkKey = this.hass?.themes?.darkMode ? "dark" : "light";
    if (!entityId) return;

    const effectiveMarkerImage = this._resolveEffectiveMarkerImage(markerImage);
    const hasPhoto = Boolean(
      markerImage || this.hass?.states?.[entityId]?.attributes?.entity_picture
    );
    const configKey = `${entityId}|${hours}|${darkKey}|${
      hasPhoto ? "img" : "ico"
    }|${markerImage}|${markerIcon}|${markerName}`;
    const mapHass = this._buildMapHass(
      entityId,
      effectiveMarkerImage,
      markerIcon,
      markerName
    );
    if (this._mapCardEl && this._mapCardConfigKey === configKey) {
      if (this._mapCardEl.parentNode !== host) {
        host.replaceChildren(this._mapCardEl);
      }
      this._mapCardEl.hass = mapHass;
      this._notifyMapStatesSubscribers(mapHass?.states);
      return;
    }

    this._mapCardConfigKey = configKey;
    if (typeof window.loadCardHelpers !== "function") {
      const msg = document.createElement("div");
      msg.className = "vehicle-map-empty";
      msg.textContent = "Map preview requires Home Assistant Lovelace";
      host.replaceChildren(msg);
      return;
    }

    this._mapCardHelpersPromise =
      this._mapCardHelpersPromise || window.loadCardHelpers();
    this._mapCardHelpersPromise
      .then((helpers) => {
        const currentHost = this.shadowRoot?.querySelector(".vehicle-map-host");
        if (!currentHost || this._mapCardConfigKey !== configKey) return;
        const entityEntry = { entity: entityId, focus: true };
        if (markerName) entityEntry.name = markerName;
        if (!hasPhoto) entityEntry.label_mode = "icon";
        const el = helpers.createCardElement({
          type: "map",
          entities: [entityEntry],
          default_zoom: 15,
          aspect_ratio: "16:10",
          auto_fit: true,
          fit_zones: false,
          hours_to_show: hours,
          theme_mode: "auto",
        });
        const freshMarkerImage = this._resolveEffectiveMarkerImage(markerImage);
        const freshHass = this._buildMapHass(
          entityId,
          freshMarkerImage,
          markerIcon,
          markerName
        );
        el.hass = freshHass;
        this._mapCardEl = el;
        currentHost.replaceChildren(el);
        this._notifyMapStatesSubscribers(freshHass?.states);
        clearTimeout(this._mapResizeTimer);
        this._mapResizeTimer = setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 320);
      })
      .catch((err) => {
        const currentHost = this.shadowRoot?.querySelector(".vehicle-map-host");
        if (!currentHost || this._mapCardConfigKey !== configKey) return;
        const msg = document.createElement("div");
        msg.className = "vehicle-map-empty";
        msg.textContent = `Unable to load map card (${err?.message || "unknown error"})`;
        currentHost.replaceChildren(msg);
      });
  }

  _openModal(vehIdx = 0, tab = "overview", ev = null) {
    if (ev) ev.stopPropagation();
    this._fireHaptic("light");
    clearTimeout(this._closeModalTimer);
    clearTimeout(this._swipeResetTimer);
    this._activeVehicleIndex = vehIdx;
    this._currentView = tab || "overview";
    this._animDirection = "none";
    const veh = this._getVehicles()[vehIdx];
    const rawImg = veh?.summary_image || veh?.image || "";
    if (rawImg) this._ensureSquaredMarkerImage(rawImg);
    if (this.config?.display_mode === "full") {
      this.requestUpdate();
      return;
    }
    this._modalOpen = true;
    this._lockBackgroundScroll();
  }

  _closeModal() {
    this._fireHaptic("light");
    clearTimeout(this._swipeResetTimer);
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    const content = this.shadowRoot?.querySelector(".popup-content");
    if (overlay) overlay.classList.add("closing");
    if (content) content.classList.add("closing");

    clearTimeout(this._closeModalTimer);
    this._closeModalTimer = setTimeout(() => {
      this._modalOpen = false;
      this._detachOverlayScrollGuard();
      this._unlockBackgroundScroll();
      this._resetMapState();
      this.requestUpdate();
    }, 180);
  }

  _navigate(direction) {
    const views = ["overview", "controls", "charging", "health"];
    const currentIdx = views.indexOf(this._currentView);
    let nextIdx = currentIdx;
    if (direction === "next" && currentIdx < views.length - 1) nextIdx++;
    else if (direction === "prev" && currentIdx > 0) nextIdx--;
    else if (typeof direction === "string" && views.includes(direction)) {
      nextIdx = views.indexOf(direction);
    }

    if (nextIdx !== currentIdx && nextIdx >= 0) {
      this._fireHaptic("light");
      this._animDirection = nextIdx > currentIdx ? "slide-left" : "slide-right";
      this._currentView = views[nextIdx];
      try {
        sessionStorage.setItem(
          this._getStorageKey("pvc_view"),
          this._currentView
        );
      } catch (e) {}
    }
  }

  _lockBackgroundScroll() {
    if (this._scrollLockedElements) return;
    const lockMap = (window.__passableScrollLocks =
      window.__passableScrollLocks || new Map());
    const targets = new Set();
    if (document.documentElement) targets.add(document.documentElement);
    if (document.body) targets.add(document.body);
    if (document.scrollingElement) targets.add(document.scrollingElement);

    let node = this.parentNode;
    while (node) {
      if (node.nodeType === 1) {
        const oy = window.getComputedStyle(node).overflowY;
        if (
          oy === "auto" ||
          oy === "scroll" ||
          oy === "overlay" ||
          node.id === "view"
        ) {
          targets.add(node);
        }
      }
      node = node.parentNode || node.host || null;
    }

    const locked = [];
    targets.forEach((el) => {
      let entry = lockMap.get(el);
      if (!entry) {
        entry = {
          count: 0,
          overflow: el.style.overflow,
          overflowY: el.style.overflowY,
          overscrollBehavior: el.style.overscrollBehavior,
        };
        lockMap.set(el, entry);
      }
      if (entry.count === 0) {
        el.style.overflowY = "hidden";
        el.style.overscrollBehavior = "none";
      }
      entry.count += 1;
      locked.push(el);
    });
    this._scrollLockedElements = locked;
  }

  _unlockBackgroundScroll() {
    if (!this._scrollLockedElements) return;
    const lockMap = window.__passableScrollLocks;
    this._scrollLockedElements.forEach((el) => {
      const entry = lockMap && lockMap.get(el);
      if (!entry) return;
      entry.count -= 1;
      if (entry.count <= 0) {
        el.style.overflow = entry.overflow;
        el.style.overflowY = entry.overflowY;
        el.style.overscrollBehavior = entry.overscrollBehavior;
        lockMap.delete(el);
      }
    });
    this._scrollLockedElements = null;
  }

  _attachOverlayScrollGuard() {
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    if (overlay === this._scrollGuardOverlay) return;
    this._detachOverlayScrollGuard();
    if (!overlay) return;
    overlay.addEventListener("wheel", this._onOverlayWheel, { passive: false });
    overlay.addEventListener("touchstart", this._onOverlayTouchStart, {
      passive: true,
    });
    overlay.addEventListener("touchmove", this._onOverlayTouchMove, {
      passive: false,
    });
    this._scrollGuardOverlay = overlay;
  }

  _detachOverlayScrollGuard() {
    if (!this._scrollGuardOverlay) return;
    this._scrollGuardOverlay.removeEventListener("wheel", this._onOverlayWheel);
    this._scrollGuardOverlay.removeEventListener(
      "touchstart",
      this._onOverlayTouchStart
    );
    this._scrollGuardOverlay.removeEventListener(
      "touchmove",
      this._onOverlayTouchMove
    );
    this._scrollGuardOverlay = null;
  }

  _findModalScrollContainer(ev, overlay) {
    const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
    const contentEl = overlay ? overlay.querySelector(".popup-content") : null;
    if (!contentEl || !path.includes(contentEl)) return null;
    for (const el of path) {
      if (el === overlay) break;
      if (!el || el.nodeType !== 1 || !contentEl.contains(el)) continue;
      const oy = window.getComputedStyle(el).overflowY;
      if (
        (oy === "auto" || oy === "scroll" || oy === "overlay") &&
        el.scrollHeight > el.clientHeight + 1
      ) {
        return el;
      }
    }
    return null;
  }

  _isInteractiveDragTarget(ev) {
    const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
    return path.some((el) => {
      if (!el || el.nodeType !== 1) return false;
      if (
        el.tagName === "HA-SLIDER" ||
        el.tagName === "SELECT" ||
        el.tagName === "HA-MAP" ||
        el.tagName === "HUI-MAP-CARD"
      ) {
        return true;
      }
      if (el.tagName === "INPUT" && el.type === "range") return true;
      if (el.dataset && el.dataset.mapHost === "true") return true;
      if (el.classList && el.classList.contains("leaflet-container")) return true;
      return false;
    });
  }

  _onOverlayWheel(ev) {
    const overlay = this._scrollGuardOverlay;
    const scroller = this._findModalScrollContainer(ev, overlay);
    if (!scroller) {
      if (ev.cancelable) ev.preventDefault();
      return;
    }
    if (
      Math.abs(ev.deltaX) > Math.abs(ev.deltaY) &&
      scroller.scrollWidth > scroller.clientWidth + 1
    ) {
      return;
    }
    const atTop = scroller.scrollTop <= 0;
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if ((ev.deltaY < 0 && atTop) || (ev.deltaY > 0 && atBottom)) {
      if (ev.cancelable) ev.preventDefault();
    }
  }

  _onOverlayTouchStart(ev) {
    if (ev.touches && ev.touches.length === 1) {
      this._guardTouchY = ev.touches[0].clientY;
      this._guardTouchX = ev.touches[0].clientX;
    }
  }

  _onOverlayTouchMove(ev) {
    if (
      !ev.touches ||
      ev.touches.length !== 1 ||
      this._isInteractiveDragTarget(ev)
    ) {
      return;
    }
    const curY = ev.touches[0].clientY;
    const curX = ev.touches[0].clientX;
    const dy = curY - this._guardTouchY;
    const dx = curX - this._guardTouchX;
    this._guardTouchY = curY;
    this._guardTouchX = curX;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) return;

    const overlay = this._scrollGuardOverlay;
    const scroller = this._findModalScrollContainer(ev, overlay);
    if (!scroller) {
      if (ev.cancelable) ev.preventDefault();
      return;
    }
    const atTop = scroller.scrollTop <= 0;
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
      if (ev.cancelable) ev.preventDefault();
    }
  }

  _handlePopupTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) return;
    if (this._isInteractiveDragTarget(e)) return;
    const popupContent = e.currentTarget;
    const scrollArea = popupContent.querySelector(".modal-scroll-area");
    const inScroll = Boolean(
      scrollArea && e.target && scrollArea.contains(e.target)
    );
    if (inScroll && scrollArea.scrollTop > 0) return;

    clearTimeout(this._swipeResetTimer);
    this._popupTouchStartY = e.touches[0].clientY;
    this._popupTouchStartX = e.touches[0].clientX;
    this._popupTouchCurrentY = this._popupTouchStartY;
    this._popupTouchTarget = popupContent;
    this._popupTouchInScroll = inScroll;
    this._popupTouchDragging = false;
    this._popupTouchLockedHorizontal = false;
  }

  _handlePopupTouchMove(e) {
    if (
      this._popupTouchStartY === undefined ||
      !this._popupTouchTarget ||
      this._popupTouchLockedHorizontal
    ) {
      return;
    }
    if (!e.touches || e.touches.length !== 1) return;
    const popupContent = this._popupTouchTarget;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - this._popupTouchStartY;
    const deltaX = currentX - (this._popupTouchStartX ?? currentX);

    if (!this._popupTouchDragging) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        this._popupTouchLockedHorizontal = true;
        return;
      }
      if (this._popupTouchInScroll) {
        const scrollArea = popupContent.querySelector(".modal-scroll-area");
        if (scrollArea && scrollArea.scrollTop > 0) {
          this._popupTouchStartY = undefined;
          this._popupTouchTarget = null;
          return;
        }
      }
      if (deltaY > 6) {
        this._popupTouchDragging = true;
        clearTimeout(this._swipeResetTimer);
        popupContent.style.animation = "none";
        popupContent.style.transition = "none";
      } else {
        return;
      }
    }

    if (deltaY > 0) {
      if (e.cancelable) e.preventDefault();
      this._popupTouchCurrentY = currentY;
      popupContent.style.transform = `translateY(${deltaY}px)`;
      const overlay = this.shadowRoot?.querySelector(".popup-overlay");
      if (overlay) {
        overlay.style.animation = "none";
        overlay.style.opacity = String(Math.max(0.2, 1 - deltaY / 360));
      }
    } else {
      this._popupTouchCurrentY = this._popupTouchStartY;
      popupContent.style.transform = "translateY(0px)";
    }
  }

  _handlePopupTouchEnd() {
    if (this._popupTouchStartY === undefined || !this._popupTouchTarget) return;
    const popupContent = this._popupTouchTarget;
    const overlay = this.shadowRoot?.querySelector(".popup-overlay");
    const wasDragging = this._popupTouchDragging;
    const deltaY =
      wasDragging && this._popupTouchCurrentY !== undefined
        ? this._popupTouchCurrentY - this._popupTouchStartY
        : 0;

    this._popupTouchStartY = undefined;
    this._popupTouchStartX = undefined;
    this._popupTouchCurrentY = undefined;
    this._popupTouchTarget = null;
    this._popupTouchInScroll = false;
    this._popupTouchDragging = false;
    this._popupTouchLockedHorizontal = false;

    if (deltaY > 80) {
      this._fireHaptic("light");
      popupContent.style.transition =
        "transform 180ms ease-in, opacity 180ms ease-in";
      popupContent.style.transform = "translateY(100%)";
      popupContent.style.opacity = "0";
      if (overlay) {
        overlay.style.transition = "opacity 180ms ease-in";
        overlay.style.opacity = "0";
      }
      clearTimeout(this._closeModalTimer);
      this._closeModalTimer = setTimeout(() => {
        this._modalOpen = false;
        this._detachOverlayScrollGuard();
        this._unlockBackgroundScroll();
        this._resetMapState();
        this.requestUpdate();
      }, 180);
    } else if (wasDragging) {
      popupContent.style.transition =
        "transform 250ms cubic-bezier(0.2, 0, 0, 1)";
      popupContent.style.transform = "translateY(0px)";
      if (overlay) {
        overlay.style.transition = "opacity 250ms cubic-bezier(0.2, 0, 0, 1)";
        overlay.style.opacity = "1";
      }
      clearTimeout(this._swipeResetTimer);
      this._swipeResetTimer = setTimeout(() => {
        popupContent.style.transition = "";
        popupContent.style.transform = "";
        popupContent.style.animation = "";
        if (overlay) {
          overlay.style.transition = "";
          overlay.style.opacity = "";
          overlay.style.animation = "";
        }
      }, 250);
    }
  }

  _handlePopupTouchCancel() {
    this._handlePopupTouchEnd();
  }

  _handleFullViewTouchStart(e) {
    if (this._isInteractiveDragTarget(e)) {
      this._touchStartX = null;
      return;
    }
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  _handleFullViewTouchEnd(e) {
    if (this._touchStartX === null) return;
    const diffX = this._touchStartX - e.changedTouches[0].clientX;
    const diffY = this._touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      this._navigate(diffX > 0 ? "next" : "prev");
    }
    this._touchStartX = null;
    this._touchStartY = null;
  }

  _toggleTelemetryTray(vehKey, ev = null) {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    this._fireHaptic("light");
    this._expandedTelemetryKeys = {
      ...(this._expandedTelemetryKeys || {}),
      [vehKey]: !this._expandedTelemetryKeys?.[vehKey],
    };
  }

  // =========================================================================
  // HOME ASSISTANT SERVICE ACTIONS & CLIMATE STAGING
  // =========================================================================

  _moreInfo(entityId, ev = null) {
    if (ev) ev.stopPropagation();
    if (!entityId) return;
    this._fireHaptic("light");
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _toggleLock(entityId, ev = null) {
    if (ev) ev.stopPropagation();
    if (!entityId || !this.hass?.states?.[entityId]) return;
    this._fireHaptic("medium");
    const isLocked = this.hass.states[entityId].state === "locked";
    const service = isLocked ? "unlock" : "lock";
    this.hass.callService("lock", service, { entity_id: entityId });
    this._showToast(`Sent ${service.toUpperCase()} command`);
  }

  _setInputSelect(entityId, option) {
    if (!entityId) return;
    this._fireHaptic("light");
    const domain = entityId.split(".")[0];
    this.hass.callService(domain, "select_option", {
      entity_id: entityId,
      option,
    });
  }

  _setLimitValue(entityId, value, unit = null) {
    if (!entityId) return;
    this._fireHaptic("light");
    const domain = entityId.startsWith("number.") ? "number" : "input_number";
    const numVal = parseFloat(value);
    this.hass.callService(domain, "set_value", {
      entity_id: entityId,
      value: numVal,
    });
    const stateObj = this.hass.states[entityId];
    const unitStr =
      unit !== null
        ? unit
        : stateObj?.attributes?.unit_of_measurement || "%";
    this._showToast(`Setting Limit to ${numVal}${unitStr}`);
  }

  _cycleWheel(vehCfg) {
    this._fireHaptic("light");
    const st = this._ensureVehicleStaging(vehCfg);
    st.wheel = st.wheel === 0 ? 1 : st.wheel === 1 ? 2 : 0;
    this._stagingRevision += 1;
  }

  _toggleDefrost(vehCfg) {
    this._fireHaptic("light");
    const st = this._ensureVehicleStaging(vehCfg);
    st.defrost = !st.defrost;
    this._stagingRevision += 1;
  }

  _toggleRearHeating(vehCfg) {
    this._fireHaptic("light");
    const st = this._ensureVehicleStaging(vehCfg);
    st.heating = st.heating > 0 ? 0 : 4;
    this._stagingRevision += 1;
  }

  _cycleSeat(vehCfg, seatKey) {
    this._fireHaptic("light");
    const st = this._ensureVehicleStaging(vehCfg);
    const levels = [0, 6, 7, 8, 3, 4, 5];
    const current = st.seats?.[seatKey] || 0;
    const idx = levels.indexOf(current);
    const next = levels[(idx + 1) % levels.length];
    st.seats = { ...(st.seats || {}), [seatKey]: next };
    this._stagingRevision += 1;
  }

  _stepStagedTemp(vehCfg, delta, min = 60, max = 85) {
    this._fireHaptic("light");
    const st = this._ensureVehicleStaging(vehCfg);
    st.temp = Math.max(min, Math.min(max, (st.temp || 72) + delta));
    this._stagingRevision += 1;
  }

  _stepStagedDuration(vehCfg, delta, min = 5, max = 30) {
    this._fireHaptic("light");
    const st = this._ensureVehicleStaging(vehCfg);
    st.duration = Math.max(min, Math.min(max, (st.duration || 15) + delta));
    this._stagingRevision += 1;
  }

  async _handleClimateStart(vehCfg, entities) {
    this._fireHaptic("medium");
    const st = this._ensureVehicleStaging(vehCfg);
    const deviceId = this._getDeviceId(vehCfg);

    const customTarget = vehCfg.start_climate_service || vehCfg.start_climate_script;
    if (customTarget) {
      const [domain, service] = customTarget.split(".");
      await this.hass.callService(domain, service, {
        device_id: deviceId || undefined,
        temperature: st.temp,
        duration: st.duration,
        climate: true,
        defrost: st.defrost,
        heating: st.heating,
        steering_wheel: st.wheel,
        flseat: st.seats.fl,
        frseat: st.seats.fr,
        rlseat: st.seats.rl,
        rrseat: st.seats.rr,
      });
      this._showToast("Climate Started. Confirming in 20s...");
      this._startPostClimateCountdown(vehCfg);
      return;
    }

    if (this.hass.services?.kia_uvo?.start_climate) {
      try {
        await this.hass.callService("kia_uvo", "start_climate", {
          device_id: deviceId || undefined,
          temperature: st.temp,
          duration: st.duration,
          climate: true,
          defrost: st.defrost,
          heating: st.heating,
          steering_wheel: st.wheel,
          flseat: st.seats.fl,
          frseat: st.seats.fr,
          rlseat: st.seats.rl,
          rrseat: st.seats.rr,
        });
        this._showToast("Climate Started. Confirming in 20s...");
        this._startPostClimateCountdown(vehCfg);
      } catch (err) {
        this._showToast("Error starting climate: " + (err.message || err));
      }
      return;
    }

    if (entities.hvac_active && entities.hvac_active.startsWith("climate.")) {
      await this.hass.callService("climate", "set_temperature", {
        entity_id: entities.hvac_active,
        temperature: st.temp,
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

  async _handleClimateStop(vehCfg, entities) {
    this._fireHaptic("medium");
    const deviceId = this._getDeviceId(vehCfg);
    const customTarget = vehCfg.stop_climate_service || vehCfg.stop_climate_script;
    if (customTarget) {
      const [domain, service] = customTarget.split(".");
      await this.hass.callService(
        domain,
        service,
        deviceId ? { device_id: deviceId } : {}
      );
      this._showToast("Climate Stopped. Confirming in 20s...");
      this._startPostClimateCountdown(vehCfg);
      return;
    }

    if (this.hass.services?.kia_uvo?.stop_climate) {
      await this.hass.callService(
        "kia_uvo",
        "stop_climate",
        deviceId ? { device_id: deviceId } : {}
      );
      this._showToast("Climate Stopped. Confirming in 20s...");
      this._startPostClimateCountdown(vehCfg);
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

  async _saveCurrentToProfile(vehCfg) {
    this._fireHaptic("medium");
    const st = this._ensureVehicleStaging(vehCfg);
    const profiles = st.profiles || [];
    const profile = profiles.find((p) => p.id === st.selectedProfileId);
    if (!profile) return;

    profile.temp = st.temp;
    profile.duration = st.duration;
    profile.defrost = st.defrost;
    profile.heating = st.heating;
    profile.steering_wheel = st.wheel;
    profile.seats = { ...(st.seats || { fl: 0, fr: 0, rl: 0, rr: 0 }) };

    const updatedProfiles = JSON.parse(JSON.stringify(profiles));
    if (vehCfg._isMultiItem && Array.isArray(this.config?.vehicles)) {
      const nextVehicles = this.config.vehicles.map((v, i) =>
        i === vehCfg._index ? { ...v, climate_profiles: updatedProfiles } : v
      );
      this.config = { ...this.config, vehicles: nextVehicles };
    } else {
      this.config = { ...this.config, climate_profiles: updatedProfiles };
    }

    try {
      const storageId = vehCfg.entity || vehCfg.key || "vehicle";
      localStorage.setItem(
        `pvc_profiles_${storageId}`,
        JSON.stringify(updatedProfiles)
      );
    } catch (e) {}

    const successMsg = `Saved settings to "${profile.name}"`;
    try {
      sessionStorage.setItem(this._getStorageKey("pvc_view"), this._currentView);
      sessionStorage.setItem(
        this._getStorageKey("pvc_profile", vehCfg.key),
        st.selectedProfileId
      );
      sessionStorage.setItem(this._getStorageKey("pvc_toast"), successMsg);
    } catch (e) {}

    let saved = false;
    try {
      saved = await this._saveConfigToLovelace(vehCfg, updatedProfiles);
    } catch (e) {
      console.warn("Could not save to Lovelace dashboard config:", e);
    }

    if (saved) {
      this._showToast(successMsg);
    } else {
      try {
        sessionStorage.removeItem(this._getStorageKey("pvc_toast"));
      } catch (e) {}
      this._showToast(`Saved "${profile.name}" (local)`);
    }
  }

  async _saveConfigToLovelace(vehCfg, updatedProfiles) {
    if (!this.hass || !this.hass.callWS) return false;
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    let urlPath = null;
    if (
      pathParts.length > 0 &&
      pathParts[0] !== "lovelace" &&
      pathParts[0] !== "config"
    ) {
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
      const isVehicleCard =
        cardType === "custom:passable-vehicle-card" ||
        cardType === "passable-vehicle-card";
      if (isVehicleCard) {
        if (vehCfg._isMultiItem && Array.isArray(card.vehicles)) {
          const targetVeh = card.vehicles[vehCfg._index];
          if (targetVeh) {
            cardFound = true;
            return {
              ...card,
              vehicles: card.vehicles.map((v, i) =>
                i === vehCfg._index
                  ? { ...v, climate_profiles: updatedProfiles }
                  : v
              ),
            };
          }
        } else {
          const isMatch =
            card.entity === this.config.entity ||
            card.battery_entity === this.config.battery_entity ||
            card.title === this.config.title ||
            (!card.entity && !this.config.entity);
          if (isMatch) {
            cardFound = true;
            return { ...card, climate_profiles: updatedProfiles };
          }
        }
      }
      if (Array.isArray(card.cards)) {
        return { ...card, cards: card.cards.map(updateCard) };
      }
      if (card.card && typeof card.card === "object") {
        return { ...card, card: updateCard(card.card) };
      }
      return card;
    };

    const newViews = dashboardConfig.views.map((view) => {
      const updatedView = { ...view };
      if (Array.isArray(updatedView.cards)) {
        updatedView.cards = updatedView.cards.map(updateCard);
      }
      if (Array.isArray(updatedView.sections)) {
        updatedView.sections = updatedView.sections.map((section) => {
          if (!Array.isArray(section.cards)) return section;
          return { ...section, cards: section.cards.map(updateCard) };
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

  _startPostClimateCountdown(vehCfg) {
    let seconds = 20;
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(this._countdownTimer);
        this._countdownTimer = null;
        this._forceUpdate(vehCfg, this._discoverEntities(vehCfg));
      }
    }, 1000);
  }

  _forceUpdate(vehCfg, entities, ev = null) {
    if (ev) ev.stopPropagation();
    this._fireHaptic("light");
    const deviceId = this._getDeviceId(vehCfg);
    if (vehCfg.force_update_service) {
      const [domain, service] = vehCfg.force_update_service.split(".");
      this.hass.callService(domain, service, deviceId ? { device_id: deviceId } : {});
      this._showToast("Force Update Sent");
    } else if (this.hass.services?.kia_uvo?.force_update) {
      this.hass.callService(
        "kia_uvo",
        "force_update",
        deviceId ? { device_id: deviceId } : {}
      );
      this._showToast("Vehicle Status Refreshed");
    } else if (entities?.force_refresh) {
      this.hass.callService("button", "press", {
        entity_id: entities.force_refresh,
      });
      this._showToast("Vehicle Refresh Pressed");
    } else {
      this._showToast("No refresh service configured");
    }
  }

  _handleChargeAction(vehCfg, entities, action, msg) {
    this._fireHaptic("medium");
    const serviceKey =
      action === "start" ? "start_charge_service" : "stop_charge_service";
    const deviceId = this._getDeviceId(vehCfg);
    if (vehCfg[serviceKey]) {
      const [domain, service] = vehCfg[serviceKey].split(".");
      this.hass.callService(domain, service, deviceId ? { device_id: deviceId } : {});
      this._showToast(msg);
    } else if (this.hass.services?.kia_uvo?.[`${action}_charge`]) {
      this.hass.callService(
        "kia_uvo",
        `${action}_charge`,
        deviceId ? { device_id: deviceId } : {}
      );
      this._showToast(msg);
    } else if (entities?.charging_switch) {
      this.hass.callService(
        "switch",
        action === "start" ? "turn_on" : "turn_off",
        { entity_id: entities.charging_switch }
      );
      this._showToast(msg);
    } else {
      this._showToast(`No charge ${action} service configured`);
    }
  }

  // =========================================================================
  // RENDERING: SUMMARY CARD & TILE
  // =========================================================================

  _renderSummaryStrip(snapshots) {
    if (this.config?.show_summary_strip === false || snapshots.length === 0) {
      return "";
    }
    const primary = snapshots[0];
    const anyCharging = snapshots.some((s) => s.isCharging);
    const anyDriving = snapshots.some((s) => s.isEngineOn);
    const anyClimate = snapshots.some((s) => s.isClimateOn);
    const anyAlert = snapshots.some((s) => s.hasAlert);

    const toneClass = anyCharging
      ? "charging"
      : anyDriving
      ? "driving"
      : anyClimate
      ? "climate"
      : anyAlert
      ? "alert"
      : primary.isPlugged
      ? "plugged"
      : "idle";

    let leftLabel = primary.statusLabel;
    if (snapshots.length > 1) {
      const chargingCount = snapshots.filter((s) => s.isCharging).length;
      const alertCount = snapshots.filter((s) => s.hasAlert).length;
      leftLabel =
        chargingCount > 0
          ? `${chargingCount} Charging`
          : anyDriving
          ? "Vehicle Active"
          : alertCount > 0
          ? `${alertCount} Attention`
          : `${snapshots.length} Vehicles Ready`;
    }

    const showQuickLock = snapshots.length === 1 && primary.hasLock;

    return html`
      <div
        class="vehicle-summary-strip ${toneClass}"
        @click=${() => this._openModal(0, "overview")}
        title="Tap to open Vehicle Command Center"
      >
        <div class="summary-strip-left">
          <span class="summary-status-dot ${toneClass}"></span>
          <span class="summary-status-label">${leftLabel}</span>
          ${primary.locationLabel
            ? html`
                <span class="summary-sep">•</span>
                <button
                  type="button"
                  class="summary-meta-pill clickable ${primary.isAway ? "away" : "home"}"
                  @click=${(e) => this._openLocationModal(primary.idx, e)}
                  title="View ${primary.vehCfg.title} location on map"
                >
                  <ha-icon icon="${primary.locationIcon}"></ha-icon>
                  <span>${primary.locationLabel}</span>
                </button>
              `
            : ""}
        </div>

        <div class="summary-strip-right">
          ${primary.relativeTime && primary.relativeTime !== "Never"
            ? html`<span class="summary-updated-text">${primary.relativeTime}</span>`
            : ""}
          ${showQuickLock
            ? html`
                <button
                  type="button"
                  class="strip-circle-btn ${primary.isLocked ? "locked" : "unlocked"}"
                  @click=${(e) => this._toggleLock(primary.entities.lock, e)}
                  title="${primary.isLocked ? "Locked — tap to unlock" : "Unlocked — tap to lock"}"
                >
                  <ha-icon
                    icon="${primary.isLocked ? "mdi:lock" : "mdi:lock-open-variant"}"
                    style="--mdc-icon-size:15px;"
                  ></ha-icon>
                </button>
              `
            : ""}
          <button
            type="button"
            class="strip-circle-btn"
            @click=${(e) => this._openModal(0, "overview", e)}
            title="Open Vehicle Command Center"
          >
            <ha-icon icon="mdi:tune-variant" style="--mdc-icon-size:15px;"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _renderRingMiniGauge(pct, valueText, subText, color) {
    const r = 17;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, pct));
    const dash = (clamped / 100) * c;
    return html`
      <div class="summary-ring-item">
        <div class="summary-ring-wrap">
          ${svg`
            <svg class="summary-ring-svg" viewBox="0 0 42 42">
              <circle
                cx="21"
                cy="21"
                r="${r}"
                fill="none"
                stroke="rgba(148, 163, 184, 0.20)"
                stroke-width="3.4"
              ></circle>
              <circle
                cx="21"
                cy="21"
                r="${r}"
                fill="none"
                stroke="${color}"
                stroke-width="3.4"
                stroke-linecap="round"
                stroke-opacity="${clamped > 0 ? 1 : 0}"
                stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}"
              ></circle>
            </svg>
          `}
          <span class="summary-ring-val">${valueText}</span>
        </div>
        <span class="summary-ring-label">${subText}</span>
      </div>
    `;
  }

  _renderVehicleTile(snap) {
    const { vehCfg, entities } = snap;
    const layout = this.config?.layout === "rings" ? "rings" : "hero";
    const thumbUrl = vehCfg.summary_image || vehCfg.image || "";
    const batColor = this._getBatteryColor(snap.batteryLevel);
    const isTrayExpanded = Boolean(this._expandedTelemetryKeys?.[vehCfg.key]);

    const chips = [];
    if (snap.isEngineOn) {
      chips.push(html`<span class="zone-inline-chip driving">On</span>`);
    }
    if (snap.hasLock && !snap.isLocked) {
      chips.push(html`<span class="zone-inline-chip warning">Unlocked</span>`);
    }
    if (snap.openClosures.length > 0) {
      const label =
        snap.openClosures.length === 1
          ? `${snap.openClosures[0].short} Open`
          : `${snap.openClosures.length} Open`;
      chips.push(html`<span class="zone-inline-chip danger">${label}</span>`);
    }
    if (snap.tpmsWarn) {
      chips.push(html`<span class="zone-inline-chip danger">TPMS</span>`);
    }
    if (snap.hasDtcAlert) {
      chips.push(
        html`<span class="zone-inline-chip danger">DTC ${snap.dtcCount}</span>`
      );
    }
    if (snap.isCharging && snap.chargePowerKw > 0.05) {
      chips.push(
        html`<span class="zone-inline-chip success">${snap.chargePowerKw.toFixed(1)} kW</span>`
      );
    }
    if (snap.isClimateOn) {
      chips.push(
        html`<span class="zone-inline-chip info">${snap.climateTemp}°F</span>`
      );
    }
    if (this._getVehicles().length > 1 && snap.locationLabel) {
      chips.push(
        html`<button
          type="button"
          class="zone-inline-chip location clickable ${snap.isAway ? "away" : ""}"
          @click=${(e) => this._openLocationModal(snap.idx, e)}
          title="View ${vehCfg.title} on map"
        >
          <ha-icon icon="${snap.locationIcon}" style="--mdc-icon-size:11px;"></ha-icon>
          <span>${snap.locationLabel}</span>
        </button>`
      );
    }

    let subText = snap.closures.length > 0 ? "All Closed" : "Standby";
    if (snap.isCharging) {
      subText =
        snap.chargeEta !== "--"
          ? `${snap.chargeEta} left${snap.acLimit ? ` to ${Math.round(snap.acLimit)}%` : ""}`
          : "Charging active";
    } else if (snap.isEngineOn) {
      subText = snap.locationLabel ? `Active · ${snap.locationLabel}` : "Vehicle active";
    } else if (snap.isClimateOn) {
      subText = `Cabin preconditioning${snap.locationLabel ? ` · ${snap.locationLabel}` : ""}`;
    } else if (snap.isPlugged) {
      subText = `Plugged${snap.acLimit ? ` · Limit ${Math.round(snap.acLimit)}%` : ""}`;
    } else if (snap.locationLabel) {
      subText = `${subText} · ${snap.locationLabel}`;
    }

    const hasQuickTrayData =
      snap.auxBattery !== null ||
      snap.odoVal !== null ||
      entities.tire_pressure ||
      snap.evseAmps !== null;

    const trayPillLabel =
      snap.auxBattery !== null ? `12V ${Math.round(snap.auxBattery)}%` : "Info";

    const stateClass =
      snap.stateTone === "charging"
        ? "active-charging"
        : snap.stateTone === "driving"
        ? "active-driving"
        : snap.stateTone === "climate"
        ? "active-climate"
        : snap.stateTone === "alert"
        ? "state-alert"
        : "";

    const rangePct =
      typeof snap.rangeVal === "number" && snap.rangeMax > 0
        ? (snap.rangeVal / snap.rangeMax) * 100
        : 0;

    return html`
      <div
        class="vehicle-zone-card ${stateClass}"
        @click=${() => this._openModal(snap.idx, "overview")}
        title="Tap to open ${vehCfg.title} Command Center"
      >
        ${this._renderSparklineSvg(vehCfg.key, batColor)}

        <div class="vehicle-zone-header">
          <div class="vehicle-zone-identity">
            ${thumbUrl
              ? html`
                  <div class="vehicle-thumb-wrap ${stateClass}">
                    <img
                      src="${thumbUrl}"
                      alt="${vehCfg.title}"
                      class="vehicle-thumb-img"
                    />
                  </div>
                `
              : html`
                  <div class="vehicle-icon-wrap ${stateClass}">
                    <ha-icon
                      icon="${vehCfg.icon || "mdi:car-electric"}"
                      class="${snap.isCharging || snap.isEngineOn ? "pulse-icon" : ""}"
                    ></ha-icon>
                  </div>
                `}

            <div class="vehicle-zone-title-wrap">
              <div class="vehicle-zone-title-row">
                <h3 class="vehicle-zone-title">${vehCfg.title}</h3>
                ${chips}
              </div>

              <div class="vehicle-zone-subtitle">
                <span class="vehicle-sub-inline ${stateClass}">
                  ${snap.isClimateOn
                    ? html`<ha-icon icon="mdi:fan" class="spin-icon"></ha-icon>`
                    : snap.isCharging
                    ? html`<ha-icon icon="mdi:lightning-bolt" class="pulse-icon"></ha-icon>`
                    : snap.isEngineOn
                    ? html`<ha-icon icon="mdi:engine" class="pulse-icon"></ha-icon>`
                    : ""}
                  <span class="sub-truncate">${subText}</span>
                </span>

                ${layout === "hero" && hasQuickTrayData
                  ? html`
                      <span class="summary-sep">•</span>
                      <button
                        type="button"
                        class="vehicle-inline-tray-btn ${isTrayExpanded ? "open" : ""}"
                        @click=${(e) => this._toggleTelemetryTray(vehCfg.key, e)}
                        title="Tap to ${isTrayExpanded ? "hide" : "show"} vehicle telemetry"
                      >
                        <span>${trayPillLabel}</span>
                        <ha-icon
                          icon="${isTrayExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}"
                        ></ha-icon>
                      </button>
                    `
                  : ""}
              </div>
            </div>
          </div>

          ${layout === "rings"
            ? html`
                <div class="summary-rings-pair">
                  ${this._renderRingMiniGauge(
                    snap.batteryLevel,
                    `${snap.batteryLevel}%`,
                    vehCfg.fuel_type === "ice" ? "Fuel" : "Battery",
                    batColor
                  )}
                  ${this._renderRingMiniGauge(
                    rangePct,
                    `${snap.rangeVal}`,
                    snap.rangeUnit,
                    "var(--info-color, #0284c7)"
                  )}
                </div>
              `
            : html`
                <div class="vehicle-zone-primary">
                  <div
                    class="vehicle-primary-val"
                    style="${snap.hasLowBattery ? "color:#ef4444;" : ""}"
                  >
                    ${snap.batteryLevel}%
                  </div>
                  <div class="vehicle-primary-sub">
                    <span class="vehicle-range-val">${snap.rangeVal} ${snap.rangeUnit}</span>
                    ${snap.isPlugged
                      ? html`
                          <span class="summary-sep">•</span>
                          <span
                            class="vehicle-plug-inline ${snap.isCharging ? "charging" : "plugged"}"
                          >
                            ${snap.isCharging ? "⚡" : "Plug"}
                          </span>
                        `
                      : ""}
                  </div>
                </div>
              `}
        </div>

        ${layout === "hero" && isTrayExpanded
          ? html`
              <div class="vehicle-telemetry-tray" @click=${(e) => e.stopPropagation()}>
                ${snap.odoVal !== null
                  ? html`
                      <div
                        class="telemetry-mini-card"
                        @click=${(e) => this._moreInfo(entities.odometer, e)}
                      >
                        <span class="t-mini-label">Odo</span>
                        <span class="t-mini-val">
                          ${snap.odoVal >= 1000
                            ? `${(snap.odoVal / 1000).toFixed(1)}k`
                            : Math.round(snap.odoVal)}
                        </span>
                      </div>
                    `
                  : ""}
                ${entities.tire_pressure
                  ? html`
                      <div
                        class="telemetry-mini-card"
                        @click=${(e) => this._moreInfo(entities.tire_pressure, e)}
                      >
                        <span class="t-mini-label">TPMS</span>
                        <span
                          class="t-mini-val ${snap.tpmsWarn ? "tone-danger" : "tone-good"}"
                        >
                          ${snap.tpmsWarn ? "Warn" : "OK"}
                        </span>
                      </div>
                    `
                  : ""}
                ${snap.evseAmps !== null
                  ? html`
                      <div
                        class="telemetry-mini-card"
                        @click=${(e) => this._moreInfo(entities.evse_current, e)}
                      >
                        <span class="t-mini-label">EVSE</span>
                        <span class="t-mini-val">${Math.round(snap.evseAmps)}A</span>
                      </div>
                    `
                  : snap.nextServiceVal !== null
                  ? html`
                      <div
                        class="telemetry-mini-card"
                        @click=${(e) => this._moreInfo(entities.next_service, e)}
                      >
                        <span class="t-mini-label">Service</span>
                        <span class="t-mini-val">
                          ${snap.odoVal !== null && snap.nextServiceVal > snap.odoVal
                            ? `${Math.round(snap.nextServiceVal - snap.odoVal).toLocaleString()} ${snap.odoUnit}`
                            : `${Math.round(snap.nextServiceVal).toLocaleString()} ${snap.odoUnit}`}
                        </span>
                      </div>
                    `
                  : ""}
              </div>
            `
          : ""}

        <div class="tile-hairline">
          <div
            class="tile-hairline-fill ${snap.isCharging ? "charging-shimmer" : ""}"
            style="width:${snap.batteryLevel}%; background:${batColor};"
          ></div>
          ${snap.acLimit !== null
            ? html`<div
                class="tile-hairline-limit"
                style="left:${Math.max(0, Math.min(100, snap.acLimit))}%;"
                title="AC Charge Limit: ${Math.round(snap.acLimit)}%"
              ></div>`
            : ""}
        </div>
      </div>
    `;
  }

  _renderFooterStrip(snapshots) {
    if (this.config?.show_footer_strip === false || snapshots.length === 0) {
      return "";
    }
    const primary = snapshots[0];
    const chargeTabLabel =
      primary.vehCfg.fuel_type === "ice" ? "Fuel" : "Charge";

    return html`
      <div class="vehicle-footer-strip">
        <div class="footer-chips">
          ${primary.hasLock
            ? html`
                <button
                  type="button"
                  class="footer-chip ${primary.isLocked ? "" : "warning"}"
                  @click=${(e) => this._toggleLock(primary.entities.lock, e)}
                >
                  <ha-icon
                    icon="${primary.isLocked ? "mdi:lock" : "mdi:lock-open-variant"}"
                    style="--mdc-icon-size:13px;"
                  ></ha-icon>
                  <span>${primary.isLocked ? "Locked" : "Unlocked"}</span>
                </button>
              `
            : ""}
          <button
            type="button"
            class="footer-chip ${primary.isClimateOn ? "info" : ""}"
            @click=${(e) => this._openModal(0, "controls", e)}
          >
            <ha-icon
              icon="mdi:fan"
              class="${primary.isClimateOn ? "spin-icon" : ""}"
              style="--mdc-icon-size:13px;"
            ></ha-icon>
            <span>
              ${primary.isClimateOn ? `Climate ${primary.climateTemp}°` : "Climate"}
            </span>
          </button>
          <button
            type="button"
            class="footer-chip ${primary.isCharging ? "success" : ""}"
            @click=${(e) => this._openModal(0, "charging", e)}
          >
            <ha-icon
              icon="${primary.vehCfg.fuel_type === "ice" ? "mdi:gas-station" : "mdi:lightning-bolt"}"
              style="--mdc-icon-size:13px;"
            ></ha-icon>
            <span>
              ${primary.isCharging && primary.chargePowerKw > 0.05
                ? `${primary.chargePowerKw.toFixed(1)} kW`
                : primary.acLimit !== null
                ? `Limit ${Math.round(primary.acLimit)}%`
                : chargeTabLabel}
            </span>
          </button>
        </div>

        <button
          type="button"
          class="footer-command-link"
          @click=${(e) => this._openModal(0, "overview", e)}
        >
          Command Center →
        </button>
      </div>
    `;
  }

  // =========================================================================
  // RENDERING: 4-TAB COMMAND CENTER VIEWS
  // =========================================================================

  _renderOverviewTab(snap) {
    const { vehCfg, entities } = snap;
    const batColor = this._getBatteryColor(snap.batteryLevel);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (snap.batteryLevel / 100) * circumference;

    let animDuration = 2.0;
    if (snap.chargePowerKw > 0) {
      if (snap.chargePowerKw < 10) animDuration = 3.0;
      else if (snap.chargePowerKw < 50) animDuration = 1.5;
      else if (snap.chargePowerKw < 100) animDuration = 0.8;
      else animDuration = 0.5;
    }
    const animStyle = `animation-duration: ${animDuration}s`;
    const tempColor = this._getTempColor(snap.climateTemp);
    const imageUrl = vehCfg.image || "";

    let doorSummary = "Closed";
    let doorIcon = "mdi:shield-check";
    let doorColorClass = "closed";
    if (snap.closures.length > 0 && snap.openClosures.length === 0) {
      doorSummary = "All Closed";
      doorIcon = "mdi:check-circle-outline";
      doorColorClass = "closed";
    } else if (snap.openClosures.length === 1) {
      doorSummary = `${snap.openClosures[0].name} Open`;
      doorIcon = snap.openClosures[0].icon;
      doorColorClass = "open";
    } else if (snap.openClosures.length > 1) {
      doorSummary = `${snap.openClosures.length} Doors Open`;
      doorIcon = "mdi:car-door-lock-open";
      doorColorClass = "open";
    }

    const nextServiceDisplay = (() => {
      if (snap.nextServiceVal === null) return { val: "--", sub: "No sensor" };
      if (snap.odoVal !== null && snap.nextServiceVal > snap.odoVal) {
        return {
          val: Math.round(snap.nextServiceVal - snap.odoVal).toLocaleString(),
          sub: `${snap.odoUnit} remaining`,
        };
      }
      return {
        val: Math.round(snap.nextServiceVal).toLocaleString(),
        sub: `${snap.odoUnit} remaining`,
      };
    })();

    return html`
      <div class="view-container overview ${this._animDirection}">
        <div class="viz-container ${snap.isEngineOn ? "engine-active" : ""}">
          ${snap.isCharging
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
          ${snap.isClimateOn
            ? html`
                <div class="climate-flow-container">
                  <div class="flow-stream s1"></div>
                  <div class="flow-stream s2"></div>
                  <div class="flow-stream s3"></div>
                </div>
              `
            : ""}
          ${snap.isEngineOn
            ? html`
                <div class="engine-motion-container">
                  <div class="motion-streak m1"></div>
                  <div class="motion-streak m2"></div>
                </div>
              `
            : ""}

          <div class="car-image-wrapper">
            ${imageUrl
              ? html`<img
                  src="${imageUrl}"
                  alt="${vehCfg.title}"
                  class="car-img"
                  @error=${(e) => (e.target.style.display = "none")}
                />`
              : html`<ha-icon
                  icon="${vehCfg.fuel_type === "ice" ? "mdi:car-side" : "mdi:car-electric"}"
                  class="fallback-icon"
                ></ha-icon>`}
          </div>

          ${snap.closures.length > 0
            ? html`
                <div
                  class="door-overlay top-left ${doorColorClass}"
                  @click=${() => this._navigate("health")}
                >
                  <ha-icon icon="${doorIcon}"></ha-icon>
                  <span>${doorSummary}</span>
                </div>
              `
            : ""}

          ${snap.hasLock
            ? html`
                <button
                  type="button"
                  class="overlay-icon top-right"
                  @click=${(e) => this._toggleLock(entities.lock, e)}
                  title="${snap.isLocked ? "Unlock Vehicle" : "Lock Vehicle"}"
                >
                  <ha-icon
                    icon="${snap.isLocked ? "mdi:lock" : "mdi:lock-open-variant"}"
                    style="color: ${snap.isLocked ? "var(--success-color, #22c55e)" : "var(--error-color, #ef4444)"};"
                  ></ha-icon>
                </button>
              `
            : ""}

          <button
            type="button"
            class="overlay-icon bottom-right"
            @click=${(e) => this._forceUpdate(vehCfg, entities, e)}
            title="Refresh Vehicle Status"
          >
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>

          ${snap.isPlugged
            ? html`
                <div
                  class="overlay-icon bottom-left ${snap.isCharging ? "pulse-charge" : ""}"
                  title="${snap.isCharging ? "Actively Charging" : "Plugged In"}"
                >
                  <ha-icon
                    icon="mdi:power-plug"
                    style="color: ${snap.isCharging ? "var(--success-color, #22c55e)" : "var(--primary-text-color)"};"
                  ></ha-icon>
                </div>
              `
            : ""}

          ${snap.isClimateOn
            ? html`
                <div
                  class="climate-bubble"
                  style="color: ${tempColor}; border-color: ${tempColor};"
                >
                  <ha-icon icon="mdi:thermometer"></ha-icon>
                  <span>${snap.climateTemp}°F</span>
                </div>
              `
            : ""}

          ${entities.battery
            ? html`
                <div
                  class="battery-ring-container"
                  @click=${(e) => this._moreInfo(entities.battery, e)}
                  title="Tap for battery history"
                >
                  ${svg`
                    <svg class="battery-ring" viewBox="0 0 100 100">
                      <circle class="ring-bg" cx="50" cy="50" r="${radius}"></circle>
                      <circle
                        class="ring-progress"
                        cx="50"
                        cy="50"
                        r="${radius}"
                        stroke="${batColor}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"
                      ></circle>
                    </svg>
                  `}
                  <div class="battery-ring-content">
                    ${snap.isCharging
                      ? html`<ha-icon
                          icon="mdi:lightning-bolt"
                          class="ring-charge-icon"
                        ></ha-icon>`
                      : ""}
                    <span class="ring-val">${snap.batteryLevel}%</span>
                    <span class="ring-range">${snap.rangeVal} ${snap.rangeUnit}</span>
                  </div>
                </div>
              `
            : ""}
        </div>

        <div class="vehicle-kpi-grid">
          <div
            class="vehicle-kpi-card clickable"
            @click=${(e) => this._moreInfo(entities.aux_battery || entities.battery, e)}
          >
            <span class="kpi-label">12V AUX</span>
            <span
              class="kpi-val ${snap.auxBattery !== null && snap.auxBattery < 60 ? "warn" : "good"}"
            >
              ${snap.auxBattery !== null ? `${Math.round(snap.auxBattery)}%` : "--"}
            </span>
            <span class="kpi-sub">
              ${snap.auxBattery === null
                ? "No sensor"
                : snap.auxBattery < 60
                ? "Low"
                : "Healthy"}
            </span>
          </div>

          <div
            class="vehicle-kpi-card clickable"
            @click=${(e) => this._moreInfo(entities.odometer, e)}
          >
            <span class="kpi-label">ODOMETER</span>
            <span class="kpi-val">
              ${snap.odoVal !== null ? Math.floor(snap.odoVal).toLocaleString() : "--"}
            </span>
            <span class="kpi-sub">${snap.odoUnit}</span>
          </div>

          <div
            class="vehicle-kpi-card clickable"
            @click=${(e) => this._moreInfo(entities.tire_pressure, e)}
          >
            <span class="kpi-label">TIRE PRESSURE</span>
            <span class="kpi-val ${snap.tpmsWarn ? "danger" : "good"}">
              ${entities.tire_pressure ? (snap.tpmsWarn ? "Warning" : "OK") : "--"}
            </span>
            <span class="kpi-sub">
              ${entities.tire_pressure ? "TPMS Monitor" : "No sensor"}
            </span>
          </div>

          <div
            class="vehicle-kpi-card clickable"
            @click=${(e) => this._moreInfo(entities.next_service, e)}
          >
            <span class="kpi-label">NEXT SERVICE</span>
            <span class="kpi-val">${nextServiceDisplay.val}</span>
            <span class="kpi-sub">${nextServiceDisplay.sub}</span>
          </div>
        </div>

        ${this._renderLocationSection(snap)}

        <div class="passable-section-card quick-actions-banner">
          <div>
            <div class="passable-section-title">Quick Actions</div>
            <div class="quick-actions-sub">
              Updated ${snap.relativeTime}
              ${snap.locationLabel ? ` • ${snap.locationLabel}` : ""}
            </div>
          </div>
          <div class="quick-actions-btns">
            <button
              type="button"
              class="pill-nav-btn"
              @click=${() => this._navigate("controls")}
            >
              Precondition
            </button>
            <button
              type="button"
              class="pill-nav-btn primary"
              @click=${() => this._navigate("charging")}
            >
              ${vehCfg.fuel_type === "ice" ? "Fuel Info" : "Manage Charge"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderLocationSection(snap) {
    const { vehCfg, entities } = snap;
    if (!entities.location && !snap.locationLabel && !snap.hasLocationCoords) {
      return html``;
    }
    const isExpanded = this._getIsMapExpanded(snap);
    const mapsUrl = snap.hasLocationCoords
      ? this._getExternalMapsUrl(
          snap.locationLat,
          snap.locationLng,
          vehCfg.title
        )
      : "";
    const badgeTone = snap.isAway
      ? "away"
      : snap.rawLocationState === "home"
      ? "home"
      : "neutral";
    const coordsText =
      snap.hasLocationCoords && (snap.isAway || isExpanded)
        ? `${snap.locationLat.toFixed(4)}, ${snap.locationLng.toFixed(4)}`
        : "";
    const updatedText =
      snap.locationUpdatedRel && snap.locationUpdatedRel !== "Never"
        ? `Updated ${snap.locationUpdatedRel}`
        : `Updated ${snap.relativeTime}`;
    const subText = coordsText ? `${updatedText} · ${coordsText}` : updatedText;

    return html`
      <div
        class="passable-section-card location-section-card ${isExpanded ? "expanded" : ""}"
      >
        <div
          class="location-card-header"
          @click=${() => this._toggleLocationMap(vehCfg.key, isExpanded)}
          title="${isExpanded ? "Collapse vehicle map" : "Expand vehicle map"}"
        >
          <div class="location-identity">
            <div class="location-badge-icon ${badgeTone}">
              <ha-icon icon="${snap.locationIcon}"></ha-icon>
            </div>
            <div class="location-title-group">
              <div class="location-title-row">
                <span class="passable-section-title">Location</span>
                <span class="location-status-chip ${badgeTone}">
                  ${snap.locationLabel || "Tracked"}
                </span>
              </div>
              <div class="location-sub-text">${subText}</div>
            </div>
          </div>

          <div class="location-header-actions">
            ${snap.hasLocationCoords
              ? html`
                  <a
                    class="location-directions-btn"
                    href="${mapsUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click=${(e) => e.stopPropagation()}
                    title="Open directions in Maps"
                  >
                    <ha-icon icon="mdi:directions"></ha-icon>
                    <span>Directions</span>
                  </a>
                `
              : ""}
            <button
              type="button"
              class="location-toggle-btn ${isExpanded ? "active" : ""}"
              aria-expanded="${isExpanded ? "true" : "false"}"
              @click=${(e) => this._toggleLocationMap(vehCfg.key, isExpanded, e)}
              title="${isExpanded ? "Hide map" : "Show map"}"
            >
              <span>${isExpanded ? "Hide" : "Map"}</span>
              <ha-icon
                icon="${isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}"
              ></ha-icon>
            </button>
          </div>
        </div>

        ${isExpanded
          ? html`
              <div class="location-map-body">
                <div class="location-map-toolbar">
                  <div class="location-trail-meta">
                    <span class="location-trail-label">Route trail</span>
                    <div
                      class="map-trail-group"
                      role="group"
                      aria-label="Route history range"
                    >
                      ${[
                        { hours: 0, label: "Pin" },
                        { hours: 2, label: "2h" },
                        { hours: 24, label: "24h" },
                      ].map(
                        (opt) => html`
                          <button
                            type="button"
                            class="map-trail-btn ${this._mapTrailHours === opt.hours ? "active" : ""}"
                            aria-pressed="${this._mapTrailHours === opt.hours ? "true" : "false"}"
                            @click=${(e) => this._setMapTrailHours(opt.hours, e)}
                          >
                            ${opt.label}
                          </button>
                        `
                      )}
                    </div>
                  </div>
                  ${entities.location
                    ? html`
                        <button
                          type="button"
                          class="location-info-btn"
                          @click=${(e) => this._moreInfo(entities.location, e)}
                          title="Location entity history"
                        >
                          <ha-icon icon="mdi:information-outline"></ha-icon>
                        </button>
                      `
                    : ""}
                </div>

                <div class="vehicle-map-wrap">
                  ${snap.hasLocationCoords && entities.location
                    ? html`
                        <div
                          class="vehicle-map-host"
                          data-map-host="true"
                          data-entity-id="${entities.location}"
                          data-hours="${this._mapTrailHours}"
                          data-marker-image="${vehCfg.summary_image || vehCfg.image || ""}"
                          data-marker-icon="${vehCfg.icon || (vehCfg.fuel_type === "ice" ? "mdi:car" : "mdi:car-electric")}"
                          data-marker-name="${vehCfg.title || ""}"
                          data-has-photo="${vehCfg.summary_image || vehCfg.image ? "true" : "false"}"
                          @context-request=${this._onMapContextRequest}
                        ></div>
                      `
                    : html`
                        <div class="vehicle-map-empty">
                          <ha-icon icon="mdi:map-marker-off-outline"></ha-icon>
                          <span>
                            No GPS coordinates currently reported by
                            ${entities.location || "location tracker"}.
                          </span>
                        </div>
                      `}
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  _renderClimateTab(snap) {
    const { vehCfg, entities } = snap;
    const st = this._ensureVehicleStaging(vehCfg);
    const profiles = st.profiles || DEFAULT_CLIMATE_PROFILES;
    const tColor = this._getTempColor(st.temp);

    return html`
      <div class="view-container controls ${this._animDirection}">
        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">Driver Presets</span>
            <span class="zone-inline-chip ${snap.isClimateOn ? "info" : "neutral"}">
              ${snap.isClimateOn ? `Active · ${snap.climateTemp}°F` : "Climate Off"}
            </span>
          </div>
          <div class="profile-selector">
            ${profiles.map(
              (p) => html`
                <button
                  type="button"
                  class="profile-chip ${p.id === st.selectedProfileId ? "active" : ""}"
                  @click=${() => this._selectProfile(vehCfg, p.id)}
                >
                  <ha-icon icon="${p.icon || "mdi:account"}"></ha-icon>
                  <span>${p.name} (${p.temp ?? 72}°)</span>
                </button>
              `
            )}
          </div>
        </div>

        <div class="climate-steppers-grid">
          <div class="passable-section-card stepper-card">
            <span class="stepper-card-label">TARGET TEMP</span>
            <div class="hero-stepper-pill">
              <button
                type="button"
                class="hero-step-btn"
                @click=${() => this._stepStagedTemp(vehCfg, -1)}
              >
                −
              </button>
              <span class="hero-step-val" style="color:${tColor};">
                ${Math.round(st.temp)}°
              </span>
              <button
                type="button"
                class="hero-step-btn"
                @click=${() => this._stepStagedTemp(vehCfg, 1)}
              >
                +
              </button>
            </div>
          </div>

          <div class="passable-section-card stepper-card">
            <span class="stepper-card-label">DURATION</span>
            <div class="hero-stepper-pill">
              <button
                type="button"
                class="hero-step-btn"
                @click=${() => this._stepStagedDuration(vehCfg, -5)}
              >
                −
              </button>
              <span class="hero-step-val" style="color:var(--primary-color);">
                ${Math.round(st.duration)}<span class="stepper-unit">m</span>
              </span>
              <button
                type="button"
                class="hero-step-btn"
                @click=${() => this._stepStagedDuration(vehCfg, 5)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">Cabin & Seat Comfort</span>
          </div>
          <div class="comfort-grid-3">
            ${this._renderStagedWheel(vehCfg, st)}
            ${this._renderStagedDefrost(vehCfg, st)}
            ${this._renderStagedHeating(vehCfg, st)}
          </div>
          <div class="comfort-grid-2">
            ${this._renderStagedSeat(vehCfg, st, "fl", "Driver (FL)")}
            ${this._renderStagedSeat(vehCfg, st, "fr", "Passenger (FR)")}
            ${this._renderStagedSeat(vehCfg, st, "rl", "Rear Left (RL)")}
            ${this._renderStagedSeat(vehCfg, st, "rr", "Rear Right (RR)")}
          </div>
        </div>

        <div class="action-buttons">
          <button
            type="button"
            class="action-btn start"
            @click=${() => this._handleClimateStart(vehCfg, entities)}
          >
            <ha-icon icon="mdi:fan"></ha-icon> Start Climate
          </button>
          <button
            type="button"
            class="action-btn stop"
            @click=${() => this._handleClimateStop(vehCfg, entities)}
          >
            <ha-icon icon="mdi:stop"></ha-icon> Stop
          </button>
          <button
            type="button"
            class="action-btn save"
            title="Save current settings to active profile"
            @click=${() => this._saveCurrentToProfile(vehCfg)}
          >
            <ha-icon icon="mdi:content-save"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  _renderStagedWheel(vehCfg, st) {
    const level = st.wheel || 0;
    const isActive = level > 0;
    const filledDots = level === 2 ? 3 : level;
    const stateText = level === 2 ? "HIGH" : level === 1 ? "LOW" : "OFF";
    return html`
      <button
        type="button"
        class="seat-widget small-widget ${isActive ? "heat" : "off"}"
        @click=${() => this._cycleWheel(vehCfg)}
      >
        <ha-icon icon="mdi:steering"></ha-icon>
        <span class="seat-label">Wheel</span>
        <div class="dots-container">
          ${[0, 1, 2].map(
            (i) =>
              html`<div class="dot ${i < filledDots ? "dot-active-heat" : ""}"></div>`
          )}
        </div>
        <span class="seat-state">${stateText}</span>
      </button>
    `;
  }

  _renderStagedDefrost(vehCfg, st) {
    const isActive = !!st.defrost;
    return html`
      <button
        type="button"
        class="seat-widget small-widget ${isActive ? "heat" : "off"}"
        @click=${() => this._toggleDefrost(vehCfg)}
      >
        <ha-icon icon="mdi:car-defrost-front"></ha-icon>
        <span class="seat-label">Front Defrost</span>
        <div class="dots-container"><div class="dot-spacer"></div></div>
        <span class="seat-state">${isActive ? "ON" : "OFF"}</span>
      </button>
    `;
  }

  _renderStagedHeating(vehCfg, st) {
    const isActive = (st.heating || 0) > 0;
    return html`
      <button
        type="button"
        class="seat-widget small-widget ${isActive ? "heat" : "off"}"
        @click=${() => this._toggleRearHeating(vehCfg)}
      >
        <ha-icon icon="mdi:car-defrost-rear"></ha-icon>
        <span class="seat-label">Rear / Mirrors</span>
        <div class="dots-container"><div class="dot-spacer"></div></div>
        <span class="seat-state">${isActive ? "ON" : "OFF"}</span>
      </button>
    `;
  }

  _renderStagedSeat(vehCfg, st, seatKey, label) {
    const level = st.seats?.[seatKey] || 0;
    let mode = "off";
    let dotCount = 0;
    let stateText = "OFF";
    if (level >= 3 && level <= 5) {
      mode = "cool";
      dotCount = level - 2;
      stateText =
        dotCount === 3 ? "COOL HIGH" : dotCount === 2 ? "COOL MID" : "COOL LOW";
    } else if (level >= 6 && level <= 8) {
      mode = "heat";
      dotCount = level - 5;
      stateText =
        dotCount === 3 ? "HEAT HIGH" : dotCount === 2 ? "HEAT MID" : "HEAT LOW";
    }
    const seatIcon =
      mode === "heat"
        ? "mdi:car-seat-heater"
        : mode === "cool"
        ? "mdi:car-seat-cooler"
        : "mdi:car-seat";

    return html`
      <button
        type="button"
        class="seat-widget ${mode}"
        @click=${() => this._cycleSeat(vehCfg, seatKey)}
      >
        <ha-icon icon="${seatIcon}"></ha-icon>
        <span class="seat-label">${label}</span>
        <div class="dots-container">
          ${[0, 1, 2].map(
            (i) =>
              html`<div
                class="dot ${i < dotCount ? (mode === "heat" ? "dot-active-heat" : "dot-active-cool") : ""}"
              ></div>`
          )}
        </div>
        <span class="seat-state">${stateText}</span>
      </button>
    `;
  }

  _renderChargeTab(snap) {
    const { vehCfg, entities } = snap;
    const isIce = vehCfg.fuel_type === "ice";

    return html`
      <div class="view-container charging ${this._animDirection}">
        <div
          class="passable-section-card charge-hero-card ${snap.isCharging ? "active-charging" : ""}"
        >
          <div class="charge-hero-left">
            <div
              class="vehicle-icon-wrap ${snap.isCharging ? "active-charging" : snap.isPlugged ? "active-climate" : ""}"
            >
              <ha-icon
                icon="${isIce ? "mdi:gas-station" : snap.isCharging ? "mdi:lightning-bolt" : "mdi:power-plug"}"
              ></ha-icon>
            </div>
            <div>
              <div class="charge-hero-title">
                ${isIce
                  ? `Fuel Level: ${snap.batteryLevel}%`
                  : snap.isCharging
                  ? `Charging${snap.chargePowerKw > 0.05 ? ` at ${snap.chargePowerKw.toFixed(1)} kW` : ""}`
                  : snap.isPlugged
                  ? "Plugged In · Standby"
                  : "Unplugged"}
              </div>
              <div class="charge-hero-sub">
                ${snap.isCharging && snap.chargeEta !== "--"
                  ? `${snap.chargeEta} remaining${snap.acLimit ? ` to ${Math.round(snap.acLimit)}%` : ""}`
                  : `${isIce ? "Fuel" : "Battery"} ${snap.batteryLevel}% (${snap.rangeVal} ${snap.rangeUnit})${snap.acLimit !== null ? ` • AC Limit ${Math.round(snap.acLimit)}%` : ""}`}
              </div>
            </div>
          </div>
          <span
            class="zone-inline-chip ${snap.isCharging ? "success" : snap.isPlugged ? "info" : "neutral"}"
          >
            ${snap.isCharging ? "ACTIVE" : snap.isPlugged ? "PLUGGED" : "IDLE"}
          </span>
        </div>

        ${entities.ac_limit || entities.dc_limit
          ? html`
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Vehicle Charge Limits</span>
                </div>
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
                        "DC Fast Charge Limit",
                        "%",
                        50,
                        100,
                        10
                      )
                    : ""}
                </div>
              </div>
            `
          : ""}

        ${entities.evse_current
          ? html`
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">EVSE / Wall Charger Current</span>
                </div>
                ${this._renderEvseCurrentControl(vehCfg, entities.evse_current)}
              </div>
            `
          : ""}

        ${entities.ac_current
          ? html`
              <div class="passable-section-card">
                <div class="passable-section-header">
                  <span class="passable-section-title">Vehicle AC Charging Current</span>
                </div>
                <div class="current-selector">
                  ${this._renderCurrentChips(entities.ac_current)}
                </div>
              </div>
            `
          : ""}

        ${!isIce
          ? html`
              <div class="action-buttons">
                <button
                  type="button"
                  class="action-btn start"
                  @click=${() =>
                    this._handleChargeAction(
                      vehCfg,
                      entities,
                      "start",
                      "Charge Started"
                    )}
                >
                  <ha-icon icon="mdi:lightning-bolt"></ha-icon> Start Charging
                </button>
                <button
                  type="button"
                  class="action-btn stop"
                  @click=${() =>
                    this._handleChargeAction(
                      vehCfg,
                      entities,
                      "stop",
                      "Charge Stopped"
                    )}
                >
                  <ha-icon icon="mdi:stop"></ha-icon> Stop Charging
                </button>
              </div>
            `
          : ""}
      </div>
    `;
  }

  _renderSliderControl(entityId, label, unit, min, max, step) {
    const stateObj = this.hass?.states?.[entityId];
    if (!stateObj) return html``;

    const entityMin =
      stateObj.attributes?.min !== undefined ? Number(stateObj.attributes.min) : min;
    const entityMax =
      stateObj.attributes?.max !== undefined ? Number(stateObj.attributes.max) : max;
    const entityStep =
      stateObj.attributes?.step !== undefined
        ? Number(stateObj.attributes.step)
        : step;

    const staged = this._stagedLimits?.[entityId];
    const val = staged !== undefined ? staged : parseFloat(stateObj.state) || entityMin;
    const pct =
      entityMax > entityMin
        ? Math.max(0, Math.min(100, ((val - entityMin) / (entityMax - entityMin)) * 100))
        : 0;

    return html`
      <div class="slider-control">
        <div class="slider-header">
          <span class="slider-label">${label}</span>
          <span class="slider-value">${val}${unit}</span>
        </div>
        <div class="p-slider-wrap">
          <div class="p-slider-track">
            <div class="p-slider-fill" style="width:${pct}%;"></div>
          </div>
          <input
            type="range"
            class="p-range-input"
            .min=${String(entityMin)}
            .max=${String(entityMax)}
            .step=${String(entityStep)}
            .value=${String(val)}
            @input=${(e) => {
              this._stagedLimits = {
                ...(this._stagedLimits || {}),
                [entityId]: parseFloat(e.target.value),
              };
            }}
            @change=${(e) => {
              const next = parseFloat(e.target.value);
              const nextMap = { ...(this._stagedLimits || {}) };
              delete nextMap[entityId];
              this._stagedLimits = nextMap;
              this._setLimitValue(entityId, next, unit);
            }}
          />
        </div>
        <div class="slider-ticks">
          <span>${entityMin}${unit}</span>
          <span>${entityMax}${unit}</span>
        </div>
      </div>
    `;
  }

  _renderEvseCurrentControl(vehCfg, entityId) {
    const stateObj = this.hass?.states?.[entityId];
    if (!stateObj) return html``;

    const isSelect =
      entityId.startsWith("select.") || entityId.startsWith("input_select.");
    const voltage = parseFloat(vehCfg?.evse_voltage) || 240;

    if (isSelect) {
      const options =
        stateObj.attributes?.options?.length > 0
          ? stateObj.attributes.options
          : ["6A", "16A", "24A", "32A", "40A", "48A"];
      return html`
        <div class="current-selector">
          ${options.map((opt) => {
            const num = parseFloat(opt) || 0;
            const kw = num > 0 ? ((num * voltage) / 1000).toFixed(1) : null;
            const isActive = stateObj.state === opt;
            return html`
              <button
                type="button"
                class="profile-chip ${isActive ? "active" : ""}"
                title=${kw ? `~${kw} kW` : ""}
                @click=${() => this._setInputSelect(entityId, opt)}
              >
                ${opt}${kw ? html`<span class="chip-kw"> (~${kw} kW)</span>` : ""}
              </button>
            `;
          })}
        </div>
      `;
    }

    const min =
      stateObj.attributes?.min !== undefined ? Number(stateObj.attributes.min) : 0;
    const max =
      stateObj.attributes?.max !== undefined ? Number(stateObj.attributes.max) : 48;
    const step =
      stateObj.attributes?.step !== undefined ? Number(stateObj.attributes.step) : 1;
    const unit = stateObj.attributes?.unit_of_measurement || "A";
    const currentVal =
      this._stagedEvseCurrent !== null && this._stagedEvseCurrent !== undefined
        ? this._stagedEvseCurrent
        : parseFloat(stateObj.state) || min;
    const kw = ((currentVal * voltage) / 1000).toFixed(1);
    const pct =
      max > min ? Math.max(0, Math.min(100, ((currentVal - min) / (max - min)) * 100)) : 0;

    return html`
      <div class="slider-control">
        <div class="slider-header">
          <span class="slider-label">Current Limit</span>
          <span class="zone-inline-chip info">${currentVal}${unit} · ~${kw} kW</span>
        </div>
        <div class="p-slider-wrap">
          <div class="p-slider-track">
            <div class="p-slider-fill" style="width:${pct}%;"></div>
          </div>
          <input
            type="range"
            class="p-range-input"
            .min=${String(min)}
            .max=${String(max)}
            .step=${String(step)}
            .value=${String(currentVal)}
            @input=${(e) => {
              this._stagedEvseCurrent = parseFloat(e.target.value);
            }}
            @change=${(e) => {
              const val = parseFloat(e.target.value);
              this._stagedEvseCurrent = null;
              this._setLimitValue(entityId, val, unit);
            }}
          />
        </div>
        <div class="slider-ticks">
          <span>${min}${unit} (~${((min * voltage) / 1000).toFixed(1)} kW)</span>
          <span>${max}${unit} (~${((max * voltage) / 1000).toFixed(1)} kW)</span>
        </div>
      </div>
    `;
  }

  _renderCurrentChips(entityId) {
    const stateObj = this.hass?.states?.[entityId];
    const options =
      stateObj?.attributes?.options?.length > 0
        ? stateObj.attributes.options
        : ["60%", "90%", "100%"];
    const current = stateObj?.state;
    return options.map(
      (opt) => html`
        <button
          type="button"
          class="profile-chip ${current === opt ? "active" : ""}"
          @click=${() => this._setInputSelect(entityId, opt)}
        >
          ${opt}
        </button>
      `
    );
  }

  _renderHealthTab(snap) {
    const { vehCfg, entities } = snap;
    const diagRows = [];

    if (entities.aux_battery && snap.auxBattery !== null) {
      diagRows.push({
        label: "12V Aux Battery",
        value: `${Math.round(snap.auxBattery)}%`,
        tone: snap.auxBattery < 60 ? "warn" : "good",
        entity: entities.aux_battery,
      });
    }
    if (entities.tire_pressure) {
      diagRows.push({
        label: "Tire Pressure (TPMS)",
        value: snap.tpmsWarn ? "Low Pressure" : "All OK",
        tone: snap.tpmsWarn ? "danger" : "good",
        entity: entities.tire_pressure,
      });
    }
    if (entities.dtc_count && snap.dtcCount !== null) {
      diagRows.push({
        label: "Diagnostic Codes (DTC)",
        value: `${snap.dtcCount} Active`,
        tone: snap.dtcCount > 0 ? "danger" : "good",
        entity: entities.dtc_count,
      });
    }
    if (entities.washer_fluid) {
      diagRows.push({
        label: "Washer Fluid",
        value: snap.washerWarn ? "Low" : "OK",
        tone: snap.washerWarn ? "warn" : "good",
        entity: entities.washer_fluid,
      });
    }
    if (entities.key_battery) {
      diagRows.push({
        label: "Smart Key Battery",
        value: snap.keyBatWarn ? "Low" : "OK",
        tone: snap.keyBatWarn ? "warn" : "good",
        entity: entities.key_battery,
      });
    }
    if (entities.engine) {
      diagRows.push({
        label: "Engine / Ignition",
        value: snap.isEngineOn ? "On" : "Off",
        tone: snap.isEngineOn ? "info" : "neutral",
        entity: entities.engine,
      });
    }
    if (entities.odometer && snap.odoVal !== null) {
      diagRows.push({
        label: "Odometer",
        value: `${Math.floor(snap.odoVal).toLocaleString()} ${snap.odoUnit}`,
        tone: "neutral",
        entity: entities.odometer,
      });
    }
    if (entities.next_service && snap.nextServiceVal !== null) {
      diagRows.push({
        label: "Next Service",
        value: `${Math.round(snap.nextServiceVal).toLocaleString()} ${snap.odoUnit}`,
        tone: "neutral",
        entity: entities.next_service,
      });
    }
    if (entities.location && snap.locationLabel) {
      diagRows.push({
        label: "Location",
        value: snap.locationLabel,
        tone: "neutral",
        entity: entities.location,
      });
    }

    return html`
      <div class="view-container health ${this._animDirection}">
        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">Doors & Closures</span>
            <span
              class="zone-inline-chip ${snap.openClosures.length === 0 ? "success" : "danger"}"
            >
              ${snap.closures.length === 0
                ? "No Sensors"
                : snap.openClosures.length === 0
                ? "All Closed"
                : `${snap.openClosures.length} Open`}
            </span>
          </div>
          ${snap.closures.length > 0
            ? html`
                <div class="closures-grid">
                  ${snap.closures.map(
                    (c) => html`
                      <div
                        class="closure-item ${c.isOpen ? "open" : ""}"
                        @click=${(e) => this._moreInfo(c.id, e)}
                      >
                        <span class="closure-name">${c.name}</span>
                        <span class="closure-state ${c.isOpen ? "open" : "closed"}">
                          ${c.isOpen ? "Open" : "Closed"}
                        </span>
                      </div>
                    `
                  )}
                </div>
              `
            : html`<div class="empty-hint">No door or hatch sensors discovered.</div>`}
        </div>

        <div class="passable-section-card">
          <div class="passable-section-header">
            <span class="passable-section-title">Diagnostics & Maintenance</span>
            <span class="zone-inline-chip neutral">Synced ${snap.relativeTime}</span>
          </div>
          ${diagRows.length > 0
            ? html`
                <div class="diag-list">
                  ${diagRows.map(
                    (r) => html`
                      <div
                        class="diag-row"
                        @click=${(e) => this._moreInfo(r.entity, e)}
                      >
                        <span class="diag-label">${r.label}</span>
                        <span class="diag-val tone-${r.tone}">${r.value}</span>
                      </div>
                    `
                  )}
                </div>
              `
            : html`<div class="empty-hint">No diagnostic sensors discovered.</div>`}
        </div>

        <button
          type="button"
          class="refresh-full-btn"
          @click=${(e) => this._forceUpdate(vehCfg, entities, e)}
        >
          <ha-icon icon="mdi:refresh" style="--mdc-icon-size:16px;"></ha-icon>
          <span>Force Vehicle Cloud Refresh</span>
        </button>
      </div>
    `;
  }

  _renderTabContent(snap) {
    switch (this._currentView) {
      case "controls":
        return this._renderClimateTab(snap);
      case "charging":
        return this._renderChargeTab(snap);
      case "health":
        return this._renderHealthTab(snap);
      case "overview":
      default:
        return this._renderOverviewTab(snap);
    }
  }

  _renderModal(snapshots) {
    if (!this._modalOpen || this.config?.display_mode === "full") return "";
    const snap = snapshots[this._activeVehicleIndex] || snapshots[0];
    if (!snap) return "";

    const { vehCfg, entities } = snap;
    const tabs =
      vehCfg.fuel_type === "ice" ? VEHICLE_TABS_ICE : VEHICLE_TABS_EV;
    const iconTone =
      snap.stateTone === "charging"
        ? "active-charging"
        : snap.stateTone === "driving"
        ? "active-driving"
        : snap.stateTone === "climate"
        ? "active-climate"
        : "";

    return html`
      <div
        class="popup-overlay"
        @click=${(ev) => {
          if (ev.target === ev.currentTarget) this._closeModal();
        }}
      >
        <div
          class="popup-content"
          @click=${(ev) => ev.stopPropagation()}
          @touchstart=${this._handlePopupTouchStart}
          @touchmove=${this._handlePopupTouchMove}
          @touchend=${this._handlePopupTouchEnd}
          @touchcancel=${this._handlePopupTouchCancel}
        >
          <div class="drag-handle"></div>

          <div class="popup-header">
            <div class="popup-header-left">
              <div class="vehicle-icon-wrap compact ${iconTone}">
                <ha-icon
                  icon="${vehCfg.icon || "mdi:car-electric"}"
                  style="--mdc-icon-size:19px;"
                ></ha-icon>
              </div>
              <div class="popup-title-stack">
                <h3>${vehCfg.title} Command Center</h3>
                <div class="popup-header-sub">
                  ${snap.batteryLevel}% • ${snap.rangeVal} ${snap.rangeUnit}
                  ${snap.locationLabel ? ` • ${snap.locationLabel}` : ""}
                  ${snap.relativeTime && snap.relativeTime !== "Never"
                    ? ` • ${snap.relativeTime}`
                    : ""}
                </div>
              </div>
            </div>

            <div class="popup-header-actions">
              ${snap.hasLock
                ? html`
                    <button
                      type="button"
                      class="zone-inline-chip clickable ${snap.isLocked ? "neutral" : "warning"}"
                      @click=${(e) => this._toggleLock(entities.lock, e)}
                    >
                      <ha-icon
                        icon="${snap.isLocked ? "mdi:lock" : "mdi:lock-open-variant"}"
                        style="--mdc-icon-size:13px;"
                      ></ha-icon>
                      <span>${snap.isLocked ? "Locked" : "Unlock"}</span>
                    </button>
                  `
                : ""}
              <button
                type="button"
                class="close-button"
                @click=${() => this._closeModal()}
                aria-label="Close"
              >
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          </div>

          ${snapshots.length > 1
            ? html`
                <div class="vehicle-switcher-row">
                  ${snapshots.map(
                    (s) => html`
                      <button
                        type="button"
                        class="vehicle-switch-pill ${s.idx === snap.idx ? "active" : ""}"
                        @click=${() => {
                          this._fireHaptic("light");
                          this._activeVehicleIndex = s.idx;
                        }}
                      >
                        <ha-icon
                          icon="${s.vehCfg.icon || "mdi:car-electric"}"
                          style="--mdc-icon-size:14px;"
                        ></ha-icon>
                        <span>${s.vehCfg.title} (${s.batteryLevel}%)</span>
                      </button>
                    `
                  )}
                </div>
              `
            : ""}

          <div class="popup-tabs">
            ${tabs.map(
              (t) => html`
                <button
                  type="button"
                  class="popup-tab ${this._currentView === t.id ? "active-tab" : ""}"
                  @click=${() => this._navigate(t.id)}
                >
                  <ha-icon icon="${t.icon}"></ha-icon>
                  <span>${t.label}</span>
                </button>
              `
            )}
          </div>

          <div class="modal-scroll-area thin-scroll">
            ${this._renderTabContent(snap)}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  render() {
    if (!this.hass || !this.config) return html``;

    const c = this.config;
    const vehicles = this._getVehicles();
    const snapshots = vehicles.map((v, idx) => this._getVehicleSnapshot(v, idx));
    const activeSnap = snapshots[this._activeVehicleIndex] || snapshots[0];
    const isFullMode = c.display_mode === "full";
    const titleIcon =
      c.icon || (c.fuel_type === "ice" ? "mdi:car" : "mdi:car-electric");

    const headerSubtext =
      c.subtitle ||
      (snapshots.length > 1
        ? `${snapshots.length} Vehicles • ${activeSnap.statusLabel}`
        : `${activeSnap.batteryLevel}% • ${activeSnap.rangeVal} ${activeSnap.rangeUnit} • ${activeSnap.statusLabel}`);

    return html`
      <ha-card>
        <div class="toast ${this._toastMsg ? "show" : ""}">
          <ha-icon icon="mdi:check-circle" style="--mdc-icon-size:16px;"></ha-icon>
          <span>${this._toastMsg}</span>
        </div>

        ${c.show_header !== false
          ? html`
              <div class="header">
                <div class="header-top-row">
                  <h1 class="title">
                    <ha-icon
                      icon="${titleIcon}"
                      style="margin-right:8px; color: var(--primary-color);"
                    ></ha-icon>
                    ${c.title || "Vehicle"}
                  </h1>
                  <span class="header-state-chip ${activeSnap.stateTone}">
                    ${activeSnap.isCharging
                      ? "CHARGING"
                      : activeSnap.isEngineOn
                      ? "DRIVING"
                      : activeSnap.isClimateOn
                      ? "CLIMATE ON"
                      : activeSnap.isPlugged
                      ? "PLUGGED"
                      : "IDLE"}
                  </span>
                </div>
                <div class="header-subtitle-row">
                  <p class="subtitle">${headerSubtext}</p>
                </div>
              </div>
            `
          : ""}

        ${isFullMode
          ? html`
              <div
                class="card-content ${c.show_header === false ? "no-header" : ""}"
                @touchstart=${this._handleFullViewTouchStart}
                @touchend=${this._handleFullViewTouchEnd}
              >
                ${snapshots.length > 1
                  ? html`
                      <div class="vehicle-switcher-row">
                        ${snapshots.map(
                          (s) => html`
                            <button
                              type="button"
                              class="vehicle-switch-pill ${s.idx === activeSnap.idx ? "active" : ""}"
                              @click=${() => {
                                this._fireHaptic("light");
                                this._activeVehicleIndex = s.idx;
                              }}
                            >
                              <ha-icon
                                icon="${s.vehCfg.icon || "mdi:car-electric"}"
                                style="--mdc-icon-size:14px;"
                              ></ha-icon>
                              <span>${s.vehCfg.title} (${s.batteryLevel}%)</span>
                            </button>
                          `
                        )}
                      </div>
                    `
                  : ""}

                <div class="popup-tabs inline-tabs">
                  ${(activeSnap.vehCfg.fuel_type === "ice"
                    ? VEHICLE_TABS_ICE
                    : VEHICLE_TABS_EV
                  ).map(
                    (t) => html`
                      <button
                        type="button"
                        class="popup-tab ${this._currentView === t.id ? "active-tab" : ""}"
                        @click=${() => this._navigate(t.id)}
                      >
                        <ha-icon icon="${t.icon}"></ha-icon>
                        <span>${t.label}</span>
                      </button>
                    `
                  )}
                </div>

                ${this._renderTabContent(activeSnap)}
              </div>
            `
          : html`
              <div
                class="card-content ${c.show_header === false ? "no-header" : ""}"
              >
                ${this._renderSummaryStrip(snapshots)}
                <div class="vehicles-stack">
                  ${snapshots.map((snap) => this._renderVehicleTile(snap))}
                </div>
                ${this._renderFooterStrip(snapshots)}
              </div>
            `}

        ${this._renderModal(snapshots)}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        --seat-heat-color: #f97316;
        --seat-cool-color: #0284c7;
        --seat-off-color: var(--secondary-text-color);
        display: block;
        width: 100%;
        box-sizing: border-box;
      }

      ha-card {
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--ha-card-background, var(--card-background-color, #fff));
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        overflow: hidden;
        color: var(--primary-text-color);
        position: relative;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }

      .toast {
        position: fixed;
        top: 18px;
        left: 50%;
        transform: translateX(-50%) translateY(-14px);
        background: var(--primary-text-color);
        color: var(--card-background-color, #fff);
        padding: 8px 16px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 700;
        pointer-events: none;
        opacity: 0;
        transition: all 0.25s ease;
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      }
      .toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* HEADER */
      .header {
        padding: 16px 16px 14px;
        display: flex;
        flex-direction: column;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        margin-bottom: 12px;
        gap: 4px;
      }
      .header-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        width: 100%;
      }
      .title {
        font-size: 24px;
        font-weight: 500;
        margin: 0;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .header-subtitle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin-top: 2px;
      }
      .subtitle {
        color: var(--secondary-text-color, #757575);
        font-size: 14px;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .header-state-chip {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 999px;
        text-transform: uppercase;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.14));
        color: var(--secondary-text-color);
        flex-shrink: 0;
      }
      .header-state-chip.charging {
        background: rgba(34, 197, 94, 0.16);
        color: #16a34a;
      }
      .header-state-chip.driving {
        background: rgba(99, 102, 241, 0.18);
        color: #6366f1;
      }
      .header-state-chip.climate {
        background: rgba(14, 165, 233, 0.16);
        color: #0284c7;
      }
      .header-state-chip.alert {
        background: rgba(245, 158, 11, 0.18);
        color: #d97706;
      }

      .card-content {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        container-type: inline-size;
      }
      .card-content.no-header {
        padding: 10px;
      }
      .header + .card-content {
        padding-top: 0;
      }

      /* SUMMARY STRIP (Sibling of .hvac-summary-strip & .light-summary-strip) */
      .vehicle-summary-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 7px 12px;
        border-radius: max(12px, calc(var(--ha-card-border-radius, 20px) - 8px));
        min-height: 36px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
        cursor: pointer;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      .vehicle-summary-strip:hover {
        border-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.35);
      }
      .vehicle-summary-strip.charging {
        background: rgba(34, 197, 94, 0.08);
        border-color: rgba(34, 197, 94, 0.32);
      }
      .vehicle-summary-strip.driving {
        background: rgba(99, 102, 241, 0.09);
        border-color: rgba(99, 102, 241, 0.34);
      }
      .vehicle-summary-strip.climate {
        background: rgba(14, 165, 233, 0.09);
        border-color: rgba(14, 165, 233, 0.32);
      }
      .vehicle-summary-strip.alert {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.36);
      }
      .summary-strip-left {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
      }
      .summary-strip-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        white-space: nowrap;
      }
      .summary-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
        background: var(--disabled-text-color, #94a3b8);
      }
      .summary-status-dot.plugged {
        background: #0284c7;
        box-shadow: 0 0 6px rgba(2, 132, 199, 0.55);
      }
      .summary-status-dot.charging {
        background: #22c55e;
        box-shadow: 0 0 7px rgba(34, 197, 94, 0.7);
        animation: gentle-pulse 1.8s ease-in-out infinite;
      }
      .summary-status-dot.driving {
        background: #6366f1;
        box-shadow: 0 0 7px rgba(99, 102, 241, 0.7);
        animation: gentle-pulse 1.6s ease-in-out infinite;
      }
      .summary-status-dot.climate {
        background: #0ea5e9;
        box-shadow: 0 0 7px rgba(14, 165, 233, 0.7);
        animation: gentle-pulse 1.8s ease-in-out infinite;
      }
      .summary-status-dot.alert {
        background: #f59e0b;
        box-shadow: 0 0 7px rgba(245, 158, 11, 0.7);
        animation: gentle-pulse 1.5s ease-in-out infinite;
      }
      .summary-status-label {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .summary-sep {
        opacity: 0.4;
        font-size: 12px;
      }
      .summary-meta-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: var(--secondary-text-color);
        font-size: 12.5px;
        font-weight: 600;
      }
      .summary-meta-pill ha-icon {
        --mdc-icon-size: 14px;
      }
      .summary-meta-pill.clickable {
        appearance: none;
        font-family: inherit;
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        border-radius: 999px;
        padding: 2px 8px;
        line-height: 1.25;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
      }
      .summary-meta-pill.clickable:hover {
        border-color: var(--primary-color, #03a9f4);
        color: var(--primary-text-color);
      }
      .summary-meta-pill.clickable.home ha-icon {
        color: #16a34a;
      }
      .summary-meta-pill.clickable.away {
        background: rgba(14, 165, 233, 0.12);
        border-color: rgba(14, 165, 233, 0.34);
        color: #0284c7;
      }
      .summary-meta-pill.clickable.away:hover {
        background: rgba(14, 165, 233, 0.2);
      }
      .summary-updated-text {
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-text-color);
      }
      @media (max-width: 380px) {
        .summary-updated-text {
          display: none;
        }
      }
      .strip-circle-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        color: var(--primary-text-color);
        cursor: pointer;
        padding: 0;
        transition: all 0.15s ease;
      }
      .strip-circle-btn:hover {
        border-color: var(--primary-color, #03a9f4);
      }
      .strip-circle-btn.locked {
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.35);
        background: rgba(34, 197, 94, 0.12);
      }
      .strip-circle-btn.unlocked {
        color: #d97706;
        border-color: rgba(245, 158, 11, 0.45);
        background: rgba(245, 158, 11, 0.16);
      }

      /* VEHICLE ZONE SUMMARY TILE (Sibling of .hvac-unit-card & .light-zone-card) */
      .vehicles-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .vehicle-zone-card {
        position: relative;
        overflow: hidden;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        border-radius: max(12px, calc(var(--ha-card-border-radius, 20px) - 8px));
        padding: 10px 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        cursor: pointer;
      }
      .vehicle-zone-card:hover {
        border-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.38);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
      }
      .vehicle-zone-card.active-charging {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.45);
        box-shadow: 0 3px 12px rgba(34, 197, 94, 0.14);
      }
      .vehicle-zone-card.active-driving {
        background: rgba(99, 102, 241, 0.1);
        border-color: rgba(99, 102, 241, 0.45);
        box-shadow: 0 3px 12px rgba(99, 102, 241, 0.14);
      }
      .vehicle-zone-card.active-climate {
        background: rgba(14, 165, 233, 0.1);
        border-color: rgba(14, 165, 233, 0.45);
        box-shadow: 0 3px 12px rgba(14, 165, 233, 0.14);
      }
      .vehicle-zone-card.state-alert {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.48);
        box-shadow: 0 3px 12px rgba(245, 158, 11, 0.14);
      }

      .summary-sparkline-layer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 54px;
        pointer-events: none;
        opacity: 0.22;
        z-index: 0;
      }
      .summary-sparkline-svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      .vehicle-zone-header {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        min-width: 0;
      }
      .vehicle-zone-identity {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }
      .vehicle-thumb-wrap {
        width: 72px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 3px 5px;
        box-sizing: border-box;
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.18));
        overflow: hidden;
      }
      .vehicle-thumb-wrap.active-charging {
        border-color: rgba(34, 197, 94, 0.45);
        box-shadow: 0 0 10px rgba(34, 197, 94, 0.22);
      }
      .vehicle-thumb-wrap.active-driving {
        border-color: rgba(99, 102, 241, 0.45);
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.24);
      }
      .vehicle-thumb-wrap.active-climate {
        border-color: rgba(14, 165, 233, 0.45);
        box-shadow: 0 0 10px rgba(14, 165, 233, 0.22);
      }
      .vehicle-thumb-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .vehicle-icon-wrap {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: rgba(128, 128, 128, 0.14);
        color: var(--secondary-text-color);
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .vehicle-icon-wrap.compact {
        width: 36px;
        height: 36px;
        border-radius: 10px;
      }
      .vehicle-icon-wrap.active-charging {
        background: rgba(34, 197, 94, 0.2);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.45);
        box-shadow: 0 0 8px rgba(34, 197, 94, 0.22);
      }
      .vehicle-icon-wrap.active-driving {
        background: rgba(99, 102, 241, 0.2);
        color: #6366f1;
        border-color: rgba(99, 102, 241, 0.45);
        box-shadow: 0 0 8px rgba(99, 102, 241, 0.22);
      }
      .vehicle-icon-wrap.active-climate {
        background: rgba(14, 165, 233, 0.2);
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.45);
        box-shadow: 0 0 8px rgba(14, 165, 233, 0.22);
      }

      .vehicle-zone-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        flex: 1;
        overflow: hidden;
      }
      .vehicle-zone-title-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
        min-width: 0;
      }
      .vehicle-zone-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--primary-text-color);
        margin: 0;
        line-height: 1.2;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .vehicle-zone-subtitle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        color: var(--secondary-text-color);
        min-width: 0;
        line-height: 1.25;
      }
      .vehicle-sub-inline {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        overflow: hidden;
      }
      .vehicle-sub-inline ha-icon {
        --mdc-icon-size: 14px;
        flex-shrink: 0;
      }
      .vehicle-sub-inline.active-charging {
        color: #16a34a;
      }
      .vehicle-sub-inline.active-climate {
        color: #0284c7;
      }
      .vehicle-sub-inline.active-driving {
        color: #6366f1;
      }
      .sub-truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .vehicle-inline-tray-btn {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 7px;
        border-radius: 999px;
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .vehicle-inline-tray-btn ha-icon {
        --mdc-icon-size: 14px;
        color: var(--secondary-text-color);
      }
      .vehicle-inline-tray-btn.open,
      .vehicle-inline-tray-btn:hover {
        border-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.45);
        background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
      }

      /* RIGHT READOUT: HERO VS DUAL RINGS */
      .vehicle-zone-primary {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }
      .vehicle-primary-val {
        font-size: 26px;
        font-weight: 800;
        line-height: 1;
        color: var(--primary-text-color);
        letter-spacing: -0.03em;
      }
      .vehicle-primary-sub {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        font-weight: 700;
        color: var(--secondary-text-color);
        margin-top: 3px;
        white-space: nowrap;
      }
      .vehicle-plug-inline.charging {
        color: #16a34a;
      }
      .vehicle-plug-inline.plugged {
        color: #0284c7;
      }

      .summary-rings-pair {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .summary-ring-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .summary-ring-wrap {
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .summary-ring-svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      .summary-ring-val {
        position: absolute;
        font-size: 11.5px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
      }
      .summary-ring-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--secondary-text-color);
        line-height: 1;
      }

      /* EXPANDABLE TELEMETRY TRAY */
      .vehicle-telemetry-tray {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-top: 4px;
        padding-top: 7px;
        border-top: 1px dashed var(--divider-color, rgba(128, 128, 128, 0.24));
      }
      .telemetry-mini-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 6px 9px;
        border-radius: 8px;
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
        cursor: pointer;
      }
      .t-mini-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-text-color);
      }
      .t-mini-val {
        font-size: 12.5px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
      }
      .t-mini-val.tone-good {
        color: #16a34a;
      }
      .t-mini-val.tone-danger {
        color: #ef4444;
      }

      /* HAIRLINE BATTERY PROGRESS BAR */
      .tile-hairline {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: rgba(148, 163, 184, 0.16);
        z-index: 2;
      }
      .tile-hairline-fill {
        height: 100%;
        position: relative;
        overflow: hidden;
        transition: width 0.3s ease;
      }
      .tile-hairline-fill.charging-shimmer::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.65) 50%,
          transparent 100%
        );
        animation: battery-shimmer 1.8s infinite linear;
      }
      @keyframes battery-shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
      .tile-hairline-limit {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--primary-text-color);
        opacity: 0.6;
      }

      /* INLINE CHIPS & FOOTER STRIP */
      .zone-inline-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        flex-shrink: 0;
        border: 1px solid transparent;
        font-family: inherit;
      }
      .zone-inline-chip.clickable {
        cursor: pointer;
      }
      .zone-inline-chip.neutral {
        background: rgba(128, 128, 128, 0.14);
        color: var(--secondary-text-color);
        border-color: rgba(128, 128, 128, 0.24);
      }
      .zone-inline-chip.info {
        background: rgba(14, 165, 233, 0.16);
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.3);
      }
      .zone-inline-chip.success {
        background: rgba(34, 197, 94, 0.16);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.32);
      }
      .zone-inline-chip.warning {
        background: rgba(245, 158, 11, 0.16);
        color: #d97706;
        border-color: rgba(245, 158, 11, 0.36);
      }
      .zone-inline-chip.danger {
        background: rgba(239, 68, 68, 0.16);
        color: #dc2626;
        border-color: rgba(239, 68, 68, 0.36);
      }
      .zone-inline-chip.driving {
        background: rgba(99, 102, 241, 0.16);
        color: #6366f1;
        border-color: rgba(99, 102, 241, 0.36);
      }
      .zone-inline-chip.location {
        background: rgba(34, 197, 94, 0.14);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.32);
      }
      .zone-inline-chip.location.away {
        background: rgba(14, 165, 233, 0.16);
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.34);
      }

      .vehicle-footer-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 6px;
        padding: 2px 2px 0;
      }
      .footer-chips {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 5px;
      }
      .footer-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .footer-chip:hover {
        border-color: var(--primary-color, #03a9f4);
        color: var(--primary-text-color);
      }
      .footer-chip.info {
        background: rgba(14, 165, 233, 0.14);
        border-color: rgba(14, 165, 233, 0.38);
        color: #0284c7;
      }
      .footer-chip.success {
        background: rgba(34, 197, 94, 0.14);
        border-color: rgba(34, 197, 94, 0.38);
        color: #16a34a;
      }
      .footer-chip.warning {
        background: rgba(245, 158, 11, 0.16);
        border-color: rgba(245, 158, 11, 0.42);
        color: #d97706;
      }
      .footer-command-link {
        background: none;
        border: none;
        padding: 2px 4px;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--primary-color, #0284c7);
        cursor: pointer;
      }

      /* ANIMATIONS */
      @keyframes spin-slow {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .spin-icon {
        animation: spin-slow 2.5s linear infinite;
        display: inline-flex;
      }
      @keyframes gentle-pulse {
        0%, 100% { opacity: 0.78; transform: scale(0.95); }
        50% { opacity: 1; transform: scale(1.08); }
      }
      .pulse-icon {
        animation: gentle-pulse 1.8s ease-in-out infinite;
        display: inline-flex;
      }

      /* POPUP MODAL COMMAND CENTER & BOTTOM SHEET */
      @keyframes ha-popup-backdrop-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ha-popup-backdrop-fade-out { from { opacity: 1; } to { opacity: 0; } }
      @keyframes ha-popup-dialog-in {
        from { opacity: 0; transform: translateY(20px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes ha-popup-dialog-out {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(12px) scale(0.97); }
      }
      @keyframes ha-popup-sheet-in {
        from { transform: translateY(100%); opacity: 0.5; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes ha-popup-sheet-out {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100%); opacity: 0; }
      }

      .popup-overlay {
        position: fixed;
        inset: 0;
        background-color: var(--mdc-dialog-scrim-color, var(--dialog-backdrop-background, rgba(0, 0, 0, 0.35)));
        backdrop-filter: var(--dialog-backdrop-filter, none);
        -webkit-backdrop-filter: var(--dialog-backdrop-filter, none);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px;
        box-sizing: border-box;
        overscroll-behavior: contain;
        z-index: 9999;
        animation: ha-popup-backdrop-fade-in 240ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .popup-overlay.closing {
        animation: ha-popup-backdrop-fade-out 180ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .popup-content {
        background-color: var(--ha-card-background, var(--card-background-color, #fff));
        padding: 16px 18px 20px;
        border-radius: var(--ha-dialog-border-radius, var(--ha-card-border-radius, 24px));
        width: 100%;
        max-width: 520px;
        max-height: 90vh;
        overflow: hidden;
        overscroll-behavior: contain;
        touch-action: pan-y;
        color: var(--primary-text-color);
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
        box-sizing: border-box;
        animation: ha-popup-dialog-in 240ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .popup-content.closing {
        animation: ha-popup-dialog-out 180ms cubic-bezier(0.2, 0, 0, 1) forwards;
      }
      .drag-handle {
        display: none;
      }
      .popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .popup-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
      }
      .popup-title-stack {
        min-width: 0;
      }
      .popup-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .popup-header-sub {
        font-size: 12px;
        color: var(--secondary-text-color);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .popup-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .close-button {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: var(--primary-text-color);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      .close-button:hover {
        background-color: rgba(128, 128, 128, 0.15);
      }

      .vehicle-switcher-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .vehicle-switch-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.1));
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .vehicle-switch-pill.active {
        background: var(--primary-color, #3b82f6);
        border-color: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
      }

      .popup-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
        padding: 4px;
        border-radius: 14px;
        gap: 4px;
        box-sizing: border-box;
      }
      .popup-tabs.inline-tabs {
        margin-bottom: 2px;
      }
      .popup-tab {
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 7px 4px;
        border-radius: 10px;
        background: transparent;
        border: none;
        font-family: inherit;
        color: var(--secondary-text-color);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .popup-tab ha-icon {
        --mdc-icon-size: 16px;
      }
      .popup-tab.active-tab {
        background: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
      }
      @media (max-width: 460px) {
        .popup-tabs {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .popup-tab {
          flex-direction: row;
          gap: 6px;
          padding: 8px 10px;
        }
      }

      .modal-scroll-area {
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        max-height: 60vh;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-right: 3px;
      }
      .thin-scroll::-webkit-scrollbar {
        width: 5px;
      }
      .thin-scroll::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.35);
        border-radius: 999px;
      }

      .view-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation-duration: 0.22s;
        animation-fill-mode: both;
      }
      .slide-left { animation-name: slideLeft; }
      .slide-right { animation-name: slideRight; }
      @keyframes slideLeft {
        from { opacity: 0; transform: translateX(14px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideRight {
        from { opacity: 0; transform: translateX(-14px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .passable-section-card {
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        border-radius: 16px;
        padding: 12px 13px;
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .passable-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .passable-section-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--primary-text-color);
      }

      /* OVERVIEW HERO VISUAL */
      .viz-container {
        position: relative;
        min-height: 205px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .viz-container.engine-active {
        border-color: rgba(99, 102, 241, 0.4);
      }
      .charging-effect,
      .climate-flow-container,
      .engine-motion-container {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .charge-beam {
        position: absolute;
        bottom: 0;
        width: 40px;
        background: linear-gradient(to top, rgba(34, 197, 94, 0.45), transparent);
        filter: blur(8px);
        opacity: 0;
        transform-origin: bottom;
      }
      .b1 { left: 20%; height: 60%; animation: chargeRise infinite ease-in; }
      .b2 { left: 50%; height: 80%; transform: translateX(-50%); animation: chargeRise infinite ease-in; }
      .b3 { right: 20%; height: 50%; animation: chargeRise infinite ease-in; }
      @keyframes chargeRise {
        0% { transform: scaleY(0); opacity: 0; }
        20% { opacity: 0.65; }
        100% { transform: scaleY(1.2); opacity: 0; }
      }
      .flow-stream {
        position: absolute;
        background: linear-gradient(
          90deg,
          rgba(14, 165, 233, 0) 0%,
          rgba(14, 165, 233, 0.45) 50%,
          rgba(14, 165, 233, 0) 100%
        );
        border-radius: 10px;
        filter: blur(5px);
        opacity: 0;
      }
      .s1 { top: 32%; left: 10%; width: 40%; height: 14px; animation: windFlow 3s infinite linear; }
      .s2 { top: 48%; left: 5%; width: 60%; height: 22px; animation: windFlow 4s infinite linear 1.2s; }
      .s3 { top: 62%; left: 15%; width: 50%; height: 12px; animation: windFlow 3.5s infinite linear 0.5s; }
      @keyframes windFlow {
        0% { transform: translateX(-90px) scaleX(0.5); opacity: 0; }
        25%, 75% { opacity: 0.6; }
        100% { transform: translateX(100px) scaleX(1.2); opacity: 0; }
      }
      .motion-streak {
        position: absolute;
        bottom: 18px;
        height: 4px;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.6), transparent);
        animation: windFlow 1.8s infinite linear;
      }
      .m1 { left: 12%; width: 35%; }
      .m2 { left: 45%; width: 40%; animation-delay: 0.8s; }

      .car-image-wrapper {
        position: relative;
        width: 100%;
        height: 195px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        pointer-events: none;
      }
      .car-img {
        max-width: 80%;
        max-height: 82%;
        object-fit: contain;
        filter: drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.22));
      }
      .fallback-icon {
        --mdc-icon-size: 120px;
        color: var(--secondary-text-color);
        opacity: 0.4;
      }
      .door-overlay {
        position: absolute;
        top: 10px;
        left: 10px;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        padding: 5px 11px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 700;
        z-index: 2;
        border: 1px solid var(--divider-color);
        cursor: pointer;
      }
      .door-overlay.closed { color: var(--success-color, #22c55e); }
      .door-overlay.open { color: var(--error-color, #ef4444); }
      .door-overlay ha-icon { --mdc-icon-size: 16px; }

      .overlay-icon {
        position: absolute;
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
        cursor: pointer;
        z-index: 2;
        border: 1px solid var(--divider-color);
        color: var(--primary-text-color);
        padding: 0;
      }
      .top-right { top: 10px; right: 10px; }
      .bottom-left { bottom: 10px; left: 10px; }
      .bottom-right { bottom: 10px; right: 10px; }

      .climate-bubble {
        position: absolute;
        top: 46%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(var(--rgb-card-background-color, 128, 128, 128), 0.35);
        backdrop-filter: blur(2px);
        width: 74px;
        height: 74px;
        border-radius: 50%;
        border: 2px solid;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 4;
      }
      .climate-bubble ha-icon { --mdc-icon-size: 24px; }
      .climate-bubble span { font-size: 15px; font-weight: 800; }

      .battery-ring-container {
        position: absolute;
        bottom: 6px;
        left: 50%;
        transform: translateX(-50%);
        width: 86px;
        height: 86px;
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
        fill: var(--ha-card-background, var(--card-background-color, #fff));
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
        line-height: 1.05;
      }
      .ring-val {
        font-size: 16px;
        font-weight: 800;
        color: var(--primary-text-color);
      }
      .ring-range {
        font-size: 11px;
        font-weight: 600;
        color: var(--secondary-text-color);
      }
      .ring-charge-icon {
        --mdc-icon-size: 15px;
        color: var(--success-color, #22c55e);
      }

      /* 4-KPI GRID */
      .vehicle-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
      }
      @media (max-width: 480px) {
        .vehicle-kpi-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .vehicle-kpi-card {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 12px;
        background: var(--secondary-background-color, rgba(128, 128, 128, 0.08));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .vehicle-kpi-card.clickable {
        cursor: pointer;
      }
      .vehicle-kpi-card.clickable:hover {
        border-color: var(--primary-color, #03a9f4);
      }
      .kpi-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.03em;
        color: var(--secondary-text-color);
      }
      .kpi-val {
        font-size: 16px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        color: var(--primary-text-color);
      }
      .kpi-val.good { color: #16a34a; }
      .kpi-val.warn { color: #d97706; }
      .kpi-val.danger { color: #ef4444; }
      .kpi-sub {
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .quick-actions-banner {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      }
      .quick-actions-sub {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }
      .quick-actions-btns {
        display: flex;
        gap: 6px;
      }
      .pill-nav-btn {
        padding: 6px 12px;
        border-radius: 10px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .pill-nav-btn.primary {
        background: var(--primary-color, #3b82f6);
        border-color: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
      }

      /* LOCATION & EMBEDDED MAP SECTION */
      .location-section-card {
        gap: 10px;
      }
      .location-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        cursor: pointer;
        user-select: none;
      }
      .location-identity {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1 1 180px;
      }
      .location-badge-icon {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: rgba(128, 128, 128, 0.14);
        color: var(--secondary-text-color);
      }
      .location-badge-icon ha-icon {
        --mdc-icon-size: 18px;
      }
      .location-badge-icon.home {
        background: rgba(34, 197, 94, 0.15);
        color: #16a34a;
      }
      .location-badge-icon.away {
        background: rgba(14, 165, 233, 0.16);
        color: #0284c7;
      }
      .location-title-group {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .location-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .location-status-chip {
        display: inline-flex;
        align-items: center;
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.3;
        background: rgba(128, 128, 128, 0.14);
        color: var(--secondary-text-color);
        border: 1px solid rgba(128, 128, 128, 0.24);
      }
      .location-status-chip.home {
        background: rgba(34, 197, 94, 0.14);
        color: #16a34a;
        border-color: rgba(34, 197, 94, 0.32);
      }
      .location-status-chip.away {
        background: rgba(14, 165, 233, 0.15);
        color: #0284c7;
        border-color: rgba(14, 165, 233, 0.34);
      }
      .location-sub-text {
        font-size: 12px;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .location-header-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .location-directions-btn,
      .location-toggle-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        border-radius: 10px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        text-decoration: none;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;
      }
      .location-directions-btn ha-icon,
      .location-toggle-btn ha-icon {
        --mdc-icon-size: 15px;
      }
      .location-directions-btn:hover,
      .location-toggle-btn:hover {
        border-color: var(--primary-color, #03a9f4);
      }
      .location-toggle-btn.active {
        background: var(--primary-color, #3b82f6);
        border-color: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
      }
      .location-map-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
      }
      .location-map-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .location-trail-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .location-trail-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--secondary-text-color);
      }
      .map-trail-group {
        display: inline-flex;
        align-items: center;
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        border-radius: 9px;
        padding: 2px;
        gap: 2px;
      }
      .map-trail-btn {
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 7px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .map-trail-btn:hover {
        color: var(--primary-text-color);
      }
      .map-trail-btn.active {
        background: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
      }
      .location-info-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        background: var(--card-background-color, rgba(128, 128, 128, 0.1));
        color: var(--secondary-text-color);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
      }
      .location-info-btn:hover {
        color: var(--primary-text-color);
        border-color: var(--primary-color, #03a9f4);
      }
      .location-info-btn ha-icon {
        --mdc-icon-size: 16px;
      }
      .vehicle-map-wrap {
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
      }
      .vehicle-map-host {
        display: block;
        width: 100%;
        min-height: 210px;
        touch-action: pan-x pan-y pinch-zoom;
      }
      .vehicle-map-host hui-map-card {
        display: block;
        width: 100%;
        --ha-card-border-width: 0;
        --ha-card-box-shadow: none;
        --ha-card-border-radius: 12px;
      }
      .vehicle-map-host[data-has-photo="true"] hui-map-card {
        --ha-marker-size: 52px;
        --ha-marker-background: var(--ha-card-background, var(--card-background-color, #1e293b));
      }
      .vehicle-map-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 20px 14px;
        font-size: 12.5px;
        color: var(--secondary-text-color);
        text-align: center;
      }
      .vehicle-map-empty ha-icon {
        --mdc-icon-size: 18px;
        flex-shrink: 0;
      }

      /* CLIMATE TAB */
      .profile-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .profile-chip {
        flex: 1;
        min-width: 100px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        border-radius: 12px;
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .profile-chip.active {
        background: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
        border-color: var(--primary-color, #3b82f6);
      }
      .climate-steppers-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .stepper-card {
        align-items: center;
        gap: 6px;
      }
      .stepper-card-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: var(--secondary-text-color);
      }
      .hero-stepper-pill {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      .hero-step-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        color: var(--primary-text-color);
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .hero-step-val {
        font-size: 24px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        min-width: 48px;
        text-align: center;
      }
      .stepper-unit {
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-text-color);
      }

      .comfort-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 7px;
      }
      .comfort-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }
      .seat-widget {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 8px 6px;
        border-radius: 12px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.18));
        background: var(--card-background-color, rgba(128, 128, 128, 0.06));
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s ease;
      }
      .seat-widget ha-icon {
        --mdc-icon-size: 26px;
      }
      .seat-widget.heat {
        border-color: rgba(249, 115, 22, 0.45);
        background: rgba(249, 115, 22, 0.1);
      }
      .seat-widget.cool {
        border-color: rgba(2, 132, 199, 0.45);
        background: rgba(2, 132, 199, 0.1);
      }
      .seat-widget.heat ha-icon,
      .seat-widget.heat .seat-state {
        color: var(--seat-heat-color);
      }
      .seat-widget.cool ha-icon,
      .seat-widget.cool .seat-state {
        color: var(--seat-cool-color);
      }
      .seat-widget.off ha-icon {
        color: var(--seat-off-color);
      }
      .seat-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-text-color);
      }
      .seat-state {
        font-size: 11px;
        font-weight: 800;
        color: var(--secondary-text-color);
      }
      .dots-container {
        display: flex;
        gap: 3px;
        height: 6px;
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
        background-color: var(--seat-heat-color);
        opacity: 1;
      }
      .dot-active-cool {
        background-color: var(--seat-cool-color);
        opacity: 1;
      }

      /* CHARGE TAB & SLIDERS */
      .charge-hero-card {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
      .charge-hero-card.active-charging {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.42);
      }
      .charge-hero-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .charge-hero-title {
        font-size: 14px;
        font-weight: 700;
      }
      .charge-hero-sub {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .slider-group {
        display: flex;
        flex-direction: column;
        gap: 12px;
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
        font-size: 12.5px;
        font-weight: 700;
      }
      .slider-value {
        color: var(--primary-color);
        font-variant-numeric: tabular-nums;
      }
      .p-slider-wrap {
        position: relative;
        height: 22px;
        display: flex;
        align-items: center;
      }
      .p-slider-track {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.22);
        overflow: hidden;
      }
      .p-slider-fill {
        height: 100%;
        background: var(--primary-color, #3b82f6);
        border-radius: 999px;
      }
      .p-range-input {
        position: absolute;
        inset: 0;
        width: 100%;
        margin: 0;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
      }
      .p-range-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--primary-color, #3b82f6);
        border: 2px solid var(--card-background-color, #fff);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      }
      .p-range-input::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--primary-color, #3b82f6);
        border: 2px solid var(--card-background-color, #fff);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      }
      .slider-ticks {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--secondary-text-color);
      }
      .current-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }
      .chip-kw {
        font-size: 11px;
        opacity: 0.85;
      }

      /* HEALTH TAB */
      .closures-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }
      .closure-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 10px;
        border-radius: 10px;
        background: var(--card-background-color, rgba(128, 128, 128, 0.06));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.16));
        font-size: 12.5px;
        cursor: pointer;
      }
      .closure-item.open {
        border-color: rgba(239, 68, 68, 0.45);
        background: rgba(239, 68, 68, 0.1);
      }
      .closure-name {
        font-weight: 600;
      }
      .closure-state.closed {
        font-weight: 700;
        color: #16a34a;
      }
      .closure-state.open {
        font-weight: 700;
        color: #ef4444;
      }
      .diag-list {
        display: flex;
        flex-direction: column;
      }
      .diag-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 2px;
        border-bottom: 1px solid var(--divider-color, rgba(128, 128, 128, 0.14));
        font-size: 12.5px;
        cursor: pointer;
      }
      .diag-row:last-child {
        border-bottom: none;
      }
      .diag-label {
        color: var(--secondary-text-color);
        font-weight: 500;
      }
      .diag-val {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .diag-val.tone-good { color: #16a34a; }
      .diag-val.tone-warn { color: #d97706; }
      .diag-val.tone-danger { color: #ef4444; }
      .diag-val.tone-info { color: #0284c7; }
      .empty-hint {
        font-size: 12.5px;
        color: var(--secondary-text-color);
      }
      .refresh-full-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        background: var(--card-background-color, rgba(128, 128, 128, 0.08));
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .refresh-full-btn:hover {
        border-color: var(--primary-color, #3b82f6);
      }

      /* ACTION BUTTONS */
      .action-buttons {
        display: flex;
        gap: 8px;
      }
      .action-btn {
        border: none;
        padding: 10px 12px;
        border-radius: 12px;
        font-family: inherit;
        font-weight: 700;
        font-size: 12.5px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 1;
      }
      .action-btn ha-icon {
        --mdc-icon-size: 16px;
      }
      .action-btn.start {
        background: var(--primary-color, #3b82f6);
        color: var(--text-primary-color, #ffffff);
      }
      .action-btn.stop {
        background: rgba(239, 68, 68, 0.14);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.35);
      }
      .action-btn.save {
        flex: 0 0 46px;
        background: var(--card-background-color, rgba(128, 128, 128, 0.12));
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.22));
        color: var(--primary-text-color);
      }

      @media (max-width: 768px) {
        .popup-overlay {
          align-items: flex-end;
          padding: 0;
          overscroll-behavior: contain;
        }
        .popup-content {
          width: 100%;
          max-width: 100%;
          border-radius: var(--ha-dialog-border-radius, 24px) var(--ha-dialog-border-radius, 24px) 0 0;
          border-bottom: none;
          border-left: none;
          border-right: none;
          padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
          animation: ha-popup-sheet-in 280ms cubic-bezier(0.2, 0, 0, 1) forwards;
        }
        .popup-content.closing {
          animation: ha-popup-sheet-out 180ms cubic-bezier(0.2, 0, 0, 1) forwards;
        }
        .drag-handle {
          display: block;
          width: 36px;
          height: 5px;
          background-color: var(--secondary-text-color, #888);
          border-radius: 3px;
          margin: -4px auto 4px auto;
          flex-shrink: 0;
          touch-action: none;
          cursor: grab;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .popup-overlay,
        .popup-content,
        .spin-icon,
        .pulse-icon,
        .tile-hairline-fill.charging-shimmer::after {
          animation: none !important;
          transition: none !important;
        }
      }
    `;
  }
}

// ===========================================================================
// VISUAL CARD EDITOR (With Drag-and-Drop Image Upload + Packaging Options)
// ===========================================================================
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

  _emitConfig(newConfig) {
    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
    this.requestUpdate();
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const configValue = target.configValue || target.getAttribute("configValue");
    if (!configValue) return;

    let value;
    if (target.tagName === "HA-SWITCH" || target.type === "checkbox") {
      value = target.checked;
    } else if (ev.detail && ev.detail.value !== undefined) {
      value = ev.detail.value;
    } else if (target.type === "number") {
      value = target.value === "" ? "" : Number(target.value);
    } else {
      value = target.value;
    }

    if (this._config[configValue] === value) return;

    const newConfig = { ...this._config };
    if (configValue === "subtitle" || configValue === "title") {
      newConfig[configValue] = value || "";
    } else if (typeof value === "boolean") {
      newConfig[configValue] = value;
    } else if (value === "" || value === undefined || value === null) {
      delete newConfig[configValue];
    } else {
      newConfig[configValue] = value;
    }

    if (configValue === "image") {
      this._uploadError = "";
    }
    this._emitConfig(newConfig);
  }

  _setImage(url) {
    if (!this._config) return;
    const newConfig = { ...this._config };
    if (!url) {
      delete newConfig.image;
    } else {
      newConfig.image = url;
    }
    this._uploadError = "";
    this._emitConfig(newConfig);
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
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    if (!this._isDragging) {
      this._isDragging = true;
      this.requestUpdate();
    }
  }

  _handleDragLeave(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.currentTarget && ev.currentTarget.contains(ev.relatedTarget)) return;
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
    const fileInput = this.shadowRoot?.getElementById("car-image-file-input");
    if (fileInput) fileInput.click();
  }

  async _handleFileInputChange(ev) {
    const files = ev.target?.files;
    if (files && files.length > 0) {
      await this._uploadFile(files[0]);
    }
    if (ev.target) ev.target.value = "";
  }

  async _uploadFile(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      this._uploadError =
        "Please select a valid image file (PNG, JPG, SVG, WebP).";
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
        throw new Error(
          `Upload failed (${res.status} ${res.statusText}): ${errorText || "Server error"}`
        );
      }
      const data = await res.json();
      if (data && data.id) {
        this._setImage(`/api/image/serve/${data.id}/original`);
      } else {
        throw new Error("Invalid response received from Home Assistant image service.");
      }
    } catch (err) {
      console.error("Passable Vehicle Card image upload failed:", err);
      this._uploadError =
        err.message || "Failed to upload image. Please try again.";
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
      ...(Array.isArray(this._config.climate_profiles)
        ? this._config.climate_profiles
        : DEFAULT_CLIMATE_PROFILES),
    ];
    const num = profiles.length + 1;
    profiles.push({
      id: `profile_${Date.now()}`,
      name: `Driver ${num}`,
      icon: "mdi:account",
      temp: 72,
      duration: 15,
      defrost: false,
      heating: 0,
      steering_wheel: 0,
      seats: { fl: 0, fr: 0, rl: 0, rr: 0 },
    });
    this._emitConfig({ ...this._config, climate_profiles: profiles });
  }

  _deleteProfile(index) {
    const profiles = [
      ...(Array.isArray(this._config.climate_profiles)
        ? this._config.climate_profiles
        : DEFAULT_CLIMATE_PROFILES),
    ];
    if (profiles.length <= 1) return;
    profiles.splice(index, 1);
    this._emitConfig({ ...this._config, climate_profiles: profiles });
  }

  _updateProfileField(index, field, value) {
    const profiles = [
      ...(Array.isArray(this._config.climate_profiles)
        ? this._config.climate_profiles
        : DEFAULT_CLIMATE_PROFILES),
    ];
    if (!profiles[index]) return;
    if (field.startsWith("seats.")) {
      const seatKey = field.split(".")[1];
      profiles[index] = {
        ...profiles[index],
        seats: {
          ...(profiles[index].seats || { fl: 0, fr: 0, rl: 0, rr: 0 }),
          [seatKey]: parseInt(value, 10) || 0,
        },
      };
    } else if (
      field === "temp" ||
      field === "duration" ||
      field === "steering_wheel" ||
      field === "heating"
    ) {
      profiles[index] = { ...profiles[index], [field]: Number(value) };
    } else if (field === "defrost") {
      profiles[index] = { ...profiles[index], [field]: Boolean(value) };
    } else {
      profiles[index] = { ...profiles[index], [field]: value };
    }
    this._emitConfig({ ...this._config, climate_profiles: profiles });
  }

  _addVehicle() {
    const existing = Array.isArray(this._config.vehicles)
      ? [...this._config.vehicles]
      : [
          {
            id: "vehicle_1",
            title: this._config.title || "Primary Vehicle",
            entity: this._config.entity || "",
            prefix: this._config.prefix || "",
            fuel_type: this._config.fuel_type || "ev",
            image: this._config.image || "",
          },
        ];
    existing.push({
      id: `vehicle_${existing.length + 1}`,
      title: `Vehicle ${existing.length + 1}`,
      entity: "",
      prefix: "",
      fuel_type: "ev",
      image: "",
    });
    this._emitConfig({ ...this._config, vehicles: existing });
  }

  _removeVehicle(index) {
    const list = [...(this._config.vehicles || [])];
    list.splice(index, 1);
    const nextConfig = { ...this._config };
    if (list.length === 0) {
      delete nextConfig.vehicles;
    } else {
      nextConfig.vehicles = list;
    }
    this._emitConfig(nextConfig);
  }

  _updateVehicleField(index, field, value) {
    const list = [...(this._config.vehicles || [])];
    if (!list[index]) return;
    const updated = { ...list[index] };
    if (value === "" || value === undefined || value === null) {
      delete updated[field];
    } else {
      updated[field] = value;
    }
    list[index] = updated;
    this._emitConfig({ ...this._config, vehicles: list });
  }

  render() {
    if (!this.hass || !this._config) return html``;
    const c = this._config;
    const profiles = Array.isArray(c.climate_profiles) && c.climate_profiles.length > 0
      ? c.climate_profiles
      : DEFAULT_CLIMATE_PROFILES;
    const vehicles = Array.isArray(c.vehicles) ? c.vehicles : [];
    const displayMode = c.display_mode === "full" ? "full" : "summary";
    const showHeaderChecked =
      c.show_header !== undefined ? c.show_header !== false : displayMode === "full";

    return html`
      <div class="card-config">
        <div class="option-row">
          <label class="label">Vehicle Title</label>
          <input
            class="input-text"
            .value=${c.title !== undefined ? c.title : ""}
            .configValue=${"title"}
            @input=${this._valueChanged}
            placeholder="Kia EV9"
          />
        </div>

        <div class="option-row">
          <label class="label">Subtitle</label>
          <input
            class="input-text"
            .value=${c.subtitle !== undefined ? c.subtitle : ""}
            .configValue=${"subtitle"}
            @input=${this._valueChanged}
            placeholder="Optional subtitle (leave blank for auto summary)"
          />
        </div>

        <div class="profile-settings-grid">
          <div class="sub-col">
            <label class="label">Fuel Type</label>
            <select
              class="input-select"
              .value=${c.fuel_type || "ev"}
              .configValue=${"fuel_type"}
              @change=${this._valueChanged}
            >
              <option value="ev">Electric Vehicle (EV)</option>
              <option value="ice">Gasoline / ICE</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div class="sub-col">
            <label class="label">Display Mode</label>
            <select
              class="input-select"
              .value=${displayMode}
              .configValue=${"display_mode"}
              @change=${this._valueChanged}
            >
              <option value="summary">Summary + Popup (Default)</option>
              <option value="full">Full Inline 4-Tab View</option>
            </select>
          </div>
          <div class="sub-col">
            <label class="label">Summary Layout</label>
            <select
              class="input-select"
              .value=${c.layout === "rings" ? "rings" : "hero"}
              .configValue=${"layout"}
              @change=${this._valueChanged}
            >
              <option value="hero">Hero + Hairline Bar</option>
              <option value="rings">Dual Rings (Battery + Range)</option>
            </select>
          </div>
        </div>

        <div class="profiles-section">
          <div class="toggle-row">
            <div class="label-group">
              <span class="label">Show Card Header</span>
              <span class="help-text">Defaults off in Summary mode (matching HVAC & Lighting)</span>
            </div>
            <ha-switch
              .checked=${showHeaderChecked}
              .configValue=${"show_header"}
              @change=${this._valueChanged}
            ></ha-switch>
          </div>

          <div class="toggle-row">
            <div class="label-group">
              <span class="label">Show Top Status Strip</span>
              <span class="help-text">Compact status, location, lock & settings strip</span>
            </div>
            <ha-switch
              .checked=${c.show_summary_strip !== false}
              .configValue=${"show_summary_strip"}
              @change=${this._valueChanged}
            ></ha-switch>
          </div>

          <div class="toggle-row">
            <div class="label-group">
              <span class="label">Show Quick-Action Footer</span>
              <span class="help-text">Lock, Climate, Charge chips & Command Center link</span>
            </div>
            <ha-switch
              .checked=${c.show_footer_strip !== false}
              .configValue=${"show_footer_strip"}
              @change=${this._valueChanged}
            ></ha-switch>
          </div>

          <div class="toggle-row">
            <div class="label-group">
              <span class="label">Show 24h Battery Sparkline</span>
              <span class="help-text">Subtle historical battery/fuel curve behind summary tile</span>
            </div>
            <ha-switch
              .checked=${c.show_sparkline === true}
              .configValue=${"show_sparkline"}
              @change=${this._valueChanged}
            ></ha-switch>
          </div>

          <div class="toggle-row">
            <div class="label-group">
              <span class="label">Auto-Expand Map When Away</span>
              <span class="help-text">Automatically expand the Overview location map when the vehicle is away from Home</span>
            </div>
            <ha-switch
              .checked=${c.auto_expand_map_away !== false}
              .configValue=${"auto_expand_map_away"}
              @change=${this._valueChanged}
            ></ha-switch>
          </div>

          <div class="profile-settings-grid">
            ${c.show_sparkline === true
              ? html`
                  <div class="sub-col">
                    <label class="sub-label">Sparkline Hours</label>
                    <input
                      type="number"
                      class="input-text"
                      min="1"
                      max="72"
                      .value=${c.sparkline_hours ?? 24}
                      .configValue=${"sparkline_hours"}
                      @input=${this._valueChanged}
                    />
                  </div>
                `
              : ""}
            <div class="sub-col">
              <label class="sub-label">Max Range (for Rings gauge)</label>
              <input
                type="number"
                class="input-text"
                min="50"
                max="1000"
                .value=${c.range_max ?? ""}
                .configValue=${"range_max"}
                @input=${this._valueChanged}
                placeholder="325"
              />
            </div>
          </div>
        </div>

        ${this._renderEntityPicker(
          "entity",
          "Primary Vehicle Entity (Battery / Fuel Level)",
          ["sensor", "binary_sensor"],
          "Select primary sensor to auto-discover all related vehicle entities!"
        )}

        <div class="option-row">
          <label class="label">Entity Prefix (Optional)</label>
          <input
            class="input-text"
            .value=${c.prefix || ""}
            .configValue=${"prefix"}
            @input=${this._valueChanged}
            placeholder="ev9"
          />
        </div>

        ${this._renderImageUploader()}

        <!-- MULTI-VEHICLE SECTION -->
        <details class="advanced-section">
          <summary>Multi-Vehicle Configuration (${vehicles.length || "Single Vehicle"})</summary>
          <div class="details-content">
            <div class="section-header-row">
              <span class="help-text">Add multiple vehicles to stack summary tiles in one card and switch between them in the popup.</span>
              <button type="button" class="btn-add" @click=${this._addVehicle}>+ Add Vehicle</button>
            </div>
            ${vehicles.map(
              (v, idx) => html`
                <div class="profile-card">
                  <div class="profile-card-top">
                    <div class="profile-name-group">
                      <label class="sub-label">Vehicle Title</label>
                      <input
                        class="input-text"
                        .value=${v.title || v.name || ""}
                        @input=${(e) => this._updateVehicleField(idx, "title", e.target.value)}
                        placeholder="Kia EV9"
                      />
                    </div>
                    <div class="profile-icon-group">
                      <label class="sub-label">Prefix</label>
                      <input
                        class="input-text"
                        .value=${v.prefix || ""}
                        @input=${(e) => this._updateVehicleField(idx, "prefix", e.target.value)}
                        placeholder="ev9"
                      />
                    </div>
                    <button
                      type="button"
                      class="btn-delete"
                      title="Remove Vehicle"
                      @click=${() => this._removeVehicle(idx)}
                    >
                      <ha-icon icon="mdi:delete-outline"></ha-icon>
                    </button>
                  </div>
                  <div class="option-row" style="margin-top:8px;">
                    <ha-entity-picker
                      .hass=${this.hass}
                      .value=${v.entity || ""}
                      .label=${"Primary Battery / Fuel Entity"}
                      .includeDomains=${["sensor", "binary_sensor"]}
                      @value-changed=${(e) => this._updateVehicleField(idx, "entity", e.detail?.value)}
                      allow-custom-entity
                    ></ha-entity-picker>
                  </div>
                  <div class="profile-settings-grid">
                    <div class="sub-col">
                      <label class="sub-label">Fuel Type</label>
                      <select
                        class="input-select"
                        .value=${v.fuel_type || "ev"}
                        @change=${(e) => this._updateVehicleField(idx, "fuel_type", e.target.value)}
                      >
                        <option value="ev">EV</option>
                        <option value="ice">ICE</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div class="sub-col">
                      <label class="sub-label">Image URL</label>
                      <input
                        class="input-text"
                        .value=${v.image || ""}
                        @input=${(e) => this._updateVehicleField(idx, "image", e.target.value)}
                        placeholder="/api/image/serve/..."
                      />
                    </div>
                  </div>
                </div>
              `
            )}
          </div>
        </details>

        <!-- CLIMATE PROFILES SECTION -->
        <div class="profiles-section">
          <div class="section-header-row">
            <h4 class="section-header" style="margin: 0; border: none;">
              Climate Presets & Profiles
            </h4>
            <button type="button" class="btn-add" @click=${this._addProfile}>
              + Add Profile
            </button>
          </div>
          <span class="help-text">
            Configure driver presets (e.g. Megan, Myles) and default temp, seats, wheel, and defrost settings.
          </span>

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
                        @change=${(e) =>
                          this._updateProfileField(idx, "steering_wheel", e.target.value)}
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
                        @change=${(e) =>
                          this._updateProfileField(idx, "defrost", e.target.value === "true")}
                      >
                        <option value="false">Off</option>
                        <option value="true">On</option>
                      </select>
                    </div>
                  </div>

                  <div class="profile-seats-grid">
                    ${[
                      ["fl", "Driver Seat (FL)"],
                      ["fr", "Pass. Seat (FR)"],
                      ["rl", "Rear L Seat"],
                      ["rr", "Rear R Seat"],
                    ].map(
                      ([key, label]) => html`
                        <div class="sub-col">
                          <label class="sub-label">${label}</label>
                          <select
                            class="input-select"
                            .value=${String(p.seats?.[key] || 0)}
                            @change=${(e) =>
                              this._updateProfileField(idx, `seats.${key}`, e.target.value)}
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
                      `
                    )}
                  </div>
                </div>
              `
            )}
          </div>
        </div>

        <details class="advanced-section">
          <summary>Advanced Entity & Image Overrides</summary>
          <div class="details-content">
            <div class="option-row">
              <label class="label">Optional Summary Thumbnail Image (Overrides main image on tile)</label>
              <input
                class="input-text"
                .value=${c.summary_image || ""}
                .configValue=${"summary_image"}
                @input=${this._valueChanged}
                placeholder="Leave blank to reuse Vehicle Image"
              />
            </div>

            <h4 class="section-header">Status & Sensor Overrides</h4>
            ${this._renderEntityPicker("range_entity", "Remaining Range", ["sensor"])}
            ${this._renderEntityPicker("lock_entity", "Vehicle Lock", ["lock"])}
            ${this._renderEntityPicker("engine_entity", "Engine / Driving Status", ["binary_sensor"])}
            ${this._renderEntityPicker("location_entity", "Vehicle Location", ["device_tracker"])}
            ${this._renderEntityPicker("charging_entity", "Charging Status", ["binary_sensor", "sensor"])}
            ${this._renderEntityPicker("plug_entity", "Plug Status", ["binary_sensor", "sensor"])}
            ${this._renderEntityPicker("odometer_entity", "Odometer", ["sensor"])}
            ${this._renderEntityPicker("last_updated_entity", "Last Update Timestamp", ["sensor"])}
            ${this._renderEntityPicker("charging_power_entity", "Vehicle Charging Power (kW)", ["sensor"])}
            ${this._renderEntityPicker("evse_power_entity", "EVSE / Wall Charger Power", ["sensor"])}

            <h4 class="section-header">Health & Diagnostics Overrides</h4>
            ${this._renderEntityPicker("aux_battery_entity", "12V Aux Battery", ["sensor"])}
            ${this._renderEntityPicker("tire_pressure_entity", "Tire Pressure Warning", ["binary_sensor", "sensor"])}
            ${this._renderEntityPicker("next_service_entity", "Next Service Distance", ["sensor"])}
            ${this._renderEntityPicker("dtc_count_entity", "Diagnostic Trouble Code Count", ["sensor"])}
            ${this._renderEntityPicker("washer_fluid_entity", "Washer Fluid Warning", ["binary_sensor"])}
            ${this._renderEntityPicker("key_battery_entity", "Smart Key Battery Warning", ["binary_sensor"])}

            <h4 class="section-header">Doors & Closures Overrides</h4>
            ${this._renderEntityPicker("hood_entity", "Hood Status", ["binary_sensor"])}
            ${this._renderEntityPicker("trunk_entity", "Trunk / Tailgate Status", ["binary_sensor"])}
            ${this._renderEntityPicker("door_fl_entity", "Front Left Door", ["binary_sensor"])}
            ${this._renderEntityPicker("door_fr_entity", "Front Right Door", ["binary_sensor"])}
            ${this._renderEntityPicker("door_rl_entity", "Rear Left Door", ["binary_sensor"])}
            ${this._renderEntityPicker("door_rr_entity", "Rear Right Door", ["binary_sensor"])}
            ${this._renderEntityPicker("sunroof_entity", "Sunroof Status", ["binary_sensor"])}

            <h4 class="section-header">Climate & Comfort Overrides</h4>
            ${this._renderEntityPicker("hvac_status_entity", "HVAC / Air Conditioner Active Status", ["binary_sensor", "climate", "switch", "sensor"])}
            ${this._renderEntityPicker("climate_temp_entity", "Set Cabin Temperature Sensor", ["sensor"])}

            <h4 class="section-header">Charging & Limits Overrides</h4>
            ${this._renderEntityPicker("ac_limit_entity", "AC Charge Limit", ["number"])}
            ${this._renderEntityPicker("dc_limit_entity", "DC Charge Limit", ["number"])}
            ${this._renderEntityPicker("charging_switch_entity", "Charging Start/Stop Switch", ["switch"])}

            <div class="toggle-row">
              <div class="label-group">
                <span class="label">Show Vehicle AC Current</span>
                <span class="help-text">Display vehicle charging current buttons (60%, 90%, 100%)</span>
              </div>
              <ha-switch
                .checked=${c.show_ac_current !== false && c.ac_current_entity !== "none"}
                .configValue=${"show_ac_current"}
                @change=${this._valueChanged}
              ></ha-switch>
            </div>

            ${c.show_ac_current !== false && c.ac_current_entity !== "none"
              ? this._renderEntityPicker(
                  "ac_current_entity",
                  "Vehicle AC Charging Current",
                  ["input_select", "select"]
                )
              : ""}

            ${this._renderEntityPicker(
              "evse_current_entity",
              "EVSE / Charger Current Limit",
              ["number", "input_number", "select", "input_select"],
              "Entity controlling wall charger / EVSE current limit (e.g. SPAN Drive, Wallbox)"
            )}

            <div class="option-row">
              <label class="label">EVSE Supply Voltage (V)</label>
              <input
                class="input-text"
                type="number"
                .value=${c.evse_voltage !== undefined ? c.evse_voltage : ""}
                .configValue=${"evse_voltage"}
                @input=${this._valueChanged}
                placeholder="240"
              />
              <span class="help-text">Voltage used to estimate kW charging power (defaults to 240V for Level 2).</span>
            </div>

            ${this._renderEntityPicker("charge_time_entity", "Charge Time Remaining", ["sensor"])}

            <h4 class="section-header">Integration & Service Overrides</h4>
            <div class="option-row">
              <label class="label">Device ID (For Kia UVO / Force Update)</label>
              <input
                class="input-text"
                .value=${c.device_id || ""}
                .configValue=${"device_id"}
                @input=${this._valueChanged}
                placeholder="Auto-detected if left blank"
              />
            </div>
            ${this._renderEntityPicker("force_refresh_entity", "Force Refresh Button Entity", ["button"])}
            ${this._renderEntityPicker("start_climate_service", "Custom Start Climate Service / Script", ["script"])}
            ${this._renderEntityPicker("stop_climate_service", "Custom Stop Climate Service / Script", ["script"])}
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
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 5px 0;
      }
      .toggle-row .label-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
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
      .input-text,
      .input-select {
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
      .manual-url-input-container {
        margin-top: 6px;
      }
      .profiles-section {
        margin-top: 4px;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 8px;
        padding: 12px;
        background: var(--secondary-background-color, #fafafa);
      }
      .section-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
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
        flex-shrink: 0;
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
      .profile-settings-grid,
      .profile-seats-grid {
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
        margin-top: 4px;
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

if (!customElements.get("passable-vehicle-card")) {
  customElements.define("passable-vehicle-card", PassableVehicleCard);
}
if (!customElements.get("passable-vehicle-card-editor")) {
  customElements.define(
    "passable-vehicle-card-editor",
    PassableVehicleCardEditor
  );
}
