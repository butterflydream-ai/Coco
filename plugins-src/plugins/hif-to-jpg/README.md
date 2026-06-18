# HIF to JPG

Convert Fuji `.HIF`, `.HEIF`, and `.HEIC` photos into `.JPG` files next to the
originals.

## Usage

1. Select HIF / HEIF / HEIC files or a folder in Finder, then run `HIF 转 JPG`
   from Coco.
2. Or run the command directly and pick files / folders in the open panel.

The plugin keeps original files untouched. It writes `<name>.JPG` beside each
source image. If that file already exists, it writes `<name>-converted.JPG`
instead.

Conversion uses Coco's native ImageIO bridge, so large photos do not have to be
decoded inside the plugin WebView.
