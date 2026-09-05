import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { catalog, defaultModel } from './catalog.mjs';
import { frameModel, inspectModel, validateGlb, modelMaterials, disposeModel, focusTarget } from './model.mjs';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const state = { model: null, info: null, request: 0, view: 'perspective', selected: null, source: null };
const directions = { perspective: new THREE.Vector3(1, .85, 1.4), front: new THREE.Vector3(0, 0, 1), top: new THREE.Vector3(0, 1, .0001) };
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

// Render only while controls change; idle inspection does not run a permanent loop.
function invalidate() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    controls.update();
    renderer.render(scene, camera);
    if (controls.autoRotate) invalidate();
  });
}
controls.addEventListener('change', invalidate);
controls.addEventListener('start', invalidate);

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
  ground.position.set(center.x, info.bounds.min.y - span * .001, center.z);
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
  try {
    const bytes = await getBytes();
    if (request !== state.request) return;
    validateGlb(bytes);
    candidate = (await loader.parseAsync(bytes, '')).scene;
    const info = inspectModel(candidate);
    if (request !== state.request) { disposeModel(candidate); return; }
    candidate.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    for (const material of modelMaterials(candidate)) material.wireframe = $('wireframe').checked;
    if (state.model) { scene.remove(state.model); disposeModel(state.model); }
    state.model = candidate;
    state.info = info;
    state.source = source;
    directions.perspective.fromArray(source.direction ?? [1, .55, 1.8]);
    $('model-select').value = source.id ?? '';
    const address = new URL(location.href);
    if (source.id) address.searchParams.set('model', source.id);
    else address.searchParams.delete('model');
    history.replaceState(null, '', address);
    scene.add(candidate);
    prepareStage(info);
    $('model-name').textContent = filename;
    $('file-size').textContent = `${(bytes.byteLength / 1024).toFixed(0)} KB`;
    $('meshes').textContent = info.meshes.toLocaleString('ja-JP');
    $('triangles').textContent = Math.round(info.triangles).toLocaleString('ja-JP');
    $('dimensions').textContent = `${info.size.toArray().map(n => n.toFixed(2)).join(' × ')} m`;
    setView('perspective');
    $('status').textContent = '表示中';
  } catch (error) {
    if (candidate && candidate !== state.model) disposeModel(candidate);
    if (request !== state.request) return;
    $('model-select').value = state.source?.id ?? '';
    $('error').textContent = `読み込めませんでした。${error.message} 外部ファイルに依存しないGLBを選んでください。`;
    $('error').hidden = false;
    $('status').textContent = state.model ? '前のモデルを表示中' : '読み込みに失敗しました';
  }
}

function loadCatalogModel(source) {
  if (!source) return;
  return loadModel(async () => {
    const address = new URL(source.url, location.href);
    address.searchParams.set('reload', Date.now());
    const response = await fetch(address, { cache: 'no-store' });
    if (!response.ok) throw new Error(`GLBを取得できません（${response.status}）。`);
    return response.arrayBuffer();
  }, source.filename, source);
}
function openFile(file) {
  if (!file) return;
  return loadModel(async () => {
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('拡張子.glbのファイルを選んでください。');
    return file.arrayBuffer();
  }, file.name, { file });
}
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
