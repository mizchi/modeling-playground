import { Group, MeshStandardMaterial, DoubleSide, Raycaster, Vector3, Vector2, ShapeUtils } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { lowpolyParts, texturedGeometry, computeWeldedNormals } from '../modeling/lowpoly.mjs';
import { createAshleyAtlas, ASHLEY_TILES } from './ashley-texture.mjs';
import { FACE_ANATOMY, FACE_SECTIONS, facialPoint } from './ashley-face.mjs';
import { FACE_COLUMNS, createFaceTopology } from './ashley-topology.mjs';

export const ASHLEY=Object.freeze({atlasSize:256,triangleBudget:3200,forward:'+Z',height:2.03,occiputDepthScale:1.12,cranialWidthScale:.90});

function group(parent,name) {
  const node=new Group();node.name=name;node.userData.focusTarget=true;parent?.add(node);return node;
}

/** Static likeness study. Model geometry and its UV atlas share no DOM or Node I/O. */
export function createAshley() {
  const root=group(null,'Ashley Riot');
  root.userData={generator:'Three.js',groundLevel:0,study:'Vagrant Story / Ashley Riot',
    textureStyle:'hand-authored 256x256 nearest atlas',reference:'User-provided front, profile and back screenshots'};
  const material=new MeshStandardMaterial({name:'Ashley painted atlas',map:createAshleyAtlas(),
    color:'#ddd7cc',roughness:1,metalness:0,side:DoubleSide});
  const p=lowpolyParts(material,ASHLEY_TILES),body=group(root,'Body');

  const torso=p.loft(body,'ExposedTorso',[
    [1.01,.148,.108,-.025],[1.12,.135,.100,.020],[1.26,.170,.130,.007],
    [1.39,.228,.166,-.013],[1.47,.248,.137,-.011],[1.545,.096,.092,-.017],
  ],'back',{sides:12});
  const neck=p.loft(body,'Neck',[[1.545,.096,.092,-.017],
    [1.590,.066,.070,-.006],[1.644,.062,.069,-.002],[1.684,.069,.077,-.008]],'neck',{sides:12});
  joinNeckRoot(torso,neck);
  // The ivory front does not wrap around the open back.
  fittedBib(body,p,torso);
  const pelvis=makeTrouserRise(body,p);
  fittedCloth(body,p,pelvis,'IvoryLowerTab',[[.954,.030],[1.042,.063]],'ivoryHem',1);
  for(const [label,s] of [['Left',-1],['Right',1]]) {
    halterStrap(body,p,[torso,neck,body.getObjectByName('IvoryBib')],label+'HalterStrap',s);
  }
  fittedCloth(body,p,torso,'WhiteBackTriangle',[[1.145,.132],[1.205,.148],[1.29,.105],
    [1.36,.060],[1.415,.027],[1.43,.018]],'ivoryHem',-1);
  fittedCloth(body,p,torso,'BackCorset',[[1.015,.141],[1.075,.133],[1.145,.132]],'leather',-1);
  const spineStrap=[[0,1.558],[0,1.486],[0,1.43]];
  for(let i=0;i<spineStrap.length-1;i++)surfaceRibbon(body,p,[torso,neck,body.getObjectByName('WhiteBackTriangle')],
    'CentralBackStrap'+i,spineStrap[i],spineStrap[i+1],.017,'leather',.003);
  // Only the low back has leather lacing. Most of the shoulder blades stay bare.
  for(const s of [-1,1]) {
    surfaceRibbon(body,p,[torso,pelvis],`BackLaceUpper${s}`,[s*.12,1.140],[-s*.09,1.015],.022,'sole');
    surfaceRibbon(body,p,[torso,pelvis],`BackLaceLower${s}`,[s*.13,1.033],[-s*.035,.925],.017,'leather');
  }
  makeWaistBelt(body,p);

  for(const [label,s] of [['Left',-1],['Right',1]]) {
    const arm=group(root,label+'Arm');
    // Ring centers describe the relaxed A-pose directly, avoiding joint spheres.
    p.loft(arm,label+'UpperArm',[
      [1.177,.059,.063,.005,s*.317],[1.277,.068,.074,-.012,s*.292],
      [1.408,.082,.088,-.011,s*.257],[1.483,.070,.078,-.013,s*.227],
    ],'skin');
    p.loft(arm,label+'Gauntlet',[
      [.935,.063,.063,.034,s*.380],[1.020,.076,.074,.026,s*.363],
      [1.12,.083,.079,.011,s*.343],[1.223,.073,.071,0,s*.317],
    ],'steel');
    p.loft(arm,label+'ElbowCuff',[[1.181,.078,.076,0,s*.324],[1.217,.079,.077,0,s*.317]],'steel');
    p.loft(arm,label+'WristStrap',[[.937,.067,.067,.034,s*.379],[.972,.070,.068,.031,s*.371]],'leather');
    p.loft(arm,label+'GlovedHand',[
      [.826,.042,.052,.037,s*.394],[.852,.055,.057,.055,s*.390],
      [.915,.058,.061,.049,s*.383],[.952,.050,.053,.033,s*.378],
    ],'steel');
    p.box(arm,label+'Thumb',[s*.337,.886,.075],[.033,.071,.042],'steel').rotation.z=s*.20;

    const leg=group(root,label+'Leg');
    makeTrouserLeg(leg,p,label,s);
    p.loft(leg,label+'KneeGuard',[[.434,.065,.069,.022,s*.239],[.508,.076,.082,.019,s*.228],[.571,.073,.075,.010,s*.218]],'steel');
    p.loft(leg,label+'Boot',[
      [.103,.062,.067,.009,s*.283],[.205,.064,.066,.002,s*.276],
      [.325,.066,.070,0,s*.260],[.450,.063,.065,.010,s*.239],
    ],'boot');
    p.loft(leg,label+'BootFoot',[
      [.025,.078,.147,.070,s*.288],[.077,.081,.148,.070,s*.288],
      [.143,.064,.108,.036,s*.283],[.19,.054,.068,.004,s*.278],
    ],'boot');
    p.loft(leg,label+'Sole',[[0,.080,.149,.070,s*.288],[.031,.081,.151,.070,s*.288]],'sole');
    // Separate coat-like hip panels leave blue shorts and skin readable between.
    const points=[
      [s*.132,.719,.135],[s*.318,.806,.049],[s*.218,1.019,.080],
      [s*.104,1.043,.128],[s*.092,.914,.151],
    ];
    p.panel(root,label+'HipPanel',points,'leather',.022);
    const rear=p.panel(root,label+'RearHipPanel',points,'leather',.022);
    rear.rotation.y=Math.PI;rear.scale.x=-1;rear.position.z=-.020;
    p.bar(root,label+'ThighBinding',[s*.115,.751,.092],[s*.239,.702,.064],.025,.008,'belt');
  }

  const head=group(root,'Head');head.position.z=.020;
  makeFace(head,p);
  for(const [label,s] of [['Left',-1],['Right',1]]) {
    p.loft(head,label+'Ear',[[1.690,.012,.013,0,s*.119],[1.716,.023,.019,-.009,s*.127],
      [1.750,.023,.019,-.009,s*.127],[1.760,.014,.014,-.006,s*.120]],'ear',{sides:6});
  }
  const hair=group(head,'Hair');
  // Low cap rises at the forehead; cropped nape, swept temple locks.
  makeScalp(hair,p,head.getObjectByName('Face'));
  for(const [label,s] of [['Left',-1],['Right',1]]) {
    for(let i=0;i<3;i++)p.lock(hair,label+'SweptTemple'+i,
      [[s*.025,1.893-i*.012,-.015],[s*.108,1.839-i*.015,.005],
        [s*.122,1.793-i*.018,-.032],[s*.105,1.731-i*.011,-.068]],
      [.023,.033,.022],'hair',.012);
    p.lock(hair,label+'Sideburn',[[s*.118,1.8,.013],[s*.121,1.758,.016],[s*.107,1.721,.018]],
      [.019,.015],'hair',.010);
  }
  // Three readable flows: lifted root, a broad falling fringe, and a lock
  // swept diagonally into the temple. Keep these separate from the long rear
  // crown spikes; one zigzag tube could not describe all of these planes.
  p.lock(hair,'ForelockLift',[
    [-.050,1.870,.055],[-.044,1.932,.065],[-.020,1.915,.110],[.025,1.878,.128],
  ],[.028,.028,.024],'hair',.007);
  p.lock(hair,'ForelockDrop',[
    [-.022,1.915,.109],[.006,1.853,.125],[-.006,1.782,.122],
  ],[.029,.023],'hair',.006);
  p.lock(hair,'ForelockSideSweep',[
    [.008,1.878,.054],[.088,1.861,.034],[.125,1.772,.027],
  ],[.027,.025],'hair',.007);
  p.lock(hair,'CrownSpikeLeft',[
    [-.040,1.880,.018],[-.040,1.960,-.070],[-.100,1.955,-.190],[-.240,1.926,-.330],
  ],[.022,.015,.006],'hair',.008);
  p.lock(hair,'CrownSpikeRight',[
    [.035,1.880,-.020],[.095,1.986,-.035],[.055,2.025,-.145],[-.060,2.005,-.290],[-.150,1.990,-.390],
  ],[.025,.019,.012,.004],'hair',.008);
  // Keep modest rear-skull depth. Approved frontal coordinates and the long
  // crown spikes are unaffected by this rear-only proportion adjustment.
  head.traverse(node=>{
    if(!node.isMesh)return;
    const positions=node.geometry.attributes.position;
    for(let i=0;i<positions.count;i++) {
      if(node.name!=='Face')positions.setX(i,positions.getX(i)*ASHLEY.cranialWidthScale);
      if(!node.name.startsWith('CrownSpike')&&positions.getZ(i)<0)
        positions.setZ(i,positions.getZ(i)*ASHLEY.occiputDepthScale);
    }
    node.geometry.computeVertexNormals();
    if(node.name==='Face')computeWeldedNormals(node.geometry);
  });
  root.updateMatrixWorld(true);return root;
}

