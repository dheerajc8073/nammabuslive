/* BMTC Vehicle Classification Engine & Category Taxonomy (Client)
   Authoritative frontend client mirroring backend/app/vehicles/classifier.py.
   Guarantees identical classification logic between Python backend and browser frontend. */
'use strict';

const BMTC_VEHICLES = (() => {
  const CATEGORIES = {
    regular: {
      id: 'regular',
      name: 'Regular',
      icon: 'bus',
      col: '#2563eb',
      modelId: 'regular-city',
      desc: 'Standard diesel city bus (Bengaluru Sarige)',
      sort: 1
    },
    vajra: {
      id: 'vajra',
      name: 'Vajra (AC)',
      icon: 'snow',
      col: '#1f5fbf',
      modelId: 'vajra-volvo',
      desc: 'Volvo 8400 low-floor air-conditioned city bus',
      sort: 2
    },
    vayu_vajra: {
      id: 'vayu_vajra',
      name: 'Vayu Vajra (Airport)',
      icon: 'plane',
      col: '#0f8a8f',
      modelId: 'vayuvajra-airport',
      desc: 'Dedicated airport express coach',
      sort: 3
    },
    electric: {
      id: 'electric',
      name: 'Electric',
      icon: 'bolt',
      col: '#12a4a0',
      modelId: 'electric-city',
      desc: 'Battery electric city bus (Switch EiV12 / Tata / JBM)',
      sort: 4
    },
    metro_feeder: {
      id: 'metro_feeder',
      name: 'Metro Feeder',
      icon: 'train',
      col: '#7a3fc0',
      modelId: 'metro-feeder',
      desc: 'Feeder service connecting Namma Metro stations',
      sort: 5
    },
    big_circle: {
      id: 'big_circle',
      name: 'Big Circle',
      icon: 'circle',
      col: '#2f8a4a',
      modelId: 'bigcircle-city',
      desc: 'Orbital ring-road circular service',
      sort: 6
    },
    express: {
      id: 'express',
      name: 'Express',
      icon: 'zap',
      col: '#c27c00',
      modelId: 'express-city',
      desc: 'Point-to-point limited-stop express service (Vegadootha)',
      sort: 7
    },
    chakra: {
      id: 'chakra',
      name: 'Chakra',
      icon: 'rotate-cw',
      col: '#d0573a',
      modelId: 'chakra-midi',
      desc: 'Local residential neighbourhood circular service',
      sort: 8
    },
    shuttle: {
      id: 'shuttle',
      name: 'Callbus & Shuttles',
      icon: 'phone-call',
      col: '#8a6d3b',
      modelId: 'shuttle-mini',
      desc: 'First/last mile demand responsive shuttle',
      sort: 9
    },
    v_ksrtc: {
      id: 'v_ksrtc',
      name: 'V-KSRTC',
      icon: 'bus',
      col: '#b23a2e',
      modelId: 'ksrtc-intercity',
      desc: 'Karnataka RTC intercity service within metropolitan area',
      sort: 10
    },
    special: {
      id: 'special',
      name: 'Special & Contract',
      icon: 'star',
      col: '#a1478b',
      modelId: 'special-contract',
      desc: 'Charter, festival or contract service',
      sort: 11
    },
    depot_runs: {
      id: 'depot_runs',
      name: 'Depot Runs',
      icon: 'wrench',
      col: '#7c7c84',
      modelId: 'depot-utility',
      desc: 'Depot transfer and deadheading vehicle',
      sort: 12
    },
    unclassified: {
      id: 'unclassified',
      name: 'Unknown / Unclassified',
      icon: 'help-circle',
      col: '#6b7280',
      modelId: 'unclassified-generic',
      desc: 'Live vehicle without verified service or model metadata',
      sort: 13
    }
  };

  const PREFIX_MAP = {
    'KIA': 'vayu_vajra',
    'KI-': 'vayu_vajra',
    'MF-': 'metro_feeder',
    'MF': 'metro_feeder',
    'V-': 'vajra',
    'VAJRA': 'vajra',
    'BC-': 'big_circle',
    'BIG': 'big_circle',
    'CHAKRA': 'chakra',
    'C-': 'chakra',
    'EXP': 'express',
    'EXPRESS': 'express',
    'S-': 'shuttle',
    'SHUTTLE': 'shuttle',
    'CALL': 'shuttle',
    'R-': 'v_ksrtc',
    'KSRTC': 'v_ksrtc',
    'D-': 'depot_runs',
    'DEPOT': 'depot_runs',
    'Z-': 'special',
    'SPEC': 'special',
    'CHARTER': 'special'
  };

  /**
   * Classifies a vehicle record row from /live/vehicles.json
   * Row format: [id, route_code, lat, lon, bearing, fix, flags, preds, (route_num), (cat_id), (model_id), (confidence)]
   */
  function classifyRow(row) {
    if (!row || !Array.isArray(row)) {
      return {
        catId: 'unclassified',
        category: CATEGORIES.unclassified,
        modelId: 'unclassified-generic',
        confidence: 'UNKNOWN',
        source: 'invalid_row'
      };
    }

    // 1. Direct authoritative classification from backend API (row[9], row[10], row[11])
    if (row.length > 9 && row[9] && CATEGORIES[row[9]]) {
      const catId = row[9];
      const modelId = (row.length > 10 && row[10]) ? row[10] : CATEGORIES[catId].modelId;
      const confidence = (row.length > 11 && row[11]) ? row[11] : (catId === 'unclassified' ? 'UNKNOWN' : 'HIGH');
      return {
        catId,
        category: CATEGORIES[catId],
        modelId,
        confidence,
        source: 'backend_api'
      };
    }

    // 2. Client-side classification using the exact same authoritative rules
    const id = row[0] || '';
    const code = (row[1] || '').trim();
    const fl = row[6] || '';
    const num = (row.length > 8 && row[8] ? String(row[8]) : '').trim();
    const text = (num || code).toUpperCase();

    const isElectric = fl.includes('e');
    const isAc = fl.includes('a');
    const isUnmapped = !code || code === 'BMTC' || /^[0-9a-f]{8,}$/i.test(code);

    if (isElectric) {
      return {
        catId: 'electric',
        category: CATEGORIES.electric,
        modelId: 'electric-city',
        confidence: 'HIGH',
        source: 'propulsion_telemetry'
      };
    }

    if (isUnmapped && !isAc) {
      return {
        catId: 'unclassified',
        category: CATEGORIES.unclassified,
        modelId: 'unclassified-generic',
        confidence: 'UNKNOWN',
        source: 'unmapped_route'
      };
    }

    for (const [prefix, catId] of Object.entries(PREFIX_MAP)) {
      if (text.startsWith(prefix) || (prefix === 'VAJRA' && text.includes('VAJRA'))) {
        return {
          catId,
          category: CATEGORIES[catId],
          modelId: CATEGORIES[catId].modelId,
          confidence: 'HIGH',
          source: 'service_schedule_gtfs'
        };
      }
    }

    if (isAc) {
      const isAirport = text.includes('KIA') || text.includes('AIRPORT');
      const catId = isAirport ? 'vayu_vajra' : 'vajra';
      return {
        catId,
        category: CATEGORIES[catId],
        modelId: CATEGORIES[catId].modelId,
        confidence: 'HIGH',
        source: 'ac_telemetry_flag'
      };
    }

    if (!isUnmapped) {
      return {
        catId: 'regular',
        category: CATEGORIES.regular,
        modelId: 'regular-city',
        confidence: 'HIGH',
        source: 'service_schedule_gtfs'
      };
    }

    return {
      catId: 'unclassified',
      category: CATEGORIES.unclassified,
      modelId: 'unclassified-generic',
      confidence: 'UNKNOWN',
      source: 'unclassified_fallback'
    };
  }

  function getCategory(catId) {
    return CATEGORIES[catId] || CATEGORIES.unclassified;
  }

  function getAllCategories() {
    return Object.values(CATEGORIES).sort((a, b) => a.sort - b.sort);
  }

  function isCategoryVerified(catId) {
    return catId !== 'unclassified';
  }

  return {
    CATEGORIES,
    classifyRow,
    getCategory,
    getAllCategories,
    isCategoryVerified
  };
})();

if (typeof window !== 'undefined') {
  window.BMTC_VEHICLES = BMTC_VEHICLES;
}
