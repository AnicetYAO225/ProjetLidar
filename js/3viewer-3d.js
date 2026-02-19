/**
 * Visualiseur 3D LIDAR avec Three.js
 */

let scene, camera, renderer, controls;
let pointCloud = null;
let gridHelper, axesHelper;
let currentLidarId = null;

/* 1e modification */
const uploadZone = document.getElementById("upload-zone");
const fileInput = document.getElementById("lidar-file-input");
const fileList = document.getElementById("lidar-files-list");

/* 2e modification*/
uploadZone.addEventListener("dragover", e => {
    e.preventDefault();
    uploadZone.style.background = "#eef5ff";
});

uploadZone.addEventListener("dragleave", () => {
    uploadZone.style.background = "";
});

uploadZone.addEventListener("drop", e => {
    e.preventDefault();
    uploadZone.style.background = "";
    handleFiles(e.dataTransfer.files);
});

/* 3e mofication */

fileInput.addEventListener("change", e => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    if (!files.length) return;

    fileList.innerHTML = "";

    [...files].forEach(file => {
        addFileToList(file);
        loadLidarFile(file);
    });
}

/* 4e modification*/
function addFileToList(file) {
    const item = document.createElement("div");
    item.className = "list-group-item lidar-file-item";
    item.innerHTML = `<i class="fas fa-file me-2"></i>${file.name}`;
    fileList.appendChild(item);
}

/* 5e modification */
function loadLidarFile(file) {

    document.getElementById("loading-overlay").style.display = "flex";

    // TODO : remplacer par ton vrai loader LIDAR
    setTimeout(() => {
        console.log("Fichier chargé :", file.name);

        document.getElementById("loading-overlay").style.display = "none";

        document.getElementById("lidar-stats").style.display = "block";
        document.getElementById("stat-points").innerText = "Simulation";
    }, 1500);
}

/* fin des modifications */

uploadZone.addEventListener("click", () => fileInput.click());

/**
 * Initialisation de la scène 3D
 */
function init3DScene() {
    const container = document.getElementById('viewer-3d');
    
    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 1000, 10000);
    
    // Caméra
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 1, 50000);
    camera.position.set(500, 500, 500);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Contrôles OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 10000;
    controls.maxPolarAngle = Math.PI;
    
    // Lumières
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
    
    // Grille
    gridHelper = new THREE.GridHelper(1000, 50, 0x888888, 0xcccccc);
    scene.add(gridHelper);
    
    // Axes
    axesHelper = new THREE.AxesHelper(500);
    scene.add(axesHelper);
    
    // Gestion du redimensionnement
    window.addEventListener('resize', onWindowResize, false);
    
    // Démarrer l'animation
    animate();
}

/**
 * Animation loop
 */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

/**
 * Redimensionnement de la fenêtre
 */
