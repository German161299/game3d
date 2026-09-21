import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Setup básico: escena, cámara, renderer
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game-canvas');
const rotateWrapper = document.getElementById('rotate-wrapper');
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  document.body.classList.add('touch-device');
  document.getElementById('mobile-controls').classList.remove('hidden');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecfff);
scene.fog = new THREE.Fog(0x8ecfff, 30, 110);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchDevice ? 1.5 : 2));
renderer.shadowMap.enabled = true;
if (isTouchDevice) {
  renderer.shadowMap.type = THREE.BasicShadowMap;
}

// ---------------------------------------------------------------------------
// Horizontal siempre, aunque el celular tenga el bloqueo de rotación activado:
// en vez de pedirle al usuario que gire el teléfono (inútil si el sistema
// operativo no va a rotar la pantalla), se rota el contenido con CSS para que
// siempre se vea y se juegue en horizontal.
// ---------------------------------------------------------------------------
const flipButton = document.getElementById('flip-rotation-button');

function isRawPortrait() {
  return window.innerWidth < window.innerHeight;
}

function getEffectiveSize() {
  if (isTouchDevice && isRawPortrait()) {
    return { width: window.innerHeight, height: window.innerWidth };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function handleViewportResize() {
  if (isTouchDevice) {
    document.body.classList.toggle('force-rotate', isRawPortrait());
  }
  const { width, height } = getEffectiveSize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// El drag/joystick llega en coordenadas físicas de pantalla; cuando el
// contenido está rotado por CSS hay que convertir esas coordenadas al
// sistema "lógico" (sin rotar) en el que vive el resto del juego.
function isForceRotateActive() {
  return document.body.classList.contains('force-rotate');
}

function physicalDeltaToLogical(physDx, physDy) {
  if (!isForceRotateActive()) return { dx: physDx, dy: physDy };
  const flipped = document.body.classList.contains('flip-rotation');
  return flipped ? { dx: -physDy, dy: physDx } : { dx: physDy, dy: -physDx };
}
window.addEventListener('resize', handleViewportResize);
window.addEventListener('orientationchange', () => setTimeout(handleViewportResize, 300));

if (isTouchDevice) {
  flipButton.classList.remove('hidden');
  let flipped = false;
  try {
    flipped = localStorage.getItem('landscapeFlip') === '1';
  } catch {
    // Sin acceso a localStorage (navegación privada, etc.): usa el valor por defecto.
  }
  if (flipped) document.body.classList.add('flip-rotation');

  flipButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    document.body.classList.toggle('flip-rotation');
    try {
      localStorage.setItem('landscapeFlip', document.body.classList.contains('flip-rotation') ? '1' : '0');
    } catch {
      // Sin acceso a localStorage: la preferencia no persiste, pero el botón sigue funcionando.
    }
  });
}

handleViewportResize();

// ---------------------------------------------------------------------------
// Luces
// ---------------------------------------------------------------------------
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 150;
scene.add(sun);

// ---------------------------------------------------------------------------
// Terreno
// ---------------------------------------------------------------------------
const WORLD_SIZE = 100;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x4a7c3c, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Obstáculos: árboles y rocas, guardados con su posición y radio de colisión
const obstacles = []; // { x, z, radius }

function addTree(x, z) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4226 })
  );
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  group.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x2e6b2e })
  );
  foliage.position.y = 3.2;
  foliage.castShadow = true;
  group.add(foliage);

  group.position.set(x, 0, z);
  scene.add(group);
  obstacles.push({ x, z, radius: 0.9 });
}

function addRock(x, z) {
  const scale = 0.6 + Math.random() * 0.8;
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x7d7d7d, roughness: 1 })
  );
  rock.position.set(x, scale * 0.5, z);
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  obstacles.push({ x, z, radius: scale * 0.8 });
}

function randomWorldPos(margin = 6) {
  const half = WORLD_SIZE / 2 - margin;
  return {
    x: (Math.random() * 2 - 1) * half,
    z: (Math.random() * 2 - 1) * half,
  };
}

for (let i = 0; i < 26; i++) {
  const { x, z } = randomWorldPos();
  if (Math.hypot(x, z) < 6) continue; // dejar libre la zona de aparición
  addTree(x, z);
}
for (let i = 0; i < 16; i++) {
  const { x, z } = randomWorldPos();
  if (Math.hypot(x, z) < 6) continue;
  addRock(x, z);
}

