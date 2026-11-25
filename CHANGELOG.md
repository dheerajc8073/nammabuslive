# Changelog — Namma Bus Live

All notable changes to **Namma Bus Live** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-25 — Initial Public Release

### Added
* **Interactive MapLibre GL Transit Map:** Full Greater Bengaluru street canvas with vector tile layers, customized bus route overlays, and stop markers.
* **10,128 BMTC & Metro Bus Stops:** High-precision coordinates with spatial proximity search, bilingual English/Kannada display, and stop schedule timetables.
* **8,428 Bus Route Geometries:** PostGIS `ST_AsGeoJSON` line string alignments for complete BMTC bus corridors.
* **Real-Time Fleet Ingestion:** Autonomous 20-second telemetry polling loop integrated with Reclaim City GTFS-RT Protobuf feeds (`vehicle_positions.pb`, `trip_updates.pb`).
* **Differential Vehicle Delta Streaming:** `/live/delta` mechanism reducing client-side telemetry bandwidth by >90%.
* **Dead-Reckoning Smooth Animation:** Client-side vector interpolation delivering fluid bus marker movement on the live map.
* **OpenTripPlanner 2.7.0 Raptor Multimodal Routing:** Native transit journey planning integrating BMTC buses, Namma Metro (Purple, Green, Yellow lines), and pedestrian transfers.
* **Fleet Classification Engine:** Automated vehicle categorization across 13 BMTC fleet tiers (Vayu Vajra, Vajra, Non-AC, EV, Volvo) with human review queue and audit logging.
* **Honest Telemetry Transparency:** Clear indicators distinguishing live GPS beacons (<90s) from stale records and scheduled timetable estimates.
* **Production Docker Compose Stack:** Fully orchestrated multi-container architecture (PostGIS 16, Redis 7, OTP2, FastAPI, Caddy 2) optimized for 4 GB RAM virtual machines.
* **Hardened Caddy 2 Reverse Proxy:** Automatic TLS, zstd/gzip compression, and raw IP HTTP port 80 fallback.
* **Comprehensive Test Suite:** 15 automated test modules covering API contracts, OTP2 journey planning, and real-time data integrity.
