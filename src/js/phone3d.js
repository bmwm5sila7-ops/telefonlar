import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3(0, 0.08, 0);

function detectSoftwareWebGL() {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createScreenTexture(phone, maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Deep OLED background
  const bg = ctx.createLinearGradient(0, 0, 512, 1024);
  bg.addColorStop(0, '#070b14');
  bg.addColorStop(0.45, '#0f172a');
  bg.addColorStop(1, '#090d16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 1024);

  // Studio curved light ribbon wallpaper
  const accent1 = phone.wallpaperAccent || '#2563eb';
  const accent2 = phone.wallpaperSecondary || '#f59e0b';

  const glowA = ctx.createRadialGradient(360, 320, 20, 340, 340, 320);
  glowA.addColorStop(0, accent1);
  glowA.addColorStop(0.55, `${accent1}44`);
  glowA.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, 512, 1024);

  const glowB = ctx.createRadialGradient(140, 680, 20, 160, 680, 310);
  glowB.addColorStop(0, accent2);
  glowB.addColorStop(0.5, `${accent2}40`);
  glowB.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle architectural curves
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-40, 420 + i * 55);
    ctx.bezierCurveTo(160, 280 + i * 40, 340, 640 - i * 35, 560, 470 + i * 45);
    ctx.stroke();
  }

  // Status bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('5G', 48, 56);
  ctx.fillRect(426, 42, 34, 16);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(429, 45, 26, 10);

  // Lockscreen clock
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.font = '700 124px "Outfit", sans-serif';
  ctx.fillText('10:09', 256, 238);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Juma, 20 Noyabr', 256, 280);

  // Glass widget card on lockscreen
  ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(54, 720, 404, 148, 26);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = accent1;
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText(phone.brand.toUpperCase(), 82, 764);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px "Outfit", sans-serif';
  ctx.fillText(phone.name, 82, 804);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
  ctx.font = '400 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(phone.shortSpecs, 82, 838);

  // Bottom home indicator
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.roundRect(176, 976, 160, 8, 4);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, maxAnisotropy || 1);
  return texture;
}

export class Phone3DStage {
  constructor(container, options = {}) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.paused = false;
    this.disposed = false;
    this.frameId = 0;
    this.renderBusy = false;
    this.renderDirty = false;
    this.clock = new THREE.Clock();

    this.explodeTarget = 0;
    this.explodeCurrent = 0;
    this.cameraPreset = null;
    this.activePhone = null;
    this.activeColor = null;

    this.layers = {
      screen: null,
      internals: null,
      chassis: null,
      backplate: null,
      cameraModule: null
    };
    this.materials = {
      frame: null,
      back: null,
      screenTex: null
    };
    this.disposables = [];

