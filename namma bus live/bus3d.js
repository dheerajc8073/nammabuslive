/* BMTC Authentic Interactive 3D Bus Model Library & Three.js Viewer
   Bengaluru Transit Platform — Phase 4.6
   Features dedicated 3D models for all BMTC vehicle categories. */
'use strict';

const BUS3D_LIB = (() => {
  // Ensure THREE is available
  const hasThree = () => typeof THREE !== 'undefined';

  /* Canvas texture generator for LED destination boards */
  function createLedBoardTexture(routeNo, destination, width = 512, height = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Matrix background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);

    // Amber LED glow
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 44px monospace';
    ctx.textBaseline = 'middle';

    const cleanNo = (routeNo || 'BMTC').trim();
    const cleanDest = (destination || '').trim();

    ctx.fillText(cleanNo, 24, height / 2);
    if (cleanDest) {
      ctx.font = '28px sans-serif';
      ctx.fillStyle = '#ffcc33';
      ctx.fillText(cleanDest.slice(0, 22), 200, height / 2);
    }

    // Dot matrix grid overlay effect
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  /* Helper to create wheels */
  function createWheel(radius = 0.5, width = 0.32) {
    const group = new THREE.Group();
    // Tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a1b, roughness: 0.9 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    group.add(tire);

    // Rim / Hubcap
    const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x8a929a, metalness: 0.6, roughness: 0.3 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    group.add(rim);

    // Central axle hub
    const hubGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width + 0.04, 12);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.5 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    group.add(hub);

    return group;
  }

  /* Base Model Builder with custom category specs */
  function buildBusModel(spec, boardData = {}) {
    const group = new THREE.Group();
    const L = spec.length || 11.5;
    const W = spec.width || 2.55;
    const H = spec.height || 3.1;
    const groundClearance = spec.groundClearance || 0.35;

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: spec.bodyColor,
      roughness: 0.35,
      metalness: spec.isMetallic ? 0.3 : 0.08
    });

    const skirtMat = new THREE.MeshStandardMaterial({
      color: spec.skirtColor,
      roughness: 0.4
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: spec.roofColor || 0xe6e9ec,
      roughness: 0.6
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: spec.glassColor || 0x161e26,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88
    });

    // 1. Lower chassis / skirt
    const skirtH = H * 0.28;
    const skirtGeo = new THREE.BoxGeometry(W, skirtH, L);
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.y = groundClearance + skirtH / 2;
    group.add(skirt);

    // 2. Middle window section
    const windowH = H * 0.42;
    const windowGeo = new THREE.BoxGeometry(W - 0.04, windowH, L - 0.15);
    const windowBand = new THREE.Mesh(windowGeo, glassMat);
    windowBand.position.y = groundClearance + skirtH + windowH / 2;
    group.add(windowBand);

    // 3. Upper body / roof structure
    const roofH = H * 0.30;
    const roofGeo = new THREE.BoxGeometry(W, roofH, L);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.y = groundClearance + skirtH + windowH + roofH / 2;
    group.add(roof);

    // Roof cap
    const roofCapGeo = new THREE.BoxGeometry(W - 0.1, 0.08, L - 0.2);
    const roofCap = new THREE.Mesh(roofCapGeo, roofMat);
    roofCap.position.y = groundClearance + H + 0.04;
    group.add(roofCap);

    // 4. Livery side stripes if defined
    if (spec.stripeColor) {
      const stripeMat = new THREE.MeshBasicMaterial({ color: spec.stripeColor });
      const stripeLGeo = new THREE.PlaneGeometry(L - 0.2, 0.14);
      
      const stripeLeft = new THREE.Mesh(stripeLGeo, stripeMat);
      stripeLeft.position.set(-W / 2 - 0.01, groundClearance + skirtH + 0.08, 0);
      stripeLeft.rotation.y = -Math.PI / 2;
      group.add(stripeLeft);

      const stripeRight = new THREE.Mesh(stripeLGeo, stripeMat);
      stripeRight.position.set(W / 2 + 0.01, groundClearance + skirtH + 0.08, 0);
      stripeRight.rotation.y = Math.PI / 2;
      group.add(stripeRight);
    }

    // 5. Roof equipment (AC Pod or Battery Enclosures)
    if (spec.hasAC) {
      const acGeo = new THREE.BoxGeometry(W * 0.65, 0.38, 2.2);
      const acMat = new THREE.MeshStandardMaterial({ color: spec.acColor || 0xd0d8e0, roughness: 0.5 });
      const acPod = new THREE.Mesh(acGeo, acMat);
      acPod.position.set(0, groundClearance + H + 0.22, 0.2);
      group.add(acPod);
    }

    if (spec.hasBatteryPacks) {
      // Modern electric bus roof pods
      const batMat = new THREE.MeshStandardMaterial({ color: 0x222a30, roughness: 0.7 });
      const bat1 = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.35, 2.4), batMat);
      bat1.position.set(0, groundClearance + H + 0.20, L * 0.18);
      group.add(bat1);

      const bat2 = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.35, 2.0), batMat);
      bat2.position.set(0, groundClearance + H + 0.20, -L * 0.22);
      group.add(bat2);
    }

    // 6. Destination Display (Front LED Board)
    const ledTexture = createLedBoardTexture(boardData.no, boardData.dest);
    const boardMat = new THREE.MeshBasicMaterial({ map: ledTexture });
    const boardGeo = new THREE.PlaneGeometry(W * 0.65, 0.34);
    const frontBoard = new THREE.Mesh(boardGeo, boardMat);
    frontBoard.position.set(0, groundClearance + skirtH + windowH + 0.12, L / 2 + 0.02);
    group.add(frontBoard);

    // Front Windshield
    const shieldGeo = new THREE.PlaneGeometry(W - 0.2, windowH + 0.1);
    const frontShield = new THREE.Mesh(shieldGeo, glassMat);
    frontShield.position.set(0, groundClearance + skirtH + windowH / 2, L / 2 + 0.015);
    group.add(frontShield);

    // Rear Window
    const rearShield = new THREE.Mesh(shieldGeo, glassMat);
    rearShield.position.set(0, groundClearance + skirtH + windowH / 2, -L / 2 - 0.015);
    rearShield.rotation.y = Math.PI;
    group.add(rearShield);

    // 7. Headlamps and Taillamps
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });

    // Front headlamps
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.05), lampMat);
    hlL.position.set(-W * 0.36, groundClearance + 0.38, L / 2 + 0.02);
    group.add(hlL);

    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.05), lampMat);
    hlR.position.set(W * 0.36, groundClearance + 0.38, L / 2 + 0.02);
    group.add(hlR);

    // Rear taillamps
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.05), tailMat);
    tlL.position.set(-W * 0.36, groundClearance + 0.44, -L / 2 - 0.02);
    group.add(tlL);

    const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.05), tailMat);
    tlR.position.set(W * 0.36, groundClearance + 0.44, -L / 2 - 0.02);
    group.add(tlR);

    // 8. Wheels
    const wheelR = spec.wheelRadius || 0.48;
    const frontZ = L * 0.32;
    const rearZ = -L * 0.30;
    const halfTrack = W / 2 + 0.05;

    // Front wheels
    const wFL = createWheel(wheelR);
    wFL.position.set(-halfTrack, wheelR, frontZ);
    group.add(wFL);

    const wFR = createWheel(wheelR);
    wFR.position.set(halfTrack, wheelR, frontZ);
    wFR.rotation.y = Math.PI;
    group.add(wFR);

    // Rear wheels (dual rear)
    const wRL = createWheel(wheelR, 0.42);
    wRL.position.set(-halfTrack, wheelR, rearZ);
    group.add(wRL);

    const wRR = createWheel(wheelR, 0.42);
    wRR.position.set(halfTrack, wheelR, rearZ);
    wRR.rotation.y = Math.PI;
    group.add(wRR);

    // Special wireframe overlay for unclassified generic bus
    if (spec.isUnclassified) {
      const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.02, H + 0.02, L + 0.02));
      const wireMat = new THREE.LineBasicMaterial({ color: 0x9ca3af, linewidth: 1.5 });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      wire.position.y = groundClearance + H / 2;
      group.add(wire);
    }

    return group;
  }

  /* Dedicated specifications for each model ID */
  const MODEL_SPECS = {
    'regular-city': {
      length: 11.5,
      width: 2.55,
      height: 3.15,
      groundClearance: 0.38,
      bodyColor: 0xf5f6f4,    // Sarige white
      skirtColor: 0x1f4f9e,   // Sarige blue skirt
      stripeColor: 0x7fb6e6,  // Light blue stripe
      roofColor: 0xe9ecee,
      hasAC: false,
      hasBatteryPacks: false
    },
    'vajra-volvo': {
      length: 12.0,
      width: 2.55,
      height: 3.05,
      groundClearance: 0.28,  // Low floor
      isMetallic: true,
      bodyColor: 0x8fcbef,    // Vajra Volvo light blue
      skirtColor: 0x4c9bd6,   // Vajra darker blue
      stripeColor: 0xffffff,
      roofColor: 0xd6ecf8,
      hasAC: true,
      acColor: 0xd6ecf8,
      hasBatteryPacks: false
    },
    'vayuvajra-airport': {
      length: 12.0,
      width: 2.55,
      height: 3.10,
      groundClearance: 0.28,
      isMetallic: true,
      bodyColor: 0x4f9fdc,    // Vayu Vajra cyan/blue
      skirtColor: 0x2a6fb0,   // Deep blue
      stripeColor: 0x9ad0f2,
      roofColor: 0xcfe6f6,
      hasAC: true,
      acColor: 0x2a6fb0,
      hasBatteryPacks: false
    },
    'electric-city': {
      length: 12.0,
      width: 2.55,
      height: 3.25,
      groundClearance: 0.28,
      bodyColor: 0xf4f8f8,    // White
      skirtColor: 0x0f8f8b,   // Astra teal
      stripeColor: 0x1bb3ae,  // Bright turquoise
      roofColor: 0xe2f1f0,
      hasAC: true,
      hasBatteryPacks: true   // Roof battery enclosures
    },
    'metro-feeder': {
      length: 9.2,            // Midi bus (shorter)
      width: 2.45,
      height: 2.95,
      groundClearance: 0.35,
      bodyColor: 0xf5f6f4,
      skirtColor: 0x7a3fc0,   // Feeder purple
      stripeColor: 0xa875e6,
      roofColor: 0xe9ecee,
      hasAC: false,
      hasBatteryPacks: false
    },
    'bigcircle-city': {
      length: 11.5,
      width: 2.55,
      height: 3.15,
      groundClearance: 0.38,
      bodyColor: 0xf5f6f4,
      skirtColor: 0x2f8a4a,   // Green skirt
      stripeColor: 0x5bc47a,
      roofColor: 0xe9ecee,
      hasAC: false,
      hasBatteryPacks: false
    },
    'express-city': {
      length: 11.8,
      width: 2.55,
      height: 3.20,
      groundClearance: 0.40,
      bodyColor: 0xf6f8f9,
      skirtColor: 0x2f7cc0,   // Vegadootha Express blue
      stripeColor: 0x6fb3e6,
      roofColor: 0xe8eef2,
      hasAC: false,
      hasBatteryPacks: false
    },
    'chakra-midi': {
      length: 8.8,            // Compact midi
      width: 2.40,
      height: 2.90,
      groundClearance: 0.34,
      bodyColor: 0xfaf5f0,
      skirtColor: 0xd0573a,   // Chakra warm red
      stripeColor: 0xf08e75,
      roofColor: 0xf5ece6,
      hasAC: false,
      hasBatteryPacks: false
    },
    'shuttle-mini': {
      length: 8.0,            // Shuttle mini
      width: 2.30,
      height: 2.80,
      groundClearance: 0.32,
      bodyColor: 0xf7f5f0,
      skirtColor: 0x8a6d3b,   // Gold/amber
      stripeColor: 0xb59963,
      roofColor: 0xf0ece0,
      hasAC: false,
      hasBatteryPacks: false
    },
    'ksrtc-intercity': {
      length: 12.0,
      width: 2.55,
      height: 3.30,
      groundClearance: 0.42,
      bodyColor: 0xb23a2e,    // KSRTC deep red
      skirtColor: 0x541812,
      stripeColor: 0xd1d5db,
      roofColor: 0x942e24,
      hasAC: false,
      hasBatteryPacks: false
    },
    'special-contract': {
      length: 11.5,
      width: 2.55,
      height: 3.15,
      groundClearance: 0.38,
      bodyColor: 0xf7f0f6,
      skirtColor: 0xa1478b,   // Magenta/purple
      stripeColor: 0xcf7cb9,
      roofColor: 0xede0eb,
      hasAC: false,
      hasBatteryPacks: false
    },
    'depot-utility': {
      length: 11.2,
      width: 2.50,
      height: 3.10,
      groundClearance: 0.38,
      bodyColor: 0x7c7c84,    // Utility slate grey
      skirtColor: 0x48484f,
      stripeColor: 0xa8a8b0,
      roofColor: 0x6e6e76,
      hasAC: false,
      hasBatteryPacks: false
    },
    'unclassified-generic': {
      length: 11.0,
      width: 2.50,
      height: 3.05,
      groundClearance: 0.35,
      bodyColor: 0x6b7280,    // Neutral slate
      skirtColor: 0x4b5563,
      stripeColor: 0x9ca3af,
      roofColor: 0x606774,
      hasAC: false,
      hasBatteryPacks: false,
      isUnclassified: true
    }
  };

  /**
   * Interactive Three.js Bus Model Viewer Component
   */
  class BusViewer {
    constructor(container, options = {}) {
      this.container = container;
      this.options = options;
      this.animId = null;
      this.isDragging = false;
      this.prevMouse = { x: 0, y: 0 };
      this.rotation = { x: 0.22, y: 0.65 };
      this.targetRotation = { x: 0.22, y: 0.65 };
      this.distance = 15.0;
      this.targetDistance = 15.0;
      this.autoRotate = true;
      this.disposed = false;

      this.init();
    }

    init() {
      if (!hasThree()) {
        console.warn('Three.js not loaded. Falling back to 2D view.');
        return;
      }

      this.container.innerHTML = '';
      this.container.style.position = 'relative';
      this.container.style.overflow = 'hidden';

      const w = this.container.clientWidth || 320;
      const h = this.container.clientHeight || 180;

      // 1. Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf6f8fa);

      // 2. Camera
      this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
      this.updateCamera();

      // 3. Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.container.appendChild(this.renderer.domElement);

      // 4. Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.75);
      this.scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xfffaed, 0.9);
      keyLight.position.set(12, 18, 14);
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xddeeff, 0.45);
      fillLight.position.set(-14, 10, -12);
      this.scene.add(fillLight);

      // Soft ground contact shadow disc
      const shadowGeo = new THREE.PlaneGeometry(16, 7);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.18
      });
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.01;
      this.scene.add(shadow);

      // 5. Build Model
      this.loadModel(this.options.modelId || 'regular-city', this.options.board || {});

      // 6. UI Controls (Reset Camera Button & Category Badge)
      this.addUIControls();

      // 7. Event Listeners for Interaction (Orbit & Zoom)
      this.bindEvents();

      // 8. Start Render Loop
      this.animate = this.animate.bind(this);
      this.animate();
    }

    loadModel(modelId, boardData) {
      if (this.currentModel) {
        this.scene.remove(this.currentModel);
      }
      const spec = MODEL_SPECS[modelId] || MODEL_SPECS['unclassified-generic'];
      this.currentModel = buildBusModel(spec, boardData);
      this.scene.add(this.currentModel);
    }

    addUIControls() {
      // Reset Button
      const resetBtn = document.createElement('button');
      resetBtn.className = 'bus3d-reset-btn';
      resetBtn.setAttribute('title', 'Reset camera view (360° tour)');
      resetBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg><span>Reset</span>';
      resetBtn.style.position = 'absolute';
      resetBtn.style.top = '8px';
      resetBtn.style.right = '8px';
      resetBtn.style.zIndex = '5';
      resetBtn.style.background = 'rgba(255,255,255,0.92)';
      resetBtn.style.border = '1px solid rgba(0,0,0,0.12)';
      resetBtn.style.borderRadius = '6px';
      resetBtn.style.padding = '4px 8px';
      resetBtn.style.fontSize = '11px';
      resetBtn.style.fontWeight = '600';
      resetBtn.style.cursor = 'pointer';
      resetBtn.style.display = 'flex';
      resetBtn.style.alignItems = 'center';
      resetBtn.style.gap = '4px';
      resetBtn.style.color = '#333';
      resetBtn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';

      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resetCamera();
      });
      this.container.appendChild(resetBtn);

      // Honest Model Watermark
      const modelLabel = document.createElement('div');
      modelLabel.className = 'bus3d-model-lbl';
      const isUn = (this.options.modelId || '').includes('unclassified');
      modelLabel.textContent = isUn ? 'Representative Model (Category Unclassified)' : 'Interactive 3D Model · Drag to Rotate 360°';
      modelLabel.style.position = 'absolute';
      modelLabel.style.bottom = '6px';
      modelLabel.style.left = '10px';
      modelLabel.style.zIndex = '5';
      modelLabel.style.fontSize = '10px';
      modelLabel.style.color = isUn ? '#854d0e' : '#64748b';
      modelLabel.style.background = isUn ? 'rgba(254, 240, 138, 0.85)' : 'rgba(255,255,255,0.85)';
      modelLabel.style.padding = '2px 6px';
      modelLabel.style.borderRadius = '4px';
      modelLabel.style.fontWeight = '500';
      modelLabel.style.pointerEvents = 'none';
      this.container.appendChild(modelLabel);
    }

    resetCamera() {
      this.targetRotation.x = 0.22;
      this.targetRotation.y = 0.65;
      this.targetDistance = 15.0;
      this.autoRotate = true;
    }

    updateCamera() {
      const rx = this.rotation.x;
      const ry = this.rotation.y;
      const d = this.distance;

      this.camera.position.x = d * Math.sin(ry) * Math.cos(rx);
      this.camera.position.y = Math.max(1.5, d * Math.sin(rx) + 1.2);
      this.camera.position.z = d * Math.cos(ry) * Math.cos(rx);
      this.camera.lookAt(0, 1.4, 0);
    }

    bindEvents() {
      const dom = this.renderer.domElement;

      // Mouse drag
      dom.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.autoRotate = false;
        this.prevMouse = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.targetRotation.y += dx * 0.01;
        this.targetRotation.x = Math.max(-0.15, Math.min(1.1, this.targetRotation.x + dy * 0.008));
        this.prevMouse = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      // Touch drag
      dom.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.autoRotate = false;
          this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }, { passive: true });

      dom.addEventListener('touchmove', (e) => {
        if (!this.isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - this.prevMouse.x;
        const dy = e.touches[0].clientY - this.prevMouse.y;
        this.targetRotation.y += dx * 0.01;
        this.targetRotation.x = Math.max(-0.15, Math.min(1.1, this.targetRotation.x + dy * 0.008));
        this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }, { passive: true });

      dom.addEventListener('touchend', () => {
        this.isDragging = false;
      });

      // Mouse wheel zoom
      dom.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.autoRotate = false;
        const delta = e.deltaY * 0.012;
        this.targetDistance = Math.max(8.0, Math.min(26.0, this.targetDistance + delta));
      }, { passive: false });

      // Resize observer
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObs = new ResizeObserver(() => this.onResize());
        this.resizeObs.observe(this.container);
      }
    }

    onResize() {
      if (this.disposed || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    }

    animate() {
      if (this.disposed) return;
      this.animId = requestAnimationFrame(this.animate);

      // Auto rotation
      if (this.autoRotate && !this.isDragging) {
        this.targetRotation.y += 0.0035;
      }

      // Smooth damping / inertia
      this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.12;
      this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.12;
      this.distance += (this.targetDistance - this.distance) * 0.15;

      this.updateCamera();
      this.renderer.render(this.scene, this.camera);
    }

    dispose() {
      this.disposed = true;
      if (this.animId) cancelAnimationFrame(this.animId);
      if (this.resizeObs) this.resizeObs.disconnect();
      if (this.renderer) {
        this.renderer.dispose();
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
      }
    }
  }

  /* Mount function to be called from live.js hero3D */
  function mountViewer(container, modelId, boardData = {}) {
    return new BusViewer(container, { modelId, board: boardData });
  }

  return {
    hasThree,
    MODEL_SPECS,
    mountViewer,
    createLedBoardTexture,
    buildBusModel
  };
})();

if (typeof window !== 'undefined') {
  window.BUS3D_LIB = BUS3D_LIB;
}
