# Fantasy Realm Explorer

Prototipo de RPG 3D de exploración y combate que corre directo en el
navegador, inspirado en el estilo de juego de **World of Warcraft**
(exploración de mundo abierto en tercera persona, subir de nivel matando
criaturas, barras de vida flotantes). Es un proyecto propio, hecho desde
cero, sin usar ningún asset ni contenido de Blizzard — no está afiliado a
Blizzard Entertainment ni a la franquicia Warcraft.

## Cómo jugar

No requiere instalación ni build. Basta con abrir `index.html` en un
navegador moderno (Chrome, Firefox, Edge), o servirlo con cualquier
servidor estático:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

**Controles**

| Acción | Tecla |
|---|---|
| Moverse | `W` `A` `S` `D` (o flechas) |
| Mirar alrededor / orbitar cámara | click izquierdo + arrastrar |
| Acercar / alejar cámara | rueda del mouse |
| Atacar | `Espacio` |

**En celular** los controles táctiles aparecen solos (joystick abajo a la
izquierda, botón de ataque abajo a la derecha, arrastrar el dedo gira la
cámara). El juego **fuerza la vista horizontal apenas carga**, incluso con
el bloqueo de rotación del sistema activado: no hay que rotar nada, la
pantalla ya se ve y se juega en horizontal. Si al abrirlo la orientación
queda "al revés" para tu forma de sostener el teléfono, hay un botón
chiquito (⇄, arriba a la derecha) que invierte el sentido de la rotación.

## Qué tiene el prototipo

- Mundo 3D explorable (100x100) con árboles y rocas como obstáculos reales
  (bloquean el movimiento).
- Cámara en tercera persona tipo "follow cam", orbitable con el mouse.
- 3 tipos de enemigos (Lobo Salvaje, Jabalí Furioso, Esqueleto Errante), cada
  uno con su propia vida, daño y velocidad.
- IA simple de enemigos: deambulan cerca de su punto de aparición, persiguen
  al jugador si se acerca demasiado (aggro), atacan cuerpo a cuerpo, y
  vuelven a "aparecer" (respawn) un rato después de morir.
- Combate cuerpo a cuerpo: el jugador ataca al enemigo más cercano dentro de
  rango con `Espacio`; daño con variación aleatoria.
- Barras de vida flotantes sobre cada enemigo (posicionadas en 2D proyectando
  su posición 3D a pantalla en cada frame) y nombre del enemigo.
- Textos de daño flotantes ("-18", "¡Subiste de nivel!").
- Controles táctiles para celular (joystick + botón de ataque), detectados
  automáticamente, con vista horizontal forzada por CSS (funciona aunque
  el sistema operativo tenga el bloqueo de rotación activado).
- Progresión de personaje: experiencia por matar enemigos, subida de nivel
  que aumenta vida máxima y daño de ataque.
- HUD con nivel, barra de vida, barra de experiencia y contador de enemigos
  derrotados.
- Pantalla de muerte con botón para reaparecer.

## Estructura del proyecto

```
fantasy-realm-explorer/
├── index.html          # Punto de entrada, HUD y estructura de la página
├── style.css           # Estilos del HUD y overlays
├── main.js             # Toda la lógica del juego (Three.js)
├── vendor/
│   └── three.module.js # Three.js empaquetado localmente (sin depender de un CDN)
└── README.md
```

## Por qué Three.js empaquetado localmente (`vendor/`) y no un CDN

Three.js se vendorizó dentro del repo (`vendor/three.module.js`, tomado del
paquete oficial `three` en npm) en lugar de cargarse desde un CDN como
`unpkg` o `jsdelivr`. Así el juego funciona sin conexión a internet y sin
depender de que un CDN externo esté disponible — simplemente se abre
`index.html` y ya. Si en el futuro se prefiere actualizar la versión de
Three.js, basta con reemplazar ese archivo por el build correspondiente del
paquete `three` (`node_modules/three/build/three.module.js`).

## Ideas para seguir este prototipo

- Modelos y animaciones reales (glTF) en vez de figuras geométricas simples.
- Clases de personaje jugables (guerrero, mago, pícaro) con habilidades
  distintas en vez de un único tipo de ataque.
- Más de una zona/mapa, con transición entre ellas.
- Sonido: efectos de combate y música ambiente.
- Guardado de progreso en `localStorage`.
