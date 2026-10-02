import {assert,importTs} from './simulation-harness.mjs';
const {MotionPath}=await importTs('src/simulation/motionPath.ts');
for(const degrees of [45,90,135,-45,-90,-135]){
 const radians=degrees*Math.PI/180,p=new MotionPath([{x:0,y:0},{x:5,y:0},{x:5+Math.cos(radians)*5,y:Math.sin(radians)*5}],.8),arc=p.segments.find(s=>s.type==='ARC');
 assert(arc&&Math.abs(arc.length/arc.radius-Math.abs(radians))<1e-6,'Incorrect fillet '+degrees);
 let old=p.getPointAtDistance(0);for(let i=1;i<=1000;i++){const q=p.getPointAtDistance(p.totalLength*i/1000),d=Math.hypot(q.position.x-old.position.x,q.position.y-old.position.y);assert(d<=p.totalLength/1000+1e-5,'Position discontinuity '+degrees);const turn=Math.atan2(Math.sin(q.heading-old.heading),Math.cos(q.heading-old.heading));assert(Math.abs(turn)<.1,'Tangent discontinuity '+degrees);old=q;}
}
for(const points of [[],[{x:3,y:4}],[{x:3,y:4},{x:3,y:4}],[{x:0,y:0},{x:2,y:0},{x:0,y:0}]]){const p=new MotionPath(points);for(const d of [-1,0,p.totalLength/2,p.totalLength+1]){const q=p.getPointAtDistance(d);assert(Number.isFinite(q.position.x)&&Number.isFinite(q.position.y)&&Number.isFinite(q.heading),'Degenerate pose');}if(points.length===3)assert(Math.abs(p.totalLength-4)<1e-8,'U-turn was removed');}
console.log('MOTION_VERIFICATION_OK: arbitrary corners, position/tangent continuity, degenerate paths and U-turn preservation');
