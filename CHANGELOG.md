# Changelog

All notable changes to **Passable Vehicle Card** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
