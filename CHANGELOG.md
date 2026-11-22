# Changelog

All notable changes to **Passable Vehicle Card** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-11-22

### Changed
- **Vehicle Photo Map Marker Pin**: Configured the embedded Home Assistant Overview map card to display the vehicle's uploaded photo (`summary_image` / `image`) as its circular marker avatar (falling back to the vehicle icon such as `mdi:car-electric` / `mdi:car` with `label_mode: "icon"` when no photo is configured) and friendly vehicle title instead of entity initials (e.g., `"EL"`).

## [2.1.0] - 2026-11-22

### Added
- **Clickable Home / Away Pill & Expandable Overview Map**: Clicking the **Home / Away** location pill in the summary strip (or location chip on multi-vehicle cards) opens the Command Center directly to **Overview** with an embedded native Home Assistant `map` card expanded and scrolled smoothly into view.
- **Route History Trail Selector**: Added a segmented `Pin` / `2h` / `24h` trail switcher inside the expanded location card to view recent GPS movement right inside the popup.
- **Cross-Platform Directions Link**: Added a one-tap **Directions** button on the Location section header opening Apple Maps (Apple devices) or Google Maps (Android/Desktop) at the vehicle's live coordinates.
- **Auto-Expand When Away (`auto_expand_map_away`)**: Enabled by default (`true`, toggleable in the visual editor) so the Overview map stays compact at Home and automatically expands whenever the vehicle is Away.
- **Map Gesture Isolation**: Excluded embedded `ha-map` / `hui-map-card` / `.leaflet-container` surfaces from swipe-to-dismiss and horizontal tab swipe handlers so mobile panning and zooming never accidentally close or swipe the modal.

## [2.0.0] - 2026-11-21

### Added
- **Passable Summary + Command Center Packaging**: Aligned dashboard card layout and styling with `passable-hvac-card` and `passable-lighting-card` — featuring a compact top status strip (`.vehicle-summary-strip`), state-tinted vehicle summary tile (`.vehicle-zone-card`) with hairline battery bar + AC limit marker, expandable quick-telemetry mini-card tray (`12V`, `Odo`, `TPMS`, `EVSE`), and quick-action footer strip.
- **Dual Summary Layouts (`layout: hero | rings`)**: Added selectable **Hero + Hairline Bar** (default) and **Dual Rings** (Battery % + Range) layouts in the visual editor.
- **4-Tab Command Center Modal / Bottom Sheet**: Clicking the card opens a responsive centered dialog (desktop) / swipe-down bottom sheet (mobile) with 4 tabs: **Overview**, **Climate**, **Charge / Fuel**, and **Health** (Doors & Closures + Diagnostics & Maintenance). Also supports `display_mode: full` for inline 4-tab embedding.
- **3-Layer Background Scroll Lock**: Prevents background dashboard scrolling when the popup is open via `overscroll-behavior: contain` across all viewports, Shadow-DOM-aware ref-counted background scroll lock, and non-passive `wheel`/`touchmove` boundary guards, plus `Escape` key dismissal.
- **Expanded Auto-Discovery & Animations**: Auto-discovers `engine` (On/Driving), `sunroof`, `location`, `aux_battery` (12V), `next_service`, `dtc_count`, `washer_fluid`, `key_battery`, `climate_temp`, `evse_power`, `force_refresh`, and `charging_switch`, with live animations for Charging, Climate On, and Engine On.
- **Optional 24h Battery Sparkline & Multi-Vehicle Support**: Added `show_sparkline` background history curve toggle and `vehicles[]` multi-vehicle array configuration.

## [1.5.7] - 2026-10-02

### Changed
- **Registry Metadata**: Standardized `window.customCards` configuration with `documentationURL`.
- **Design System Alignment**: Normalized startup console banner.

## [1.5.6] - 2026-09-25

### Fixed
- Climate profile scheduling and charging slider stepping.

## [1.5.0] - 2026-09-15

### Added
- Multi-vehicle support and drag-and-drop custom vehicle imagery.
