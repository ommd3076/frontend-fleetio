import type { RouteStep } from '../types';

export const LANE_OFFSET = 0.62;

function rightNormal(from: RouteStep, to: RouteStep) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > 0.001 ? { x: dy / length * LANE_OFFSET, y: -dx / length * LANE_OFFSET } : { x: 0, y: 0 };
}

/** Moves graph centre lines onto the right-hand lane while retaining exact
 * pickup, drop and staging endpoints. Corner offsets are the intersection of
 * the incoming and outgoing lane centre lines. */
export function applyRightHandLanes(route: RouteStep[]): RouteStep[] {
  if (route.length < 3) return route.map(step => ({ ...step }));
  return route.map((step, index) => {
    if (index === 0 || index === route.length - 1) return { ...step };
    const incoming = rightNormal(route[index - 1], step);
    const outgoing = rightNormal(step, route[index + 1]);
    const sameLane = incoming.x * outgoing.x + incoming.y * outgoing.y > LANE_OFFSET * LANE_OFFSET * 0.98;
    return {
      ...step,
      x: step.x + (sameLane ? incoming.x : incoming.x + outgoing.x),
      y: step.y + (sameLane ? incoming.y : incoming.y + outgoing.y)
    };
  });
}
