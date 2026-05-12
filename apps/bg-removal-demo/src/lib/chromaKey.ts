import type { ChromaKeyOptions } from "./types";

export function applyChromaKey(
  sourceVideo: HTMLVideoElement,
  targetCanvas: HTMLCanvasElement,
  options: ChromaKeyOptions,
): void {
  const ctx = targetCanvas.getContext("2d", {
    willReadFrequently: true,
    alpha: true,
  });

  if (!ctx || sourceVideo.readyState < 2) return;

  targetCanvas.width = sourceVideo.videoWidth;
  targetCanvas.height = sourceVideo.videoHeight;

  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(sourceVideo, 0, 0, targetCanvas.width, targetCanvas.height);

  const imageData = ctx.getImageData(
    0,
    0,
    targetCanvas.width,
    targetCanvas.height,
  );
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] as number;
    const g = data[i + 1] as number;
    const b = data[i + 2] as number;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta === 0) {
      h = 0;
    } else if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;
    const v = max / 255;

    const isGreen =
      h >= options.minHue &&
      h <= options.maxHue &&
      s > options.minSaturation &&
      v > 0.15 &&
      g > r * options.threshold &&
      g > b * options.threshold;

    if (isGreen) {
      const greenness = (g - Math.max(r, b)) / (g || 1);
      const alphaValue = Math.max(0, 1 - greenness * 4);
      data[i + 3] = alphaValue < 0.2 ? 0 : Math.round(alphaValue * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function setupChromaKey(
  sourceVideo: HTMLVideoElement,
  targetCanvas: HTMLCanvasElement,
  options: ChromaKeyOptions,
): () => void {
  let animationFrameId: number | null = null;

  const render = () => {
    applyChromaKey(sourceVideo, targetCanvas, options);
    animationFrameId = requestAnimationFrame(render);
  };

  render();

  return () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}
