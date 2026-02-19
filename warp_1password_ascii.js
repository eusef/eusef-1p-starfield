#!/usr/bin/env node
/**
 * warp_1password_ascii.js
 * Animated ASCII starfield with 1Password logo and floating security/dev icons.
 * Deterministic playback when seeded. ANSI-only, no heavy dependencies.
 */

// --- Default Parameters ---
const FPS = 30;
const NUM_OBJECTS = 14;
const WARP_SPEED = 0.6;
const SCALE_X_FACTOR = 0.35;
const SCALE_Y_FACTOR = 0.55;
const NEAR_EPSILON = 0.02;
const OBJECT_SPEED_FACTOR = 3.0;
const DEFAULT_SEED = 12345;
const UNICODE_DEFAULT = false;

// --- PRNG ---
function createPRNG(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state * 1103515245 + 12345) >>> 0;
      return (state >>> 16) / 65536;
    },
    nextInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
  };
}

// --- Canvas ---
function createCanvas(width, height) {
  const chars = Array.from({ length: height }, () => Array(width).fill(' '));
  const zbuf = Array.from({ length: height }, () => Array(width).fill(-Infinity));
  return { width, height, chars, zbuf };
}

function clearCanvas(canvas) {
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      canvas.chars[y][x] = ' ';
      canvas.zbuf[y][x] = -Infinity;
    }
  }
}

function plot(canvas, x, y, z, ch) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix >= 0 && ix < canvas.width && iy >= 0 && iy < canvas.height) {
    if (z > canvas.zbuf[iy][ix]) {
      canvas.zbuf[iy][ix] = z;
      canvas.chars[iy][ix] = ch;
    }
  }
}

function drawSprite(canvas, x, y, z, lines, centerAnchor = true, opaque = false) {
  const maxW = Math.max(...lines.map((l) => l.length));
  const h = lines.length;
  const ox = centerAnchor ? x - Math.floor(maxW / 2) : x;
  const oy = centerAnchor ? y - Math.floor(h / 2) : y;
  for (let row = 0; row < h; row++) {
    const line = lines[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch !== ' ' || opaque) plot(canvas, ox + col, oy + row, z, ch);
    }
  }
}

// --- Star ---
function createStar(prng) {
  return {
    sx: (prng.next() - 0.5) * 2,
    sy: (prng.next() - 0.5) * 2,
    z: 0.1 + prng.next() * 0.9,
  };
}

function updateStar(star, dt) {
  star.z -= WARP_SPEED * dt;
  return star.z <= NEAR_EPSILON;
}

function projectStar(star, centerX, centerY, scaleX, scaleY) {
  const px = centerX + (star.sx / star.z) * scaleX;
  const py = centerY + (star.sy / star.z) * scaleY;
  return { px, py, z: 1 - star.z };
}

function starGlyph(z, unicode) {
  if (z > 0.75) return '.';
  if (z > 0.5) return '*';
  if (z > 0.25) return '+';
  return unicode ? '✦' : '#';
}