function isBlocked(x, z, selfRadius = 0.4, ignore = null) {
  const half = WORLD_SIZE / 2 - 1;
  if (Math.abs(x) > half || Math.abs(z) > half) return true;
  for (const o of obstacles) {
    if (o === ignore) continue;
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < o.radius + selfRadius) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Jugador
// ---------------------------------------------------------------------------
// Geometrías compartidas entre todos los personajes (jugador + enemigos):
// se crean una sola vez y se reutilizan, solo cambia el color del material
// por personaje.
// Cápsulas (no cilindros) para brazos y piernas: los extremos redondeados
// se hunden en el torso sin dejar un corte recto a la vista, y con el
// solapamiento extra de las posiciones de abajo el cuerpo se ve como una
// sola pieza en vez de tubos pegoteados.
const legGeometry = new THREE.CapsuleGeometry(0.13, 0.55, 4, 8);
const armGeometry = new THREE.CapsuleGeometry(0.1, 0.45, 4, 8);
const torsoGeometry = new THREE.CapsuleGeometry(0.3, 0.4, 4, 8);
const headGeometry = new THREE.SphereGeometry(0.3, 12, 12);
const hairGeometry = new THREE.SphereGeometry(0.305, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
const handGeometry = new THREE.SphereGeometry(0.11, 8, 8);
const fingerGeometry = new THREE.BoxGeometry(0.035, 0.14, 0.035);
const eyeGeometry = new THREE.SphereGeometry(0.045, 8, 8);
const noseGeometry = new THREE.BoxGeometry(0.06, 0.07, 0.06);
const mouthGeometry = new THREE.BoxGeometry(0.15, 0.03, 0.02);
const earGeometry = new THREE.SphereGeometry(0.08, 8, 8);
const weaponGeometry = new THREE.BoxGeometry(0.1, 0.95, 0.1);

const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1410 });
const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2020 });
const weaponMaterial = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.6, roughness: 0.3 });

// Geometrías compartidas para los enemigos de cuatro patas (lobo, jabalí)
const quadLegGeometry = new THREE.CapsuleGeometry(0.09, 0.28, 4, 6);
const quadBodyGeometry = new THREE.CapsuleGeometry(0.26, 0.55, 4, 8);
const quadHeadGeometry = new THREE.SphereGeometry(0.22, 10, 10);
const snoutGeometry = new THREE.BoxGeometry(0.16, 0.15, 0.24);
const quadEarGeometry = new THREE.ConeGeometry(0.075, 0.15, 6);
const tailGeometry = new THREE.CapsuleGeometry(0.05, 0.3, 4, 6);
const tuskGeometry = new THREE.ConeGeometry(0.03, 0.14, 6);
const tuskMaterial = new THREE.MeshStandardMaterial({ color: 0xf2ead9 });

function addHand(armPivot, bodyMaterial) {
  const hand = new THREE.Mesh(handGeometry, bodyMaterial);
  hand.position.y = -0.62;
  hand.castShadow = true;
  armPivot.add(hand);

  // 3 dedos estilizados (no 5) para no disparar la cantidad de mallas por
  // personaje — con ~15 personajes en pantalla, cada dedo extra pesa.
  for (const offsetX of [-0.07, 0, 0.07]) {
    const finger = new THREE.Mesh(fingerGeometry, bodyMaterial);
    finger.position.set(offsetX, -0.72, 0.02);
    finger.rotation.z = offsetX * 1.1;
    armPivot.add(finger);
  }
}

function buildHumanoid(bodyColor, headColor, { hairColor = null, skeletal = false } = {}) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor });
  const headMaterial = new THREE.MeshStandardMaterial({ color: headColor });

  // Piernas: cada una cuelga de un pivote en la cadera para poder rotarlas
  // al caminar sin que giren raro desde su propio centro. El pivote se
  // hunde un poco en el torso (en vez de tocarlo justo) para que no se
  // note el corte entre las dos piezas.
  const legPivotLeft = new THREE.Group();
  legPivotLeft.position.set(-0.19, 0.95, 0);
  const legLeft = new THREE.Mesh(legGeometry, bodyMaterial);
  legLeft.position.y = -0.4;
  legLeft.castShadow = true;
  legPivotLeft.add(legLeft);
  group.add(legPivotLeft);

  const legPivotRight = new THREE.Group();
  legPivotRight.position.set(0.19, 0.95, 0);
  const legRight = new THREE.Mesh(legGeometry, bodyMaterial);
  legRight.position.y = -0.4;
  legRight.castShadow = true;
  legPivotRight.add(legRight);
  group.add(legPivotRight);

  const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
  torso.position.y = 1.3;
  torso.castShadow = true;
  group.add(torso);

  // Brazos: mismo truco del pivote, ahora en el hombro (más cerca del
  // torso y más abajo, a la altura donde el torso todavía tiene su ancho
  // completo) para poder animar el hachazo/espadazo al atacar sin dejar
  // un hueco entre el brazo y el cuerpo.
  const armPivotLeft = new THREE.Group();
  armPivotLeft.position.set(-0.36, 1.55, 0);
  const armLeft = new THREE.Mesh(armGeometry, bodyMaterial);
  armLeft.position.y = -0.3;
  armLeft.castShadow = true;
  armPivotLeft.add(armLeft);
  addHand(armPivotLeft, bodyMaterial);
  group.add(armPivotLeft);

  const armPivotRight = new THREE.Group();
  armPivotRight.position.set(0.36, 1.55, 0);
  const armRight = new THREE.Mesh(armGeometry, bodyMaterial);
  armRight.position.y = -0.3;
  armRight.castShadow = true;
  armPivotRight.add(armRight);
  addHand(armPivotRight, bodyMaterial);
  group.add(armPivotRight);

  // Cabeza + cara (ojos, nariz, boca, orejas)
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 2.1;
  head.castShadow = true;
  group.add(head);

  if (hairColor !== null) {
    const hair = new THREE.Mesh(hairGeometry, new THREE.MeshStandardMaterial({ color: hairColor }));
    hair.castShadow = true;
    head.add(hair);
  }

  const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.position.set(-0.12, 0.04, 0.27);
  head.add(eyeLeft);

  const eyeRight = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeRight.position.set(0.12, 0.04, 0.27);
  head.add(eyeRight);

  if (!skeletal) {
    // Un cráneo no tiene nariz ni labios — se saltean para el esqueleto.
    const nose = new THREE.Mesh(noseGeometry, headMaterial);
    nose.position.set(0, -0.03, 0.29);
    head.add(nose);

    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.11, 0.27);
    head.add(mouth);
  }

  const earLeft = new THREE.Mesh(earGeometry, headMaterial);
  earLeft.position.set(-0.29, 0, 0);
  earLeft.scale.set(0.55, 1, 1);
  head.add(earLeft);

  const earRight = new THREE.Mesh(earGeometry, headMaterial);
  earRight.position.set(0.29, 0, 0);
  earRight.scale.set(0.55, 1, 1);
  head.add(earRight);

  // Arma: colgada de la mano derecha (pivote del brazo), así sigue el
  // movimiento del brazo cuando ataca.
  const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
  weapon.position.set(0.05, -0.62, 0.1);
  weapon.rotation.z = 0.3;
  weapon.castShadow = true;
  armPivotRight.add(weapon);

  return { group, weapon, bodyMaterial, legPivotLeft, legPivotRight, armPivotLeft, armPivotRight };
}

