# Cursor Demo

Presentation mode for your pointer. When you're sharing your screen or demoing
to a room, it can be hard for the audience to follow where the mouse is. Cursor
Demo draws a glowing highlight ring around the cursor, a fading motion trail
behind it, and a ripple wherever you click.

## Commands

- **Start Cursor Demo** — opens the highlight overlay.
- **Stop Cursor Demo** — closes it. You can also press **Esc** while the overlay
  is active.

## Preferences

| Setting | What it does |
| --- | --- |
| Highlight color | Amber / red / green / blue / purple for the ring, trail, and ripples. |
| Ring size | Diameter of the ring drawn around the cursor. |
| Trail length | How long the motion trail lingers (or off for ring only). |
| Click ripples | Expanding ripple on every click. |
| Spotlight | Dim the rest of the screen and keep a bright circle around the cursor. |

## How it works

The plugin opens a transparent, borderless, top-most overlay that covers the
screen and requests click-through so you can keep using your apps while the
highlight follows the system cursor. The overlay draws everything on a canvas
with `requestAnimationFrame`.

To draw the trail it needs the live cursor position. It prefers a native cursor
feed from Coco (which keeps working even when the overlay is click-through and
receives no DOM events) and falls back to ordinary DOM mouse events when the
overlay is interactive, so it degrades gracefully on hosts that don't forward a
global cursor feed.