function makeWaistBelt(parent,p) {
  const bottom=1.039,top=1.090,sides=8,targets=parent.children.filter(o=>o.isMesh);
  parent.updateWorldMatrix(true,true);
  // Project every underlying triangle clipped to the belt's height range.
  // Supporting planes enclose all layers, including the diagonal back laces;
  // merely scaling an eight-sided ellipse left the twelve-sided torso exposed.
  const points=[];
  for(const mesh of targets) {
    const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;
    for(let i=0;i<(index?.count??position.count);i+=3) {
      const triangle=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      for(let j=0;j<3;j++) {
        const a=triangle[j],b=triangle[(j+1)%3];
        if(a.y>=bottom&&a.y<=top)points.push(a);
        for(const y of [bottom,top])if((a.y<y&&b.y>y)||(a.y>y&&b.y<y))points.push(a.clone().lerp(b,(y-a.y)/(b.y-a.y)));
      }
    }
  }
  const planes=Array.from({length:sides},(_,i)=>{
    const angle=(i+.5)/sides*Math.PI*2,x=Math.sin(angle),z=Math.cos(angle);
    const support=y=>Math.max(...points.filter(p=>Math.abs(p.y-y)<1e-6).map(p=>x*p.x+z*p.z));
    const lo=support(bottom),hi=support(top);
    const extra=Math.max(0,...points.map(p=>x*p.x+z*p.z-(lo+(hi-lo)*(p.y-bottom)/(top-bottom))))+.004;
    return {x,z,lo:lo+extra,hi:hi+extra};
  });
  const outlineAt=y=>planes.map((b,i)=>{
    const a=planes[(i+sides-1)%sides],det=a.x*b.z-b.x*a.z,t=(y-bottom)/(top-bottom);
    const da=a.lo+(a.hi-a.lo)*t,db=b.lo+(b.hi-b.lo)*t;
    return new Vector3((da*b.z-db*a.z)/det,y,(a.x*db-b.x*da)/det);
  });
  const positions=[],uvs=[],indices=[],ray=new Raycaster();
  for(const [y,inner] of [[bottom,true],[bottom,false],[top,false],[top,true]])for(let i=0;i<=sides;i++) {
    const point=outlineAt(y)[i%sides];
    if(inner) {
      const direction=new Vector3(point.x,0,point.z).normalize();
      ray.set(new Vector3(0,y,0).addScaledVector(direction,.5),direction.clone().negate());
      const hit=ray.intersectObjects(targets,false)[0];
      if(!hit)throw new Error('Belt inner edge missed waist');
      point.copy(hit.point).addScaledVector(direction,-.001);
    }
    positions.push(...point);uvs.push(...p.uv('waistLeather',i/sides,(y-bottom)/(top-bottom)));
  }
  // U-section: outer strap plus top/bottom thickness; no hidden interior wall.
  for(let row=0;row<3;row++)for(let i=0;i<sides;i++) {
    const a=row*(sides+1)+i,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);
  }
  p.add(parent,'WaistBelt',texturedGeometry(positions,uvs,indices));
  p.box(parent,'BeltBuckle',[0,(bottom+top)/2,outlineAt((bottom+top)/2)[0].z+.007],[.055,.038,.012],'waistBuckle');
}

