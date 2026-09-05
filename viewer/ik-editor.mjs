import { Plane, Raycaster, Vector2, Vector3 } from 'three';

/** Screen-plane handles: camera orbit and IK dragging never consume the same gesture. */
export class IKEditor {
  constructor(pose,camera,viewport,orbit,onChange) {
    this.pose=pose;this.camera=camera;this.viewport=viewport;this.orbit=orbit;this.onChange=onChange;
    this.layer=document.createElement('div');
    this.layer.className='ik-handles';
    viewport.append(this.layer);
    this.handles=[];
    this.drag=null;
    const add=(id,label,short,pole=false)=>{
      const button=document.createElement('button');
      button.type='button';button.className=`ik-handle${pole?' pole':''}${id==='hips'?' hips':''}`;
      button.textContent=short;button.setAttribute('aria-label',label);button.title=label;
      button.addEventListener('pointerdown',event=>this.start(event,id,button));
      button.addEventListener('pointermove',event=>this.move(event));
      button.addEventListener('pointerup',event=>this.end(event));
      button.addEventListener('pointercancel',event=>this.end(event));
      this.layer.append(button);this.handles.push({id,label,button});
    };
    add('hips','腰ターゲット','腰');
    for(const chain of pose.chains) {
      add(chain.id,chain.label+'ターゲット',chain.label);
      const label=chain.label.replace('足','膝').replace('手','肘');
      add(chain.id+'Pole',label+'ポール',label,true);
    }
  }
  ray(event) {
    const rect=this.viewport.getBoundingClientRect();
    const ray=new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    return ray.ray;
  }
  start(event,id,button) {
    if(event.button!==0 || this.pose.mode!=='IK')return;
    event.preventDefault();event.stopPropagation();
    const point=this.pose.targets[id].clone();
    const plane=new Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new Vector3()),point);
    const hit=this.ray(event).intersectPlane(plane,new Vector3());
    if(!hit)return;
    this.drag={id,plane,offset:point.sub(hit),button,pointerId:event.pointerId,auto:this.orbit.autoRotate};
    this.orbit.enabled=false;this.orbit.autoRotate=false;
    button.setPointerCapture(event.pointerId);
    this.onChange(id);
  }
  move(event) {
    if(!this.drag)return;
    const point=this.ray(event).intersectPlane(this.drag.plane,new Vector3());
    if(!point)return;
    this.pose.targets[this.drag.id].copy(point.add(this.drag.offset));
    this.pose.solve();this.onChange(this.drag.id);
  }
  end(event) {
    if(!this.drag)return;
    const {button,pointerId,auto}=this.drag;
    if(button.hasPointerCapture(pointerId))button.releasePointerCapture(pointerId);
    this.orbit.enabled=true;this.orbit.autoRotate=auto;this.drag=null;
    this.onChange();
  }
  update() {
    const rect=this.viewport.getBoundingClientRect();
    for(const handle of this.handles) {
      const p=this.pose.targets[handle.id].clone().project(this.camera);
      handle.button.hidden=this.pose.mode!=='IK'||p.z<-1||p.z>1;
      handle.button.style.left=`${(p.x+1)*rect.width/2}px`;
      handle.button.style.top=`${(1-p.y)*rect.height/2}px`;
    }
  }
  dispose() {this.end();this.layer.remove();}
}