// ---------------------------------------------------------------------------
// Enemigos de cuatro patas (lobo, jabalí): un cuerpo horizontal con 4
// patas, cabeza con hocico y orejas, y cola — nada que ver con la forma
// humanoide, para que se parezcan a lo que dice su nombre.
// ---------------------------------------------------------------------------
function buildQuadruped(bodyColor, headColor, { stocky = false } = {}) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor });
  const headMaterial = new THREE.MeshStandardMaterial({ color: headColor });
  const hipHeight = 0.45;

  const body = new THREE.Mesh(quadBodyGeometry, bodyMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, hipHeight + 0.1, 0);
  if (stocky) body.scale.set(1, 1.3, 1.2);
  body.castShadow = true;
  group.add(body);

  const legSpots = [
    ['frontLeft', -0.16, 0.32],
    ['frontRight', 0.16, 0.32],
    ['backLeft', -0.16, -0.32],
    ['backRight', 0.16, -0.32],
  ];
  const legPivots = {};
  for (const [key, x, z] of legSpots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, hipHeight + 0.08, z);
    const leg = new THREE.Mesh(quadLegGeometry, bodyMaterial);
    leg.position.y = -0.17;
    leg.castShadow = true;
    pivot.add(leg);
    group.add(pivot);
    legPivots[key] = pivot;
  }

  // La cabeza tiene su propio pivote para poder animar un mordisco al atacar.
  const headPivot = new THREE.Group();
  headPivot.position.set(0, hipHeight + 0.22, 0.4);
  group.add(headPivot);

  const head = new THREE.Mesh(quadHeadGeometry, headMaterial);
  head.castShadow = true;
  headPivot.add(head);

  const snout = new THREE.Mesh(snoutGeometry, headMaterial);
  snout.position.set(0, -0.06, 0.22);
  headPivot.add(snout);

  const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.position.set(-0.09, 0.06, 0.18);
  headPivot.add(eyeLeft);

  const eyeRight = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeRight.position.set(0.09, 0.06, 0.18);
  headPivot.add(eyeRight);

  const earLeft = new THREE.Mesh(quadEarGeometry, headMaterial);
  earLeft.position.set(-0.12, 0.24, -0.03);
  earLeft.rotation.z = -0.2;
  headPivot.add(earLeft);

  const earRight = new THREE.Mesh(quadEarGeometry, headMaterial);
  earRight.position.set(0.12, 0.24, -0.03);
  earRight.rotation.z = 0.2;
  headPivot.add(earRight);

  if (stocky) {
    const tuskLeft = new THREE.Mesh(tuskGeometry, tuskMaterial);
    tuskLeft.position.set(-0.07, -0.1, 0.28);
    tuskLeft.rotation.x = Math.PI * 0.42;
    headPivot.add(tuskLeft);

    const tuskRight = new THREE.Mesh(tuskGeometry, tuskMaterial);
    tuskRight.position.set(0.07, -0.1, 0.28);
    tuskRight.rotation.x = Math.PI * 0.42;
    headPivot.add(tuskRight);
  }

  const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
  tail.position.set(0, hipHeight + 0.12, -0.5);
  tail.rotation.x = stocky ? -0.3 : -0.85;
  tail.castShadow = true;
  group.add(tail);

  return { group, bodyMaterial, legPivots, headPivot };
}

