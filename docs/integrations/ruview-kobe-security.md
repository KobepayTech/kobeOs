# RuView + Kobe Security Integration

This document defines how KobeOS integrates RuView WiFi/CSI sensing into a new `Kobe Security` module.

## Goal

KobeOS should treat RuView as an optional smart-building sensor backend, not as required core infrastructure. The integration allows hotels, warehouses, shops, schools, and offices to connect ESP32 CSI nodes or a RuView sensing server and surface the results inside KobeOS.

## Architecture

```text
ESP32-S3 / ESP32-C6 CSI nodes
        ↓ UDP / MQTT
RuView sensing server
        ↓ REST / WebSocket / MQTT
KobeOS RuView connector
        ↓
Kobe Security module
        ↓
Guards, hotel staff, warehouse staff, admins
```

## Kobe Security responsibilities

- Guard dashboard for live zones, patrols, incidents, and alerts.
- RuView signal panel for occupancy, motion, room status, and confidence.
- QR patrol checkpoints for guards.
- Incident creation from RuView alerts or manual guard reports.
- Hotel room occupancy support for housekeeping and energy automation.
- Cargo warehouse movement monitoring for KobeCargo.
- Café/table occupancy and queue signals for KobeERP/POS.

## Safety and reliability notes

RuView should be treated as a sensing aid. It must not be the only source of truth for emergencies, medical decisions, or life-safety actions. Guards and staff should confirm important alerts physically or with approved security systems.

## Environment variables

```bash
VITE_RUVIEW_BASE_URL=http://localhost:3000
VITE_RUVIEW_WS_URL=ws://localhost:3001
```

## Local RuView demo

```bash
docker pull ruvnet/wifi-densepose:latest
docker run -p 3000:3000 -p 3001:3001 -p 5005:5005/udp ruvnet/wifi-densepose:latest
```

## Implementation phase

1. Add `src/services/ruviewClient.ts` for REST/WebSocket communication and demo fallback.
2. Add `src/modules/kobe-security/KobeSecurity.tsx` for the guard/security UI.
3. Wire the module into `src/App.tsx` as `security`.
4. Later add backend persistence for incidents, patrol checkpoints, and alerts.

## Next backend tasks

- Persist incidents and guard patrol scans in the KobeOS local database.
- Add user roles: `security_admin`, `guard`, `hotel_housekeeping`, `warehouse_supervisor`.
- Add a mobile web scanner for QR patrol checkpoints.
- Map zones to hotel rooms, cargo warehouse gates, ERP shop branches, and school buildings.
- Add alert escalation rules: notify supervisor, create task, dispatch guard, mark resolved.
