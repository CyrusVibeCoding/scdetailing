import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const story = document.querySelector('.porsche-story');
const stage = document.querySelector('.porsche-stage');
const visual = document.querySelector('.porsche-visual');
const host = document.querySelector('#porsche-scene');
const intro = document.querySelector('.porsche-intro');
const outro = document.querySelector('.porsche-outro');
const cue = document.querySelector('.porsche-meta span:last-child');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
const { clamp, lerp, smoothstep } = THREE.MathUtils;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, .1, 150);
const rig = new THREE.Group();
scene.add(rig);
const roadMaterials = new Set();
let renderer, road, frameId = 0, last = 0, progress = 0, target = 0;
let visible = false, started = false, loaded = false, frames = 0, lastRoadFade = -1;

stage.classList.add('is-enhanced');

function requestFrame() {
  if (!frameId && visible && !document.hidden) {
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  }
}

function updateScroll() {
  const bounds = story.getBoundingClientRect();
  target = motion.matches ? 1 : clamp(-bounds.top / Math.max(1, story.offsetHeight - stage.offsetHeight), 0, 1);
  requestFrame();
}

function resize() {
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  renderer?.setSize(stage.clientWidth, stage.clientHeight);
  updateScroll();
}

function frame(now) {
  frameId = 0;
  const dt = Math.min((now - last) / 1000, .06);
  last = now;
  progress = motion.matches ? 1 : lerp(progress, target, 1 - Math.exp(-8 * dt));
  const t = smoothstep(progress, .08, .8);
  const mobile = stage.clientWidth <= 800;
  const introOpacity = 1 - smoothstep(progress, .05, .4);
  const outroOpacity = smoothstep(progress, .48, .82);
  intro.style.opacity = introOpacity;
  intro.style.visibility = introOpacity < .01 ? 'hidden' : 'visible';
  intro.style.transform = `translateY(${-t * 24}px)`;
  outro.style.opacity = outroOpacity;
  outro.style.visibility = outroOpacity < .01 ? 'hidden' : 'visible';
  outro.inert = outroOpacity < .1;
  cue.style.opacity = 1 - t;
  const entry = motion.matches ? 1 : smoothstep(1 - story.getBoundingClientRect().top / innerHeight, .05, .75);
  visual.style.opacity = entry;

  if (road && t !== lastRoadFade) {
    for (const material of roadMaterials) {
      material.opacity = 1 - t;
      material.depthWrite = t < .5;
    }
    road.visible = t < .995;
    lastRoadFade = t;
  }
  rig.position.set(mobile ? 0 : lerp(0, -2.9, t), mobile ? lerp(-.3, 2.4, t) : lerp(-.3, .05, t), 0);
  rig.scale.setScalar(mobile ? lerp(.8, .88, t) : lerp(1, 1.3, t));
  camera.position.set(lerp(9, 8, t), lerp(12, 8.5, t), lerp(12, 11, t));
  camera.position.multiplyScalar(mobile ? 1.32 : 1);
  camera.lookAt(mobile ? 0 : lerp(.1, .7, t), mobile ? lerp(1.1, .3, t) : 1.3, 0);
  if (loaded && renderer) {
    renderer.render(scene, camera);
    host.dataset.frames = ++frames;
    if (!host.classList.contains('ready')) {
      host.classList.add('ready');
      visual.classList.add('ready');
    }
  }
  host.dataset.progress = progress.toFixed(3);
  if (Math.abs(progress - target) > .0001) frameId = requestAnimationFrame(frame);
}

function showFallback() {
  loaded = false;
  stage.classList.add('is-fallback');
  visual.classList.remove('ready');
  host.classList.remove('ready');
  host.dataset.state = 'fallback';
}

async function loadScene() {
  if (started) return;
  started = true;
  host.dataset.state = 'loading';
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'default' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1 : 1.4));
    renderer.setClearColor(0x0d191f, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      showFallback();
    });

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x706b63);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), new THREE.MeshBasicMaterial({ color: 0xe9dcca, side: THREE.DoubleSide }));
    panel.position.set(-6, 10, 5);
    panel.lookAt(0, 0, 0);
    room.add(panel);
    scene.environment = pmrem.fromScene(room, .14).texture;
    scene.environmentIntensity = .55;
    panel.geometry.dispose();
    panel.material.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0x8998b2, 0x17130d, .3));
    const key = new THREE.DirectionalLight(0xffdbab, 3);
    key.position.set(3, 7, 4);
    key.castShadow = !lowPower;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    key.shadow.normalBias = .04;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x96b4dc, 1);
    rim.position.set(-4, 3, -4);
    scene.add(rim);
    const lamp = new THREE.PointLight(0xffb45c, 65, 18, 2);
    lamp.position.set(.52, 5.9, -2.1);
    scene.add(lamp);

    const loader = new GLTFLoader();
    const [model, environment] = await Promise.all([
      loader.loadAsync('assets/porsche/car.glb'),
      loader.loadAsync('assets/porsche/roadside.glb')
    ]);
    const car = model.scene;
    car.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.name.includes('Gloss Red Paint')) continue;
        material.roughness = .36;
        material.envMapIntensity = 0;
        if ('clearcoat' in material) {
          material.clearcoat = .2;
          material.clearcoatRoughness = .35;
        }
      }
    });
    const box = new THREE.Box3().setFromObject(car);
    const center = box.getCenter(new THREE.Vector3());
    car.position.set(-center.x, -box.min.y, -center.z);
    rig.add(car);

    road = environment.scene;
    road.position.set(-3.25, -.3, 0);
    road.traverse(object => {
      if (!object.isMesh) return;
      object.receiveShadow = true;
      object.castShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        roadMaterials.add(material);
        material.transparent = true;
        material.envMapIntensity = .035;
        if (material.name.includes('asphalt')) {
          material.roughness = .95;
          material.color.set(0x111210);
        }
        if (material.name.includes('sidewalk')) material.color.set(0x1d1e18);
      }
    });
    scene.add(road);
    for (const x of [-.77, .77]) {
      const beam = new THREE.SpotLight(0xffedc4, 22, 10, .38, .65, 1.5);
      beam.position.set(x, .72, 2.6);
      beam.target.position.set(x, -.3, 8);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(.095, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe9bc }));
      lens.position.set(x, .73, 2.05);
      rig.add(beam, beam.target, lens);
    }
    renderer.shadowMap.needsUpdate = true;
    loaded = true;
    host.dataset.state = 'ready';
    resize();
    requestFrame();
  } catch (error) {
    console.warn('Porsche preview is using the static image.', error);
    showFallback();
  }
}

const preload = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) {
    loadScene();
    preload.disconnect();
  }
}, { rootMargin: '800px' });
preload.observe(story);
const visibility = new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (visible) updateScroll();
  else {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
});
visibility.observe(story);
addEventListener('scroll', updateScroll, { passive: true });
addEventListener('resize', resize);
motion.addEventListener('change', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  } else updateScroll();
});
resize();