const {
  group: playerMesh,
  weapon: playerWeapon,
  legPivotLeft: playerLegPivotLeft,
  legPivotRight: playerLegPivotRight,
  armPivotRight: playerArmPivotRight,
} = buildHumanoid(0x2a5db0, 0xe8c39e, { hairColor: 0x3b2a1a });
playerMesh.position.set(0, 0, 0);
scene.add(playerMesh);

const player = {
  mesh: playerMesh,
  weapon: playerWeapon,
  legPivotLeft: playerLegPivotLeft,
  legPivotRight: playerLegPivotRight,
  armPivotRight: playerArmPivotRight,
  walkCycle: 0,
  yaw: 0,
  speed: 6,
  radius: 0.45,
  level: 1,
  xp: 0,
  xpToNext: 50,
  maxHealth: 100,
  health: 100,
  attackRange: 2.6,
  attackDamage: [16, 26],
  attackCooldown: 0,
  attackCooldownMax: 0.6,
  alive: true,
  invulnerableTimer: 0,
};

// ---------------------------------------------------------------------------
// Cámara en tercera persona (orbit-follow controlado con el mouse)
// ---------------------------------------------------------------------------
const cameraRig = {
  yaw: Math.PI,
  pitch: 0.35,
  distance: 7,
  height: 2.4,
};

let dragging = false;
let lastPointer = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPointer = { x: e.clientX, y: e.clientY };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Ignorado: el arrastre de cámara sigue funcionando sin captura.
  }
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    // El puntero ya pudo haber perdido la captura; no es un error real.
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const physDx = e.clientX - lastPointer.x;
  const physDy = e.clientY - lastPointer.y;
  lastPointer = { x: e.clientX, y: e.clientY };
  const { dx, dy } = physicalDeltaToLogical(physDx, physDy);
  cameraRig.yaw -= dx * 0.006;
  cameraRig.pitch -= dy * 0.005;
  cameraRig.pitch = Math.max(0.08, Math.min(1.2, cameraRig.pitch));
});
canvas.addEventListener('wheel', (e) => {
  cameraRig.distance += e.deltaY * 0.01;
  cameraRig.distance = Math.max(3, Math.min(14, cameraRig.distance));
});

function updateCamera() {
  const { yaw, pitch, distance, height } = cameraRig;
  const target = player.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const offset = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch) * distance,
    Math.sin(pitch) * distance + height,
    Math.cos(yaw) * Math.cos(pitch) * distance
  );
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
}

// ---------------------------------------------------------------------------
// Input de teclado
// ---------------------------------------------------------------------------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// ---------------------------------------------------------------------------
// Joystick virtual y botón de ataque (controles táctiles para celular)
// ---------------------------------------------------------------------------
const joystickInput = { x: 0, z: 0 }; // x = eje derecha, z = eje adelante
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const JOYSTICK_RADIUS = 40;
let joystickPointerId = null;

function updateJoystick(e) {
  const rect = joystickBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const physDx = e.clientX - cx;
  const physDy = e.clientY - cy;
  let { dx, dy } = physicalDeltaToLogical(physDx, physDy);
  const dist = Math.hypot(dx, dy);
  if (dist > JOYSTICK_RADIUS) {
    dx = (dx / dist) * JOYSTICK_RADIUS;
    dy = (dy / dist) * JOYSTICK_RADIUS;
  }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  // El eje izquierda/derecha queda invertido para cómo la gente sostiene
  // el teléfono en la práctica; se invierte acá (no en physicalDeltaToLogical)
  // para no tocar también el arrastre de cámara.
  joystickInput.x = -dx / JOYSTICK_RADIUS;
  joystickInput.z = -dy / JOYSTICK_RADIUS;
}

function resetJoystick() {
  joystickInput.x = 0;
  joystickInput.z = 0;
  joystickKnob.style.transform = 'translate(0px, 0px)';
}

joystickBase.addEventListener('pointerdown', (e) => {
  if (editMode) return;
  joystickPointerId = e.pointerId;
  try {
    joystickBase.setPointerCapture(e.pointerId);
  } catch {
    // Algunos navegadores pueden rechazar la captura; el joystick sigue
    // funcionando igual porque el listener de pointermove no depende de ella.
  }
  updateJoystick(e);
});
joystickBase.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joystickPointerId) return;
  updateJoystick(e);
});
function endJoystick(e) {
  if (e.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  resetJoystick();
}
joystickBase.addEventListener('pointerup', endJoystick);
joystickBase.addEventListener('pointercancel', endJoystick);

const attackButton = document.getElementById('attack-button');
attackButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (editMode) return;
  tryPlayerAttack();
});

