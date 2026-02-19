# 1Password Starfield

An animated ASCII starfield with the 1Password logo and floating security/dev icons. Pure ANSI, zero dependencies—just Node.js and your terminal.

## Features

- **Warp-speed starfield** — Stars rush toward you in classic sci-fi style
- **1Password logo** — Centered ASCII art of the 1Password shield
- **Floating icons** — Lock, shield, key, cloud, server, code, gear, chart, globe, and window sprites drift across the screen
- **Deterministic playback** — Use a seed for reproducible animations
- **ANSI-only** — No heavy dependencies, works in any terminal
- **Responsive** — Auto-detects terminal size or use `--width` and `--height` to customize

## Requirements

- **Node.js** 14 or later

## Usage

```bash
node warp_1password_ascii.js
```

Press `Ctrl+C` to exit.

## Options

| Option | Description |
|--------|-------------|
| `--unicode`, `-u` | Use unicode glyph (✦) for near stars instead of `#` |
| `--seed=N` | PRNG seed for deterministic playback (default: 12345) |
| `--width=N` | Terminal width in characters |
| `--height=N` | Terminal height in lines |
| `--help`, `-h` | Show usage information |

### Examples

```bash
# Default run
node warp_1password_ascii.js

# With unicode stars
node warp_1password_ascii.js --unicode

# Deterministic "replay" with the same seed
node warp_1password_ascii.js --seed=42

# Custom dimensions (e.g. for recording)
node warp_1password_ascii.js --width=120 --height=30
```

## How It Works

The script uses a simple 3D projection: stars start in the distance and move toward the viewer. A z-buffer ensures correct depth ordering. Sprites orbit the logo and respawn when they drift off-screen. Everything is rendered to a character grid and drawn with ANSI escape codes.

## License

MIT
