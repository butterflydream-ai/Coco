# Cursor Glow

Draws a glowing ribbon that follows your mouse pointer across every screen, so
the cursor is impossible to lose during a screen share, a demo, or a class.

Not part of the default set — install it from the Coco Store.

## Usage

- **Start Cursor Glow** opens the overlay.
- **Stop Cursor Glow** closes it.

The overlay is a full-screen, transparent, click-through window pinned above
normal windows and shown on all Spaces, so it never intercepts a click and
never gets hidden behind the app you are actually demoing. Clicking anywhere
sends a ripple out from the pointer.

## Themes

Set **Flame Theme** in the plugin's preferences. The overlay restarts itself
when you change it, so you can compare themes without stopping and starting.

| Theme | Core → edge |
|---|---|
| Fire (default) | yellow → deep red |
| Frost | near-white → sky blue |
| Venom | acid green → forest green |
| Arcane | lavender → violet |
| Sakura | pale pink → magenta |

## Notes

- The trail is a smoothed (Catmull-Rom) ribbon that tapers from the pointer
  back over roughly 350 ms, so it reads as motion rather than as a line.
- Nothing is recorded and nothing leaves your Mac: the plugin receives pointer
  coordinates from Coco and paints them into its own canvas.
- Pointer tracking uses ordinary mouse-move events, so no Accessibility or
  Screen Recording permission is required.
