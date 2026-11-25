Bengaluru bus map (demo)

Run:   python3 -m http.server 8000   (in this folder), then open http://localhost:8000
Needs internet for the base map (OpenFreeMap tiles) and MapLibre (cdnjs).

demo.js stands in for the server: it generates routes, stops, timetables, speeds and ~135 buses in the browser
and answers the data/ and live/ requests the map makes. Everything it generates is invented.
To use real data, serve your own data/ and live/ files beside index.html and open the page with ?real
(demo.js is then skipped).

Not included: editor.js / editkit.js (need the edits server), planner.js / plannerui.js (need planner.worker.js and a timetable).
