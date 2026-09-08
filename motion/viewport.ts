import { Scene, Color, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight, GridHelper, Vector3, Euler, SkeletonHelper, ACESFilmicToneMapping } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHuman, disposeHuman } from '../human/model.ts';
import type { HumanRecipe } from '../human/contract.ts';
import { humanFraming } from '../human/framing.ts';
import { IKEditor } from '../viewer/ik-editor.ts';
import { applyPose, capturePose, createMotionRig } from './rig.ts';
import type { MotionRig } from './rig.ts';
import type { BodyBone, MotionPose, Vec3 } from './contract.ts';
import { BODY_BONES } from './contract.ts';

/** Three/DOM objects never enter project JSON or undo history. */
export class MotionViewport {
  scene=new Scene(); camera=new PerspectiveCamera(35,1,.01,100); renderer: WebGLRenderer;
  orbit: OrbitControls; rig!: MotionRig; handles!: IKEditor; helper!: SkeletonHelper;
  element: HTMLElement; resize: ResizeObserver; frame=0; last=0; disposed=false; editable=true; view='quarter';
  onPose: (pose: MotionPose,target?: string)=>void=()=>{};
  onTick: (delta: number)=>void=()=>{};
  constructor(element: HTMLElement,recipe: HumanRecipe){
    this.element=element;this.scene.background=new Color('#e8e9e2');
    this.renderer=new WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.toneMapping=ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.domElement.setAttribute('aria-label','モーションの3Dプレビュー');element.append(this.renderer.domElement);
    this.scene.add(new HemisphereLight(0xffffff,0x82948c,2.6));
    const light=new DirectionalLight(0xfff7e8,2.5);light.position.set(2,4,3);this.scene.add(light);
    const fill=new DirectionalLight(0xc7dbef,1.3);fill.position.set(-3,2,-2);this.scene.add(fill);
    this.scene.add(new GridHelper(6,30,0x9ea99f,0xcbd2c6));
    this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.enableDamping=true;this.orbit.minDistance=.5;this.orbit.maxDistance=15;
    this.setRecipe(recipe);
    this.resize=new ResizeObserver(()=>{
      const {width,height}=element.getBoundingClientRect();if(!width||!height)return;
      const oldAspect=this.camera.aspect;
      this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
      const ratio=Math.max(1,1/this.camera.aspect)/Math.max(1,1/oldAspect);
      this.camera.position.sub(this.orbit.target).multiplyScalar(ratio).add(this.orbit.target);this.orbit.update();
    });this.resize.observe(element);
    const render=(now: number)=>{
      if(this.disposed)return;const dt=this.last?Math.min((now-this.last)/1000,.1):0;this.last=now;
      this.onTick(dt);this.orbit.update();this.handles.update();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(render);
    };this.frame=requestAnimationFrame(render);
  }
  setRecipe(recipe: HumanRecipe){
    const root=createHuman(recipe);let next: MotionRig;
    try{next=createMotionRig(root);}catch(e){disposeHuman(root);throw e;}
    this.releaseModel();this.rig=next;this.scene.add(root);
    this.helper=new SkeletonHelper(root);
    this.helper.bones=BODY_BONES.map(name=>next.bones[name]);
    this.helper.geometry.setDrawRange(0,(BODY_BONES.length-1)*2);this.scene.add(this.helper);
    this.handles=new IKEditor(next.ik,this.camera,this.element,this.orbit,target=>this.onPose(capturePose(next),target));
    this.setEditable(this.editable);this.setView(this.view);
  }
  setView(view: string){
    this.view=view;const offsets: Record<string,Vec3>={front:[0,0,1],quarter:[.8,.15,1],side:[1,0,0],back:[0,0,-1],high:[.8,.8,1],low:[.8,-.35,1]};
    const frame=humanFraming(this.rig.root).body;this.orbit.target.fromArray(frame.target);
    this.camera.position.copy(this.orbit.target).add(new Vector3(...(offsets[view]??offsets.quarter)).normalize().multiplyScalar(frame.distance*Math.max(1,1/this.camera.aspect)));this.orbit.update();
  }
  setEditable(enabled: boolean){this.editable=enabled;this.handles.layer.hidden=!enabled;}
  pose(): MotionPose{return capturePose(this.rig);}
  setPose(pose: MotionPose){applyPose(this.rig,pose);this.rig.ik.capture();}
  rotate(bone: BodyBone,angles: Vec3){
    this.rig.bones[bone].quaternion.setFromEuler(new Euler(...angles.map(a=>a*Math.PI/180)));
    this.rig.root.updateMatrixWorld(true);this.rig.ik.capture();this.onPose(this.pose());
  }
  angles(bone: BodyBone): Vec3{return new Euler().setFromQuaternion(this.rig.bones[bone].quaternion).toArray().slice(0,3).map(v=>Number(v)*180/Math.PI) as Vec3;}
  target(id: string,axis: number,value: number){
    if(!Number.isFinite(value))throw new Error('ターゲット座標が不正です');
    this.rig.ik.targets[id].setComponent(axis,value);this.rig.ik.solve();this.onPose(this.pose(),id);
  }
  private releaseModel(){
    if(!this.rig)return;this.handles.dispose();this.helper.removeFromParent();this.helper.geometry.dispose();[this.helper.material].flat().forEach(m=>m.dispose());
    this.rig.root.removeFromParent();disposeHuman(this.rig.root);
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resize.disconnect();this.releaseModel();this.orbit.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
