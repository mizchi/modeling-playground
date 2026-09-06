import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STAGE } from './stage.ts';
import type { Solid, Vec3 } from './types.ts';

function Box({position,size,color,metalness=.15}:{position:Vec3;size:Vec3;color:string;metalness?:number}) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.78} metalness={metalness}/></mesh>;
}

function Structure({solid:s}: {solid:Solid}) {
  const [w,h,d]=s.size;
  return <group position={s.center}>
    <Box position={[0,0,0]} size={s.size} color={s.color}/>
    {s.kind==='warehouse'&&<>
      <Box position={[0,h/2+.22,0]} size={[w+.8,.44,d+.8]} color="#35434a"/>
      <Box position={[0,-h*.15,d/2+.035]} size={[w*.55,h*.60,.07]} color="#293a43"/>
      {Array.from({length:7},(_,i)=><Box key={i} position={[0,-h*.43+i*h*.09,d/2+.09]} size={[w*.56,.055,.06]} color="#617077"/>)}
      {[-1,1].map(side=><group key={side}>
        <Box position={[side*w*.30,-h*.15,d/2+.15]} size={[.3,h*.64,.3]} color="#d1a54d"/>
        <mesh position={[side*w*.35,h/2+.55,0]} rotation={[Math.PI/2,0,0]} castShadow>
          <cylinderGeometry args={[.4,.4,d*.9,12]}/><meshStandardMaterial color="#9ca8ac" metalness={.6} roughness={.55}/>
        </mesh>
      </group>)}
      <Box position={[0,h*.22,d/2+.16]} size={[w*.7,.16,.2]} color="#cfb773"/>
    </>}
    {s.kind==='container'&&<>
      {Array.from({length:12},(_,i)=><Box key={i} position={[0,0,-d/2+.3+i*(d-.6)/11]} size={[w+.12,h+.08,.09]} color={s.color}/>)}
      <Box position={[0,h/2+.02,0]} size={[w+.1,.12,d+.15]} color="#303d41"/>
      <Box position={[0,0,d/2+.08]} size={[.06,h,.09]} color="#c2b695"/>
    </>}
    {s.kind==='barrier'&&Array.from({length:8},(_,i)=><Box key={i} position={[-w/2+.6+i*(w-1.2)/7,h*.24,-d/2-.04]} size={[.65,.55,.08]} color={i%2?'#252e32':'#d4ae58'}/>)}
    {s.kind==='tower'&&<>
      <Box position={[0,h/2+.3,0]} size={[w+1,.6,d+1]} color="#31454c"/>
      {[0,1,2,3].map(i=><Box key={i} position={[0,-h*.3+i*h*.18,d/2+.07]} size={[w*.75,.65,.15]} color="#34464e"/>)}
      <mesh position={[0,h/2+.8,0]}><sphereGeometry args={[.22,8,8]}/><meshBasicMaterial color="#ee7849"/></mesh>
    </>}
    {s.kind==='wall'&&<Box position={[0,h/2+.15,0]} size={[w+.2,.3,d+.2]} color="#35494f"/>}
  </group>;
}

function Environment() {
  const {gl,scene}=useThree();
  useEffect(()=>{
    const generator=new PMREMGenerator(gl),room=new RoomEnvironment(),environment=generator.fromScene(room,.04);
    scene.environment=environment.texture;scene.environmentIntensity=.55;
    room.dispose();generator.dispose();
    return ()=>{scene.environment=null;environment.dispose();};
  },[gl,scene]);
  return null;
}

export function Stage() {
  const {bounds}=STAGE,width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;
  const centerZ=(bounds.minZ+bounds.maxZ)/2;
  return <>
    <color attach="background" args={['#a4b3bd']}/><fog attach="fog" args={['#a4b3bd',65,180]}/>
    <Environment/>
    <hemisphereLight args={['#e1edff','#465154',1.3]}/>
    <directionalLight position={[-35,65,-25]} intensity={3.2} color="#fff0d7" castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-65} shadow-camera-right={65}
      shadow-camera-top={65} shadow-camera-bottom={-65} shadow-camera-far={180} shadow-normalBias={.04}/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[650,650]}/><meshStandardMaterial color="#46555c" roughness={.95}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.008,centerZ]} receiveShadow><planeGeometry args={[width,depth]}/><meshStandardMaterial color="#566269" roughness={.95}/></mesh>
    {Array.from({length:11},(_,i)=><group key={i}>
      <Box position={[bounds.minX+i*width/10,.015,centerZ]} size={[.055,.015,depth]} color="#435158"/>
      <Box position={[0,.015,bounds.minZ+i*depth/10]} size={[width,.015,.055]} color="#435158"/>
    </group>)}
    {Array.from({length:20},(_,i)=><group key={i}>
      <Box position={[-6.5,.025,-46+i*5]} size={[.13,.025,2.2]} color="#bfa064"/>
      <Box position={[6.5,.025,-46+i*5]} size={[.13,.025,2.2]} color="#bfa064"/>
    </group>)}
    <mesh position={[0,.04,-36]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[5.4,5.58,64]}/><meshStandardMaterial color="#d5b570"/></mesh>
    <Box position={[0,.035,-42]} size={[10,.035,.18]} color="#d5b570"/>
    {STAGE.solids.map(s=><Structure key={s.id} solid={s}/>)}
    {Array.from({length:10},(_,i)=><Box key={i} position={[-100+i*22,18+i%3*8,95+(i%2)*15]} size={[12,36+i%3*16,16]} color="#73858e"/>)}
    {[-1,1].flatMap(side=>[-32,12,42].map(z=><group key={`${side}/${z}`} position={[side*43,0,z]}>
      <Box position={[0,4,0]} size={[.18,8,.18]} color="#283940"/>
      <Box position={[-side*.9,8,0]} size={[2,.13,.4]} color="#aabdc2"/>
      <mesh position={[-side*1.5,7.9,0]}><boxGeometry args={[.7,.06,.25]}/><meshBasicMaterial color="#c6f2f5"/></mesh>
    </group>))}
  </>;
}
