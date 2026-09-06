import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { catalog, defaultModel } from './catalog.mjs';
import { frameModel, inspectModel, validateGlb, modelMaterials, disposeModel, focusTarget } from './model.mjs';
import { AnimationPlayer, animationBounds, updateSkinBounds } from './animation.mjs';
import { IKPose } from './ik.mjs';
import { IKEditor } from './ik-editor.mjs';
import { bindAsset } from '../runtime/asset.mjs';
import { createAssemblyPanel } from './assembly.mjs';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const state = { model: null, info: null, request: 0, view: 'perspective', selected: null, source: null, player: null, skeleton: null, ik: null, ikEditor: null, binding: null };
const assembly=createAssemblyPanel(()=>{
  if(!state.model)return;
  state.info=inspectModel(state.model);
  for(const material of modelMaterials(state.model))material.wireframe=$('wireframe').checked;
  $('meshes').textContent=state.info.meshes.toLocaleString('ja-JP');
  $('triangles').textContent=Math.round(state.info.triangles).toLocaleString('ja-JP');
  $('dimensions').textContent=`${state.info.size.toArray().map(n=>n.toFixed(2)).join(' × ')} m`;
  $('file-size').textContent='未保存の構成';
  prepareStage(state.info);setView(state.view);
});
const directions = { perspective: new THREE.Vector3(1, .85, 1.4), front: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), back: new THREE.Vector3(0, 0, -1), top: new THREE.Vector3(0, 1, .0001) };
const scene = new THREE.Scene();
scene.background = new THREE.Color('#eeeee6');
const camera = new THREE.PerspectiveCamera(40, 1, .01, 1000);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch {
  $('error').hidden = false;
  $('error').textContent = '3D表示を開始できませんでした。WebGL 2に対応したブラウザで、ハードウェアアクセラレーションを有効にしてください。';
  $('status').textContent = '3D表示を利用できません';
  throw new Error('WebGL renderer unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', '3Dモデル。ドラッグで回転、ホイールで拡大縮小、Fキーで全体を表示');
viewport.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI;
controls.autoRotateSpeed = .6;
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04);
scene.environment = environment.texture;
scene.environmentIntensity = .55;
room.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8d9878, 1));
const sun = new THREE.DirectionalLight(0xfff2d9, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = .025;
sun.shadow.bias = -.00005;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: .15 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
let grid;
let renderPending = false;
let lastFrame = 0;

// Render only while controls change; idle inspection does not run a permanent loop.
function invalidate() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(now => {
    renderPending = false;
    const delta = lastFrame ? Math.min((now-lastFrame)/1000,.1) : 0;
    lastFrame = now;
    if (state.player?.playing) { state.player.update(delta); updatePlaybackUI(); }
    controls.update();
    state.ikEditor?.update();
    renderer.render(scene, camera);
    if (controls.autoRotate || state.player?.playing) invalidate();
  });
}
controls.addEventListener('change', invalidate);
controls.addEventListener('start', invalidate);

function updatePlaybackUI() {
  const player = state.player;
  $('play-pause').textContent = player?.playing ? '一時停止' : '再生';
  $('timeline').value = String(player?.time ?? 0);
  $('animation-time').textContent = `${(player?.time ?? 0).toFixed(2)} / ${(player?.duration ?? 0).toFixed(2)} s`;
}

function setupPlayback() {
  const player = state.player;
  $('animation-panel').hidden = !player.clips.length;
  $('clip-select').replaceChildren();
  player.clips.forEach((clip,index) => $('clip-select').add(new Option(clip.name || `Clip ${index+1}`,index)));
  $('timeline').max = String(player.duration);
  player.speed = Number($('playback-speed').value);
  state.skeleton = new THREE.SkeletonHelper(state.model);
  state.skeleton.visible = $('skeleton').checked && state.skeleton.bones.length>0;
  state.skeleton.material.depthTest = false;
  state.skeleton.renderOrder = 10;
  scene.add(state.skeleton);
  updatePlaybackUI();
  lastFrame = 0;
}

