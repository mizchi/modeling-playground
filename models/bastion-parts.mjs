import { Group } from 'three';
import { createKit } from './bastion-kit.mjs';

/** A module is authored in its socket's local frame, never in screen space. */
export function createBastionPart(slot,id) {
  const root=new Group();root.name=`${slot}_${id}`;
  root.userData={focusTarget:true,partId:id,slot};
  if(id==='none')return root;
  const k=createKit(root),{m,box,hull,rod,bolt,vent,barrel,stencil,hose}=k;
  const side=slot.startsWith('right')?-1:1;
  if(slot==='core') {
    // A deep, stepped reactor cage: chest front and upper back both carry volume.
    box('spine',[0,-.17,-.14],[.78,1.22,.82],m.frame);
    hull('thorax',[[-.61,.83,.74,-.03],[-.14,1.49,1.10,.03],[.37,1.69,1.12,-.06],[.59,1.30,.79,-.13]],m.dark);
    hull('front_glacis',[[-.42,.88,.16,.54],[.10,1.27,.18,.64],[.39,1.43,.17,.50]],m.armor);
    box('upper_glacis',[0,.47,.36],[1.22,.24,.20],m.light,[-.60,0,0]);
    box('belly_keel',[0,-.52,.28],[.73,.35,.63],m.dark,[.20,0,0]);
    box('collar',[0,.64,-.03],[.94,.15,.88],m.dark);
    for(const s of [-1,1]) {
      rod('shoulder_axle',[s*.6,.45,0],[s*1.38,.45,0],.18,m.frame);
      box('pectoral',[s*.61,.17,.39],[.42,.69,.54],m.armor,[0,s*.25,s*-.10]);
      vent('intake',[s*.47,.47,.65],.28,.20);
      rod('lower_brace',[s*.45,-.63,-.05],[s*.65,-.05,.35],.063,m.steel);
      box('rear_plate',[s*.44,.12,-.64],[.55,.89,.15],m.armor);
      for(const y of [-.22,.18])bolt([s*.50,y,.686]);
    }
    rod('waist_bearing',[0,-.92,-.05],[0,-.67,-.05],.39,m.steel,.39,16);
    box('pelvis',[0,-1.04,-.06],[1.43,.36,.70],m.frame);
    for(const s of [-1,1]) {
      box('hip_cover',[s*.53,-1.07,.34],[.48,.42,.22],m.armor,[.10,0,s*-.12]);
      rod('hip_hinge',[s*.44,-1.04,-.05],[s*.81,-1.04,-.05],.21,m.steel);
    }
    box('cockpit_hatch',[0,.10,.755],[.42,.25,.055],m.dark,[.12,0,0]);
    box('hatch_handle',[0,.16,.802],[.18,.028,.06],m.steel);
    stencil('BST-06',[0,-.20,.681],.38,[.19,0,0]);
    if(id==='fortress') {
      for(const s of [-1,1])box('ablative_cheek',[s*.81,-.03,.05],[.23,.74,.85],m.armor,[0,0,s*.09]);
      box('lower_laminate',[0,-.47,.65],[.68,.18,.14],m.light,[.20,0,0]);
    } else {
      vent('central_radiator',[0,-.41,.68],.58,.23);
      box('orange_ident',[.66,.20,.678],[.085,.27,.018],m.orange);
    }
  } else if(slot==='head') {
    rod('neck',[0,0,0],[0,.17,0],.18,m.frame);
    hull('sensor_hull',[[.12,.44,.44,.03],[.27,.65,.59,.01],[.41,.50,.43,-.035]],m.armor);
    box('visor_hood',[0,.39,.23],[.65,.12,.32],m.light,[-.12,0,0]);
    box('optics_recess',[0,.27,.337],[.45,.11,.04],m.black);
    box('main_optic',[-.07,.27,.364],[.10,.050,.025],m.lens);
    box('rangefinder',[.15,.27,.364],[.055,.067,.025],m.white);
    for(const s of [-1,1])box('ear_receiver',[s*.34,.24,-.015],[.13,.22,.28],m.dark);
    box('brow',[0,.49,-.05],[.37,.10,.27],m.dark);
    if(id==='command') {
      rod('antenna',[.30,.34,-.16],[.30,1.0,-.20],.012,m.steel,.005);
      rod('antenna_short',[-.28,.34,-.18],[-.28,.75,-.18],.014,m.frame,.008);
      box('sensor_dish',[0,.62,-.15],[.71,.18,.15],m.light);
    } else rod('whip',[.27,.35,-.17],[.29,.76,-.20],.010,m.steel,.004);
  } else if(slot.endsWith('Arm')) {
    rod('shoulder_drum',[-.32,0,0],[.32,0,0],.26,m.frame,.26,16);
    hull('pauldron',[[-.20,.68,.76,0],[.10,.94,.91,0],[.32,.71,.69,-.06]],m.armor);
    box('shoulder_cap',[0,.34,-.04],[.58,.055,.55],m.light);
    for(const z of [-.20,.20])rod('shoulder_lift_eye',[side*.21,.36,z],[side*.21,.43,z],.028,m.steel);
    box('outer_shoulder_plate',[side*.45,.015,0],[.12,.31,.65],m.dark,[0,0,side*-.16]);
    box('upper_arm',[side*.12,-.41,-.02],[.39,.55,.43],m.frame,[0,0,side*.15]);
    rod('elbow',[side*-.10,-.72,.03],[side*.40,-.72,.03],.19,m.steel,.19,12);
    box('forearm',[side*.22,-1.00,.16],[.48,.53,.58],m.dark,[-.22,0,side*.08]);
    box('gauntlet',[side*.26,-1.32,.28],[.38,.23,.36],m.frame);
    for(let i=0;i<3;i++)box('finger',[side*.26+(i-1)*.10,-1.45,.36],[.07,.16,.14],m.steel);
    rod('arm_piston',[side*-.19,-.35,.15],[side*-.10,-.79,.30],.045,m.steel);
    hose('arm_cable',[[side*.26,-.24,-.20],[side*.44,-.62,-.22],[side*.38,-1.1,.01]]);
    if(id==='armored') {
      const shield=box('forearm_shield',[side*.27,-.98,.49],[.58,.63,.16],m.armor,[-.20,0,side*.08]);
      box('upper_plate',[side*.16,-.37,.25],[.42,.32,.12],m.light,[0,0,side*.10]);
      for(const x of [-.18,.18])bolt([x,.14,.088],shield);
    } else vent('arm_cooling',[side*.23,-1.01,.48],.31,.34);
    stencil('06',[0,-.06,.444],.20,[-.05,0,0]);
  } else if(slot.endsWith('Leg')) {
    // Slightly forward knee, rear-set ankle, long toe: a braced S-shaped profile.
    rod('hip_pin',[-.23,-.04,0],[.23,-.04,0],.22,m.frame,.22,16);
    box('femur',[side*.08,-.42,.10],[.47,.68,.51],m.frame,[-.22,0,side*.10]);
    box('thigh_plate',[side*.09,-.40,.40],[.55,.59,.20],m.armor,[-.18,0,side*.10]);
    rod('knee_axle',[side*.12-.38,-.91,.21],[side*.12+.38,-.91,.21],.22,m.steel,.22,16);
    box('knee_guard',[side*.12,-.90,.48],[.63,.37,.31],m.light,[-.15,0,0]);
    box('shin_frame',[side*.17,-1.49,.035],[.49,1.0,.50],m.frame,[.18,0,side*.03]);
    const width=id==='siege'?.95:.63;
    const shin=hull('shin_armor',[[-2.05,width*.82,.52,.19],[-1.76,width,.69,.24],[-1.14,width,.72,.33],[-1.02,width*.76,.55,.25]],m.armor);
    shin.position.x=side*.18;
    const front=box('shin_front_panel',[side*.18,-1.55,.62],[width*.67,.85,.095],m.dark,[.13,0,side*.025]);
    box('center_ridge',[side*.18,-1.51,.699],[.09,.72,.045],m.light,[.13,0,side*.025]);
    for(const s of [-1,1]) {
      rod('hydraulic_sleeve',[side*.18+s*.30,-1.06,-.09],[side*.18+s*.30,-1.58,-.23],.073,m.dark);
      rod('hydraulic_ram',[side*.18+s*.30,-1.52,-.215],[side*.18+s*.30,-2.12,-.15],.035,m.steel);
    }
    box('calf_powerpack',[side*.18,-1.40,-.43],[.55,.78,.46],m.dark,[.10,0,0]);
    const rear=new Group();rear.name=root.name+'_rear_vents';rear.position.set(side*.18,-1.41,-.68);rear.rotation.y=Math.PI;root.add(rear);
    vent('calf_exhaust',[0,0,0],.39,.45,rear);
    rod('ankle',[-.10+side*.18,-2.14,-.10],[.10+side*.18,-2.14,-.10],.21,m.steel);
    box('heel',[side*.18,-2.33,-.29],[.77,.34,.69],m.frame);
    box('toe',[side*.18,-2.265,.40],[.86,.40,.94],m.armor,[-.04,0,0]);
    // Separate soles stay exactly at world Y=0 on both leg variants.
    box('sole',[side*.18,-2.445,.16],[.92,.11,1.51],m.rubber);
    for(let i=0;i<4;i++)box('toe_tread',[side*.18+(i-1.5)*.21,-2.35,.91],[.16,.17,.12],m.steel);
    for(const y of [-.30,.30])for(const x of [-width*.24,width*.24])bolt([x,y,.05],front);
    if(id==='siege') {
      box('outer_laminate',[side*.66,-1.53,.07],[.18,.86,.65],m.dark,[0,0,side*.03]);
      for(let i=0;i<3;i++)box('laminate_seam',[side*.66,-1.29-i*.21,.408],[.17,.025,.02],m.steel);
    }
    stencil(side===1?'06':'01',[side*width*.13,.19,.054],.19,[0,0,0],front);
  } else if(slot==='backpack') {
    box('back_mount',[0,0,-.12],[1.0,.88,.35],m.frame);
    box('reactor',[0,.01,-.42],[.67,1.11,.52],m.armor);
    const rear=new Group();rear.name=root.name+'_rear';rear.position.z=-.70;rear.rotation.y=Math.PI;root.add(rear);
    vent('reactor_grille',[0,.13,0],.48,.53,rear);stencil('06',[0,-.32,.01],.25,[0,0,0],rear);
    for(const s of [-1,1]) {
      if(id==='reactor') {
        rod('engine',[s*.57,-.42,-.48],[s*.57,.40,-.48],.25,m.dark,.23,12);
        for(const y of [-.32,.19])rod('engine_band',[s*.57,y,-.48],[s*.57,y+.08,-.48],.265,m.steel,.265,12);
        rod('exhaust_rim',[s*.57,-.60,-.48],[s*.57,-.44,-.48],.245,m.frame,.25,12);
        rod('exhaust_dark',[s*.57,-.61,-.48],[s*.57,-.60,-.48],.18,m.black);
      } else {
        box('radiator',[s*.55,0,-.43],[.34,1.04,.44],m.dark);
        for(let i=0;i<10;i++)box('cooling_fin',[s*.55,-.43+i*.095,-.68],[.38,.027,.15],m.steel);
      }
      hose('fuel_line',[[s*.22,.4,-.4],[s*.52,.65,-.48],[s*.68,.41,-.47]],.044);
    }
  } else if(slot.endsWith('Weapon')) {
    const gun=new Group();gun.name=root.name+'_gun';gun.rotation.x=.13;root.add(gun);
    box('grip',[0,-.07,0],[.16,.34,.17],m.rubber,[0,0,0],gun);
    box('receiver',[0,-.25,.27],[.40,.41,.81],m.armor,[0,0,0],gun);
    if(id==='rifle') {
      box('stock',[0,-.23,-.36],[.34,.39,.45],m.dark,[0,0,0],gun);
      box('handguard',[0,-.25,.90],[.29,.29,.67],m.frame,[0,0,0],gun);
      barrel('rifle',[0,-.25,1.04],.065,1.23,gun);
      box('magazine',[side*.16,-.58,.20],[.18,.50,.32],m.dark,[.2,0,side*-.15],gun);
      box('top_rail',[0,.015,.60],[.12,.065,.86],m.steel,[0,0,0],gun);
      box('optic',[0,.12,.39],[.14,.17,.24],m.frame,[0,0,0],gun);
      for(let i=0;i<4;i++)box('cooling_slot',[0,-.08,.65+i*.13],[.30,.035,.05],m.black,[0,0,0],gun);
      stencil('01',[0,-.25,.687],.22,[0,0,0],gun);
    } else {
      rod('rotor',[0,-.30,.36],[0,-.30,.87],.28,m.frame,.28,16,gun);
      for(let i=0;i<6;i++) {
        const a=i*Math.PI/3;
        barrel('rotary_barrel',[Math.cos(a)*.16,-.30+Math.sin(a)*.16,.73],.043,1.20,gun);
      }
      for(const z of [.94,1.56])rod('barrel_clamp',[0,-.30,z],[0,-.30,z+.11],.23,m.dark,.23,16,gun);
      rod('ammo_drum',[side*.19,-.30,.28],[side*.65,-.30,.28],.31,m.dark,.31,16,gun);
      box('ammo_feed',[side*.31,-.10,.47],[.37,.20,.23],m.brass,[0,0,0],gun);
    }
  } else if(slot.endsWith('Shoulder')) {
    box('shoulder_socket',[0,0,0],[.42,.22,.45],m.frame);
    rod('mount_arm',[0,0,0],[side*.16,.53,-.11],.10,m.steel);
    rod('elevation_pin',[-.30,.49,-.11],[.30,.49,-.11],.15,m.frame);
    const turret=new Group();turret.name=root.name+'_turret';turret.position.set(side*.16,.53,-.11);
    turret.rotation.x=id==='missiles'?-.48:-.93;root.add(turret);
    if(id==='missiles') {
      box('pod_hull',[0,.05,.18],[.80,.92,.85],m.armor,[0,0,0],turret);
      box('pod_mouth',[0,.05,.62],[.69,.81,.07],m.frame,[0,0,0],turret);
      for(let x=0;x<2;x++)for(let y=0;y<3;y++) {
        const xx=(x-.5)*.32,yy=(y-1)*.25+.05;
        rod('launch_tube',[xx,yy,.65],[xx,yy,.70],.105,m.black,.105,12,turret);
        rod('missile_cap',[xx,yy,.705],[xx,yy,.75],.066,m.steel,.041,12,turret);
      }
      for(const s of [-1,1])box('pod_edge',[s*.39,.05,.20],[.075,.97,.85],m.light,[0,0,0],turret);
      box('pod_warning',[0,.522,.20],[.42,.012,.13],m.orange,[0,0,0],turret);
    } else {
      box('breech',[0,0,0],[.46,.47,.65],m.dark,[0,0,0],turret);
      barrel('howitzer',[0,0,.28],.115,1.75,turret);
      rod('recoil_ram',[.21,-.12,.03],[.21,-.12,1.05],.057,m.steel,.05,12,turret);
      box('recoil_cover',[-.18,0,.58],[.13,.29,.80],m.armor,[0,0,0],turret);
    }
  } else throw new Error(`Unknown part slot: ${slot}`);
  return root;
}
