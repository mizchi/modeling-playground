import { ShapeUtils, Vector2 } from 'three';
import { FACE_SECTIONS, FACE_ANATOMY, EYE_SURFACE } from './ashley-face.mjs';

export const FACE_COLUMNS=Object.freeze([-1,-.90,-.78,-.45,-.20,0,.20,.45,.78,.90,1]);

/** @typedef {{name: string, loops: number[][], center?: number}} FacialFeature */
/** @typedef {{points: number[][], quads: number[][], triangles: number[][], features: FacialFeature[]}} FaceTopology */

/**
 * Authoring contract: points are [normalized X, anatomical Y]; all polygons
 * wind toward +Z. Feature loops index actual shared vertices, not overlays.
 * Quad strips surround the painted eyes/mouth; their closed interiors and
 * export are triangulated. This static study has no eyelid or mouth cavity.
 * @returns {FaceTopology}
 */
export function createFaceTopology() {
  const points=[],quads=[],triangles=[],features=[],columns=FACE_COLUMNS.length;
  const grid=FACE_SECTIONS.map(([y])=>FACE_COLUMNS.map(x=>{points.push([x,y]);return points.length-1;}));
  const column=x=>FACE_COLUMNS.indexOf(x);
  const patches=[
    {name:'leftEye',ocular:true,x0:column(-.78),x1:column(0),y0:5,y1:8,cx:-EYE_SURFACE.centerX,cy:EYE_SURFACE.centerY,radii:[EYE_SURFACE.outerRadii,EYE_SURFACE.innerRadii]},
    {name:'rightEye',ocular:true,x0:column(0),x1:column(.78),y0:5,y1:8,cx:EYE_SURFACE.centerX,cy:EYE_SURFACE.centerY,radii:[EYE_SURFACE.outerRadii,EYE_SURFACE.innerRadii]},
    {name:'mouth',x0:column(-.45),x1:column(.45),y0:1,y1:3,cx:0,cy:FACE_ANATOMY.mouthY-.003,radii:[[.35,.017],[.26,.006]]},
  ];
  const quad=(a,b,c,d)=>{quads.push([a,b,c,d]);triangles.push([a,b,c],[a,c,d]);};
  for(let row=0;row<grid.length-1;row++)for(let column=0;column<columns-1;column++) {
    if(patches.some(p=>column>=p.x0&&column<p.x1&&row>=p.y0&&row<p.y1))continue;
    quad(grid[row][column],grid[row][column+1],grid[row+1][column+1],grid[row+1][column]);
  }
  for(const patch of patches) {
    const {name,x0,x1,y0,y1,cx,cy,radii}=patch,boundary=[];
    for(let x=x0;x<x1;x++)boundary.push(grid[y0][x]);
    for(let y=y0;y<y1;y++)boundary.push(grid[y][x1]);
    for(let x=x1;x>x0;x--)boundary.push(grid[y1][x]);
    for(let y=y1;y>y0;y--)boundary.push(grid[y][x0]);
    // Normalize the two axes before taking angles: facial X is dimensionless,
    // whereas Y is in meters. Preserve radial ordering across the patch.
    const angles=boundary.map(id=>Math.atan2((points[id][1]-cy)/radii[0][1],(points[id][0]-cx)/radii[0][0]));
    const loops=[];let outer=boundary;
    for(const [rx,ry] of radii) {
      const inner=angles.map(angle=>{
        points.push([cx+rx*Math.cos(angle),cy+ry*Math.sin(angle)]);return points.length-1;
      });
      for(let i=0;i<outer.length;i++) {
        const next=(i+1)%outer.length;quad(outer[i],outer[next],inner[next],inner[i]);
      }
      loops.push(inner);outer=inner;
    }
    if(patch.ocular) {
      // Sample the convex ocular apex; a boundary-only cap cannot represent it.
      const center=points.length;points.push([cx,cy]);
      for(let i=0;i<outer.length;i++)triangles.push([center,outer[i],outer[(i+1)%outer.length]]);
      features.push({name,loops,center});
    } else {
      const polygon=outer.map(id=>new Vector2(...points[id]));
      for(const triangle of ShapeUtils.triangulateShape(polygon,[]))triangles.push(triangle.map(i=>outer[i]));
      features.push({name,loops});
    }
  }
  // Removed grid cells must not leave orphan authoring vertices behind.
  const used=[...new Set(triangles.flat())].sort((a,b)=>a-b),remap=new Map(used.map((id,i)=>[id,i]));
  const indices=ids=>ids.map(id=>remap.get(id));
  return {points:used.map(id=>points[id]),quads:quads.map(indices),triangles:triangles.map(indices),
    features:features.map(({name,loops,center})=>({name,loops:loops.map(indices),
      ...(center===undefined?{}:{center:remap.get(center)})}))};
}