function makeTrouserRise(parent,p) {
  // The front is the shared cloth rise, not a skin-colored box between two
  // independent leg tubes. Taper its underside into the crotch; retain the
  // reference's exposed rear lacing panel without exposing the front pelvis.
  const mesh=p.loft(parent,'Pelvis',[[.875,.050,.046,-.004],[.947,.150,.095,0],[1.042,.146,.101,0]],'skin',{sides:12});
  const geometry=mesh.geometry.toNonIndexed(),{position,uv}=geometry.attributes;
  const [ox,oy,w,h]=ASHLEY_TILES.skin;
  for(let i=0;i<position.count;i+=3) {
    if((position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3<0)continue;
    for(let j=0;j<3;j++) {
      const k=i+j,u=(uv.getX(k)*256-ox-.5)/(w-1),v=1-(uv.getY(k)*256-oy-.5)/(h-1);
      // The leg tile has a worn hem stripe at its bottom. The rise has no hem,
      // so sample above that stripe instead of painting a tan mark in the crotch.
      uv.setXY(k,...p.uv('cloth',Math.max(0,Math.min(1,u)),.12+.88*Math.max(0,Math.min(1,v))));
    }
  }
  // Keep face-specific UV islands and the original smooth normals; downstream
  // surface-fitted cloth consumes indexed triangles.
  mesh.geometry.dispose();mesh.geometry=mergeVertices(geometry);geometry.dispose();
  return mesh;
}

function makeTrouserLeg(parent,p,label,sign) {
  // Cut the original thigh at the garment edge; don't leave an independently
  // shaped skin mesh inside the shorts. Shared rings keep the seam exact.
  const t=(.673-.644)/(.801-.644);
  const inner=[.673,.087+(.095-.087)*t,.087+(.103-.087)*t,-.014*t,sign*(.200+(.157-.200)*t)];
  const outer=[inner[0],inner[1]+.009,inner[2]+.010,inner[3],inner[4]];
  p.loft(parent,label+'Thigh',[
    [.530,.070,.074,.005,sign*.218],[.644,.087,.087,0,sign*.200],inner,
  ],'skin',{capTop:false});
  p.loft(parent,label+'Shorts',[
    outer,[.801,.105,.113,-.014,sign*.157],[.995,.095,.108,-.013,sign*.097],
  ],'cloth',{capBottom:false});
  // An annulus gives the hem thickness without a disk cutting through the leg.
  const positions=[],uvs=[],indices=[],sides=8;
  for(const ring of [inner,outer])for(let i=0;i<=sides;i++) {
    const angle=i/sides*Math.PI*2;
    positions.push(ring[4]+ring[1]*Math.sin(angle),ring[0],ring[3]+ring[2]*Math.cos(angle));
    uvs.push(...p.uv('cloth',i/sides,ring===inner?.035:0));
  }
  for(let i=0;i<sides;i++) {
    const a=i,b=i+sides+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  p.add(parent,label+'ShortsHem',texturedGeometry(positions,uvs,indices));
}

function makeFace(parent,p) {
  const rows=FACE_SECTIONS,sx=FACE_COLUMNS,rings=[];
  const frontSegments=sx.length-1,rearSegments=8;
  for(const [y,rx,,,rear,sideRise,backRise] of rows) {
    const ring=sx.map(x=>facialPoint(x,y));
    for(let i=1;i<rearSegments;i++){
      const a=i/rearSegments*Math.PI;ring.push([rx*Math.cos(a),y+sideRise+(backRise-sideRise)*Math.sin(a),-rear*Math.sin(a)]);
    }
    rings.push(ring);
  }
  const positions=[],uvs=[],indices=[],n=rings[0].length;
  function triangle(points,coords,tile) {
    const offset=positions.length/3;
    points.forEach((point,i)=>{positions.push(...point);uvs.push(...p.uv(tile,...coords[i]));});indices.push(offset,offset+1,offset+2);
  }
  // The frontal skin uses feature loops. Only the hidden skull keeps sections.
  const topology=createFaceTopology();
  for(const ids of topology.triangles) {
    const coords=ids.map(i=>topology.points[i]);
    triangle(coords.map(([x,y])=>facialPoint(x,y)),coords.map(([x,y])=>
      [(x+1)/2,(y-FACE_ANATOMY.bottom)/(FACE_ANATOMY.top-FACE_ANATOMY.bottom)]),'face');
  }
  for(let row=0;row<rings.length-1;row++)for(let i=frontSegments;i<n;i++) {
    const j=(i+1)%n,a=rings[row][i],b=rings[row][j],c=rings[row+1][i],d=rings[row+1][j];
    const u0=(i-frontSegments)/rearSegments,u1=(i-frontSegments+1)/rearSegments;
    const v0=(rows[row][0]-rows[0][0])/(rows.at(-1)[0]-rows[0][0]);
    const v1=(rows[row+1][0]-rows[0][0])/(rows.at(-1)[0]-rows[0][0]);
    triangle([a,b,c],[[u0,v0],[u1,v0],[u0,v1]],'skin');
    triangle([b,d,c],[[u1,v0],[u1,v1],[u0,v1]],'skin');
  }
  for(const row of [0,rings.length-1])for(let i=0;i<n;i++) {
    const a=rings[row][i],b=rings[row][(i+1)%n],center=row?[0,rows[row][0],0]:[0,rows[row][0]+.022,-.006];
    triangle(row?[center,a,b]:[center,b,a],[[.5,.5],[.2,.2],[.8,.2]],'skin');
  }
  const geometry=texturedGeometry(positions,uvs,indices);geometry.deleteAttribute('normal');
  const smooth=mergeVertices(geometry);smooth.computeVertexNormals();geometry.dispose();
  const mesh=p.add(parent,'Face',smooth);
  mesh.userData.topology={version:1,features:topology.features.map(({name,loops})=>({name,rings:loops.map(loop=>loop.length)})),
    closedFeatureInteriors:true};
}

function filterTriangles(geometry,keep) {
  const pos=geometry.attributes.position,indices=[],center=new Vector3();
  for(let i=0;i<geometry.index.count;i+=3) {
    const triangle=[0,1,2].map(j=>geometry.index.getX(i+j));center.set(0,0,0);
    for(const id of triangle)center.add(new Vector3().fromBufferAttribute(pos,id));center.divideScalar(3);
    if(keep(center))indices.push(...triangle);
  }
  geometry.setIndex(indices);
}

function joinNeckRoot(torso,neck) {
  const height=1.545;
  filterTriangles(torso.geometry,center=>center.y<height-1e-6);
  filterTriangles(neck.geometry,center=>center.y>height+1e-6);
  const vertices=[];
  for(const mesh of [torso,neck]) {
    // Drop unused cap centers before computing normals, so no zero normals
    // survive export. Separate materials/UV islands retain coincident seams.
    const flat=mesh.geometry.toNonIndexed();flat.deleteAttribute('normal');
    mesh.geometry.dispose();mesh.geometry=mergeVertices(flat);flat.dispose();
    mesh.geometry.computeVertexNormals();
    const {position,normal}=mesh.geometry.attributes;
    for(let i=0;i<position.count;i++)if(Math.abs(position.getY(i)-height)<1e-6)
      vertices.push({point:new Vector3().fromBufferAttribute(position,i),normal,index:i});
  }
  const sums=vertices.map(vertex=>vertices.filter(other=>other.point.distanceTo(vertex.point)<1e-6)
    .reduce((sum,other)=>sum.add(new Vector3().fromBufferAttribute(other.normal,other.index)),new Vector3()).normalize());
  vertices.forEach((vertex,i)=>vertex.normal.setXYZ(vertex.index,...sums[i]));
}

function fittedBib(parent,p,torso) {
  fittedCloth(parent,p,torso,'IvoryBib',[[1.035,.094],[1.12,.102],[1.19,.109],[1.26,.126],[1.39,.153],
    [1.454,.131],[1.47,.104],[1.503,.041]],'bib',1);
}

function fittedCloth(parent,p,torso,name,outline,tile,direction) {
  // Clip the cloth outline against the ACTUAL torso triangles. Projecting only
  // grid vertices can still cross a crease between them, especially at the waist.
  const boundary=[...outline.map(([y,w])=>new Vector2(w,y)),
    ...outline.toReversed().map(([y,w])=>new Vector2(-w,y))];
  const masks=ShapeUtils.triangulateShape(boundary,[]).map(ids=>ids.map(i=>boundary[i]));
  const positions=[],uvs=[],source=torso.geometry,attribute=source.attributes.position;
  const signed=(a,b,q)=>(b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x);
  const clip=(polygon,a,b,orientation)=>{
    const result=[];
    for(let i=0;i<polygon.length;i++) {
      const from=polygon[i],to=polygon[(i+1)%polygon.length];
      const f=orientation*signed(a,b,from),t=orientation*signed(a,b,to);
      if(f>=0)result.push(from);
      if((f>=0)!==(t>=0))result.push(from.clone().lerp(to,f/(f-t)));
    }
    return result;
  };
  const widthAt=y=>{
    const index=Math.max(0,Math.min(outline.length-2,outline.findIndex(row=>row[0]>=y)-1));
    const [y0,w0]=outline[index],[y1,w1]=outline[index+1];
    return w0+(w1-w0)*Math.max(0,Math.min(1,(y-y0)/(y1-y0)));
  };
  for(let i=0;i<source.index.count;i+=3) {
    const triangle=[0,1,2].map(j=>new Vector3().fromBufferAttribute(attribute,source.index.getX(i+j)));
    if(direction*signed(...triangle)<1e-10)continue;
    for(const mask of masks) {
      const orientation=Math.sign(signed(...mask));let polygon=triangle;
      for(let j=0;j<3&&polygon.length;j++)polygon=clip(polygon,mask[j],mask[(j+1)%3],orientation);
      for(let j=1;j<polygon.length-1;j++) {
        const tri=[polygon[0],polygon[j],polygon[j+1]].map(point=>new Vector3(...point.toArray().map(Math.fround)));
        // Discard slivers AFTER float32 rounding; tiny intersections at matching
        // ring heights otherwise collapse during BufferAttribute construction.
        if(Math.abs(signed(...tri))<1e-8)continue;
        for(const point of tri) {
          positions.push(point.x,point.y,point.z+direction*.005);
          const u=Math.max(0,Math.min(1,.5+point.x/(2*widthAt(point.y))));
          const v=Math.max(0,Math.min(1,(point.y-outline[0][0])/(outline.at(-1)[0]-outline[0][0])));
          uvs.push(...p.uv(tile,direction>0?u:1-u,v));
        }
      }
    }
  }
  p.add(parent,name,texturedGeometry(positions,uvs));
}

function makeScalp(parent,p,face) {
  const hairline=[
    [0,1.806,.092],[.065,1.811,.076],[.108,1.785,.037],[.128,1.755,-.023],
    [.092,1.714,-.087],[.043,1.686,-.108],[0,1.665,-.095],
    [-.043,1.686,-.108],[-.092,1.714,-.087],[-.128,1.755,-.023],[-.108,1.785,.037],[-.065,1.811,.076],
  ];
  const rings=[hairline];
  for(const [y,rx,rz,cz] of [[1.823,.127,.120,-.024],[1.866,.110,.105,-.031],
    [1.893,.067,.073,-.034],[1.903,.023,.027,-.029]]) {
    rings.push(Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return [rx*Math.sin(a),y,cz+rz*Math.cos(a)];}));
  }
  // A supporting row follows the occipital curve; shrinking only the endpoints
  // would pull their long chord through the skull at the middle of the nape.
  rings.splice(1,0,hairline.map((point,i)=>point.map((value,axis)=>(value+rings[1][i][axis])*.5)));
  // Fit the front cap to the finished face contour. Query at the final hair
  // width so the later shared head-width adjustment cannot uncover the skin.
  face.updateWorldMatrix(true,false);
  const ray=new Raycaster(),direction=new Vector3(0,0,-1).transformDirection(face.matrixWorld);
  for(const ring of rings)for(const point of ring)if(point[2]>=0) {
    ray.set(face.localToWorld(new Vector3(point[0]*ASHLEY.cranialWidthScale,point[1],1)),direction);
    const hit=ray.intersectObject(face)[0];
    // Clearance also covers the chord between coarse cap vertices.
    if(hit)point[2]=Math.max(point[2],face.worldToLocal(hit.point.clone()).z+.012);
  } else {
    // Reduce the rear cap independently of the skull, while preserving skin
    // coverage. Upper crown points above the skull use the same compact profile.
    point[2]*=.85;
    ray.set(face.localToWorld(new Vector3(point[0]*ASHLEY.cranialWidthScale,point[1],-1)),direction.clone().negate());
    const hit=ray.intersectObject(face)[0];
    if(hit)point[2]=Math.min(point[2],face.worldToLocal(hit.point.clone()).z-.012);
  }
  const positions=[],uvs=[],indices=[];
  for(let row=0;row<rings.length;row++)for(let i=0;i<=12;i++) {
    positions.push(...rings[row][i%12]);
    // Rotate the cap's UV direction: painted strands sweep sideways and down
    // the nape, while the separate forelocks retain longitudinal highlights.
    uvs.push(...p.uv('hair',row/(rings.length-1),i/12));
    if(row&&i<12){const b=row*13+i,a=b-13;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const center=positions.length/3;positions.push(0,1.904,-.029);uvs.push(...p.uv('hair',1,.5));
  const lastRow=(rings.length-1)*13;
  for(let i=0;i<12;i++)indices.push(center,lastRow+i,lastRow+i+1);
  // One fitted boundary vertex per temple prevents a long straight hairline
  // edge from cutting across the forehead's curved surface.
  for(const a of [1,10]) {
    const point=new Vector3(...hairline[a]).lerp(new Vector3(...hairline[a+1]),.5);
    ray.set(face.localToWorld(new Vector3(point.x*ASHLEY.cranialWidthScale,point.y,1)),direction);
    const hit=ray.intersectObject(face)[0];
    if(hit)point.z=Math.max(point.z,face.worldToLocal(hit.point.clone()).z+.012);
    const middle=positions.length/3;positions.push(...point);uvs.push(...p.uv('hair',0,(a+.5)/12));
    const triangle=indices.findIndex((v,i)=>i%3===0&&v===a&&indices[i+1]===a+1&&indices[i+2]===a+13);
    if(triangle<0)throw new Error('Missing temple hairline triangle');
    indices.splice(triangle,3,a,middle,a+13,middle,a+1,a+13);
  }
  const cap=p.add(parent,'HairCap',texturedGeometry(positions,uvs,indices));cap.updateWorldMatrix(true,false);
  for(const s of [-1,1]) {
    const points=[[s*.083,1.791,-.108],[s*.065,1.734,-.099],[s*.034,1.693,-.084]];
    for(const point of points) {
      ray.set(cap.localToWorld(new Vector3(point[0],point[1],-1)),direction.clone().negate());
      const hit=ray.intersectObject(cap)[0];
      if(hit)point[2]=cap.worldToLocal(hit.point.clone()).z-.003;
    }
    p.lock(parent,`NapeSweep${s}`,points,[.012,.010],'hair',.004);
  }
}

/** Continuous surface-fitted route from the front bib around either neck side. */
function halterStrap(parent,p,targets,name,sign) {
  for(const target of targets)target.updateWorldMatrix(true,false);
  const route=[[1.497,.26],[1.549,.70],[1.590,1.45],[1.580,2.30],[1.558,Math.PI]];
  const ray=new Raycaster(),project=point=>{
    const outward=new Vector3(point.x,0,point.z).normalize();
    ray.set(new Vector3(outward.x,point.y,outward.z),outward.clone().negate());
    const hit=ray.intersectObjects(targets,false)[0];
    if(!hit)throw new Error(`${name} missed its attachment surface`);
    return hit.point.clone().addScaledVector(outward,.003);
  };
  const centers=[];
  for(let segment=0;segment<route.length-1;segment++)for(let step=0;step<5;step++) {
    const t=step/5,a=route[segment],b=route[segment+1],y=a[0]+(b[0]-a[0])*t,angle=sign*(a[1]+(b[1]-a[1])*t);
    centers.push(project(new Vector3(Math.sin(angle),y,Math.cos(angle))));
  }
  centers.push(project(new Vector3(0,route.at(-1)[0],-1)));
  const positions=[],uvs=[],indices=[];
  for(let row=0;row<centers.length;row++) {
    const center=centers[row],tangent=centers[Math.min(row+1,centers.length-1)].clone().sub(centers[Math.max(0,row-1)]).normalize();
    const outward=new Vector3(center.x,0,center.z).normalize(),across=new Vector3().crossVectors(outward,tangent).normalize();
    for(let side=0;side<2;side++) {
      const point=project(center.clone().addScaledVector(across,(side-.5)*.012));
      positions.push(...point);uvs.push(...p.uv('leather',side,row/(centers.length-1)));
    }
    if(row){const a=(row-1)*2,b=row*2;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  p.add(parent,name,texturedGeometry(positions,uvs,indices));
}

function surfaceRibbon(parent,p,targets,name,a,b,width,tile,clearance=.014) {
  for(const target of targets)target.updateMatrixWorld(true);
  const start=new Vector2(...a),end=new Vector2(...b),tangent=end.clone().sub(start).normalize();
  const normal=new Vector2(-tangent.y,tangent.x),positions=[],uvs=[],indices=[],ray=new Raycaster();
  for(let row=0;row<=6;row++)for(let side=0;side<2;side++) {
    const point=start.clone().lerp(end,row/6).addScaledVector(normal,(side-.5)*width);
    ray.set(new Vector3(point.x,point.y,-1),new Vector3(0,0,1));
    const hit=ray.intersectObjects(targets,false)[0];if(!hit)throw new Error(`${name} missed body`);
    positions.push(point.x,point.y,hit.point.z-clearance);uvs.push(...p.uv(tile,side,row/6));
    if(row&&side===0){const b=row*2,a=b-2;indices.push(b,a+1,a,b,b+1,a+1);}
  }
  p.add(parent,name,texturedGeometry(positions,uvs,indices));
}