    this._initScene(options);
    this._bindEvents();
  }

  _initScene(options) {
    const width = Math.max(300, this.container.clientWidth || 640);
    const height = Math.max(300, this.container.clientHeight || 480);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0e121b, 0.045);

    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    this.camera.position.set(1.9, 0.45, 3.65);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Studio Environment Reflections (mandatory for metal & sapphire glass)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmremGenerator.dispose();

    // 3-Point Studio Lighting + Warm/Cool Contrast
    const hemiLight = new THREE.HemisphereLight(0xcbe0ff, 0x161922, 0.85);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.1);
    keyLight.position.set(3.5, 5.2, 4.0);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -2.5;
      keyLight.shadow.camera.right = 2.5;
      keyLight.shadow.camera.top = 2.5;
      keyLight.shadow.camera.bottom = -2.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x4f8cff, 1.35);
    rimLight.position.set(-3.8, 2.5, -3.5);
    this.scene.add(rimLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxLeft = new THREE.RectAreaLight(0xffffff, 2.4, 2.2, 3.6);
      softboxLeft.position.set(-3.2, 1.2, 1.8);
      softboxLeft.lookAt(0, 0.1, 0);
      this.scene.add(softboxLeft);

      const softboxRight = new THREE.RectAreaLight(0x9ec5ff, 1.6, 2.0, 3.2);
      softboxRight.position.set(3.2, 0.8, -1.6);
      softboxRight.lookAt(0, 0.1, 0);
      this.scene.add(softboxRight);
    }

    // Grounded Studio Pedestal & Contact Shadow
    this.pedestalGroup = new THREE.Group();
    const shadowTex = createContactShadowTexture();
    this.disposables.push(shadowTex);

    const shadowGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.16;
    this.pedestalGroup.add(shadowPlane);
    this.disposables.push(shadowGeo, shadowMat);

    const ringGeo = new THREE.RingGeometry(0.96, 1.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -1.15;
    this.pedestalGroup.add(ringMesh);
    this.disposables.push(ringGeo, ringMat);

    const baseDiscGeo = new THREE.CylinderGeometry(1.12, 1.18, 0.04, 64);
    const baseDiscMat = new THREE.MeshStandardMaterial({
      color: 0x111520,
      metalness: 0.65,
      roughness: 0.42
    });
    const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
    baseDisc.position.y = -1.19;
    baseDisc.receiveShadow = true;
    this.pedestalGroup.add(baseDisc);
    this.disposables.push(baseDiscGeo, baseDiscMat);

    this.scene.add(this.pedestalGroup);

    // Phone Root Group
    this.phoneRoot = new THREE.Group();
    this.phoneRoot.position.y = 0.08;
    this.scene.add(this.phoneRoot);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.08, 0);
    this.controls.enablePan = false;
    this.controls.minDistance = 2.1;
    this.controls.maxDistance = 5.4;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.maxPolarAngle = Math.PI * 0.78;
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = false;

    this.controls.addEventListener('start', () => {
      // Cancel preset camera flight immediately so we never fight user drag
      this.cameraPreset = null;
    });

    if (options.initialPhone) {
      this.setPhone(options.initialPhone, options.initialColor);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this._startLoop();
  }

  _bindEvents() {
    this._onResize = () => {
      if (this.disposed) return;
      const w = Math.max(260, this.container.clientWidth);
      const h = Math.max(260, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    this._resizeObserver = new ResizeObserver(this._onResize);
    this._resizeObserver.observe(this.container);

    this._onContextLost = (e) => {
      e.preventDefault();
      this.pause();
    };
    this._onContextRestored = () => {
      this.resume();
    };

    this.renderer.domElement.addEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this._onContextRestored);
  }

  _clearPhoneModel() {
    while (this.phoneRoot.children.length > 0) {
      this.phoneRoot.remove(this.phoneRoot.children[0]);
    }
    this.modelDisposables?.forEach((d) => d.dispose());
    this.modelDisposables = [];
  }

  setPhone(phone, colorObj) {
    this.activePhone = phone;
    this.activeColor = colorObj || phone.colors[0];
    this._clearPhoneModel();

    const track = (item) => {
      this.modelDisposables.push(item);
      return item;
    };

    const isAngular = phone.chassis === 'galaxy';
    const cornerRadius = isAngular ? 0.035 : 0.145;
    const width = 0.94;
    const height = 1.96;
    const depth = 0.095;

    // 1. Metallic Frame (Primary silhouette)
    const frameMat = track(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.activeColor.frameHex),
        metalness: this.activeColor.metalness ?? 0.9,
        roughness: this.activeColor.roughness ?? 0.22,
        anisotropy: 0.75,
        clearcoat: 0.25,
        clearcoatRoughness: 0.25
      })
    );
    this.materials.frame = frameMat;

    const backMat = track(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.activeColor.hex),
        metalness: phone.chassis === 'xiaomi' ? 0.25 : 0.35,
        roughness: phone.chassis === 'xiaomi' ? 0.55 : 0.36,
        clearcoat: phone.chassis === 'xiaomi' ? 0.2 : 0.65,
        clearcoatRoughness: 0.22
      })
    );
    this.materials.back = backMat;

    const darkGlassMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x090b10,
        metalness: 0.1,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04
      })
    );

    const chassisGroup = new THREE.Group();
    const bodyShape = createRoundedRectShape(width, height, cornerRadius);
    const frameGeo = track(
      new THREE.ExtrudeGeometry(bodyShape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 4,
        curveSegments: 20
      })
    );
    frameGeo.center();
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.castShadow = true;
    chassisGroup.add(frameMesh);

    // Side buttons (Power, Volume, Action)
    const btnGeo = track(new THREE.BoxGeometry(0.016, 0.16, 0.032));
    const powerBtn = new THREE.Mesh(btnGeo, frameMat);
    powerBtn.position.set(width / 2 + 0.014, 0.22, 0);
    chassisGroup.add(powerBtn);

    const volUpBtn = new THREE.Mesh(btnGeo, frameMat);
    volUpBtn.scale.set(1, 0.85, 1);
    volUpBtn.position.set(-width / 2 - 0.014, 0.34, 0);
    chassisGroup.add(volUpBtn);

    const volDownBtn = new THREE.Mesh(btnGeo, frameMat);
    volDownBtn.scale.set(1, 0.85, 1);
    volDownBtn.position.set(-width / 2 - 0.014, 0.15, 0);
    chassisGroup.add(volDownBtn);

    // Bottom USB-C port & speaker grilles
    const portGeo = track(new THREE.BoxGeometry(0.11, 0.014, 0.032));
    const portMat = track(new THREE.MeshStandardMaterial({ color: 0x05070b, metalness: 0.8, roughness: 0.4 }));
    const usbPort = new THREE.Mesh(portGeo, portMat);
    usbPort.position.set(0, -height / 2 - 0.008, 0);
    chassisGroup.add(usbPort);

    this.phoneRoot.add(chassisGroup);
    this.layers.chassis = chassisGroup;

    // 2. Front OLED Display Layer (Explodes forward +Z)
    const screenGroup = new THREE.Group();
    const bezelShape = createRoundedRectShape(width - 0.032, height - 0.032, Math.max(0.02, cornerRadius - 0.015));
    const bezelGeo = track(new THREE.ShapeGeometry(bezelShape, 18));
    const bezelMesh = new THREE.Mesh(bezelGeo, darkGlassMat);
    bezelMesh.position.z = depth / 2 + 0.013;
    screenGroup.add(bezelMesh);

    const screenTex = track(createScreenTexture(phone, this.renderer.capabilities.getMaxAnisotropy()));
    this.materials.screenTex = screenTex;

    const screenShape = createRoundedRectShape(width - 0.068, height - 0.068, Math.max(0.016, cornerRadius - 0.025));
    const screenGeo = track(new THREE.ShapeGeometry(screenShape, 18));
    // Normalize UVs for ShapeGeometry so the wallpaper fits [0..1]
    const posAttr = screenGeo.attributes.position;
    const uvs = new Float32Array(posAttr.count * 2);
    const sw = width - 0.068;
    const sh = height - 0.068;
    for (let i = 0; i < posAttr.count; i++) {
      uvs[i * 2] = (posAttr.getX(i) + sw / 2) / sw;
      uvs[i * 2 + 1] = (posAttr.getY(i) + sh / 2) / sh;
    }
    screenGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const screenMat = track(
      new THREE.MeshPhysicalMaterial({
        map: screenTex,
        emissiveMap: screenTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.72,
        roughness: 0.08,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04
      })
    );
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = depth / 2 + 0.015;
    screenGroup.add(screenMesh);

    // Dynamic Island / Punch-Hole Front Camera
    const punchMat = track(new THREE.MeshStandardMaterial({ color: 0x020305, metalness: 0.4, roughness: 0.15 }));
    if (phone.chassis === 'iphone' || phone.chassis === 'honor') {
      const pillGeo = track(new THREE.CapsuleGeometry(0.022, 0.11, 8, 12));
      const pillMesh = new THREE.Mesh(pillGeo, punchMat);
      pillMesh.rotation.z = Math.PI / 2;
      pillMesh.position.set(0, height / 2 - 0.11, depth / 2 + 0.018);
      screenGroup.add(pillMesh);
    } else {
      const dotGeo = track(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 20));
      const dotMesh = new THREE.Mesh(dotGeo, punchMat);
      dotMesh.rotation.x = Math.PI / 2;
      dotMesh.position.set(0, height / 2 - 0.09, depth / 2 + 0.018);
      screenGroup.add(dotMesh);
    }

    this.phoneRoot.add(screenGroup);
    this.layers.screen = screenGroup;

    // 3. Internal Hardware Architecture (Revealed during Exploded View!)
    const internalsGroup = new THREE.Group();

    // Logic Board (Matte dark emerald/slate PCB + silver SoC chip)
    const pcbGeo = track(new THREE.BoxGeometry(0.72, 0.56, 0.018));
    const pcbMat = track(new THREE.MeshStandardMaterial({ color: 0x16382b, metalness: 0.35, roughness: 0.45 }));
    const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
    pcbMesh.position.set(0, 0.52, 0.01);
    internalsGroup.add(pcbMesh);

    const socGeo = track(new THREE.BoxGeometry(0.18, 0.18, 0.012));
    const socMat = track(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.92, roughness: 0.18 }));
    const socMesh = new THREE.Mesh(socGeo, socMat);
    socMesh.position.set(-0.08, 0.52, 0.024);
    internalsGroup.add(socMesh);

    // Copper Vapor Chamber Cooling Plate
    const copperGeo = track(new THREE.BoxGeometry(0.62, 0.78, 0.008));
    const copperMat = track(new THREE.MeshStandardMaterial({ color: 0xc87542, metalness: 0.9, roughness: 0.24 }));
    const copperMesh = new THREE.Mesh(copperGeo, copperMat);
    copperMesh.position.set(0, -0.05, 0.02);
    internalsGroup.add(copperMesh);

    // Lithium Battery Cell
    const batGeo = track(new THREE.BoxGeometry(0.68, 0.94, 0.032));
    const batMat = track(new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.45 }));
    const batMesh = new THREE.Mesh(batGeo, batMat);
    batMesh.position.set(0, -0.34, -0.005);
    internalsGroup.add(batMesh);

    // Qi2 / MagSafe Copper Charging Ring
    const coilGeo = track(new THREE.TorusGeometry(0.24, 0.016, 12, 48));
    const coilMesh = new THREE.Mesh(coilGeo, copperMat);
    coilMesh.position.set(0, -0.18, -0.025);
    internalsGroup.add(coilMesh);

    this.phoneRoot.add(internalsGroup);
    this.layers.internals = internalsGroup;

    // 4. Rear Frosted Backplate (Explodes backward -Z)
    const backGroup = new THREE.Group();
    const backShape = createRoundedRectShape(width - 0.028, height - 0.028, Math.max(0.02, cornerRadius - 0.012));
    const backGeo = track(new THREE.ShapeGeometry(backShape, 18));
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.rotation.y = Math.PI;
    backMesh.position.z = -depth / 2 - 0.013;
    backGroup.add(backMesh);

    this.phoneRoot.add(backGroup);
    this.layers.backplate = backGroup;

    // 5. Rear Camera Module (Distinct silhouettes per brand)
    const camGroup = new THREE.Group();
    camGroup.position.z = -depth / 2 - 0.016;
    this._buildCameraIsland(camGroup, phone.chassis, frameMat, darkGlassMat, track);

    // Optional S-Pen silhouette detail next to Galaxy S25 Ultra
    if (phone.chassis === 'galaxy') {
      const penMat = track(new THREE.MeshStandardMaterial({ color: 0x222630, metalness: 0.65, roughness: 0.35 }));
      const penGeo = track(new THREE.CylinderGeometry(0.022, 0.02, 1.38, 16));
      const penMesh = new THREE.Mesh(penGeo, penMat);
      penMesh.position.set(0.66, -0.22, 0);
      camGroup.add(penMesh);

      const penTipGeo = track(new THREE.ConeGeometry(0.02, 0.08, 16));
      const penTip = new THREE.Mesh(penTipGeo, frameMat);
      penTip.rotation.x = Math.PI;
      penTip.position.set(0.66, -0.95, 0);
      camGroup.add(penTip);
    }

    this.phoneRoot.add(camGroup);
    this.layers.cameraModule = camGroup;
  }

  _buildCameraIsland(camGroup, chassis, frameMat, darkGlassMat, track) {
    const lensRingMat = track(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.95, roughness: 0.14 })
    );
    const lensGlassMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x0b162c,
        metalness: 0.2,
        roughness: 0.04,
        clearcoat: 1.0,
        iridescence: 0.85,
        iridescenceIOR: 1.4
      })
    );
    const flashMat = track(
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfde68a, emissiveIntensity: 0.35, roughness: 0.2 })
    );

    const addLens = (x, y, z, radius) => {
      const ringGeo = track(new THREE.CylinderGeometry(radius, radius, 0.026, 28));
      const ring = new THREE.Mesh(ringGeo, lensRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, z - 0.012);
      camGroup.add(ring);

      const glassGeo = track(new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, 0.028, 24));
      const glass = new THREE.Mesh(glassGeo, lensGlassMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(x, y, z - 0.013);
      camGroup.add(glass);

      const pupilGeo = track(new THREE.CylinderGeometry(radius * 0.34, radius * 0.34, 0.03, 18));
      const pupil = new THREE.Mesh(pupilGeo, darkGlassMat);
      pupil.rotation.x = Math.PI / 2;
      pupil.position.set(x, y, z - 0.014);
      camGroup.add(pupil);
    };

    if (chassis === 'iphone') {
      const plateauShape = createRoundedRectShape(0.42, 0.42, 0.09);
      const plateauGeo = track(
        new THREE.ExtrudeGeometry(plateauShape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 })
      );
      const plateau = new THREE.Mesh(plateauGeo, frameMat);
      plateau.rotation.y = Math.PI;
      plateau.position.set(0.21, 0.68, 0);
      camGroup.add(plateau);

      addLens(0.30, 0.78, -0.024, 0.078);
      addLens(0.30, 0.58, -0.024, 0.078);
      addLens(0.12, 0.68, -0.024, 0.078);

      const flashGeo = track(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16));
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.rotation.x = Math.PI / 2;
      flash.position.set(0.12, 0.80, -0.024);
      camGroup.add(flash);
    } else if (chassis === 'galaxy') {
      addLens(0.28, 0.78, -0.016, 0.076);
      addLens(0.28, 0.59, -0.016, 0.076);
      addLens(0.28, 0.40, -0.016, 0.076);
      addLens(0.11, 0.68, -0.016, 0.044);
      addLens(0.11, 0.49, -0.016, 0.044);

      const flashGeo = track(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 16));
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.rotation.x = Math.PI / 2;
      flash.position.set(0.11, 0.585, -0.015);
      camGroup.add(flash);
    } else if (chassis === 'xiaomi' || chassis === 'honor' || chassis === 'oneplus') {
      const offsetX = chassis === 'oneplus' ? 0.14 : 0;
      const diskRadius = chassis === 'xiaomi' ? 0.34 : 0.29;
      const segments = chassis === 'honor' ? 8 : 48;

      const diskGeo = track(new THREE.CylinderGeometry(diskRadius, diskRadius * 1.03, 0.032, segments));
      const disk = new THREE.Mesh(diskGeo, darkGlassMat);
      disk.rotation.x = Math.PI / 2;
      disk.position.set(offsetX, 0.56, -0.016);
      camGroup.add(disk);

      const bezelGeo = track(new THREE.TorusGeometry(diskRadius, 0.014, 12, segments));
      const bezel = new THREE.Mesh(bezelGeo, frameMat);
      bezel.position.set(offsetX, 0.56, -0.032);
      camGroup.add(bezel);

      addLens(offsetX - 0.12, 0.65, -0.032, 0.068);
      addLens(offsetX + 0.12, 0.65, -0.032, 0.068);
      addLens(offsetX - 0.12, 0.46, -0.032, 0.068);
      addLens(offsetX + 0.12, 0.46, -0.032, 0.068);
    } else if (chassis === 'pixel') {
      const visorShape = createRoundedRectShape(0.82, 0.24, 0.11);
      const visorGeo = track(
        new THREE.ExtrudeGeometry(visorShape, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 })
      );
      const visor = new THREE.Mesh(visorGeo, frameMat);
      visor.rotation.y = Math.PI;
      visor.position.set(0, 0.64, 0);
      camGroup.add(visor);

      addLens(0.21, 0.64, -0.036, 0.066);
      addLens(0.03, 0.64, -0.036, 0.066);
      addLens(-0.15, 0.64, -0.036, 0.056);

      const flashGeo = track(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16));
      const flash = new THREE.Mesh(flashGeo, flashMat);
      flash.rotation.x = Math.PI / 2;
      flash.position.set(-0.29, 0.66, -0.036);
      camGroup.add(flash);
    }
  }

  setColor(colorObj) {
    this.activeColor = colorObj;
    if (this.materials.frame) {
      this.materials.frame.color.set(colorObj.frameHex);
      this.materials.frame.metalness = colorObj.metalness ?? 0.9;
      this.materials.frame.roughness = colorObj.roughness ?? 0.22;
    }
    if (this.materials.back) {
      this.materials.back.color.set(colorObj.hex);
    }
  }

  setExplode(ratio) {
    this.explodeTarget = THREE.MathUtils.clamp(ratio, 0, 1);
  }

  setCameraPreset(preset) {
    const map = {
      hero: new THREE.Vector3(1.9, 0.45, 3.65),
      front: new THREE.Vector3(0, 0.12, 3.85),
      back: new THREE.Vector3(0, 0.15, -3.85),
      side: new THREE.Vector3(3.4, 0.25, 0.85)
    };
    this.cameraPreset = map[preset] ? map[preset].clone() : null;
  }

  pause() {
    this.paused = true;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      this.frameId = 0;
    }
  }

  resume() {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    this.clock.getDelta();
    this._startLoop();
  }

  _afterDraw(cb) {
    const gl = this.renderer.getContext();
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed || this.paused) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  _startLoop() {
    const tick = () => {
      if (this.disposed || this.paused) return;

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();

      // Smooth Exploded View Damping
      this.explodeCurrent = THREE.MathUtils.damp(this.explodeCurrent, this.explodeTarget, 7, delta);
      if (this.layers.screen && this.layers.internals && this.layers.backplate && this.layers.cameraModule) {
        this.layers.screen.position.z = this.explodeCurrent * 0.42;
        this.layers.internals.position.z = this.explodeCurrent * 0.12;
        this.layers.backplate.position.z = -this.explodeCurrent * 0.36;
        this.layers.cameraModule.position.z = -0.0635 - this.explodeCurrent * 0.56;
      }

      // Gentle studio levitation & slow idle sway
      if (!this.prefersReducedMotion) {
        this.phoneRoot.position.y = 0.08 + Math.sin(elapsed * 1.4) * 0.045;
        this.phoneRoot.rotation.y = Math.sin(elapsed * 0.45) * 0.18;
      }

      // Smooth Camera Preset Flight
      if (this.cameraPreset) {
        _targetPos.copy(this.cameraPreset);
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _targetPos.x, 6, delta);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _targetPos.y, 6, delta);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _targetPos.z, 6, delta);
        this.controls.target.lerp(_targetLook, 1 - Math.exp(-6 * delta));
        if (this.camera.position.distanceTo(_targetPos) < 0.025) {
          this.cameraPreset = null;
        }
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this._afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  dispose() {
    this.disposed = true;
    this.pause();
    this._resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this._onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this._onContextRestored);
    this._clearPhoneModel();
    this.disposables.forEach((d) => d.dispose());
    this.envRT?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