// ---------------------------------------------------------------------------
// Editor de controles: permite arrastrar el joystick y el botón de ataque
// a cualquier posición, y guarda esa posición para la próxima vez.
// ---------------------------------------------------------------------------
let editMode = false;
const editControlsButton = document.getElementById('edit-controls-button');
const editControlsToolbar = document.getElementById('edit-controls-toolbar');
const resetControlsBtn = document.getElementById('reset-controls-btn');
const doneControlsBtn = document.getElementById('done-controls-btn');

const DEFAULT_CONTROL_LAYOUT = {
  joystick: { left: 14, top: 82 },
  attack: { left: 88, top: 82 },
};

function loadControlLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem('controlLayout'));
    if (saved && saved.joystick && saved.attack) return saved;
  } catch {
    // Sin acceso a localStorage o dato corrupto: se usa el layout por defecto.
  }
  return null;
}

function applyControlLayout(layout) {
  joystickBase.style.left = `${layout.joystick.left}%`;
  joystickBase.style.top = `${layout.joystick.top}%`;
  attackButton.style.left = `${layout.attack.left}%`;
  attackButton.style.top = `${layout.attack.top}%`;
}

function saveControlLayout() {
  const layout = {
    joystick: { left: parseFloat(joystickBase.style.left), top: parseFloat(joystickBase.style.top) },
    attack: { left: parseFloat(attackButton.style.left), top: parseFloat(attackButton.style.top) },
  };
  try {
    localStorage.setItem('controlLayout', JSON.stringify(layout));
  } catch {
    // Sin acceso a localStorage: la posición no persiste, pero sigue funcionando en esta sesión.
  }
}

function makeDraggableInEditMode(el) {
  let dragPointerId = null;
  let lastPointer = { x: 0, y: 0 };
  el.addEventListener('pointerdown', (e) => {
    if (!editMode) return;
    e.preventDefault();
    dragPointerId = e.pointerId;
    lastPointer = { x: e.clientX, y: e.clientY };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Ignorado: el arrastre sigue funcionando sin captura.
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (!editMode || e.pointerId !== dragPointerId) return;
    const physDx = e.clientX - lastPointer.x;
    const physDy = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    const { width, height } = getEffectiveSize();
    const { dx, dy } = physicalDeltaToLogical(physDx, physDy);
    const curLeft = parseFloat(el.style.left);
    const curTop = parseFloat(el.style.top);
    const nextLeft = Math.min(95, Math.max(5, curLeft + (dx / width) * 100));
    const nextTop = Math.min(95, Math.max(5, curTop + (dy / height) * 100));
    el.style.left = `${nextLeft}%`;
    el.style.top = `${nextTop}%`;
  });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== dragPointerId) return;
    dragPointerId = null;
  });
  el.addEventListener('pointercancel', () => {
    dragPointerId = null;
  });
}

if (isTouchDevice) {
  applyControlLayout(loadControlLayout() || DEFAULT_CONTROL_LAYOUT);
  makeDraggableInEditMode(joystickBase);
  makeDraggableInEditMode(attackButton);

  editControlsButton.classList.remove('hidden');
  editControlsButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    editMode = true;
    resetJoystick();
    document.body.classList.add('edit-controls-mode');
    editControlsToolbar.classList.remove('hidden');
  });

  doneControlsBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    editMode = false;
    document.body.classList.remove('edit-controls-mode');
    editControlsToolbar.classList.add('hidden');
    saveControlLayout();
  });

  resetControlsBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    applyControlLayout(DEFAULT_CONTROL_LAYOUT);
    saveControlLayout();
  });
}

// ---------------------------------------------------------------------------
// Enemigos
// ---------------------------------------------------------------------------
const ENEMY_TYPES = [
  { name: 'Lobo Salvaje', bodyType: 'quadruped', bodyColor: 0x5b4636, headColor: 0x4a3826, health: 45, damage: [6, 10], speed: 4.2, xp: 18 },
  { name: 'Jabalí Furioso', bodyType: 'quadruped', stocky: true, bodyColor: 0x7a4a2b, headColor: 0x6b4024, health: 65, damage: [8, 14], speed: 3.2, xp: 26 },
  { name: 'Esqueleto Errante', bodyType: 'skeleton', bodyColor: 0xd8d3c4, headColor: 0xefe9d8, health: 55, damage: [10, 16], speed: 3.6, xp: 30 },
];

const enemies = [];

