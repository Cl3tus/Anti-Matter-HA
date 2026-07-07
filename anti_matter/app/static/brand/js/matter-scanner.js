/**
 * Camera / photo QR scanner for Matter codes.
 */
(function (global) {
  let stream = null;
  let scanTimerId = null;
  let html5Instance = null;
  let currentTrack = null;
  let torchIsOn = false;

  async function stopCamera() {
    if (scanTimerId) {
      clearTimeout(scanTimerId);
      scanTimerId = null;
    }
    // Stopping a track while its torch is still on crashes the camera HAL on some
    // Android phones — the tab's renderer/GPU process dies and Chrome silently
    // reloads it, which looks like the whole page crashed right after a scan
    // (torch off -> stop is the safe order; stop -> torch off is not, on those
    // devices). Always turn it off first and wait for it to actually apply.
    if (currentTrack && torchIsOn) {
      try {
        await currentTrack.applyConstraints({ advanced: [{ torch: false }] });
      } catch {
        /* best effort */
      }
      torchIsOn = false;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    currentTrack = null;
    if (html5Instance) {
      html5Instance
        .stop()
        .then(() => html5Instance.clear())
        .catch(() => {});
      html5Instance = null;
    }
  }

  // Torch (camera flash) — only the native BarcodeDetector path exposes a raw
  // MediaStreamTrack to apply this constraint on; most desktop webcams (and the
  // html5-qrcode fallback path) never report the capability, so this is always
  // feature-detected rather than assumed available.
  function supportsTorch() {
    if (!currentTrack) return false;
    try {
      const caps = currentTrack.getCapabilities ? currentTrack.getCapabilities() : null;
      return !!(caps && caps.torch);
    } catch {
      return false;
    }
  }

  async function setTorch(on) {
    if (!currentTrack) return false;
    try {
      await currentTrack.applyConstraints({ advanced: [{ torch: on }] });
      torchIsOn = on;
      return true;
    } catch {
      return false;
    }
  }

  // Sampling every displayed frame via requestAnimationFrame (up to 60-120Hz on a
  // phone) ran detector.detect() far more often than QR scanning needs, and on
  // devices without a hardware Shape Detection backend (detect() falls back to a
  // software/WASM decoder there) that was enough sustained CPU/memory pressure to
  // crash the tab's renderer mid-scan — Chrome recovers by silently reloading the
  // page, which looked like the whole app had crashed. ~8 detections/sec (matching
  // the html5-qrcode fallback's own fps:10) is still plenty responsive for aiming
  // a phone at a QR code.
  const SCAN_INTERVAL_MS = 120;

  async function scanWithBarcodeDetector(video, onScan) {
    const detector = new global.BarcodeDetector({ formats: ["qr_code"] });
    const tick = async () => {
      if (!stream) return;
      try {
        if (video.videoWidth > 0) {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            await stopCamera();
            onScan(codes[0].rawValue);
            return;
          }
        }
      } catch {
        /* skip frame */
      }
      scanTimerId = setTimeout(tick, SCAN_INTERVAL_MS);
    };
    scanTimerId = setTimeout(tick, SCAN_INTERVAL_MS);
  }

  // Pinch-to-zoom (two fingers) and tap-to-focus. Hardware zoom via the raw
  // MediaStreamTrack's constraints is Chrome-on-Android-only and, even there, most
  // phone cameras don't actually report a zoom capability through getUserMedia —
  // so pinch always does *something*: hardware zoom when the track supports it,
  // otherwise a CSS transform: scale() on the video itself (framing aid only —
  // BarcodeDetector still reads the full, unscaled frame, so decoding is unaffected).
  // Tap-to-focus has no software fallback and stays feature-detected.
  const CSS_ZOOM_MIN = 1;
  const CSS_ZOOM_MAX = 3;

  function wirePinchZoomAndTapFocus(video, track) {
    let caps = null;
    try {
      caps = track.getCapabilities ? track.getCapabilities() : null;
    } catch {
      caps = null;
    }
    const zoomCaps = caps && caps.zoom;
    const supportsFocus = !!(caps && caps.focusMode && caps.focusMode.includes("single-shot"));

    let pinchStartDist = 0;
    let pinchStartZoom = zoomCaps ? zoomCaps.min : 1;
    let cssScale = 1;
    let touchStart = null;
    let moved = false;

    video.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          const [a, b] = e.touches;
          pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          pinchStartZoom = zoomCaps ? track.getSettings?.().zoom || zoomCaps.min : cssScale;
          moved = true;
        } else if (e.touches.length === 1) {
          touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          moved = false;
        }
      },
      { passive: true }
    );

    video.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && pinchStartDist) {
          const [a, b] = e.touches;
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const ratio = dist / pinchStartDist;
          if (zoomCaps) {
            const zoom = Math.min(zoomCaps.max, Math.max(zoomCaps.min, pinchStartZoom * ratio));
            track.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
          } else {
            cssScale = Math.min(CSS_ZOOM_MAX, Math.max(CSS_ZOOM_MIN, pinchStartZoom * ratio));
            video.style.transform = cssScale > 1 ? `scale(${cssScale})` : "";
          }
        } else if (touchStart) {
          const dx = e.touches[0].clientX - touchStart.x;
          const dy = e.touches[0].clientY - touchStart.y;
          if (Math.hypot(dx, dy) > 10) moved = true;
        }
      },
      { passive: true }
    );

    video.addEventListener("touchend", () => {
      if (!moved && touchStart && supportsFocus) {
        const rect = video.getBoundingClientRect();
        const x = (touchStart.x - rect.left) / rect.width;
        const y = (touchStart.y - rect.top) / rect.height;
        track
          .applyConstraints({ advanced: [{ focusMode: "single-shot", pointsOfInterest: [{ x, y }] }] })
          .catch(() => {});
      }
      touchStart = null;
      pinchStartDist = 0;
    });
  }

  async function startNativeCamera(containerId, onScan, onError, onReady) {
    const container = document.getElementById(containerId);
    if (!container) {
      onError(new Error("Scanner container not found"));
      return;
    }
    container.innerHTML = "";
    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.className = "scan-video";
    container.appendChild(video);

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (e) {
      onError(e);
      return;
    }
    video.srcObject = stream;
    await video.play();
    const track = stream.getVideoTracks()[0];
    currentTrack = track || null;
    if (track) wirePinchZoomAndTapFocus(video, track);
    if (typeof onReady === "function") onReady();
    await scanWithBarcodeDetector(video, onScan);
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (global.Html5Qrcode) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-antimatter-scanner="${url}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Scanner library failed to load")));
        return;
      }
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.dataset.antimatterScanner = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Scanner library failed to load"));
      document.head.appendChild(s);
    });
  }

  async function startHtml5Camera(containerId, libUrl, onScan, onError) {
    try {
      await loadScript(libUrl);
    } catch (e) {
      onError(e);
      return;
    }
    const container = document.getElementById(containerId);
    if (!container) {
      onError(new Error("Scanner container not found"));
      return;
    }
    container.innerHTML = "";
    const readerId = "antimatter-qr-reader";
    const div = document.createElement("div");
    div.id = readerId;
    div.className = "scan-reader-mount";
    container.appendChild(div);

    html5Instance = new global.Html5Qrcode(readerId);
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    const cameras = await global.Html5Qrcode.getCameras();
    const cam =
      cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
    if (!cam) {
      onError(new Error("No camera found"));
      return;
    }
    await html5Instance.start(
      cam.id,
      config,
      (text) => {
        stopCamera();
        onScan(text);
      },
      () => {}
    );
  }

  // Html5Qrcode.clear() doesn't reliably return a Promise (some code paths return
  // undefined synchronously, e.g. when scanFile() threw before scanning state was
  // ever set up) — calling .catch() on that crashes with a *new*, uncaught
  // "Cannot read properties of undefined (reading 'catch')", which pre-empts the
  // real onError(e) call below it and makes a failed photo scan look like nothing
  // happened at all instead of showing an error.
  async function safeClear(inst) {
    if (!inst) return;
    try {
      await inst.clear();
    } catch (e) {
      /* ignore cleanup failures */
    }
  }

  async function scanImageFile(file, onScan, onError, libUrl) {
    if ("BarcodeDetector" in global) {
      try {
        const detector = new global.BarcodeDetector({ formats: ["qr_code"] });
        const bitmap = await createImageBitmap(file);
        const codes = await detector.detect(bitmap);
        bitmap.close();
        if (codes.length > 0 && codes[0].rawValue) {
          onScan(codes[0].rawValue);
          return;
        }
      } catch (e) {
        onError(e);
        return;
      }
      onError(new Error("No QR code found in image"));
      return;
    }
    // Fallback for browsers without BarcodeDetector (e.g. iOS Safari): html5-qrcode scanFile.
    if (libUrl) {
      let inst = null;
      try {
        await loadScript(libUrl);
        const tmpId = "antimatter-file-scan-tmp";
        let div = document.getElementById(tmpId);
        if (!div) {
          div = document.createElement("div");
          div.id = tmpId;
          div.style.display = "none";
          document.body.appendChild(div);
        }
        inst = new global.Html5Qrcode(tmpId);
        const text = await inst.scanFile(file, false);
        await safeClear(inst);
        if (text) {
          onScan(text);
          return;
        }
        onError(new Error("No QR code found in image"));
      } catch (e) {
        await safeClear(inst);
        onError(e);
      }
      return;
    }
    onError(new Error("Photo scan not supported in this browser"));
  }

  /**
   * @param {object} opts
   * @param {string} opts.containerId
   * @param {string} [opts.libUrl] html5-qrcode script URL
   * @param {(text: string) => void} opts.onScan
   * @param {(err: Error) => void} opts.onError
   * @param {() => void} [opts.onReady] fired once the camera track is live —
   *   only reached on the native BarcodeDetector path, where torch support can
   *   actually be feature-detected against the real MediaStreamTrack.
   */
  async function startCamera(opts) {
    stopCamera();
    const { containerId, libUrl, onScan, onError, onReady } = opts;
    if ("BarcodeDetector" in global) {
      await startNativeCamera(containerId, onScan, onError, onReady);
      return;
    }
    if (libUrl) {
      await startHtml5Camera(containerId, libUrl, onScan, onError);
      return;
    }
    onError(new Error("Camera scanning is not supported in this browser"));
  }

  global.AntiMatterScanner = {
    startCamera,
    stopCamera,
    scanImageFile,
    supportsCamera: () =>
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    supportsNativeScan: () => "BarcodeDetector" in global,
    supportsTorch,
    setTorch,
  };
})(typeof window !== "undefined" ? window : globalThis);
