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
      powerPreference: "high-performance"
    });
  } catch {
    document.body.classList.add("scene-fallback");
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeff1f4);
  scene.fog = new THREE.Fog(0xeff1f4, 9, 18);

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 40);
  camera.position.set(0, 0.1, 9.4);

  const world = new THREE.Group();
  const sculpture = new THREE.Group();
  world.add(sculpture);
  scene.add(world);

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdcecff,
    roughness: 0.08,
    metalness: 0.02,
    transmission: 0.5,
    thickness: 1.25,
    ior: 1.38,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    iridescence: 0.8,
    iridescenceIOR: 1.25,
    sheen: 0.2,
    sheenColor: new THREE.Color(0xffffff),
    transparent: true,
    opacity: 0.94
  });

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.55, 0.31, 256, 42, 2, 3),
    glassMaterial
  );
  knot.rotation.set(0.32, -0.48, 0.18);
  knot.castShadow = true;
  knot.receiveShadow = true;
  sculpture.add(knot);

  const core = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.34, 0.045, 220, 16, 2, 3),
    new THREE.MeshPhysicalMaterial({
      color: 0x146ef5,
      roughness: 0.22,
      metalness: 0.08,
      transmission: 0.18,
      clearcoat: 1,
      emissive: 0x062556,
      emissiveIntensity: 0.12
    })
  );
  core.rotation.copy(knot.rotation);
  sculpture.add(core);

  const ribbons = [
    {
      color: 0xff5f57,
      points: [
        [-2.55, -0.25, 0.1],
        [-1.65, 0.75, 0.65],
        [-0.45, 1.6, -0.2],
        [0.95, 1.15, 0.45],
        [2.5, 0.35, -0.3]
      ]
    },
    {
      color: 0x176cff,
      points: [
        [-2.3, 0.7, -0.5],
        [-1.05, -0.05, 0.5],
        [0.1, -1.55, 0],
        [1.25, -0.75, 0.65],
        [2.35, 0.55, 0.2]
      ]
    },
    {
      color: 0x30a86b,
      points: [
        [-1.8, -1.3, 0.25],
        [-0.65, -0.8, -0.7],
        [0.35, 0.2, 0.5],
        [1.2, 1.55, -0.25],
        [2.1, 1.1, 0.3]
      ]
    }
  ];

  for (const ribbon of ribbons) {
    const curve = new THREE.CatmullRomCurve3(
      ribbon.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "centripetal"
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 140, 0.065, 12, false),
      new THREE.MeshPhysicalMaterial({
        color: ribbon.color,
        roughness: 0.18,
        metalness: 0.04,
        transmission: 0.24,
        thickness: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.06
      })
    );
    mesh.castShadow = true;
    sculpture.add(mesh);
  }

  const planeSpecs = [
    { color: 0xff755e, position: [-1.55, 1.62, -0.95], rotation: [0.2, -0.45, 0.12] },
    { color: 0x1d70f7, position: [1.85, 1.2, -0.55], rotation: [-0.3, 0.42, -0.18] },
    { color: 0x43b979, position: [1.78, -1.28, -0.8], rotation: [0.26, -0.38, 0.24] }
  ];

  for (const spec of planeSpecs) {
    const panel = new THREE.Mesh(
      createRoundedPanelGeometry(1.18, 0.72, 0.16, 0.07),
      new THREE.MeshPhysicalMaterial({
        color: spec.color,
        roughness: 0.16,
        metalness: 0.02,
        transmission: 0.38,
        thickness: 0.45,
        clearcoat: 1,
        transparent: true,
        opacity: 0.88
      })
    );
    panel.position.set(...spec.position);
    panel.rotation.set(...spec.rotation);
    panel.castShadow = true;
    sculpture.add(panel);
  }

  const ringMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.12,
    metalness: 0.16,
    transmission: 0.35,
    clearcoat: 1,
    transparent: true,
    opacity: 0.72
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.025, 10, 180), ringMaterial);
  ring.rotation.set(1.12, 0.15, 0.42);
  sculpture.add(ring);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.84, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.52;
  floor.receiveShadow = true;
  scene.add(floor);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xb7c0cf, 2.8);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffffff, 5.2);
  keyLight.position.set(-4, 6, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  scene.add(keyLight);

  const blueLight = new THREE.PointLight(0x4b83ff, 18, 10, 2);
  blueLight.position.set(3.8, 1.8, 3.5);
  scene.add(blueLight);

  const warmLight = new THREE.PointLight(0xff8a72, 12, 9, 2);
  warmLight.position.set(-2.2, -0.4, 4.2);
  scene.add(warmLight);

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
    const dprCap = mobile ? 1.35 : 1.7;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(viewportWidth, viewportHeight, false);
    camera.aspect = viewportWidth / viewportHeight;
    camera.fov = mobile ? 40 : 33;
    camera.updateProjectionMatrix();

    world.position.set(mobile ? 0.2 : 2.05, mobile ? -0.9 : -0.05, 0);
    world.scale.setScalar(mobile ? 0.72 : 1.03);
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

  targetHero.addEventListener("pointerleave", () => {
    pointerTarget.set(0, 0);
  });

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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pointerTarget.set(0, 0);
  });

  const timer = new THREE.Timer();
  timer.connect(document);
  const baseScale = new THREE.Vector3();

  const render = (timestamp) => {
    requestAnimationFrame(render);
    if (!sceneActive && transitionValue > 0.995) return;

    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.05);
    const elapsed = timer.getElapsed();
    pointer.lerp(pointerTarget, 1 - Math.pow(0.001, delta));
    transitionValue = THREE.MathUtils.damp(transitionValue, transitionTarget, 4.8, delta);

    const mobile = viewportWidth < 700;
    const base = mobile ? 0.72 : 1.03;
    baseScale.setScalar(base * (1 + transitionValue * 0.24));
    world.scale.lerp(baseScale, 1 - Math.pow(0.0001, delta));

    if (!reduceMotion.matches) {
      sculpture.rotation.y += delta * 0.075;
      sculpture.rotation.x = Math.sin(elapsed * 0.32) * 0.055 + pointer.y * 0.07;
      sculpture.rotation.z = Math.sin(elapsed * 0.21) * 0.035 - pointer.x * 0.045;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.16, 3.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.1 + pointer.y * 0.1, 3.2, delta);
    }

    camera.position.z = THREE.MathUtils.damp(camera.position.z, 9.4 - transitionValue * 1.25, 4.2, delta);
    camera.lookAt(0, -0.05, 0);
    renderer.render(scene, camera);
  };

  render();
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
    bevelSegments: 4,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    curveSegments: 8
  });
  geometry.center();
  return geometry;
}
