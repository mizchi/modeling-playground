import * as T from 'three';

// A deterministic painted-metal finish, not baked lighting. It works in both
// Node export and the live browser assembler without DOM/canvas dependencies.
function paintMap() {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const hash=((x*73856093)^(y*19349663))>>>0;
    const grain=hash%13,chip=hash%491===0;
    const value=chip?144:235+grain;
    const i=(y*size+x)*4;data.set([value,value,value,255],i);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;return texture;
}

/** Each replaceable module owns its materials/textures. Geometry is shared only
 * within that module, so disposal of one part can never invalidate another. */
export function createKit(root) {
  let serial=0;
  const cache=new Map(),map=paintMap();
  const material=(color,metalness=.45,roughness=.65,extra={})=>new T.MeshStandardMaterial({color,metalness,roughness,...extra});
  const m={
    armor:material('#626653',.48,.71,{map}),light:material('#7a7c67',.42,.66,{map}),
    dark:material('#373d35',.5,.72,{map}),frame:material('#252c2b',.68,.58),
    steel:material('#92958c',.78,.35),rubber:material('#171d1b',.05,.94),
    black:material('#090f0f',.2,.8),brass:material('#a18b57',.64,.5),
    white:material('#cecaba',.2,.76),orange:material('#b56e35',.4,.62),
    lens:material('#c5482e',.4,.25,{emissive:'#df4520',emissiveIntensity:1.7}),
  };
  function geometry(key,build){if(!cache.has(key))cache.set(key,build());return cache.get(key);}
  function mesh(name,g,mat,at=[0,0,0],rotation=[0,0,0],parent=root) {
    const node=new T.Mesh(g,mat);node.name=`${root.name}_${name}_${serial++}`;
    node.position.set(...at);node.rotation.set(...rotation);node.castShadow=node.receiveShadow=true;parent.add(node);return node;
  }
  function box(name,at,size,mat=m.armor,rotation=[0,0,0],parent=root) {
    const [w,h,d]=size,b=Math.min(.045,w*.12,h*.12,d*.12);
    const g=geometry(`box/${size}`,()=>{
      const shape=new T.Shape(),x=w/2-b,y=h/2-b,c=Math.min(w,h)*.11;
      shape.moveTo(-x+c,-y);shape.lineTo(x-c,-y);shape.lineTo(x,-y+c);shape.lineTo(x,y-c);
      shape.lineTo(x-c,y);shape.lineTo(-x+c,y);shape.lineTo(-x,y-c);shape.lineTo(-x,-y+c);shape.closePath();
      const geo=new T.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:b,bevelThickness:b});
      geo.translate(0,0,-d/2+b);return geo;
    });
    return mesh(name,g,mat,at,rotation,parent);
  }
  function rod(name,a,b,r,mat=m.steel,r2=r,sides=12,parent=root) {
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),length=av.distanceTo(bv);
    const g=geometry(`rod/${r}/${r2}/${length.toFixed(6)}/${sides}`,()=>new T.CylinderGeometry(r2,r,length,sides));
    const n=mesh(name,g,mat,av.clone().add(bv).multiplyScalar(.5).toArray(),[0,0,0],parent);
    n.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return n;
  }
  // Hard-edged armor with independently authored cross sections. Varying width,
  // depth and center creates a real glacis rather than a decorated cuboid.
  function hull(name,rings,mat=m.armor,parent=root) {
    const positions=[],indices=[];
    for(const [y,w,d,z=0] of rings) {
      const c=Math.min(w,d)*.19;
      for(const [x,zz] of [[-w/2+c,-d/2],[w/2-c,-d/2],[w/2,-d/2+c],[w/2,d/2-c],
        [w/2-c,d/2],[-w/2+c,d/2],[-w/2,d/2-c],[-w/2,-d/2+c]])positions.push(x,y,zz+z);
    }
    for(let row=1;row<rings.length;row++)for(let i=0;i<8;i++) {
      const a=(row-1)*8+i,b=(row-1)*8+(i+1)%8,c=row*8+i,d=row*8+(i+1)%8;
      indices.push(a,c,b,b,c,d);
    }
    for(let i=1;i<7;i++){indices.push(0,i,i+1);const top=(rings.length-1)*8;indices.push(top,top+i+1,top+i);}
    const indexed=new T.BufferGeometry();indexed.setAttribute('position',new T.Float32BufferAttribute(positions,3));indexed.setIndex(indices);
    const geo=indexed.toNonIndexed();indexed.dispose();geo.computeVertexNormals();
    const uv=[],p=geo.attributes.position,n=geo.attributes.normal;
    for(let i=0;i<p.count;i++) {
      const axis=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
      if(axis[1]>axis[0] && axis[1]>axis[2])uv.push(p.getX(i),p.getZ(i));
      else if(axis[0]>axis[2])uv.push(p.getZ(i),p.getY(i));
      else uv.push(p.getX(i),p.getY(i));
    }
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    return mesh(name,geo,mat,[0,0,0],[0,0,0],parent);
  }
  function bolt(at,parent=root) {return rod('bolt',[at[0],at[1],at[2]-.018],[at[0],at[1],at[2]+.018],.025,m.steel,.025,6,parent);}
  function vent(name,at,w,h,parent=root) {
    box(name+'_recess',at,[w,h,.035],m.black,[0,0,0],parent);
    const count=Math.max(3,Math.round(h/.075));
    for(let i=0;i<count;i++)box(name+'_louver',[at[0],at[1]-h*.4+i*h*.8/(count-1),at[2]+.028],[w*.90,.025,.06],m.frame,[.2,0,0],parent);
  }
  function barrel(name,at,r,length,parent=root) {
    const [x,y,z]=at;
    rod(name+'_jacket',[x,y,z],[x,y,z+length*.70],r*1.3,m.frame,r*1.16,12,parent);
    rod(name+'_tube',[x,y,z+length*.68],[x,y,z+length-.07],r,m.steel,r,12,parent);
    for(const f of [.18,.55,.86])rod(name+'_collar',[x,y,z+length*f],[x,y,z+length*f+.055],r*1.32,m.dark,r*1.32,12,parent);
    const ring=geometry(`ring/${r}`,()=>new T.RingGeometry(r*.65,r*1.16,12));
    mesh(name+'_muzzle',ring,m.steel,[x,y,z+length],[0,0,0],parent);
    const tube=geometry(`open/${r}`,()=>new T.CylinderGeometry(r*1.16,r*1.16,.10,12,1,true));
    mesh(name+'_muzzle_wall',tube,m.frame,[x,y,z+length-.05],[Math.PI/2,0,0],parent);
    const bore=geometry(`bore/${r}`,()=>new T.CircleGeometry(r*.96,12));
    mesh(name+'_bore',bore,m.black,[x,y,z+length-.065],[0,0,0],parent);
  }
  // A tiny actual pixel stencil; alpha only at glyph boundaries, no font/network dependency.
  function stencil(text,at,width,rotation=[0,0,0],parent=root) {
    const glyphs={
      '0':['111','101','101','101','111'],'6':['111','100','111','101','111'],
      '1':['010','110','010','010','111'],'2':['111','001','111','100','111'],
      B:['110','101','110','101','110'],S:['111','100','111','001','111'],
      T:['111','010','010','010','010'],'-':['000','000','111','000','000'],
    };
    const w=text.length*4-1,data=new Uint8Array(w*5*4);
    [...text].forEach((char,c)=>glyphs[char]?.forEach((row,y)=>[...row].forEach((pixel,x)=>{
      if(pixel==='1')data.set([206,202,184,255],(y*w+c*4+x)*4);
    })));
    const texture=new T.DataTexture(data,w,5,T.RGBAFormat);texture.flipY=true;texture.colorSpace=T.SRGBColorSpace;
    texture.magFilter=T.NearestFilter;texture.minFilter=T.NearestFilter;texture.needsUpdate=true;
    const mat=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.5,roughness:.8,metalness:.1});
    return mesh('stencil_'+text,new T.PlaneGeometry(width,width*5/w),mat,at,rotation,parent);
  }
  function hose(name,points,r=.04,parent=root) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return mesh(name,new T.TubeGeometry(curve,16,r,6,false),m.rubber,[0,0,0],[0,0,0],parent);
  }
  return {m,box,hull,rod,bolt,vent,barrel,stencil,hose};
}
