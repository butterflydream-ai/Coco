(async function() {
  try {
    await coco.log("screen-color-picker plugin loaded");

    coco.commands.on("pick", async function() {
      try {
        const color = await coco.system.pickColorFromScreen();
        await coco.clipboard.set(color.hex);
        await coco.toast("Copied " + color.hex);
        await coco.log("color picked hex=" + color.hex + " rgb=" + color.r + "," + color.g + "," + color.b);
      } catch (err) {
        await coco.toast("Color pick cancelled");
        await coco.log("color pick failed: " + (err && err.message ? err.message : String(err)));
      }
    });

    coco.commands.on("capture", async function() {
      try {
        const path = await coco.fs.savePanel({
          title: "Save screen capture",
          defaultName: "coco-capture-" + Date.now() + ".png",
          allowedTypes: ["public.png"]
        });
        if (!path) {
          await coco.toast("Capture cancelled");
          return;
        }
        const bytes = await coco.system.captureScreen();
        await coco.fs.write(path, bytes);
        await coco.clipboard.set(path);
        await coco.toast("Saved → path on clipboard");
        await coco.log("capture saved path=" + path + " bytes=" + bytes.byteLength);
      } catch (err) {
        await coco.toast("Capture failed");
        await coco.log("capture failed: " + (err && err.message ? err.message : String(err)));
      }
    });
  } catch (err) {
    console.error("screen-color-picker bootstrap error", err);
  }
})();