function fit(bounds = state.info?.bounds) {
  if (!bounds) return;
  const frame = frameModel(bounds, camera.fov, camera.aspect, directions[state.view]);
  controls.autoRotate = $('rotate').checked;
  controls.target.copy(frame.target);
  camera.position.copy(frame.position);
  const fullRadius = state.info.bounds.getSize(new THREE.Vector3()).length() / 2;
  camera.near = Math.min(frame.near, fullRadius / 1000);
  camera.far = Math.max(frame.far, fullRadius * 200);
  controls.minDistance = frame.radius * .03;
  controls.maxDistance = fullRadius * 20;
  camera.updateProjectionMatrix();
  // Clear residual damping so a view preset has a predictable position.
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = true;
  invalidate();
}

function syncIKUI(selected) {
  const pose = state.ik;
  if (!pose) return;
  if (selected) $('ik-target').value = selected;
  $('ik-mode').value = pose.mode;
  $('ik-target-fields').hidden = pose.mode !== 'IK';
  $('fk-fields').hidden = pose.mode !== 'FK';
  const target = pose.targets[$('ik-target').value];
  const angles = pose.fk[$('fk-bone').value] ?? new THREE.Vector3();
  for (const axis of ['x','y','z']) {
    $(`ik-${axis}`).value = String(target[axis]);
    $(`ik-${axis}-value`).textContent = `${target[axis].toFixed(2)} m`;
    const degrees = THREE.MathUtils.radToDeg(angles[axis]);
    $(`fk-${axis}`).value = String(degrees);
    $(`fk-${axis}-value`).textContent = `${Math.round(degrees)}°`;
  }
  const error = Math.max(0, ...Object.values(pose.errors));
  $('ik-status').textContent = pose.mode === 'FK' ? '各関節を直接回転します。' : error < .002 ? 'ターゲットに追従中' : `届く範囲に制限中（最大差 ${error.toFixed(2)} m）`;
  invalidate();
}

function setupIK() {
  $('ik-panel').hidden = !state.ik;
  if (!state.ik) return;
  state.ikEditor = new IKEditor(state.ik, camera, viewport, controls, selected => {
    state.player.playing = false;
    updatePlaybackUI();
    syncIKUI(selected);
  });
  $('ik-target').replaceChildren(...state.ikEditor.handles.map(h => new Option(h.label, h.id)));
  const bones = [...new Set(state.ik.chains.flatMap(chain => [chain.upper,chain.lower,chain.end]))];
  $('fk-bone').replaceChildren(...bones.map(bone => new Option(bone.name,bone.name)));
  $('ik-target').value = state.ik.chains[0].id;
  state.ik.solve();
  syncIKUI();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  state.selected = null;
  $('selection').textContent = 'ダブルクリックで部品にフォーカス';
  fit();
}

function prepareStage(info) {
  const center = info.bounds.getCenter(new THREE.Vector3());
  const span = Math.max(...info.size, .01);
  ground.position.set(center.x, (info.groundY ?? info.bounds.min.y) - span * .001, center.z);
  ground.scale.setScalar(span * 5);
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  grid = new THREE.GridHelper(span * 2, 40, 0x9ba78d, 0xc5ccbc);
  grid.position.copy(ground.position);
  grid.position.y += span * .0002;
  grid.visible = $('grid').checked;
  scene.add(grid);
  sun.position.copy(center).add(new THREE.Vector3(-span, span * 1.6, span));
  sun.target.position.copy(center);
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: span * .01, far: span * 6 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = span * .0007;
}

