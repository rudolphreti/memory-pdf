import { grayscale, type PDFPage } from "pdf-lib";

export interface CropMarkOptions {
  enabled?: boolean;
  intensity?: number;
  lengthMm?: number;
  lineWidthPt?: number;
}

export interface CropMarkSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export const defaultCropMarkOptions = {
  enabled: true,
  intensity: 0.82,
  lengthMm: 4,
  lineWidthPt: 0.18,
} satisfies Required<CropMarkOptions>;

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function normalizeCropMarkIntensity(intensity: number): number {
  return Math.min(1, Math.max(0, intensity));
}

export function createCornerCropMarkSegments(
  xMm: number,
  yMm: number,
  sizeMm: number,
  lengthMm = defaultCropMarkOptions.lengthMm
): CropMarkSegment[] {
  const x = mmToPt(xMm);
  const y = mmToPt(yMm);
  const size = mmToPt(sizeMm);
  const length = mmToPt(lengthMm);
  const left = x;
  const right = x + size;
  const bottom = y;
  const top = y + size;

  return [
    { start: { x: left, y: bottom }, end: { x: left + length, y: bottom } },
    { start: { x: left, y: bottom }, end: { x: left, y: bottom + length } },
    { start: { x: right, y: bottom }, end: { x: right - length, y: bottom } },
    { start: { x: right, y: bottom }, end: { x: right, y: bottom + length } },
    { start: { x: left, y: top }, end: { x: left + length, y: top } },
    { start: { x: left, y: top }, end: { x: left, y: top - length } },
    { start: { x: right, y: top }, end: { x: right - length, y: top } },
    { start: { x: right, y: top }, end: { x: right, y: top - length } },
  ];
}

export function drawCornerCropMarks(
  page: PDFPage,
  xMm: number,
  yMm: number,
  sizeMm: number,
  options: CropMarkOptions = {}
): void {
  const resolved = { ...defaultCropMarkOptions, ...options };
  if (!resolved.enabled) {
    return;
  }

  const colorValue = normalizeCropMarkIntensity(resolved.intensity);
  const segments = createCornerCropMarkSegments(
    xMm,
    yMm,
    sizeMm,
    resolved.lengthMm
  );

  for (const segment of segments) {
    page.drawLine({
      start: segment.start,
      end: segment.end,
      thickness: resolved.lineWidthPt,
      color: grayscale(colorValue),
    });
  }
}
