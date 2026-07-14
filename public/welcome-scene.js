import * as THREE from "/vendor/three.module.min.js";

const canvas = document.querySelector("#welcomeCanvas");
const hero = document.querySelector("#welcomeHero");

if (canvas && hero) {
  initWelcomeScene(canvas, hero);
}

function initWelcomeScene(targetCanvas, targetHero) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas: targetCanvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
  } catch {
    document.body.classList.add("scene-fallback");
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfafbff);
  scene.fog = new THREE.Fog(0xfafbff, 10, 24);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(0, 1.15, 12.5);

  const world = new THREE.Group();
  const gallery = new THREE.Group();
  const orbGroup = new THREE.Group();
  const panelMeshes = [];
  world.add(gallery, orbGroup);
  scene.add(world);

  const orbTexture = createOrbTexture();
  const mainOrb = new THREE.Mesh(
    new THREE.SphereGeometry(1.36, 96, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: orbTexture,
      emissive: 0xffffff,
      emissiveMap: orbTexture,
      emissiveIntensity: 0.18,
      roughness: 0.1,
      metalness: 0.02,
      transmission: 0.08,
      thickness: 1.8,
      ior: 1.34,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 0.52,
      iridescenceIOR: 1.28,
      iridescenceThicknessRange: [120, 520],
      attenuationColor: new THREE.Color(0xc9baff),
      attenuationDistance: 2.4,
      transparent: true,
      opacity: 0.92
    })
  );
  mainOrb.position.set(0, -0.58, -2.7);
  mainOrb.castShadow = true;
  orbGroup.add(mainOrb);

  const smallOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.47, 72, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xffd8ee,
      roughness: 0.06,
      metalness: 0.01,
      transmission: 0.56,
      thickness: 1.1,
      ior: 1.38,
      clearcoat: 1,
      iridescence: 0.72,
      iridescenceIOR: 1.3,
      transparent: true,
      opacity: 0.94
    })
  );
  smallOrb.position.set(0, -0.63, -0.8);
  smallOrb.castShadow = true;
  orbGroup.add(smallOrb);

  const panelLayout = [
    { x: 2.3, y: -1.12, z: 0.25, width: 1.5, height: 2.5, rotation: -0.28 },
    { x: 3.75, y: -0.9, z: -0.55, width: 1.45, height: 2.75, rotation: -0.42 },
    { x: 5.05, y: -0.63, z: -1.38, width: 1.5, height: 3.0, rotation: -0.56 },
    { x: 6.2, y: -0.38, z: -2.18, width: 1.55, height: 3.2, rotation: -0.66 }
  ];

  for (const side of [-1, 1]) {
    panelLayout.forEach((layout, index) => {
      const texture = createDreamTexture(index, side);
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: texture,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.16,
        roughness: 0.1,
        metalness: 0,
        transmission: 0.06,
        thickness: 0.7,
        ior: 1.32,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      });

      const panel = new THREE.Mesh(
        createRoundedPanelGeometry(layout.width, layout.height, 0.18, 0.055),
        material
      );
      panel.position.set(side * layout.x, layout.y, layout.z);
      panel.rotation.y = side * layout.rotation;
      panel.rotation.z = side * (0.012 + index * 0.004);
      panel.castShadow = true;
      panel.receiveShadow = true;
      panel.userData = {
        baseY: layout.y,
        phase: index * 0.72 + (side > 0 ? 0.4 : 0),
        rank: index
      };
      gallery.add(panel);
      panelMeshes.push(panel);

      const rim = new THREE.Mesh(
        createRoundedPanelGeometry(layout.width * 1.025, layout.height * 1.018, 0.19, 0.025),
        new THREE.MeshPhysicalMaterial({
          color: index % 2 === 0 ? 0xe6edff : 0xf4e8ff,
          roughness: 0.04,
          transmission: 0.86,
          thickness: 0.25,
          ior: 1.4,
          clearcoat: 1,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide
        })
      );
      rim.position.copy(panel.position);
      rim.position.z -= 0.035;
      rim.rotation.copy(panel.rotation);
      rim.userData = {
        baseY: layout.y,
        phase: panel.userData.phase,
        rank: index,
        isRim: true
      };
      gallery.add(rim);
      panelMeshes.push(rim);
    });
  }

  const mountains = createMountainRange();
  mountains.position.set(0, -1.94, -4.25);
  world.add(mountains);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 26),
    new THREE.MeshPhysicalMaterial({
      color: 0xf7f8ff,
      roughness: 0.16,
      metalness: 0.02,
      transmission: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.42;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(30, 20, 0xb7b4f5, 0xd9dafa);
  grid.position.y = -3.405;
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  scene.add(grid);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xbfc9ed, 1.8);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.7);
  keyLight.position.set(-4, 7, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -5;
  scene.add(keyLight);

  const lavenderLight = new THREE.PointLight(0x8d8bff, 14, 13, 2);
  lavenderLight.position.set(-2.8, -0.1, 4.5);
  scene.add(lavenderLight);

  const roseLight = new THREE.PointLight(0xffb0dc, 12, 12, 2);
  roseLight.position.set(3.2, -0.6, 3.8);
  scene.add(roseLight);

  const horizonLight = new THREE.PointLight(0xffe4ed, 12, 10, 1.8);
  horizonLight.position.set(0, -1.2, -0.6);
  scene.add(horizonLight);

  let sceneActive = true;
  let transitionTarget = 0;
  let transitionValue = 0;
  let viewportWidth = 0;
  let viewportHeight = 0;

  const resize = () => {
    const rect = targetHero.getBoundingClientRect();
    viewportWidth = Math.max(1, Math.round(rect.width));
    viewportHeight = Math.max(1, Math.round(rect.height));
    const mobile = viewportWidth < 700;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.65));
    renderer.setSize(viewportWidth, viewportHeight, false);
    camera.aspect = viewportWidth / viewportHeight;
    camera.fov = mobile ? 48 : 36;
    camera.updateProjectionMatrix();

    world.position.set(0, mobile ? -2.05 : -2.02, 0);
    world.scale.setScalar(mobile ? 0.72 : 1);
    panelMeshes.forEach((panel) => {
      panel.visible = !mobile || panel.userData.rank < 3;
    });
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(targetHero);
  resize();

  targetHero.addEventListener("pointermove", (event) => {
    if (reduceMotion.matches) return;
    const rect = targetHero.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerTarget.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  targetHero.addEventListener("pointerleave", () => pointerTarget.set(0, 0));

  window.addEventListener("studio:enter", () => {
    transitionTarget = 1;
  });
  window.addEventListener("studio:entered", () => {
    sceneActive = false;
  });
  window.addEventListener("studio:welcome", () => {
    sceneActive = true;
    transitionTarget = 0;
  });

  const timer = new THREE.Timer();
  timer.connect(document);
  const targetScale = new THREE.Vector3();

  const render = (timestamp) => {
    requestAnimationFrame(render);
    if (!sceneActive && transitionValue > 0.995) return;

    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.05);
    const elapsed = timer.getElapsed();
    pointer.lerp(pointerTarget, 1 - Math.pow(0.001, delta));
    transitionValue = THREE.MathUtils.damp(transitionValue, transitionTarget, 4.6, delta);

    const mobile = viewportWidth < 700;
    const baseScale = mobile ? 0.72 : 1;
    targetScale.setScalar(baseScale * (1 + transitionValue * 0.12));
    world.scale.lerp(targetScale, 1 - Math.pow(0.0001, delta));

    if (!reduceMotion.matches) {
      mainOrb.rotation.y += delta * 0.045;
      mainOrb.rotation.x = Math.sin(elapsed * 0.24) * 0.025;
      smallOrb.position.y = -0.63 + Math.sin(elapsed * 0.65) * 0.055;
      panelMeshes.forEach((panel) => {
        panel.position.y = panel.userData.baseY + Math.sin(elapsed * 0.32 + panel.userData.phase) * 0.035;
      });
      world.rotation.y = THREE.MathUtils.damp(world.rotation.y, pointer.x * 0.022, 2.6, delta);
      world.rotation.x = THREE.MathUtils.damp(world.rotation.x, pointer.y * 0.012, 2.6, delta);
      camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.14, 3, delta);
    }

    camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.15 + pointer.y * 0.06, 3, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 12.5 - transitionValue * 0.9, 4, delta);
    camera.lookAt(0, -1.05, 0);
    renderer.render(scene, camera);
  };

  render();
}