const loader = new GLTFLoader();
async function loadModel(getBytes, filename, source) {
  const request = ++state.request;
  $('error').hidden = true;
  $('status').textContent = 'モデルを読み込み中…';
  let candidate;
  let candidatePlayer;
  try {
    const [bytes,definition] = await Promise.all([getBytes(),source.definitionUrl?fetchCatalogFile(source.definitionUrl,'json'):null]);
    if (request !== state.request) return;
    validateGlb(bytes);
    const asset = await loader.parseAsync(bytes, '');
    candidate = asset.scene;
    const info = inspectModel(candidate);
    if (request !== state.request) { disposeModel(candidate); return; }
    // Bind and validate in the rest pose, before the first animation sample.
    const candidateBinding = definition ? bindAsset(candidate,asset.animations,definition) : null;
    candidatePlayer = new AnimationPlayer(candidate, asset.animations,{modes:candidateBinding?.modes});
    if (asset.animations.length) {
      info.bounds = animationBounds(candidatePlayer);
      info.size = info.bounds.getSize(new THREE.Vector3());
    }
    candidate.traverse(object => {
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
      if (object.isSkinnedMesh) object.frustumCulled = false;
    });
    for (const material of modelMaterials(candidate)) material.wireframe = $('wireframe').checked;
    const candidateIK = IKPose.fromModel(candidate);
    state.ikEditor?.dispose();
    state.ikEditor = null;
    state.player?.dispose();
    if (state.skeleton) { scene.remove(state.skeleton); state.skeleton.dispose(); }
    if (state.model) { scene.remove(state.model); disposeModel(state.model); }
    state.model = candidate;
    state.info = info;
    state.source = source;
    state.player = candidatePlayer;
    state.binding = candidateBinding;
    state.ik = candidateIK;
    directions.perspective.fromArray(source.direction ?? [1, .55, 1.8]);
    $('model-select').value = source.id ?? '';
    const address = new URL(location.href);
    if (source.id) address.searchParams.set('model', source.id);
    else address.searchParams.delete('model');
    history.replaceState(null, '', address);
    scene.add(candidate);
    assembly.setModel(candidate);
    setupPlayback();
    setupIK();
    prepareStage(info);
    $('model-name').textContent = filename;
    $('file-size').textContent = `${(bytes.byteLength / 1024).toFixed(0)} KB`;
    $('meshes').textContent = info.meshes.toLocaleString('ja-JP');
    $('triangles').textContent = Math.round(info.triangles).toLocaleString('ja-JP');
    $('dimensions').textContent = `${info.size.toArray().map(n => n.toFixed(2)).join(' × ')} m`;
    setView('perspective');
    $('status').textContent = '表示中';
  } catch (error) {
    if (candidatePlayer && candidatePlayer !== state.player) candidatePlayer.dispose();
    if (candidate && candidate !== state.model) disposeModel(candidate);
    if (request !== state.request) return;
    $('model-select').value = state.source?.id ?? '';
    $('error').textContent = `読み込めませんでした。${error.message} 外部ファイルに依存しないGLBを選んでください。`;
    $('error').hidden = false;
    $('status').textContent = state.model ? '前のモデルを表示中' : '読み込みに失敗しました';
  }
}

