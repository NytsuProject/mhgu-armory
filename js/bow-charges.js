// El índice es el orden de carga del arco. «Lv» indica la potencia de la flecha,
// no su posición; «!» indica que la carga requiere Recargando.
export function thirdChargeType(level, includeLoadUp = false) {
  const charge = level.x?.charges?.[2];
  if (!charge || (!includeLoadUp && charge.endsWith('!'))) return null;
  return charge.split(' ')[0];
}
