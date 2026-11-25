# Namma Bus Live — Public API Reference

This document provides a high-level overview of the public API capabilities offered by the **Namma Bus Live** platform for transit search, journey planning, and real-time fleet visualization.

---

## 1. Journey Planning (`/api/v1/journey`)

### Multimodal Journey Routing
* **Endpoint:** `GET /api/v1/journey/plan` or `POST /api/v1/journey/plan`
* **Description:** Computes optimal transit itineraries across BMTC bus services and Namma Metro rail lines, including walking transfer legs.
* **Key Query Parameters:**
  * `from_place` (string): Origin coordinates (`"lat,lon"`) or stop identifier.
  * `to_place` (string): Destination coordinates (`"lat,lon"`) or stop identifier.
  * `time` (string, optional): Departure time (`HH:MM`).
  * `modes` (string, optional): Modes to include (`TRANSIT,WALK`).
* **Response Summary:** Returns an array of itineraries with leg durations, transport modes, route short names, and transfer points.

### Stop Autocomplete
* **Endpoint:** `GET /api/v1/journey/stops`
* **Description:** Fast prefix and trigram lookup for origin and destination stop inputs.

---

## 2. Transit Search & Stop Information (`/api/v1/stops`, `/api/v1/routes`)

### Stop Search & Proximity
* **`GET /api/v1/stops/search`:** Search transit stops by English or Kannada name.
* **`GET /api/v1/stops/nearby`:** Search transit stops within a geographic radius (`lat`, `lon`, `radius_meters`).
* **`GET /api/v1/stops/{stop_id}`:** Retrieve stop details and static scheduled departures.
* **`GET /api/v1/stops/{stop_id}/eta`:** Estimated arrivals for upcoming buses at a designated stop.

### Route Information
* **`GET /api/v1/routes/search`:** Lookup bus routes by corridor or short name (e.g., `335E`, `KIA-8`, `500D`).
* **`GET /api/v1/routes/{route_id}/stops`:** Sequential list of stops served along a route direction.
* **`GET /api/v1/routes/{route_id}/shape`:** GeoJSON spatial alignment representing the physical road corridor.

---

## 3. Real-Time Telemetry & Fleet Status (`/live`, `/api/v1/realtime`)

* **`GET /live/vehicles.json`:** City-wide snapshot of actively transmitting transit vehicles.
* **`GET /live/delta/{timestamp}`:** Incremental differential vehicle position deltas to optimize mobile bandwidth.
* **`GET /api/v1/realtime/status`:** High-level ingestion feed status, active vehicle count, and telemetry freshness indicators.
* **`GET /health`:** Platform availability and uptime check.