// --- 1Password Logo (raw ASCII art, used as-is) ---
const LOGO_RAW = `
                                    :=+**####%%%%#####**=-
                                  -*##%%%%%%%%%%%%%%%%%%%%%%%%%#*+:
                              -*#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#+:
                           =#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*:
                        :*%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%+
                      -%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#
                    =#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#:
                  -#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*:
                 +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
               :%%%%%%%%%%%%%%%%%%%%%%%%%%%#************#%%%%%%%%%%%%%%%%%%%%%%%%%%%*
              =%%%%%%%%%%%%%%%%%%%%%%%%%%%+              :*%%%%%%%%%%%%%%%%%%%%%%%%%%%:
             *%%%%%%%%%%%%%%%%%%%%%%%%%%%#=               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
            +%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-
           +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-
          =%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#:
         :%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%+
         +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
        :%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#
        *%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%+               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
        %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#+             +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*
       -%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%            +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
       +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-             +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%:
       *%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
       #%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
       *%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
       +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-             :#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
       =%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-           :%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
       :%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-            *#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#
        #%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-              +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
        -%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
         #%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
         -%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#
          +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%-
          :*%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
           :#%%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%%+
            :#%%%%%%%%%%%%%%%%%%%%%%%%%%%#-               +%%%%%%%%%%%%%%%%%%%%%%%%%%%%+
             :#%%%%%%%%%%%%%%%%%%%%%%%%%%%=               +%%%%%%%%%%%%%%%%%%%%%%%%%%%+
               +%%%%%%%%%%%%%%%%%%%%%%%%%%#*-:::::::: ::=#%%%%%%%%%%%%%%%%%%%%%%%%%%%-
                -%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*
                 :+%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
                   :#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%+
                     :#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%+
                        *%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%=
                          =#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*:
                             -#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*:
                                 =#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#*-
                                     :=*##%%%%%%%%%%%%%%%%###+-
                                             ::-------:
`.trim().split('\n');

function prepareLogo(logoLines) {
  const maxW = Math.max(...logoLines.map((l) => l.length));
  return logoLines.map((line, i) => {
    if (i === 0) {
      const trimmed = line.trim();
      const padStart = Math.floor((maxW - trimmed.length) / 2);
      return ' '.repeat(padStart) + trimmed + ' '.repeat(maxW - padStart - trimmed.length);
    }
    return line.padEnd(maxW, ' ');
  });
}

// --- Sprites ---
const SPRITES = {
  lock: [[' .-. ', '(   )', ' | | ', ' |_| '], [' .-. ', '(   )', ' | | ', ' |_| ']],
  shield: [[' /\\ ', '/__\\', '\\  /', ' \\/ '], [' /\\ ', '/__\\', '\\  /', ' \\/ ']],
  key: [[' _  ', '/ )=', '\\_)=', '    '], [' _  ', '/ )=', '\\_)=', '    ']],
  cloud: [[' .--. ', '(____)', '      '], [' .--. ', '(____)', '      ']],
  server: [['[==]', '[==]', '    '], ['[==]', '[==]', '    ']],
  code: [['</>', '   '], ['</>', '   ']],
  gear: [[' _o_ ', '/___\\', ' \\o/ ', '     '], [' _o_ ', '/___\\', ' \\o/ ', '     ']],
  chart: [['|#.', '|##', '   '], ['|#.', '|##', '   ']],
  globe: [[" .-. ", '( + )', " '-' ", '     '], [" .-. ", '( + )', " '-' ", '     ']],
  window: [['+--+', '|[]|', '+--+', '    '], ['+--+', '|[]|', '+--+', '    ']],
};
const SPRITE_NAMES = Object.keys(SPRITES);

// --- SpriteObject ---
function getSpawnRadius(canvasWidth, canvasHeight) {
  return Math.min(canvasWidth, canvasHeight) * 0.35;
}

function createSpriteObject(prng, centerX, centerY, spawnRadius, scaleX, scaleY) {
  const angle = prng.next() * Math.PI * 2;
  const baseSpeed = ((scaleX + scaleY) / 2) * WARP_SPEED * OBJECT_SPEED_FACTOR;
  const speed = baseSpeed * (0.8 + prng.next() * 0.4);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const name = SPRITE_NAMES[prng.nextInt(0, SPRITE_NAMES.length - 1)];
  const r = spawnRadius + prng.next() * 8;
  return {
    name,
    pos: { x: centerX + Math.cos(angle) * r, y: centerY + Math.sin(angle) * r },
    vel: { x: vx, y: vy },
    z: 0.5 + prng.next() * 0.3,
    frame: 0,
  };
}

function updateSpriteObject(obj, dt, t) {
  obj.pos.x += obj.vel.x * dt;
  obj.pos.y += obj.vel.y * dt;
  obj.frame = Math.floor(t * 2) % 2;
}