function spawnEnemy(spawnX, spawnZ) {
  const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
  const isQuadruped = type.bodyType === 'quadruped';
  const built = isQuadruped
    ? buildQuadruped(type.bodyColor, type.headColor, { stocky: !!type.stocky })
    : buildHumanoid(type.bodyColor, type.headColor, { skeletal: true }); // esqueleto: sin pelo/nariz/boca

  const { group, bodyMaterial } = built;
  if (isQuadruped) {
    group.scale.setScalar(1);
  } else {
    // El esqueleto queda más flaco/huesudo que un humano normal.
    group.scale.set(0.78, 0.92, 0.78);
  }
  group.position.set(spawnX, 0, spawnZ);
  scene.add(group);

  const nameTag = document.createElement('div');
  nameTag.className = 'enemy-name-tag';
  nameTag.textContent = type.name;
  rotateWrapper.appendChild(nameTag);

  const barWrap = document.createElement('div');
  barWrap.className = 'enemy-health-bar';
  const barFill = document.createElement('div');
  barFill.className = 'enemy-health-bar-fill';
  barWrap.appendChild(barFill);
  rotateWrapper.appendChild(barWrap);

  enemies.push({
    type,
    isQuadruped,
    mesh: group,
    bodyMaterial,
    legPivotLeft: built.legPivotLeft,
    legPivotRight: built.legPivotRight,
    legPivots: built.legPivots,
    armPivotRight: built.armPivotRight,
    headPivot: built.headPivot,
    walkCycle: Math.random() * 10,
    swingTimer: 0,
    nameTag,
    barWrap,
    barFill,
    spawn: { x: spawnX, z: spawnZ },
    health: type.health,
    maxHealth: type.health,
    state: 'idle',
    wanderTarget: null,
    wanderCooldown: Math.random() * 2,
    attackCooldown: 0,
    radius: 0.5,
    alive: true,
    respawnTimer: 0,
    hitFlash: 0,
  });
}

const ENEMY_COUNT = 14;
for (let i = 0; i < ENEMY_COUNT; i++) {
  let pos;
  do {
    pos = randomWorldPos(4);
  } while (Math.hypot(pos.x, pos.z) < 10);
  spawnEnemy(pos.x, pos.z);
}

const AGGRO_RANGE = 7;
const LEASH_RANGE = 14;
const ENEMY_ATTACK_RANGE = 1.8;

function updateEnemy(enemy, dt) {
  if (!enemy.alive) {
    enemy.respawnTimer -= dt;
    if (enemy.respawnTimer <= 0) {
      enemy.alive = true;
      enemy.health = enemy.maxHealth;
      enemy.mesh.visible = true;
      enemy.mesh.position.set(enemy.spawn.x, 0, enemy.spawn.z);
      enemy.state = 'idle';
    }
    return;
  }

  if (enemy.hitFlash > 0) {
    enemy.hitFlash -= dt;
  }

  const toPlayer = new THREE.Vector2(
    player.mesh.position.x - enemy.mesh.position.x,
    player.mesh.position.z - enemy.mesh.position.z
  );
  const distToPlayer = toPlayer.length();
  const distFromSpawn = Math.hypot(
    enemy.mesh.position.x - enemy.spawn.x,
    enemy.mesh.position.z - enemy.spawn.z
  );

  if (enemy.state !== 'chasing' && player.alive && distToPlayer < AGGRO_RANGE) {
    enemy.state = 'chasing';
  }
  if (enemy.state === 'chasing' && (distFromSpawn > LEASH_RANGE || !player.alive)) {
    enemy.state = 'idle';
  }

  let moveX = 0;
  let moveZ = 0;

  if (enemy.state === 'chasing') {
    if (distToPlayer > ENEMY_ATTACK_RANGE * 0.9) {
      moveX = toPlayer.x / distToPlayer;
      moveZ = toPlayer.y / distToPlayer;
    } else {
      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0 && player.alive) {
        enemy.attackCooldown = 1.1;
        enemy.swingTimer = 0.25;
        const dmg = Math.floor(
          enemy.type.damage[0] + Math.random() * (enemy.type.damage[1] - enemy.type.damage[0])
        );
        damagePlayer(dmg);
      }
    }
  } else {
    enemy.wanderCooldown -= dt;
    if (enemy.wanderCooldown <= 0 || !enemy.wanderTarget) {
      enemy.wanderCooldown = 3 + Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 4;
      enemy.wanderTarget = {
        x: enemy.spawn.x + Math.cos(angle) * dist,
        z: enemy.spawn.z + Math.sin(angle) * dist,
      };
    }
    const dx = enemy.wanderTarget.x - enemy.mesh.position.x;
    const dz = enemy.wanderTarget.z - enemy.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.3) {
      moveX = dx / d;
      moveZ = dz / d;
    }
  }

  const isMoving = moveX !== 0 || moveZ !== 0;
  if (isMoving) {
    const speed = enemy.type.speed * (enemy.state === 'chasing' ? 1 : 0.45);
    const nx = enemy.mesh.position.x + moveX * speed * dt;
    const nz = enemy.mesh.position.z + moveZ * speed * dt;
    if (!isBlocked(nx, nz, enemy.radius)) {
      enemy.mesh.position.x = nx;
      enemy.mesh.position.z = nz;
    }
    enemy.mesh.rotation.y = Math.atan2(moveX, moveZ);
  }

  if (enemy.isQuadruped) {
    animateQuadrupedWalk(enemy, isMoving, dt);
  } else {
    animateWalkCycle(enemy, isMoving, dt);
  }

  if (enemy.swingTimer > 0) {
    enemy.swingTimer -= dt;
    const swing = -Math.sin((0.25 - enemy.swingTimer) * 25);
    if (enemy.isQuadruped) {
      enemy.headPivot.rotation.x = swing * 0.5;
    } else {
      enemy.armPivotRight.rotation.x = swing * 1.1;
    }
  } else if (enemy.isQuadruped) {
    enemy.headPivot.rotation.x = 0;
  } else {
    enemy.armPivotRight.rotation.x = 0;
  }

  const flashColor = enemy.hitFlash > 0 ? 0xff5555 : enemy.type.bodyColor;
  enemy.bodyMaterial.color.setHex(flashColor);
}

