import type { Position } from '../types';

export interface RouteSegment {
  type: 'LINE' | 'ARC';
  length: number;
  start: Position;
  end: Position;
  
  // For arcs
  center?: Position;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  ccw?: boolean;
}

export class MotionPath {
  segments: RouteSegment[] = [];
  totalLength: number = 0;
  
  constructor(path: Position[], turnRadius: number = 0.75) {
    if (path.length < 2) return;
    
    // Simplify collinear points
    const simplified = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      
      // If not collinear
      const cross = dx1 * dy2 - dy1 * dx2;
      const scale = Math.max(1, Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2));
      if (Math.abs(cross) > 1e-6 * scale) {
        simplified.push(curr);
      }
    }
    simplified.push(path[path.length - 1]);
    
    if (simplified.length === 2) {
      this.addLineSegment(simplified[0], simplified[1]);
      return;
    }
    
    // Create arcs at corners
    let currentStart = simplified[0];
    
    for (let i = 1; i < simplified.length - 1; i++) {
      const p1 = currentStart;
      const p2 = simplified[i];
      const p3 = simplified[i + 1];
      
      const v1x = p2.x - p1.x;
      const v1y = p2.y - p1.y;
      const l1 = Math.hypot(v1x, v1y);
      const d1x = v1x / l1;
      const d1y = v1y / l1;
      
      const v2x = p3.x - p2.x;
      const v2y = p3.y - p2.y;
      const l2 = Math.hypot(v2x, v2y);
      const d2x = v2x / l2;
      const d2y = v2y / l2;
      
      const r = Math.min(turnRadius, l1 / 2, l2 / 2);
      
      if (r > 0) {
        const cornerStart = { x: p2.x - d1x * r, y: p2.y - d1y * r };
        const cornerEnd = { x: p2.x + d2x * r, y: p2.y + d2y * r };
        
        this.addLineSegment(p1, cornerStart);
        
        // cross product to determine turn direction
        const cross = d1x * d2y - d1y * d2x;
        const ccw = cross > 0;
        
        // Arc center
        // The circle centre sits on the inside of the turn. The previous
        // sign convention put it on the outside, producing a 270 degree arc
        // for an ordinary 90 degree corner.
        const turnSign = ccw ? 1 : -1;
        const cx = cornerStart.x - d1y * r * turnSign;
        const cy = cornerStart.y + d1x * r * turnSign;
        
        let startAngle = Math.atan2(cornerStart.y - cy, cornerStart.x - cx);
        let endAngle = Math.atan2(cornerEnd.y - cy, cornerEnd.x - cx);
        
        let dAngle = endAngle - startAngle;
        if (ccw && dAngle < 0) dAngle += 2 * Math.PI;
        if (!ccw && dAngle > 0) dAngle -= 2 * Math.PI;
        
        const arcLength = Math.abs(dAngle) * r;
        
        this.segments.push({
          type: 'ARC',
          length: arcLength,
          start: cornerStart,
          end: cornerEnd,
          center: { x: cx, y: cy },
          radius: r,
          startAngle,
          endAngle,
          ccw
        });
        this.totalLength += arcLength;
        
        currentStart = cornerEnd;
      } else {
        this.addLineSegment(p1, p2);
        currentStart = p2;
      }
    }
    
    this.addLineSegment(currentStart, simplified[simplified.length - 1]);
  }
  
  private addLineSegment(p1: Position, p2: Position) {
    const l = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (l > 0.001) {
      this.segments.push({
        type: 'LINE',
        length: l,
        start: p1,
        end: p2
      });
      this.totalLength += l;
    }
  }
  
  getPointAtDistance(d: number): { position: Position, heading: number } {
    if (d <= 0 && this.segments.length > 0) {
      const s = this.segments[0];
      return this.calcPointAndHeading(s, 0);
    }
    
    let currentD = 0;
    for (const s of this.segments) {
      if (d <= currentD + s.length || s === this.segments[this.segments.length - 1]) {
        return this.calcPointAndHeading(s, d - currentD);
      }
      currentD += s.length;
    }
    
    const last = this.segments[this.segments.length - 1];
    return this.calcPointAndHeading(last, last.length);
  }
  
  private calcPointAndHeading(s: RouteSegment, d: number): { position: Position, heading: number } {
    d = Math.max(0, Math.min(d, s.length));
    
    if (s.type === 'LINE') {
      const t = d / s.length;
      const x = s.start.x + (s.end.x - s.start.x) * t;
      const y = s.start.y + (s.end.y - s.start.y) * t;
      const heading = Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x);
      return { position: { x, y }, heading };
    } else {
      const t = d / s.length;
      let dAngle = s.endAngle! - s.startAngle!;
      if (s.ccw! && dAngle < 0) dAngle += 2 * Math.PI;
      if (!s.ccw! && dAngle > 0) dAngle -= 2 * Math.PI;
      
      const angle = s.startAngle! + dAngle * t;
      const x = s.center!.x + s.radius! * Math.cos(angle);
      const y = s.center!.y + s.radius! * Math.sin(angle);
      
      const tangentAngle = angle + (s.ccw ? Math.PI / 2 : -Math.PI / 2);
      return { position: { x, y }, heading: tangentAngle };
    }
  }
}
