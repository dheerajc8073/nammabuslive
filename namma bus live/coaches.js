/* BMTC bus liveries for the Bengaluru live map's 3D buses (coaches3d.js, TGSRTC's renderer).

   From BMTC's fleet as described on Wikipedia's BMTC, Vajra and Vayu Vajra pages (read 17 Nov 2026):
     Bengaluru Sarige (ordinary): white over blue (dark blue-and-white on BS IV, light blue-and-white on BS VI),
       Ashok Leyland / Tata / Eicher city buses with framed windows, front and middle doors. Big Circle, Big10,
       Suvarna and the other old brands were merged into it, so their routes run Sarige buses.
     Metro feeder: Sarige livery, many on midi buses (drawn 9.5 m).
     Vegadootha Express: light blue-and-white.
     Vajra (AC): light-blue Volvo 8400LE low-entry, one glass band; also Switch EiV 12 electrics.
     Vayu Vajra (airport): Volvo 8400LE in blue.
     Astra (electric non-AC): turquoise JBM / violet-and-white Switch / two-tone blue Tata Starbus EV; drawn turquoise.
   BMTC's tracking gives only AC / Non AC per bus, so the drawing follows the route's family and the AC flag
   (live.js lvOf), not the individual bus. Fields as tgsrtc/coaches.js: stripes [[y from roof 0..29, h, colour]],
   swoosh, panel (one glass band), low, mid (middle door), len, ev, ac, bolt, mask, frame. */
'use strict';
const COACH = (() => {
  const L = {
    sarige:  { name: 'Bengaluru Sarige', city: 1, key: '#2a62b8', body: '#f5f6f4', roof: '#e9ecee', glass: '#26303a', skirt: '#1f4f9e',
               stripes: [[16.6, 1.1, '#7fb6e6'], [18.4, 10.6, '#2a62b8']], frame: '#2b2f36', mid: 1 },
    feeder:  { name: 'Metro feeder', city: 1, key: '#2a62b8', body: '#f5f6f4', roof: '#e9ecee', glass: '#26303a', skirt: '#1f4f9e',
               stripes: [[16.6, 1.1, '#7fb6e6'], [18.4, 10.6, '#2a62b8']], frame: '#2b2f36', mid: 1, len: 0.8 },
    express: { name: 'Vegadootha Express', city: 1, key: '#4a9ad8', body: '#f6f8f9', roof: '#e8eef2', glass: '#1d2733', skirt: '#2f7cc0',
               stripes: [[17, 1, '#2f7cc0'], [18.6, 10.4, '#6fb3e6']], frame: '#2b2f36', mid: 1 },
    vajra:   { name: 'Vajra', city: 1, key: '#5aaee6', body: '#8fcbef', roof: '#d6ecf8', glass: '#121a22', skirt: '#4c9bd6',
               stripes: [[19.5, 1.2, '#ffffff']], mask: '#121a22', panel: 1, low: 1, ac: 1 },
    vayu:    { name: 'Vayu Vajra', city: 1, key: '#2f86d0', body: '#4f9fdc', roof: '#cfe6f6', glass: '#10171f', skirt: '#2a6fb0',
               swoosh: ['#ffffff', '#9ad0f2'], mask: '#10171f', panel: 1, low: 1, ac: 1 },
    astra:   { name: 'Astra electric', city: 1, key: '#12a4a0', body: '#f4f8f8', roof: '#e2f1f0', glass: '#141a1f', skirt: '#0f8f8b', roofEdge: '#0f8f8b',
               stripes: [[18.6, 10.4, '#1bb3ae'], [17.6, 0.9, '#0b6f6c']], mask: '#16191d', panel: 1, low: 1, ev: 1, bolt: '#ffffff' },
  };
  const of = fl => (fl || '').includes('e') ? 'astra' : (fl || '').includes('K') ? 'vayu' : (fl || '').includes('a') ? 'vajra' : 'sarige';
  return { L, of };
})();
