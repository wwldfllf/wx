export function resolutionPresets(aspect, limits) {
  if (!limits || !/^\d+x\d+$/.test(aspect)) return [];
  const [width, height] = aspect.split("x").map(Number);
  if (!width || !height) return [];
  const divisor = gcd(width, height);
  const unitW = (width / divisor) * limits.step;
  const unitH = (height / divisor) * limits.step;
  const min = Math.max(
    Math.ceil(limits.min / Math.min(unitW, unitH)),
    Math.ceil(Math.sqrt(limits.minPixels / (unitW * unitH)))
  );
  const max = Math.floor(limits.max / Math.max(unitW, unitH));
  if (min > max || Math.max(unitW, unitH) / Math.min(unitW, unitH) > limits.maxRatio) return [];
  const middle = Math.round((min + max) / 2);
  return [...new Set([min, middle, max])].map((scale) => `${unitW * scale}x${unitH * scale}`);
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