function damageEnemy(enemy, amount) {
  if (!enemy.alive) return;
  enemy.health -= amount;
  enemy.hitFlash = 0.15;
  spawnFloatingText(enemy.mesh.position, `-${amount}`, '#ffdd55');
  if (enemy.health <= 0) {
    enemy.alive = false;
    enemy.mesh.visible = false;
    enemy.respawnTimer = 14 + Math.random() * 6;
    kills += 1;
    document.getElementById('kills').textContent = String(kills);
    grantXp(enemy.type.xp);
  }
}

// ---------------------------------------------------------------------------
// Combate del jugador
// ---------------------------------------------------------------------------
let kills = 0;

function tryPlayerAttack() {
  if (player.attackCooldown > 0 || !player.alive) return;
  player.attackCooldown = player.attackCooldownMax;

  animateSwing();

  let closest = null;
  let closestDist = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const d = player.mesh.position.distanceTo(enemy.mesh.position);
    if (d < player.attackRange && d < closestDist) {
      closest = enemy;
      closestDist = d;
    }
  }
  if (closest) {
    const dmg = Math.floor(
      player.attackDamage[0] + Math.random() * (player.attackDamage[1] - player.attackDamage[0])
    );
    damageEnemy(closest, dmg);
  }
}

let swingTimer = 0;
function animateSwing() {
  swingTimer = 0.25;
}

function damagePlayer(amount) {
  if (!player.alive || player.invulnerableTimer > 0) return;
  player.health -= amount;
  player.invulnerableTimer = 0.3;
  spawnFloatingText(player.mesh.position, `-${amount}`, '#ff5555');
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
    document.getElementById('death-screen').classList.remove('hidden');
  }
  updateHud();
}

function grantXp(amount) {
  player.xp += amount;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.floor(player.xpToNext * 1.4);
    player.maxHealth += 20;
    player.health = player.maxHealth;
    player.attackDamage = [player.attackDamage[0] + 3, player.attackDamage[1] + 4];
    spawnFloatingText(player.mesh.position, '¡Subiste de nivel!', '#66ffcc');
  }
  updateHud();
}

document.getElementById('respawn-btn').addEventListener('click', () => {
  player.alive = true;
  player.health = player.maxHealth;
  player.mesh.position.set(0, 0, 0);
  document.getElementById('death-screen').classList.add('hidden');
  updateHud();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') tryPlayerAttack();
});

// ---------------------------------------------------------------------------
// Textos flotantes de daño / eventos
// ---------------------------------------------------------------------------
const floatingTexts = [];

function spawnFloatingText(worldPos, text, color) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.color = color;
  el.style.fontWeight = 'bold';
  el.style.fontSize = '14px';
  el.style.textShadow = '0 1px 2px #000';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '6';
  rotateWrapper.appendChild(el);
  floatingTexts.push({
    el,
    pos: worldPos.clone().add(new THREE.Vector3(0, 2.1, 0)),
    life: 1.0,
  });
}

function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= dt;
    ft.pos.y += dt * 0.8;
    if (ft.life <= 0) {
      ft.el.remove();
      floatingTexts.splice(i, 1);
      continue;
    }
    const screen = toScreenPosition(ft.pos);
    ft.el.style.left = `${screen.x}px`;
    ft.el.style.top = `${screen.y}px`;
    ft.el.style.opacity = String(Math.min(1, ft.life * 1.5));
  }
}

