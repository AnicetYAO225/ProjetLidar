// ===============================
// Scene de base
// ===============================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    100000
);

camera.position.set(0, -500, 300);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("viewer-3d").appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);

scene.add(new THREE.AxesHelper(100));
scene.add(new THREE.GridHelper(2000, 40));

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===============================
// Nuage de points global
// ===============================
let pointCloud = null;
let currentLidar = null;
let lastRequest = 0;

// ===============================
// Création nuage
// ===============================
function buildPointCloud(points) {

    if (pointCloud) scene.remove(pointCloud);

    const geom = new THREE.BufferGeometry();
    const arr = new Float32Array(points.flat());

    geom.setAttribute("position",
        new THREE.BufferAttribute(arr, 3));

    const mat = new THREE.PointsMaterial({
        size: 2,
        color: 0xffffff
    });

    pointCloud = new THREE.Points(geom, mat);
    scene.add(pointCloud);
}

// ===============================
// Chargement adaptatif caméra
// ===============================
async function updateStreaming() {

    if (!currentLidar) return;

    const now = performance.now();
    if (now - lastRequest < 500) return;
    lastRequest = now;

    const pos = camera.position;

    const bboxSize = 1000;

    const minx = pos.x - bboxSize;
    const miny = pos.y - bboxSize;
    const maxx = pos.x + bboxSize;
    const maxy = pos.y + bboxSize;

    const url =
        `/lidar/files/${currentLidar}/stream-bbox`
        + `?minx=${minx}&miny=${miny}`
        + `&maxx=${maxx}&maxy=${maxy}`;

    const res = await fetch(url);
    const data = await res.json();

    buildPointCloud(data.points);
}

// ===============================
// LOD dynamique GPU
// ===============================
function dynamicLOD() {

    if (!pointCloud) return;

    const dist = camera.position.length();

    const size = Math.max(1, 4000 / dist);
    pointCloud.material.size = size;
}

// ===============================
// Drone navigation automatique
// ===============================
let dronePath = [];
let droneIndex = 0;
let droneActive = false;

async function startDronePath() {

    if (!currentLidar) return;

    const res = await fetch(
        `/lidar/files/${currentLidar}/drone-path`
    );

    const data = await res.json();

    dronePath = data.path;
    droneIndex = 0;
    droneActive = true;
}

function updateDrone() {

    if (!droneActive || dronePath.length === 0)
        return;

    const target = dronePath[droneIndex];

    camera.position.lerp(
        new THREE.Vector3(...target),
        0.05
    );

    controls.target.set(
        target[0],
        target[1],
        target[2] - 20
    );

    if (camera.position.distanceTo(
        new THREE.Vector3(...target)
    ) < 5) {

        droneIndex++;

        if (droneIndex >= dronePath.length)
            droneActive = false;
    }
}

// ===============================
// Extraction bâtiments live
// ===============================
async function showBuildings() {

    if (!currentLidar) return;

    const res = await fetch(
        `/lidar/files/${currentLidar}/buildings`,
        { method: "POST" }
    );

    const data = await res.json();
    console.log("Bâtiments détectés:", data);
}

// ===============================
// FPS compteur
// ===============================
let fpsCounter = document.getElementById("fps-counter");
let frames = 0;
let lastFps = performance.now();

function updateFPS() {

    frames++;
    const now = performance.now();

    if (now - lastFps > 1000) {
        fpsCounter.innerText = "FPS: " + frames;
        frames = 0;
        lastFps = now;
    }
}

// ===============================
// Boucle rendu
// ===============================
function animate() {
    requestAnimationFrame(animate);

    controls.update();
    updateStreaming();
    dynamicLOD();
    updateDrone();
    updateFPS();

    renderer.render(scene, camera);
}

animate();

// ===============================
// Hook upload
// ===============================
document
.getElementById("lidar-file-input")
.addEventListener("change", async (e) => {

    const file = e.target.files[0];
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(
        "/lidar/upload",
        { method: "POST", body: form }
    );

    const data = await res.json();
    currentLidar = data.lidar_id;
});

// ===============================
// Upload zone click
// ===============================
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("lidar-file-input");

uploadZone.onclick = () => fileInput.click();

// ===============================
// Upload fichier
// ===============================
fileInput.addEventListener("change", async (e) => {

    if (!e.target.files.length) return;

    const file = e.target.files[0];

    const form = new FormData();
    form.append("file", file);

    document.getElementById("loading-overlay").style.display = "flex";

    const res = await fetch("/lidar/upload", {
        method: "POST",
        body: form
    });

    const data = await res.json();
    currentLidar = data.lidar_id;

    document.getElementById("loading-overlay").style.display = "none";

    // chargement premier aperçu
    updateStreaming();
});

document.getElementById("btn-reset-camera").onclick = () => {

    camera.position.set(0, -500, 300);

    controls.target.set(0, 0, 0);
    controls.update();
};

document.getElementById("btn-screenshot").onclick = () => {

    renderer.render(scene, camera);

    const link = document.createElement("a");
    link.download = "capture_lidar.png";
    link.href = renderer.domElement.toDataURL();
    link.click();
};

