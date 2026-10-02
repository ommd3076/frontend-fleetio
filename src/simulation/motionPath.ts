import type {Position} from '../types';
export interface RouteSegment {type:'LINE'|'ARC';length:number;start:Position;end:Position;center?:Position;radius?:number;startAngle?:number;endAngle?:number;ccw?:boolean}
const dist=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Arbitrary-angle, continuous arc-length fillets. U-turns retain a pivot
 * where the simulation rotates in place before reversing. */
export class MotionPath {
 segments:RouteSegment[]=[]; pivots:number[]=[]; totalLength=0; private origin:Position;
 constructor(input:Position[],turnRadius=.55){
  const points=input.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).filter((p,i,a)=>!i||dist(p,a[i-1])>1e-7);
  this.origin={...(points[0]??{x:0,y:0})};if(points.length<2)return;let start=points[0];
  for(let i=1;i<points.length-1;i++){
   const a=points[i-1],b=points[i],c=points[i+1],l1=dist(a,b),l2=dist(b,c);
   const ux=(b.x-a.x)/l1,uy=(b.y-a.y)/l1,vx=(c.x-b.x)/l2,vy=(c.y-b.y)/l2;
   const theta=Math.acos(Math.max(-1,Math.min(1,ux*vx+uy*vy))),cross=ux*vy-uy*vx;
   if(theta<1e-6)continue;
   if(Math.PI-theta<1e-5||turnRadius<=0){this.line(start,b);start=b;continue;}
   const tangent=Math.min(turnRadius*Math.tan(theta/2),l1*.38,l2*.38,dist(start,b)*.8),radius=tangent/Math.tan(theta/2),sign=Math.sign(cross);
   const s={x:b.x-ux*tangent,y:b.y-uy*tangent},e={x:b.x+vx*tangent,y:b.y+vy*tangent};
   this.line(start,s);const center={x:s.x-uy*radius*sign,y:s.y+ux*radius*sign};
   const startAngle=Math.atan2(s.y-center.y,s.x-center.x),endAngle=startAngle+theta*sign,length=theta*radius;
   if(length>1e-7){this.segments.push({type:'ARC',length,start:s,end:e,center,radius,startAngle,endAngle,ccw:sign>0});this.totalLength+=length;}start=e;
  }
  this.line(start,points[points.length-1]);
  let offset=0;for(let i=0;i<this.segments.length-1;i++){const a=this.segments[i],b=this.segments[i+1];offset+=a.length;if(a.type==='LINE'&&b.type==='LINE'){const dot=((a.end.x-a.start.x)*(b.end.x-b.start.x)+(a.end.y-a.start.y)*(b.end.y-b.start.y))/(a.length*b.length);if(dot<-.9999)this.pivots.push(offset);}}
 }
 private line(a:Position,b:Position){const length=dist(a,b);if(length<1e-7)return;this.segments.push({type:'LINE',length,start:{...a},end:{...b}});this.totalLength+=length;}
 getPointAtDistance(distance:number):{position:Position;heading:number}{
  if(!this.segments.length)return{position:{...this.origin},heading:0};let d=Math.max(0,Math.min(this.totalLength,Number.isFinite(distance)?distance:0));
  for(let i=0;i<this.segments.length;i++){const s=this.segments[i];if(d<=s.length||i===this.segments.length-1){const t=Math.min(1,d/s.length);if(s.type==='LINE')return{position:{x:s.start.x+(s.end.x-s.start.x)*t,y:s.start.y+(s.end.y-s.start.y)*t},heading:Math.atan2(s.end.y-s.start.y,s.end.x-s.start.x)};const angle=s.startAngle!+(s.endAngle!-s.startAngle!)*t;return{position:{x:s.center!.x+s.radius!*Math.cos(angle),y:s.center!.y+s.radius!*Math.sin(angle)},heading:angle+(s.ccw?Math.PI/2:-Math.PI/2)};}d-=s.length;}
  return{position:{...this.origin},heading:0};
 }
}
