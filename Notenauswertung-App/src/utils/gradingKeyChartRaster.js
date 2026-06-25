import { buildGradingKeyChartModel } from './gradingKeyChartModel';
import {
  buildGradingKeyChartSvg,
  GRADING_KEY_CHART_EXPORT_HEIGHT,
  GRADING_KEY_CHART_EXPORT_WIDTH,
} from './gradingKeyChartSvg';

export function rasterizeSvgStringToPngDataUrl(svgString, width, height) {
  return new Promise((resolve, reject) => {
    const svg = svgString.includes('xmlns=')
      ? svgString
      : svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas nicht verfügbar'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG-Rasterisierung fehlgeschlagen'));
    };
    img.src = url;
  });
}

/** @param {import('./gradingKeyChartModel').buildGradingKeyChartModel extends (...args: any[]) => infer _R ? Parameters<typeof buildGradingKeyChartModel>[0] : never} chartParams */
export async function rasterizeGradingKeyChartPngDataUrl(chartParams) {
  if (!chartParams) return null;
  const model = buildGradingKeyChartModel(chartParams);
  if (!model) return null;
  const svg = buildGradingKeyChartSvg(model, {
    width: GRADING_KEY_CHART_EXPORT_WIDTH,
    height: GRADING_KEY_CHART_EXPORT_HEIGHT,
  });
  if (!svg) return null;
  return rasterizeSvgStringToPngDataUrl(svg, GRADING_KEY_CHART_EXPORT_WIDTH, GRADING_KEY_CHART_EXPORT_HEIGHT);
}

export function pngDataUrlToBase64(dataUrl) {
  if (!dataUrl) return null;
  const m = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
  return m ? m[1] : null;
}
