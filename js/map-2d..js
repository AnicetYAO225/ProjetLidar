/**
 * Carte 2D - Version Ultra-Safe avec gestion d'erreurs complète
 */

(function () {
    'use strict';

    console.log('🚀 Démarrage du script carte 2D...');

    // Vérifications de sécurité
    try {
        if (typeof L === 'undefined') {
            console.error('❌ Leaflet non chargé !');
            alert('Erreur: Bibliothèque Leaflet non chargée. Rechargez la page.');
            return;
        }
        console.log('✅ Leaflet détecté');

        if (typeof bootstrap === 'undefined') {
            console.warn('⚠️ Bootstrap non chargé');
        } else {
            console.log('✅ Bootstrap détecté');
        }

    } catch (e) {
        console.error('❌ Erreur initialisation:', e);
        return;
    }

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        CHUNK_SIZE: 1000,
        MAX_ZOOM: 19
    };

    // ==================== VARIABLES GLOBALES ====================
    let map = null;
    let osmLayer = null;
    let satelliteLayer = null;
    let topoLayer = null;
    let drawnItems = null;
    let dataLayers = {};
    let layerIdCounter = 0;
    let currentFeature = null;
    let selectedFeatures = [];

    // ==================== UTILITAIRES ====================

    function showToast(message, type) {
        type = type || 'info';
        console.log(`📢 [${type.toUpperCase()}] ${message}`);

        try {
            const toastContainer = document.getElementById('toast-container');
            if (!toastContainer) return;

            const toastEl = document.createElement('div');
            toastEl.className = 'toast align-items-center text-white bg-' + type + ' border-0';
            toastEl.setAttribute('role', 'alert');
            toastEl.innerHTML = '<div class="d-flex"><div class="toast-body">' + message + '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>';

            toastContainer.appendChild(toastEl);

            if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
                const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
                toast.show();
                toastEl.addEventListener('hidden.bs.toast', function () {
                    toastEl.remove();
                });
            } else {
                setTimeout(function () { toastEl.remove(); }, 3000);
            }
        } catch (e) {
            console.error('Erreur showToast:', e);
        }
    }

    function setLoading(show, text) {
        try {
            const overlay = document.getElementById('loading-overlay');
            if (!overlay) return;

            const loadingText = document.getElementById('loading-text');
            if (loadingText) {
                loadingText.textContent = text || 'Chargement...';
            }

            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        } catch (e) {
            console.error('Erreur setLoading:', e);
        }
    }

    function updateStats() {
        try {
            const layerCount = Object.keys(dataLayers).length;
            let featureCount = 0;

            for (const layerId in dataLayers) {
                featureCount += dataLayers[layerId].featureCount || 0;
            }

            const statsLayers = document.getElementById('stats-layers');
            const statsFeatures = document.getElementById('stats-features');

            if (statsLayers) statsLayers.textContent = layerCount;
            if (statsFeatures) statsFeatures.textContent = featureCount;
        } catch (e) {
            console.error('Erreur updateStats:', e);
        }
    }

    // ==================== INITIALISATION CARTE ====================

    function initMap() {
        try {
            console.log('🗺️ Création de la carte...');

            map = L.map('map', {
                preferCanvas: true
            }).setView([45.5, -73.6], 11);

            console.log('✅ Carte créée');

            // Fonds de carte
            osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: CONFIG.MAX_ZOOM
            });

            satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                maxZoom: CONFIG.MAX_ZOOM
            });

            topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap',
                maxZoom: 17
            });

            // Ajouter OSM par défaut
            osmLayer.addTo(map);
            console.log('✅ OpenStreetMap chargé');

            // Groupe pour dessins
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);

            // Contrôles de dessin
            const drawControl = new L.Control.Draw({
                draw: {
                    polyline: true,
                    polygon: true,
                    circle: false,
                    rectangle: true,
                    marker: true,
                    circlemarker: false
                },
                edit: {
                    featureGroup: drawnItems,
                    remove: true
                }
            });
            map.addControl(drawControl);

            console.log('✅ Contrôles de dessin ajoutés');

            // Événement de création
            map.on(L.Draw.Event.CREATED, function (e) {
                try {
                    console.log('✏️ Nouvelle entité dessinée');
                    const layer = e.layer;
                    drawnItems.addLayer(layer);

                    const name = prompt('Nom de l\'entité:');
                    if (name) {
                        const feature = layer.toGeoJSON();
                        feature.properties = { name: name };
                        console.log('💾 Entité:', name);
                        showToast('Entité créée: ' + name, 'success');
                    }
                } catch (err) {
                    console.error('Erreur création:', err);
                }
            });

            // Coordonnées souris
            map.on('mousemove', function (e) {
                try {
                    const mouseLat = document.getElementById('mouse-lat');
                    const mouseLng = document.getElementById('mouse-lng');
                    if (mouseLat) mouseLat.value = e.latlng.lat.toFixed(6);
                    if (mouseLng) mouseLng.value = e.latlng.lng.toFixed(6);
                } catch (err) { }
            });

            map.on('zoomend', function () {
                try {
                    const mapZoom = document.getElementById('map-zoom');
                    if (mapZoom) mapZoom.value = map.getZoom();
                } catch (err) { }
            });

            console.log('✅ Carte initialisée avec succès');

        } catch (e) {
            console.error('❌ Erreur initialisation carte:', e);
            alert('Erreur lors de l\'initialisation de la carte. Rechargez la page.');
        }
    }

    // ==================== PANELS ====================

    function initPanels() {
        try {
            console.log('📂 Initialisation des panels...');

            const toolsPanel = document.getElementById('tools-panel');
            const sidebar = document.getElementById('sidebar');
            const toggleTools = document.getElementById('toggle-tools');
            const toggleLayers = document.getElementById('toggle-layers');
            const closeTools = document.getElementById('close-tools');
            const closeSidebar = document.getElementById('close-sidebar');

            if (toggleTools && toolsPanel) {
                toggleTools.onclick = function () {
                    console.log('🔧 Toggle outils');
                    toolsPanel.classList.toggle('collapsed');
                };
            }

            if (closeTools && toolsPanel) {
                closeTools.onclick = function () {
                    console.log('❌ Fermer outils');
                    toolsPanel.classList.add('collapsed');
                };
            }

            if (toggleLayers && sidebar) {
                toggleLayers.onclick = function () {
                    console.log('📚 Toggle gestionnaire');
                    sidebar.classList.toggle('collapsed');
                };
            }

            if (closeSidebar && sidebar) {
                closeSidebar.onclick = function () {
                    console.log('❌ Fermer gestionnaire');
                    sidebar.classList.add('collapsed');
                };
            }

            console.log('✅ Panels configurés');
        } catch (e) {
            console.error('Erreur panels:', e);
        }
    }

    // ==================== FONDS DE CARTE ====================

    function initBasemaps() {
        try {
            console.log('🎨 Initialisation fonds de carte...');

            const layerOsm = document.getElementById('layer-osm');
            const layerSat = document.getElementById('layer-satellite');
            const layerTop = document.getElementById('layer-topo');

            if (layerOsm) {
                layerOsm.onchange = function () {
                    if (this.checked) {
                        console.log('🗺️ → OpenStreetMap');
                        map.removeLayer(satelliteLayer);
                        map.removeLayer(topoLayer);
                        osmLayer.addTo(map);
                    }
                };
            }

            if (layerSat) {
                layerSat.onchange = function () {
                    if (this.checked) {
                        console.log('🛰️ → Satellite');
                        map.removeLayer(osmLayer);
                        map.removeLayer(topoLayer);
                        satelliteLayer.addTo(map);
                    }
                };
            }

            if (layerTop) {
                layerTop.onchange = function () {
                    if (this.checked) {
                        console.log('⛰️ → Topographique');
                        map.removeLayer(osmLayer);
                        map.removeLayer(satelliteLayer);
                        topoLayer.addTo(map);
                    }
                };
            }

            console.log('✅ Fonds de carte configurés');
        } catch (e) {
            console.error('Erreur basemaps:', e);
        }
    }

    // ==================== IMPORT ====================

    function initImport() {
        try {
            console.log('📥 Initialisation import...');

            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');

            if (!dropZone || !fileInput) {
                console.warn('⚠️ Éléments import non trouvés');
                return;
            }

            dropZone.onclick = function () {
                console.log('📂 Clic drop zone');
                fileInput.click();
            };

            dropZone.ondragover = function (e) {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            };

            dropZone.ondragleave = function () {
                dropZone.classList.remove('drag-over');
            };

            dropZone.ondrop = function (e) {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                console.log('📥 Drop fichiers');

                const files = Array.from(e.dataTransfer.files);
                handleFiles(files);
            };

            fileInput.onchange = function (e) {
                console.log('📂 Fichiers sélectionnés');
                const files = Array.from(e.target.files);
                handleFiles(files);
                e.target.value = '';
            };

            console.log('✅ Import configuré');
        } catch (e) {
            console.error('Erreur import:', e);
        }
    }

    function handleFiles(files) {
        try {
            console.log('📥 Traitement ' + files.length + ' fichier(s)');

            if (files.length === 0) return;

            setLoading(true, 'Chargement...');

            let processed = 0;

            files.forEach(function (file) {
                loadFile(file, function () {
                    processed++;
                    if (processed === files.length) {
                        setLoading(false);
                        showToast(files.length + ' fichier(s) chargé(s)', 'success');
                    }
                });
            });

        } catch (e) {
            console.error('Erreur handleFiles:', e);
            setLoading(false);
            showToast('Erreur traitement fichiers', 'danger');
        }
    }

    function loadFile(file, callback) {
        try {
            console.log('📄 Lecture ' + file.name);

            const reader = new FileReader();

            reader.onload = function (e) {
                try {
                    const geojson = JSON.parse(e.target.result);

                    if (!geojson.type || !geojson.features) {
                        throw new Error('GeoJSON invalide');
                    }

                    displayFeatures(geojson, file.name);
                    console.log('✅ ' + file.name + ' chargé');

                    if (callback) callback();

                } catch (err) {
                    console.error('Erreur parsing:', err);
                    showToast('Erreur: ' + err.message, 'danger');
                    if (callback) callback();
                }
            };

            reader.onerror = function () {
                console.error('Erreur lecture fichier');
                if (callback) callback();
            };

            reader.readAsText(file);

        } catch (e) {
            console.error('Erreur loadFile:', e);
            if (callback) callback();
        }
    }

    function displayFeatures(geojson, name) {
        try {
            console.log('🗺️ Affichage ' + name);

            const features = geojson.features || [];
            if (features.length === 0) {
                showToast('Aucune entité dans le fichier', 'warning');
                return;
            }

            const layerId = 'layer_' + (layerIdCounter++);

            const layer = L.geoJSON(geojson, {
                style: function () {
                    return {
                        color: '#3388ff',
                        fillColor: '#3388ff',
                        fillOpacity: 0.3,
                        weight: 2
                    };
                },
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: '#3388ff',
                        color: '#fff',
                        weight: 2,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties || {};
                    const popupText = '<strong>' + (props.name || 'Sans nom') + '</strong><br>Type: ' + feature.geometry.type;
                    layer.bindPopup(popupText);

                    layer.on('click', function () {
                        currentFeature = feature;
                        selectedFeatures = [feature];
                        console.log('📍 Sélection:', props.name || 'Sans nom');
                    });
                }
            });

            layer.addTo(map);

            dataLayers[layerId] = {
                name: name,
                layer: layer,
                visible: true,
                featureCount: features.length,
                data: geojson
            };

            if (layer.getBounds && layer.getBounds().isValid()) {
                map.fitBounds(layer.getBounds(), { padding: [50, 50] });
            }

            updateLayersList();
            updateStats();

            console.log('✅ ' + features.length + ' entités affichées');

        } catch (e) {
            console.error('Erreur displayFeatures:', e);
            showToast('Erreur affichage: ' + e.message, 'danger');
        }
    }

    function updateLayersList() {
        try {
            const container = document.getElementById('layers-list');
            if (!container) return;

            if (Object.keys(dataLayers).length === 0) {
                container.innerHTML = '<div class="text-muted text-center py-3"><small>Aucune couche</small></div>';
                return;
            }

            container.innerHTML = '';

            for (const layerId in dataLayers) {
                const ld = dataLayers[layerId];

                const item = document.createElement('div');
                item.className = 'layer-item';
                item.innerHTML = '<strong>' + ld.name + '</strong><br><small>' + ld.featureCount + ' entités</small>';

                const btnDel = document.createElement('button');
                btnDel.className = 'btn btn-sm btn-danger mt-2';
                btnDel.innerHTML = '<i class="fas fa-trash"></i> Supprimer';
                btnDel.onclick = function () {
                    if (confirm('Supprimer ' + ld.name + ' ?')) {
                        map.removeLayer(ld.layer);
                        delete dataLayers[layerId];
                        updateLayersList();
                        updateStats();
                        showToast('Couche supprimée', 'success');
                    }
                };

                item.appendChild(btnDel);
                container.appendChild(item);
            }
        } catch (e) {
            console.error('Erreur updateLayersList:', e);
        }
    }

    // ==================== OUTILS ====================

    function initTools() {
        try {
            console.log('🔧 Initialisation outils...');

            const btnPoint = document.getElementById('btn-draw-point');
            const btnLine = document.getElementById('btn-draw-line');
            const btnPoly = document.getElementById('btn-draw-polygon');
            const btnRect = document.getElementById('btn-draw-rectangle');
            const btnBuffer = document.getElementById('btn-buffer');
            const btnClear = document.getElementById('btn-clear');
            const btnExport = document.getElementById('btn-export');

            if (btnPoint) {
                btnPoint.onclick = function () {
                    console.log('📍 Outil Point');
                    new L.Draw.Marker(map).enable();
                };
            }

            if (btnLine) {
                btnLine.onclick = function () {
                    console.log('📏 Outil Ligne');
                    new L.Draw.Polyline(map).enable();
                };
            }

            if (btnPoly) {
                btnPoly.onclick = function () {
                    console.log('⬡ Outil Polygone');
                    new L.Draw.Polygon(map).enable();
                };
            }

            if (btnRect) {
                btnRect.onclick = function () {
                    console.log('▭ Outil Rectangle');
                    new L.Draw.Rectangle(map).enable();
                };
            }

            if (btnBuffer) {
                btnBuffer.onclick = function () {
                    console.log('⭕ Buffer');
                    if (!currentFeature) {
                        showToast('Sélectionnez une entité', 'warning');
                        return;
                    }
                    if (typeof turf !== 'undefined') {
                        const dist = prompt('Distance (km):', '1');
                        if (dist) {
                            try {
                                const buffered = turf.buffer(currentFeature, parseFloat(dist), { units: 'kilometers' });
                                const bufferLayer = L.geoJSON(buffered, {
                                    style: { color: '#ff7800', fillOpacity: 0.2 }
                                });
                                bufferLayer.addTo(drawnItems);
                                map.fitBounds(bufferLayer.getBounds());
                                showToast('Buffer créé', 'success');
                            } catch (e) {
                                showToast('Erreur buffer: ' + e.message, 'danger');
                            }
                        }
                    } else {
                        showToast('Turf.js non chargé', 'warning');
                    }
                };
            }

            if (btnClear) {
                btnClear.onclick = function () {
                    if (confirm('Tout effacer ?')) {
                        drawnItems.clearLayers();
                        for (const id in dataLayers) {
                            map.removeLayer(dataLayers[id].layer);
                            delete dataLayers[id];
                        }
                        updateLayersList();
                        updateStats();
                        showToast('Effacé', 'success');
                    }
                };
            }

            if (btnExport) {
                btnExport.onclick = function () {
                    console.log('💾 Export');
                    const all = [];
                    for (const id in dataLayers) {
                        if (dataLayers[id].data && dataLayers[id].data.features) {
                            all.push(...dataLayers[id].data.features);
                        }
                    }
                    if (all.length === 0) {
                        showToast('Rien à exporter', 'warning');
                        return;
                    }
                    const geojson = { type: 'FeatureCollection', features: all };
                    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'export_' + Date.now() + '.geojson';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Exporté', 'success');
                };
            }

            console.log('✅ Outils configurés');
        } catch (e) {
            console.error('Erreur outils:', e);
        }
    }

    // ==================== INITIALISATION GLOBALE ====================

    function init() {
        try {
            console.log('🚀 Initialisation globale...');

            initMap();
            initPanels();
            initBasemaps();
            initImport();
            initTools();

            // Zoom initial
            const mapZoom = document.getElementById('map-zoom');
            if (mapZoom && map) {
                mapZoom.value = map.getZoom();
            }

            updateStats();

            console.log('✅ Application prête !');
            showToast('Carte chargée', 'success');

        } catch (e) {
            console.error('❌ Erreur initialisation:', e);
            alert('Erreur critique: ' + e.message);
        }
    }

    // Démarrer quand le DOM est prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

console.log('✅ Script chargé sans erreur');