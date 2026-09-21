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
function buildHumanoid(bodyColor, headColor) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: bodyColor })
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshStandardMaterial({ color: headColor })
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.1, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xcfcfcf, metalness: 0.6, roughness: 0.3 })
  );
  weapon.position.set(0.55, 1.1, 0);
  weapon.rotation.z = 0.3;
  weapon.castShadow = true;
  group.add(weapon);

  return { group, weapon };
}

const { group: playerMesh, weapon: playerWeapon } = buildHumanoid(0x2a5db0, 0xe8c39e);
playerMesh.position.set(0, 0, 0);
scene.add(playerMesh);

const player = {
  mesh: playerMesh,
  weapon: playerWeapon,
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
  tryPlayerAttack();
});

// ---------------------------------------------------------------------------
// Enemigos
// ---------------------------------------------------------------------------
const ENEMY_TYPES = [
  { name: 'Lobo Salvaje', bodyColor: 0x5b4636, headColor: 0x3f2f22, health: 45, damage: [6, 10], speed: 4.2, xp: 18 },
  { name: 'Jabalí Furioso', bodyColor: 0x7a4a2b, headColor: 0x5c3720, health: 65, damage: [8, 14], speed: 3.2, xp: 26 },
  { name: 'Esqueleto Errante', bodyColor: 0xd8d3c4, headColor: 0xefe9d8, health: 55, damage: [10, 16], speed: 3.6, xp: 30 },
];

const enemies = [];

function spawnEnemy(spawnX, spawnZ) {
  const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
  const { group } = buildHumanoid(type.bodyColor, type.headColor);
  group.scale.setScalar(0.9);
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
    mesh: group,
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

  if (moveX !== 0 || moveZ !== 0) {
    const speed = enemy.type.speed * (enemy.state === 'chasing' ? 1 : 0.45);
    const nx = enemy.mesh.position.x + moveX * speed * dt;
    const nz = enemy.mesh.position.z + moveZ * speed * dt;
    if (!isBlocked(nx, nz, enemy.radius)) {
      enemy.mesh.position.x = nx;
      enemy.mesh.position.z = nz;
    }
    enemy.mesh.rotation.y = Math.atan2(moveX, moveZ);
  }

  const flashColor = enemy.hitFlash > 0 ? 0xff5555 : enemy.type.bodyColor;
  enemy.mesh.children[0].material.color.setHex(flashColor);
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

  if (move.lengthSq() > 0.0001) {
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

  if (swingTimer > 0) {
    swingTimer -= dt;
    player.weapon.rotation.x = Math.sin((0.25 - swingTimer) * 25) * 1.2;
  } else {
    player.weapon.rotation.x = 0;
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
