import type { ScanDetails, ScanPoint } from './types';

export type OverlayShape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'polygon'; points: ScanPoint[] };

function cross(o: ScanPoint, a: ScanPoint, b: ScanPoint) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** 从定位点中挑出面积最大的三点，排除对齐图案等内部点。 */
function pickFinderPoints(points: ScanPoint[]): ScanPoint[] {
  if (points.length <= 3) return points;

  let best = points.slice(0, 3);
  let bestArea = -1;

  for (let i = 0; i < points.length - 2; i += 1) {
    for (let j = i + 1; j < points.length - 1; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const area = Math.abs(cross(points[i], points[j], points[k]));
        if (area > bestArea) {
          bestArea = area;
          best = [points[i], points[j], points[k]];
        }
      }
    }
  }

  return best;
}

/**
 * 由三个定位图案中心推算二维码的四个角。
 *
 * 三个定位点构成直角三角形，最长边是斜边，剩下那个点是直角顶点；
 * 第四个角等于另外两个角相加再减去直角顶点。
 */
function qrCorners(points: ScanPoint[]): ScanPoint[] {
  const finders = pickFinderPoints(points);
  if (finders.length < 3) return finders;

  const [a, b, c] = finders;
  const distanceSquared = (p: ScanPoint, q: ScanPoint) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  const sides = [
    { length: distanceSquared(a, b), ends: [a, b] as const, corner: c },
    { length: distanceSquared(a, c), ends: [a, c] as const, corner: b },
    { length: distanceSquared(b, c), ends: [b, c] as const, corner: a },
  ];
  const hypotenuse = sides.reduce((longest, side) => (side.length > longest.length ? side : longest));
  const [first, second] = hypotenuse.ends;
  const missing = {
    x: first.x + second.x - hypotenuse.corner.x,
    y: first.y + second.y - hypotenuse.corner.y,
  };

  return [hypotenuse.corner, first, second, missing];
}

/** 把扫描结果转换成可绘制的位置形状。 */
export function getOverlayShape(details: ScanDetails): OverlayShape | null {
  if (details.circle) {
    return { kind: 'circle', ...details.circle };
  }

  const corners = qrCorners(details.points);
  if (corners.length < 3) return null;

  // 定位点位于二维码内部，向外扩一圈才能覆盖完整码区。
  const center = corners.reduce(
    (acc, point) => ({ x: acc.x + point.x / corners.length, y: acc.y + point.y / corners.length }),
    { x: 0, y: 0 },
  );
  const padding = 1.2;
  const points = [...corners]
    .sort(
      (p, q) =>
        Math.atan2(p.y - center.y, p.x - center.x)
        - Math.atan2(q.y - center.y, q.x - center.x),
    )
    .map((point) => ({
      x: center.x + (point.x - center.x) * padding,
      y: center.y + (point.y - center.y) * padding,
    }));

  return { kind: 'polygon', points };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('读取图片失败'));
    image.src = source;
  });
}

/**
 * 把原图和二维码位置画到同一张图片上，返回新的 object URL。
 *
 * 这样在新标签页打开图片时，看到的就是已经框好二维码的成品图。
 */
export async function createAnnotatedImage(source: string, details: ScanDetails): Promise<string> {
  const image = await loadImage(source);
  const width = image.naturalWidth || details.width;
  const height = image.naturalHeight || details.height;

  // 超大截图做等比缩放，避免创建过大的 canvas。
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图片画布');

  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  const shape = getOverlayShape(details);
  if (shape) {
    const strokeWidth = Math.max(2, Math.max(width, height) * 0.007);

    context.save();
    context.lineJoin = 'round';
    context.lineWidth = strokeWidth;
    context.strokeStyle = '#22c55e';
    context.fillStyle = 'rgba(34, 197, 94, 0.12)';
    context.shadowColor = 'rgba(34, 197, 94, 0.55)';
    context.shadowBlur = Math.max(6, strokeWidth * 3);

    context.beginPath();
    if (shape.kind === 'circle') {
      context.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
    }
    else {
      for (const [index, point] of shape.points.entries()) {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.closePath();
    }
    context.fill();
    context.stroke();
    context.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('生成标注图片失败');

  return URL.createObjectURL(blob);
}