function createDreamTexture(index, side) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  const palettes = [
    ["#91b7f5", "#eee6ff", "#fff4f4"],
    ["#a8c8ff", "#e8edff", "#fff4fb"],
    ["#bdc7f6", "#f1e8ff", "#ffe9ed"],
    ["#d2d9f8", "#f4edff", "#fff8fb"]
  ];
  const palette = palettes[index % palettes.length];
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, palette[0]);
  sky.addColorStop(0.52, palette[1]);
  sky.addColorStop(1, palette[2]);
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const sun = context.createRadialGradient(260, 410, 8, 260, 410, 190);
  sun.addColorStop(0, "rgba(255,255,255,0.96)");
  sun.addColorStop(0.32, "rgba(255,220,239,0.62)");
  sun.addColorStop(1, "rgba(255,220,239,0)");
  context.fillStyle = sun;
  context.fillRect(0, 210, canvas.width, 390);

  drawCloud(context, 110 + index * 28, 270 + index * 34, 1.1, side);
  drawCloud(context, 385 - index * 20, 355 - index * 18, 0.78, -side);

  context.beginPath();
  context.moveTo(0, 610);
  context.lineTo(95, 515 - index * 10);
  context.lineTo(188, 594);
  context.lineTo(310, 475 + index * 15);
  context.lineTo(420, 578);
  context.lineTo(512, 515);
  context.lineTo(512, 768);
  context.lineTo(0, 768);
  context.closePath();
  context.fillStyle = index % 2 === 0 ? "rgba(116,139,202,0.34)" : "rgba(150,145,215,0.28)";
  context.fill();

  const reflection = context.createLinearGradient(0, 590, 0, 768);
  reflection.addColorStop(0, "rgba(255,255,255,0.64)");
  reflection.addColorStop(1, "rgba(188,203,245,0.42)");
  context.fillStyle = reflection;
  context.fillRect(0, 590, canvas.width, 178);

  context.strokeStyle = "rgba(255,255,255,0.48)";
  context.lineWidth = 2;
  for (let line = 0; line < 4; line += 1) {
    context.beginPath();
    context.moveTo(0, 645 + line * 32);
    context.quadraticCurveTo(256, 625 + line * 36, 512, 648 + line * 31);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createOrbTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#8196e5");
  sky.addColorStop(0.48, "#c5b5ed");
  sky.addColorStop(0.7, "#ffd7e6");
  sky.addColorStop(1, "#eef2ff");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(512, 640, 18, 512, 640, 330);
  glow.addColorStop(0, "rgba(255,255,255,0.98)");
  glow.addColorStop(0.22, "rgba(255,225,239,0.8)");
  glow.addColorStop(1, "rgba(255,225,239,0)");
  context.fillStyle = glow;
  context.fillRect(130, 260, 764, 720);

  context.beginPath();
  context.moveTo(0, 820);
  context.lineTo(150, 690);
  context.lineTo(265, 765);
  context.lineTo(390, 625);
  context.lineTo(515, 780);
  context.lineTo(650, 650);
  context.lineTo(790, 745);
  context.lineTo(1024, 610);
  context.lineTo(1024, 1024);
  context.lineTo(0, 1024);
  context.closePath();
  context.fillStyle = "rgba(116,109,182,0.5)";
  context.fill();

  const lake = context.createLinearGradient(0, 760, 0, 1024);
  lake.addColorStop(0, "rgba(255,235,246,0.78)");
  lake.addColorStop(1, "rgba(185,203,245,0.66)");
  context.fillStyle = lake;
  context.fillRect(0, 790, 1024, 234);

  context.strokeStyle = "rgba(255,255,255,0.58)";
  context.lineWidth = 4;
  for (let line = 0; line < 4; line += 1) {
    context.beginPath();
    context.moveTo(90, 845 + line * 44);
    context.quadraticCurveTo(512, 816 + line * 48, 934, 850 + line * 43);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawCloud(context, x, y, scale, direction) {
  context.save();
  context.translate(x, y);
  context.scale(direction, 1);
  const cloud = context.createRadialGradient(0, 0, 4, 0, 0, 90 * scale);
  cloud.addColorStop(0, "rgba(255,255,255,0.86)");
  cloud.addColorStop(0.62, "rgba(244,238,255,0.58)");
  cloud.addColorStop(1, "rgba(224,229,255,0)");
  context.fillStyle = cloud;
  [[0, 0, 85, 50], [46, 8, 68, 43], [-46, 15, 62, 37], [18, -28, 54, 45]].forEach(
    ([cx, cy, rx, ry]) => {
      context.beginPath();
      context.ellipse(cx * scale, cy * scale, rx * scale, ry * scale, 0, 0, Math.PI * 2);
      context.fill();
    }
  );
  context.restore();
}

function createMountainRange() {
  const shape = new THREE.Shape();
  shape.moveTo(-6.4, -0.65);
  shape.lineTo(-5.25, 0.12);
  shape.lineTo(-4.25, -0.35);
  shape.lineTo(-3.15, 0.44);
  shape.lineTo(-1.95, -0.28);
  shape.lineTo(-0.82, 0.22);
  shape.lineTo(0, -0.46);
  shape.lineTo(0.95, 0.18);
  shape.lineTo(2.15, -0.25);
  shape.lineTo(3.35, 0.5);
  shape.lineTo(4.45, -0.18);
  shape.lineTo(5.5, 0.25);
  shape.lineTo(6.4, -0.35);
  shape.lineTo(6.4, -1.2);
  shape.lineTo(-6.4, -1.2);
  shape.closePath();

  return new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshPhysicalMaterial({
      color: 0xe5bcd8,
      roughness: 0.5,
      transmission: 0.2,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide
    })
  );
}

function createRoundedPanelGeometry(width, height, radius, depth) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 10
  });
  geometry.center();
  return geometry;
}
