# QTA to MP3

Convert iPhone Voice Memo / `.qta` recordings to MP3, right next to the
originals. Despite the unusual extension, a `.qta` file is a QuickTime/MOV
container holding an AAC audio track (often alongside an Apple spatial-audio
`apac` track, which is ignored).

## How it works

1. The recording is decoded with macOS's built-in `afconvert` (Core Audio) to a
   temporary WAV — no ffmpeg or Homebrew required.
2. The WAV is encoded to MP3 with a bundled, self-contained **LAME** encoder
   (`bin/lame`, a universal arm64 + x86_64 static binary, ad-hoc signed).
3. The temporary WAV is deleted.

The output is written beside the original (`recording.qta` → `recording.mp3`) and
existing files are never overwritten. The resulting path is copied to the
clipboard.

## Usage

- Select one or more recordings in Finder, then run **Convert QTA to MP3** from
  Coco — or run the command and pick files from the open panel.
- Encoding uses LAME VBR `-V2` (~190 kbps), close to the source quality.

## Notes

- Decoding produces a temporary uncompressed WAV roughly `~11.5 MB / minute` of
  audio; the plugin checks for free space first and refuses the job if the
  volume is too small.
- Long conversions are cancellable from the progress HUD.

## Licensing

The bundled `bin/lame` is [LAME](https://lame.sourceforge.io/), licensed under
the GNU LGPL v2 — see [LICENSE-LAME](LICENSE-LAME).
