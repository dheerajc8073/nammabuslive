# Namma Bus Live — Transit Data Sources & External Links

This document outlines the third-party transportation datasets, real-time feeds, and external data sources utilized by **Namma Bus Live**, including original repository links and access guidelines.

> **Note on Data Hosting:** In compliance with repository guidelines, raw GTFS datasets and database archives are **not hosted directly within this GitHub repository**. Instead, developers and researchers can access the authoritative original data sources via the links below.

---

## 1. Primary Transit Datasets & External Links

| Transport System | Original Provider / Maintainer | Source Link | Data Provided |
| :--- | :--- | :--- | :--- |
| **BMTC Bus Network** | Vivek Matthew (`bmtc-gtfs`), sourced from Namma BMTC 2.0 app | [GitHub: Vonter/bmtc-gtfs](https://github.com/Vonter/bmtc-gtfs) | Static stops, route corridors, scheduled trips, timetable stop times, and road shapes. |
| **BMRCL Namma Metro** | Open City Urban Data Portal / BMRCL | [OpenCity Bengaluru Transit](https://opencity.in/tags/bmrcl/) | Metro station coordinates, Purple/Green line track alignments, and schedule frequencies. |
| **Real-Time Telemetry** | Reclaim City Bengaluru Open Transit Proxy | [Reclaim City Transit Map](https://maps.reclaim.city/bmtc/)<br>[Live RT Feed Status](https://maps.reclaim.city/bengaluru/rt/status.json) | Live GTFS-RT Protobuf streams (`vehicle_positions.pb`, `trip_updates.pb`). |
| **Regional Transit** | KSRTC / NWKRTC Public Information | [KSRTC Official Portal](https://ksrtc.in/) | Static timetable schedules for inter-city corridors and major bus terminals. |

---

## 2. Dataset Descriptions & High-Level Utilization

### 2.1 BMTC Static GTFS
* **Upstream Project:** [Vonter/bmtc-gtfs](https://github.com/Vonter/bmtc-gtfs)
* **Author / Maintainer:** Vivek Matthew ([ORCID: 0009-0003-2627-7788](https://orcid.org/0009-0003-2627-7788))
* **License:** [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/)
* **Transport Information Provided:** Covers over 10,000 bus stops across Greater Bengaluru, 8,000+ directional route variants, trip schedules, and road geometries.
* **How Namma Bus Live Uses It:** Processed and indexed into high-performance spatial tables and routing graphs to power stop searches, route alignments, and multimodal journey planning.

### 2.2 BMRCL Namma Metro Data
* **Source:** Open City Bengaluru Urban Data Portal
* **Transport Information Provided:** Station coordinates, transfer walkways, and line geometries for the Purple, Green, and upcoming Yellow line corridors.
* **How Namma Bus Live Uses It:** Integrated alongside bus network data into the multimodal journey engine to calculate door-to-door transit itineraries with seamless metro transfers.

### 2.3 Real-Time Telemetry Feeds
* **Provider:** [Reclaim City](https://maps.reclaim.city/)
* **Transport Information Provided:** Periodic vehicle position updates (latitude, longitude, speed, bearing, timestamp) and trip delay indicators for active BMTC fleet vehicles.
* **How Namma Bus Live Uses It:** An autonomous background worker ingests the live feeds periodically, calculates differential movement deltas, and streams updates to the frontend for smooth vehicle animations.

---

## 3. Acquiring Datasets for Local Development

To run a full local transit routing instance:
1. Clone the static GTFS repository from [Vonter/bmtc-gtfs](https://github.com/Vonter/bmtc-gtfs).
2. Download the latest GTFS export archive (`bmtc.zip`).
3. Download the Namma Metro GTFS schedule from [Open City Bengaluru](https://opencity.in/).
4. Follow the routing engine setup guide in the project documentation to build your local transit graph.