function toScreenPosition(worldPos) {
  const vector = worldPos.clone().project(camera);
  const { width, height } = getEffectiveSize();
  return {
    x: (vector.x * 0.5 + 0.5) * width,
    y: (-vector.y * 0.5 + 0.5) * height,
    behind: vector.z > 1,
  };
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
function updateHud() {
  document.getElementById('level').textContent = String(player.level);
  document.getElementById('hp-fill').style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
  document.getElementById('xp-fill').style.width = `${Math.max(0, (player.xp / player.xpToNext) * 100)}%`;
  document.getElementById('hp-text').textContent = `${Math.max(0, Math.round(player.health))} / ${player.maxHealth}`;
  document.getElementById('xp-text').textContent = `${Math.max(0, Math.round(player.xp))} / ${player.xpToNext}`;
}
updateHud();

function updateEnemyBars() {
  for (const enemy of enemies) {
    if (!enemy.alive) {
      enemy.barWrap.style.display = 'none';
      enemy.nameTag.style.display = 'none';
      continue;
    }
    const dist = player.mesh.position.distanceTo(enemy.mesh.position);
    if (dist > 22) {
      enemy.barWrap.style.display = 'none';
      enemy.nameTag.style.display = 'none';
      continue;
    }
    const headPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const screen = toScreenPosition(headPos);
    if (screen.behind) {
      enemy.barWrap.style.display = 'none';
      enemy.nameTag.style.display = 'none';
      continue;
    }
    enemy.barWrap.style.display = 'block';
    enemy.nameTag.style.display = 'block';
    enemy.barWrap.style.left = `${screen.x}px`;
    enemy.barWrap.style.top = `${screen.y}px`;
    enemy.nameTag.style.left = `${screen.x}px`;
    enemy.nameTag.style.top = `${screen.y - 10}px`;
    enemy.barFill.style.width = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;
  }
}

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

// Ciclo de caminata: balancea las piernas (pivote de cadera) en fase
// opuesta mientras el personaje se mueve, y las vuelve al centro cuando
// se detiene. Se usa tanto para el jugador como para cada enemigo.
function animateWalkCycle(character, isMoving, dt) {
  if (isMoving) {
    character.walkCycle += dt * 9;
  }
  const targetSwing = isMoving ? Math.sin(character.walkCycle) * 0.5 : 0;
  const ease = Math.min(1, dt * 8);
  character.legPivotLeft.rotation.x += (targetSwing - character.legPivotLeft.rotation.x) * ease;
  character.legPivotRight.rotation.x += (-targetSwing - character.legPivotRight.rotation.x) * ease;
}

// Trote de cuatro patas: las diagonales opuestas (delantera-izq +
// trasera-der, delantera-der + trasera-izq) se mueven juntas, como
// caminan de verdad los animales de cuatro patas.
function animateQuadrupedWalk(enemy, isMoving, dt) {
  if (isMoving) {
    enemy.walkCycle += dt * 12;
  }
  const swing = isMoving ? Math.sin(enemy.walkCycle) * 0.6 : 0;
  const ease = Math.min(1, dt * 8);
  const { frontLeft, frontRight, backLeft, backRight } = enemy.legPivots;
  frontLeft.rotation.x += (swing - frontLeft.rotation.x) * ease;
  backRight.rotation.x += (swing - backRight.rotation.x) * ease;
  frontRight.rotation.x += (-swing - frontRight.rotation.x) * ease;
  backLeft.rotation.x += (-swing - backLeft.rotation.x) * ease;
}

function updatePlayer(dt) {
  if (player.invulnerableTimer > 0) player.invulnerableTimer -= dt;
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (!player.alive) return;

  const forward = new THREE.Vector3(-Math.sin(cameraRig.yaw), 0, -Math.cos(cameraRig.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  let forwardAxis = joystickInput.z;
  let rightAxis = joystickInput.x;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forwardAxis += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forwardAxis -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) rightAxis += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) rightAxis -= 1;

  const axisLen = Math.hypot(forwardAxis, rightAxis);
  if (axisLen > 1) {
    forwardAxis /= axisLen;
    rightAxis /= axisLen;
  }

  const move = new THREE.Vector3();
  move.addScaledVector(forward, forwardAxis);
  move.addScaledVector(right, rightAxis);

  const isMoving = move.lengthSq() > 0.0001;
  if (isMoving) {
    move.multiplyScalar(player.speed * dt);
    const nx = player.mesh.position.x + move.x;
    const nz = player.mesh.position.z + move.z;
    if (!isBlocked(nx, player.mesh.position.z, player.radius)) player.mesh.position.x = nx;
    if (!isBlocked(player.mesh.position.x, nz, player.radius)) player.mesh.position.z = nz;

    const targetYaw = Math.atan2(move.x, move.z);
    let diff = targetYaw - player.mesh.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.mesh.rotation.y += diff * Math.min(1, dt * 10);
  }

  animateWalkCycle(player, isMoving, dt);

  if (swingTimer > 0) {
    swingTimer -= dt;
    player.armPivotRight.rotation.x = -Math.sin((0.25 - swingTimer) * 25) * 1.1;
  } else {
    player.armPivotRight.rotation.x = 0;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  updatePlayer(dt);
  for (const enemy of enemies) updateEnemy(enemy, dt);
  updateCamera();
  updateEnemyBars();
  updateFloatingTexts(dt);

  renderer.render(scene, camera);
}

animate();

// ---------------------------------------------------------------------------
// Pantalla de carga: ya está todo armado (escena, enemigos, jugador), así
// que se puede ocultar apenas arranca el primer frame de render.
// ---------------------------------------------------------------------------
const loadingScreen = document.getElementById('loading-screen');
loadingScreen.classList.add('fade-out');
setTimeout(() => loadingScreen.classList.add('hidden'), 350);