async function fetchCatalogFile(url,type) {
  const address = new URL(url,location.href);
  address.searchParams.set('reload',Date.now());
  const response = await fetch(address,{cache:'no-store'});
  if(!response.ok)throw new Error(`モデルファイルを取得できません（${response.status}）。`);
  return type==='json'?response.json():response.arrayBuffer();
}
function loadCatalogModel(source) {
  if (!source) return;
  return loadModel(()=>fetchCatalogFile(source.url,'glb'), source.filename, source);
}
function openFile(file) {
  if (!file) return;
  return loadModel(async () => {
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('拡張子.glbのファイルを選んでください。');
    return file.arrayBuffer();
  }, file.name, { file });
}
$('ik-mode').addEventListener('change', event => {
  state.ik.mode = event.target.value;
  state.ik.solve();
  syncIKUI();
});
$('ik-target').addEventListener('change', () => syncIKUI());
$('fk-bone').addEventListener('change', () => syncIKUI());
for (const axis of ['x','y','z']) {
  $(`ik-${axis}`).addEventListener('input', event => {
    state.ik.targets[$('ik-target').value][axis] = Number(event.target.value);
    state.ik.solve();
    syncIKUI();
  });
  $(`fk-${axis}`).addEventListener('input', event => {
    const angles = state.ik.fk[$('fk-bone').value] ??= new THREE.Vector3();
    angles[axis] = THREE.MathUtils.degToRad(Number(event.target.value));
    state.ik.solve();
    syncIKUI();
  });
}
$('ik-crouch').addEventListener('click', () => {
  state.ik.targets.hips.copy(state.ik.initial.hips).y -= .12;
  state.ik.solve();
  syncIKUI('hips');
});
$('ik-reset').addEventListener('click', () => { state.ik.reset(); syncIKUI(); });
$('play-pause').addEventListener('click', () => {
  if (!state.player?.duration) return;
  if (state.player.playing) state.player.playing = false;
  else state.player.play();
  lastFrame = 0;
  updatePlaybackUI();
  invalidate();
});
$('timeline').addEventListener('input', event => {
  state.player?.seek(Number(event.target.value));
  updatePlaybackUI();
  invalidate();
});
$('playback-speed').addEventListener('change', event => {
  if (state.player) state.player.speed = Number(event.target.value);
});
$('clip-select').addEventListener('change', event => {
  state.player.select(Number(event.target.value));
  state.info.bounds = animationBounds(state.player);
  state.info.size = state.info.bounds.getSize(new THREE.Vector3());
  $('timeline').max = String(state.player.duration);
  $('dimensions').textContent = `${state.info.size.toArray().map(n => n.toFixed(2)).join(' × ')} m`;
  prepareStage(state.info);
  fit();
  updatePlaybackUI();
  lastFrame = 0;
  invalidate();
});
$('skeleton').addEventListener('change', event => {
  if (state.skeleton) state.skeleton.visible = event.target.checked;
  invalidate();
});
$('file').addEventListener('change', event => { openFile(event.target.files[0]); event.target.value = ''; });
$('reload').addEventListener('click', () => {
  if (state.source?.file) openFile(state.source.file);
  else loadCatalogModel(state.source ?? defaultModel);
});
for (const model of catalog) $('model-select').add(new Option(model.label, model.id));
$('model-select').addEventListener('change', event => loadCatalogModel(catalog.find(model => model.id === event.target.value)));
$('reset').addEventListener('click', () => setView('perspective'));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('wireframe').addEventListener('change', event => {
  if (state.model) for (const material of modelMaterials(state.model)) material.wireframe = event.target.checked;
  invalidate();
});
$('grid').addEventListener('change', event => { if (grid) grid.visible = event.target.checked; invalidate(); });
$('rotate').addEventListener('change', event => { controls.autoRotate = event.target.checked; invalidate(); });
$('exposure').addEventListener('input', event => {
  renderer.toneMappingExposure = Number(event.target.value);
  $('exposure-value').textContent = Number(event.target.value).toFixed(1);
  invalidate();
});
renderer.domElement.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'f') { event.preventDefault(); setView('perspective'); } });
const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('dblclick', event => {
  if (!state.model) return;
  if (state.player?.duration) { state.player.playing = false; updatePlaybackUI(); updateSkinBounds(state.model); }
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
  let object = raycaster.intersectObject(state.model, true)[0]?.object;
  if (!object) return;
  object = focusTarget(object, state.model);
  state.selected = object;
  $('selection').textContent = `選択：${object.name || '名称なし'} ｜ Fで全体を表示`;
  fit(new THREE.Box3().setFromObject(object));
});
let dragDepth = 0;
window.addEventListener('dragenter', event => {
  event.preventDefault();
  if (event.dataTransfer.types.includes('Files')) { dragDepth++; $('drop-hint').hidden = false; }
});
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop-hint').hidden = true; });
window.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; $('drop-hint').hidden = true;
  openFile(event.dataTransfer.files[0]);
});
new ResizeObserver(() => {
  const { width, height } = viewport.getBoundingClientRect();
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  fit(state.selected ? new THREE.Box3().setFromObject(state.selected) : undefined);
  invalidate();
}).observe(viewport);
const requestedModel = new URLSearchParams(location.search).get('model');
loadCatalogModel(catalog.find(model => model.id === requestedModel) ?? defaultModel);