// --- Compose Frame ---
function composeFrame(canvas, stars, objects, centerX, centerY, scaleX, scaleY, unicode, logoLines) {
  clearCanvas(canvas);

  for (const star of stars) {
    const { px, py, z } = projectStar(star, centerX, centerY, scaleX, scaleY);
    const ch = starGlyph(z, unicode);
    plot(canvas, px, py, 0.1 + z * 0.2, ch);
    if (z > 0.7) {
      const dx = (star.sx / star.z) * scaleX * 0.1;
      const dy = (star.sy / star.z) * scaleY * 0.1;
      plot(canvas, px - dx, py - dy, 0.05, '.');
    }
  }

  for (const obj of objects) {
    const sprite = SPRITES[obj.name][obj.frame];
    drawSprite(canvas, obj.pos.x, obj.pos.y, obj.z, sprite);
  }

  drawSprite(canvas, centerX, centerY, 1.0, logoLines, true, true);

  return canvas.chars.map((row) => row.join('')).join('\n');
}

// --- Main ---
function main() {
  const args = process.argv.slice(2);
  let seed = DEFAULT_SEED;
  let unicode = UNICODE_DEFAULT;
  let width = 80;
  let height = 24;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node warp_1password_ascii.js [options]
Options:
  --unicode, -u     Use unicode glyphs (✦ for near stars)
  --seed=N          PRNG seed for deterministic playback (default: ${DEFAULT_SEED})
  --width=N         Terminal width (default: auto-detect)
  --height=N        Terminal height (default: auto-detect)
`);
      process.exit(0);
    }
    if (arg === '--unicode' || arg === '-u') unicode = true;
    else if (arg.startsWith('--seed=')) seed = parseInt(arg.slice(7), 10) || DEFAULT_SEED;
    else if (arg.startsWith('--width=')) width = parseInt(arg.slice(8), 10) || 80;
    else if (arg.startsWith('--height=')) height = parseInt(arg.slice(9), 10) || 24;
  }

  if (process.stdout.columns && process.stdout.rows) {
    width = args.includes('--width=') ? width : process.stdout.columns;
    height = args.includes('--height=') ? height : process.stdout.rows;
  }

  const prng = createPRNG(seed);
  const canvas = createCanvas(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const scaleX = width * SCALE_X_FACTOR;
  const scaleY = height * SCALE_Y_FACTOR;
  const numStars = Math.min(1200, Math.floor((width * height) / 18));
  const spawnRadius = getSpawnRadius(width, height);

  const logoLines = prepareLogo(LOGO_RAW);

  const stars = [];
  for (let i = 0; i < numStars; i++) stars.push(createStar(prng));

  const objects = [];
  for (let i = 0; i < NUM_OBJECTS; i++) {
    objects.push(createSpriteObject(prng, centerX, centerY, spawnRadius, scaleX, scaleY));
  }

  process.stdout.write('\x1b[?25l');
  process.stdout.write('\x1b[2J');

  const dt = 1 / FPS;
  let t = 0;
  let lastFrame = 0;

  function render() {
    lastFrame = Date.now();
    t += dt;

    for (let i = 0; i < stars.length; i++) {
      if (updateStar(stars[i], dt)) stars[i] = createStar(prng);
    }

    const margin = 10;
    for (const obj of objects) {
      updateSpriteObject(obj, dt, t);
      if (obj.pos.x < -margin || obj.pos.x > canvas.width + margin || obj.pos.y < -margin || obj.pos.y > canvas.height + margin) {
        Object.assign(obj, createSpriteObject(prng, centerX, centerY, spawnRadius, scaleX, scaleY));
      }
    }

    const frameStr = composeFrame(canvas, stars, objects, centerX, centerY, scaleX, scaleY, unicode, logoLines);
    process.stdout.write('\x1b[H' + frameStr);
  }

  const interval = setInterval(render, 1000 / FPS);
  lastFrame = Date.now();

  function cleanup() {
    clearInterval(interval);
    process.stdout.write('\x1b[?25h');
    process.stdout.write('\x1b[0m');
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main();