function onWindowResize() {
    const container = document.getElementById('viewer-3d');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Charger et afficher un nuage de points LIDAR
 */
async function loadLidarPointCloud(lidarId, sampleSize = 10000) {
    showLoading(true);
    
    try {
        const data = await apiClient.getLidarSample(lidarId, sampleSize);
        
        // Supprimer le nuage précédent
        if (pointCloud) {
            scene.remove(pointCloud);
            pointCloud.geometry.dispose();
            pointCloud.material.dispose();
        }
        
        // Créer la géométrie
        const geometry = new THREE.BufferGeometry();
        
        const positions = [];
        const colors = [];
        
        // Normalisation des altitudes pour les couleurs
        const minZ = data.bounds.min_z;
        const maxZ = data.bounds.max_z;
        const rangeZ = maxZ - minZ;
        
        for (let i = 0; i < data.points.x.length; i++) {
            positions.push(
                data.points.x[i],
                data.points.z[i],  // Y dans Three.js = Z dans LIDAR
                data.points.y[i]
            );
            
            // Coloration par altitude (dégradé du bleu au rouge)
            const normalized = (data.points.z[i] - minZ) / rangeZ;
            const color = getElevationColor(normalized);
            colors.push(color.r, color.g, color.b);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeBoundingSphere();
        
        // Matériau des points
        const material = new THREE.PointsMaterial({
            size: parseFloat(document.getElementById('point-size').value),
            vertexColors: true,
            sizeAttenuation: true
        });
        
        // Créer le nuage de points
        pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);
        
        // Centrer la caméra
        centerCameraOnPointCloud(data.bounds);
        
        // Mettre à jour les statistiques
        updateStats(data);
        
        currentLidarId = lidarId;
        showLoading(false);
        showToast('Nuage de points chargé avec succès', 'success');
        
    } catch (error) {
        showLoading(false);
        showToast('Erreur chargement LIDAR: ' + error.message, 'danger');
        console.error('Error loading LIDAR:', error);
    }
}

/**
 * Obtenir une couleur basée sur l'altitude
 */
function getElevationColor(normalized) {
    // Dégradé: bleu (bas) -> vert -> jaune -> rouge (haut)
    if (normalized < 0.25) {
        // Bleu -> Cyan
        const t = normalized / 0.25;
        return {
            r: 0,
            g: t,
            b: 1
        };
    } else if (normalized < 0.5) {
        // Cyan -> Vert
        const t = (normalized - 0.25) / 0.25;
        return {
            r: 0,
            g: 1,
            b: 1 - t
        };
    } else if (normalized < 0.75) {
        // Vert -> Jaune
        const t = (normalized - 0.5) / 0.25;
        return {
            r: t,
            g: 1,
            b: 0
        };
    } else {
        // Jaune -> Rouge
        const t = (normalized - 0.75) / 0.25;
        return {
            r: 1,
            g: 1 - t,
            b: 0
        };
    }
}

/**
 * Centrer la caméra sur le nuage de points
 */
function centerCameraOnPointCloud(bounds) {
    const centerX = (bounds.min_x + bounds.max_x) / 2;
    const centerY = (bounds.min_y + bounds.max_y) / 2;
    const centerZ = (bounds.min_z + bounds.max_z) / 2;
    
    const rangeX = bounds.max_x - bounds.min_x;
    const rangeY = bounds.max_y - bounds.min_y;
    const rangeZ = bounds.max_z - bounds.min_z;
    
    const maxRange = Math.max(rangeX, rangeY, rangeZ);
    const distance = maxRange * 2;
    
    camera.position.set(
        centerX + distance,
        centerZ + distance,
        centerY + distance
    );
    
    controls.target.set(centerX, centerZ, centerY);
    controls.update();
}

/**
 * Mettre à jour les statistiques
 */
function updateStats(data) {
    document.getElementById('stat-points').textContent = data.point_count.toLocaleString();
    document.getElementById('stat-min-z').textContent = data.bounds.min_z.toFixed(2);
    document.getElementById('stat-max-z').textContent = data.bounds.max_z.toFixed(2);
    document.getElementById('stat-range').textContent = (data.bounds.max_z - data.bounds.min_z).toFixed(2);
    
    document.getElementById('lidar-stats').style.display = 'block';
}

/**
 * Charger la liste des fichiers LIDAR
 */
async function loadLidarFilesList() {
    try {
        const data = await apiClient.getLidarFiles();
        
        const listContainer = document.getElementById('lidar-files-list');
        
        if (data.files.length === 0) {
            listContainer.innerHTML = `
                <div class="text-muted text-center py-3">
                    <small>Aucun fichier LIDAR</small>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = '';
        
        data.files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'list-group-item lidar-file-item';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${file.filename}</h6>
                        <small class="text-muted">
                            ${file.point_count.toLocaleString()} points
                        </small>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-load" data-id="${file.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-delete" data-id="${file.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // Bouton charger
            item.querySelector('.btn-load').addEventListener('click', () => {
                loadLidarPointCloud(file.id);
                
                // Marquer comme actif
                document.querySelectorAll('.lidar-file-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
            });
            
            // Bouton supprimer
            item.querySelector('.btn-delete').addEventListener('click', async () => {
                if (confirm('Supprimer ce fichier LIDAR?')) {
                    try {
                        await apiClient.deleteLidarFile(file.id);
                        showToast('Fichier supprimé', 'success');
                        loadLidarFilesList();
                        
                        if (currentLidarId === file.id && pointCloud) {
                            scene.remove(pointCloud);
                            pointCloud = null;
                        }
                    } catch (error) {
                        showToast('Erreur suppression: ' + error.message, 'danger');
                    }
                }
            });
            
            listContainer.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error loading LIDAR files:', error);
    }
}

/**
 * Upload de fichier LIDAR
 */
function setupFileUpload() {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('lidar-file-input');
    
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadLidarFile(file);
        }
    });
    
    // Drag & drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.backgroundColor = '#f8f9fa';
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.backgroundColor = '';
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.backgroundColor = '';
        
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.las') || file.name.endsWith('.laz'))) {
            uploadLidarFile(file);
        } else {
            showToast('Format non supporté. Utilisez .las ou .laz', 'warning');
        }
    });
}

/**
 * Upload fichier LIDAR
 */
async function uploadLidarFile(file) {
    const progressContainer = document.getElementById('upload-progress');
    const progressBar = progressContainer.querySelector('.progress-bar');
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    try {
        progressBar.style.width = '50%';
        
        const response = await apiClient.uploadLidarFile(file);
        
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            showToast('Fichier uploadé avec succès', 'success');
            loadLidarFilesList();
        }, 500);
        
    } catch (error) {
        progressContainer.style.display = 'none';
        showToast('Erreur upload: ' + error.message, 'danger');
    }
}

/**
 * Contrôles de visualisation
 */
function setupViewerControls() {
    // Taille des points
    document.getElementById('point-size').addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        document.getElementById('point-size-value').textContent = size;
        
        if (pointCloud) {
            pointCloud.material.size = size;
        }
    });
    
    // Grille
    document.getElementById('show-grid').addEventListener('change', (e) => {
        gridHelper.visible = e.target.checked;
    });
    
    // Axes
    document.getElementById('show-axes').addEventListener('change', (e) => {
        axesHelper.visible = e.target.checked;
    });
    
    // Réinitialiser la caméra
    document.getElementById('btn-reset-camera').addEventListener('click', () => {
        if (pointCloud) {
            const box = new THREE.Box3().setFromObject(pointCloud);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;
            
            camera.position.set(
                center.x + distance,
                center.y + distance,
                center.z + distance
            );
            controls.target.copy(center);
            controls.update();
        }
    });
    
    // Capture d'écran
    document.getElementById('btn-screenshot').addEventListener('click', () => {
        renderer.render(scene, camera);
        const imgData = renderer.domElement.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `lidar_capture_${Date.now()}.png`;
        link.href = imgData;
        link.click();
        
        showToast('Capture d\'écran enregistrée', 'success');
    });
}

/**
 * Afficher/masquer le loading
 */
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
}

/**
 * Initialisation au chargement
 */
window.addEventListener('DOMContentLoaded', () => {
    init3DScene();
    setupFileUpload();
    setupViewerControls();
    loadLidarFilesList();
});
