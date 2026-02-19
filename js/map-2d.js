/**
 * Carte 2D Interactive - WebSIG Portfolio
 * Toutes les fonctionnalités : fonds de carte, outils, panels, import/export
 */

(function () {
    'use strict';

    console.log('🗺️ Initialisation carte 2D...');

    // ==================== VARIABLES GLOBALES ====================

    let map = null;
    let osmLayer = null;
    let satelliteLayer = null;
    let topoLayer = null;
    let currentBaseLayer = null;

    let drawnItems = null;
    let drawControl = null;
    let markerCluster = null;

    let dataLayers = {};
    let layerIdCounter = 0;

    let currentFeature = null;
    let selectedFeatures = [];

    let clusteringEnabled = true;

    // ==================== INITIALISATION ====================

    function init() {
        console.log('🚀 Démarrage application...');

        // Initialiser la carte
        initMap();

        // Initialiser les contrôles
        initDrawControls();

        // Initialiser les panels
        initPanels();

        // Initialiser les fonds de carte
        initBasemaps();

        // Initialiser les boutons
        initButtons();

        // Initialiser l'import
        initImport();

        // Initialiser les événements carte
        initMapEvents();

        console.log('✅ Application prête !');
    }

    // ==================== CARTE ====================

    function initMap() {
        console.log('🗺️ Création de la carte...');

        // Créer la carte
        map = L.map('map', {
            center: [45.5, -73.6],
            zoom: 11,
            zoomControl: true
        });

        // Créer les fonds de carte
        osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        });

        topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap contributors',
            maxZoom: 17
        });

        // Ajouter OSM par défaut
        osmLayer.addTo(map);
        currentBaseLayer = osmLayer;

        console.log('✅ Carte créée avec succès');
    }

    // ==================== CONTRÔLES DE DESSIN ====================

    function initDrawControls() {
        console.log('✏️ Initialisation contrôles de dessin...');

        // Groupe pour les dessins
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        // Cluster pour les markers
        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });
        map.addLayer(markerCluster);

        console.log('✅ Contrôles de dessin initialisés');
    }

    // ==================== PANELS ====================

    function initPanels() {
        console.log('📂 Initialisation des panels...');

        const toolsPanel = document.getElementById('tools-panel');
        const sidebar = document.getElementById('sidebar');
        const toggleTools = document.getElementById('toggle-tools');
        const toggleLayers = document.getElementById('toggle-layers');
        const closeTools = document.getElementById('close-tools');
        const closeSidebar = document.getElementById('close-sidebar');

        // Toggle outils
        if (toggleTools) {
            toggleTools.addEventListener('click', function () {
                console.log('🔧 Toggle panel outils');
                toolsPanel.classList.toggle('collapsed');
                this.classList.toggle('hidden');
            });
        }

        // Toggle gestionnaire
        if (toggleLayers) {
            toggleLayers.addEventListener('click', function () {
                console.log('📚 Toggle panel gestionnaire');
                sidebar.classList.toggle('collapsed');
                this.classList.toggle('hidden');
            });
        }

        // Fermer outils
        if (closeTools) {
            closeTools.addEventListener('click', function () {
                console.log('❌ Fermer panel outils');
                toolsPanel.classList.add('collapsed');
                toggleTools.classList.remove('hidden');
            });
        }

        // Fermer gestionnaire
        if (closeSidebar) {
            closeSidebar.addEventListener('click', function () {
                console.log('❌ Fermer panel gestionnaire');
                sidebar.classList.add('collapsed');
                toggleLayers.classList.remove('hidden');
            });
        }

        // Fermer avec Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                toolsPanel.classList.add('collapsed');
                sidebar.classList.add('collapsed');
                toggleTools.classList.remove('hidden');
                toggleLayers.classList.remove('hidden');
            }
        });

        console.log('✅ Panels configurés');
    }

    // Fonction pour parser CSV en GeoJSON
    function csvToGeoJSON(csvText, filename) {
        console.log(`📄 Parsing CSV: ${filename}`);

        try {
            // Parser avec PapaParse
            const result = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });

            if (result.errors.length > 0) {
                throw new Error(`Erreur parsing CSV: ${result.errors[0].message}`);
            }

            const data = result.data;

            // Trouver colonnes lat/lon
            const headers = Object.keys(data[0] || {});
            const latCol = headers.find(h => ['lat', 'latitude', 'y'].includes(h.toLowerCase()));
            const lonCol = headers.find(h => ['lon', 'lng', 'longitude', 'x'].includes(h.toLowerCase()));

            if (!latCol || !lonCol) {
                throw new Error('Colonnes latitude/longitude introuvables. Utilisez: lat,lon ou latitude,longitude');
            }

            // Convertir en GeoJSON
            const features = data.map((row, index) => {
                const lat = parseFloat(row[latCol]);
                const lon = parseFloat(row[lonCol]);

                // Valider
                if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    console.warn(`⚠️ Ligne ${index + 1} ignorée: coordonnées invalides`);
                    return null;
                }

                // Propriétés
                const properties = {};
                for (const key in row) {
                    if (key !== latCol && key !== lonCol) {
                        properties[key] = row[key];
                    }
                }

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [lon, lat]
                    },
                    properties: properties
                };
            }).filter(f => f !== null);

            return {
                type: 'FeatureCollection',
                features: features
            };

        } catch (error) {
            console.error('❌ Erreur conversion CSV:', error);
            throw error;
        }
    }

    // ==================== FONDS DE CARTE ====================

    function initBasemaps() {
        console.log('🎨 Initialisation fonds de carte...');

        const osmRadio = document.getElementById('layer-osm');
        const satelliteRadio = document.getElementById('layer-satellite');
        const topoRadio = document.getElementById('layer-topo');

        // OpenStreetMap
        if (osmRadio) {
            osmRadio.addEventListener('change', function () {
                if (this.checked) {
                    console.log('🗺️ Changement vers OSM');
                    switchBaseLayer(osmLayer);
                }
            });
        }

        // Satellite
        if (satelliteRadio) {
            satelliteRadio.addEventListener('change', function () {
                if (this.checked) {
                    console.log('🛰️ Changement vers Satellite');
                    switchBaseLayer(satelliteLayer);
                }
            });
        }

        // Topographique
        if (topoRadio) {
            topoRadio.addEventListener('change', function () {
                if (this.checked) {
                    console.log('⛰️ Changement vers Topographique');
                    switchBaseLayer(topoLayer);
                }
            });
        }

        console.log('✅ Fonds de carte configurés');
    }

    function switchBaseLayer(newLayer) {
        if (currentBaseLayer) {
            map.removeLayer(currentBaseLayer);
        }
        newLayer.addTo(map);
        currentBaseLayer = newLayer;
    }

    // ==================== BOUTONS ====================

    function initButtons() {
        console.log('🔘 Initialisation boutons...');

        // Boutons de dessin
        const btnPoint = document.getElementById('btn-draw-point');
        const btnLine = document.getElementById('btn-draw-line');
        const btnPolygon = document.getElementById('btn-draw-polygon');
        const btnRectangle = document.getElementById('btn-draw-rectangle');

        if (btnPoint) {
            btnPoint.addEventListener('click', function () {
                console.log('📍 Outil Point');
                new L.Draw.Marker(map).enable();
            });
        }

        if (btnLine) {
            btnLine.addEventListener('click', function () {
                console.log('📏 Outil Ligne');
                new L.Draw.Polyline(map).enable();
            });
        }

        if (btnPolygon) {
            btnPolygon.addEventListener('click', function () {
                console.log('🔷 Outil Polygone');
                new L.Draw.Polygon(map).enable();
            });
        }

        if (btnRectangle) {
            btnRectangle.addEventListener('click', function () {
                console.log('⬛ Outil Rectangle');
                new L.Draw.Rectangle(map).enable();
            });
        }

        // Bouton Buffer
        const btnBuffer = document.getElementById('btn-buffer');
        if (btnBuffer) {
            btnBuffer.addEventListener('click', function () {
                console.log('⭕ Outil Buffer');
                runBuffer();
            });
        }

        // Bouton Clear
        const btnClear = document.getElementById('btn-clear');
        if (btnClear) {
            btnClear.addEventListener('click', function () {
                console.log('🗑️ Effacer tout');
                if (confirm('Effacer toutes les données ?')) {
                    clearAll();
                }
            });
        }

        // Bouton Export
        const btnExport = document.getElementById('btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', function () {
                console.log('💾 Export');
                exportData();
            });
        }

        // Clustering toggle
        const clusterToggle = document.getElementById('toggle-clustering');
        if (clusterToggle) {
            clusterToggle.addEventListener('change', function () {
                clusteringEnabled = this.checked;
                console.log('🔄 Clustering:', clusteringEnabled);
                refreshLayers();
            });
        }

        console.log('✅ Boutons configurés');
    }

    // ==================== ÉVÉNEMENTS CARTE ====================

    function initMapEvents() {
        console.log('🎯 Initialisation événements carte...');

        // Événement de dessin créé
        map.on(L.Draw.Event.CREATED, function (e) {
            const layer = e.layer;
            const type = e.layerType;

            console.log('✏️ Nouvelle entité dessinée:', type);

            // Demander un nom
            const name = prompt('Nom de l\'entité:', `Entité ${Date.now()}`);
            if (!name) return;

            // Ajouter au groupe
            drawnItems.addLayer(layer);

            // Popup
            const popup = `<strong>${name}</strong><br>Type: ${type}`;
            layer.bindPopup(popup);

            // Sauvegarder dans dataLayers
            const layerId = 'drawn_' + layerIdCounter++;
            dataLayers[layerId] = {
                name: name,
                type: type,
                layer: layer,
                featureCount: 1
            };

            updateStats();
            updateLayersList();

            showToast('Entité créée', 'success');
        });

        // Coordonnées de la souris
        map.on('mousemove', function (e) {
            const lat = e.latlng.lat.toFixed(5);
            const lng = e.latlng.lng.toFixed(5);

            const latInput = document.getElementById('mouse-lat');
            const lngInput = document.getElementById('mouse-lng');

            if (latInput) latInput.value = lat;
            if (lngInput) lngInput.value = lng;
        });

        // Niveau de zoom
        map.on('zoomend', function () {
            const zoomInput = document.getElementById('map-zoom');
            if (zoomInput) {
                zoomInput.value = map.getZoom();
            }
        });

        console.log('✅ Événements configurés');
    }

    // ==================== IMPORT ====================

    function initImport() {
        console.log('📥 Initialisation import...');

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        if (dropZone && fileInput) {
            // Clic sur la drop zone
            dropZone.addEventListener('click', function () {
                console.log('📂 Clic drop zone');
                fileInput.click();
            });

            // Drag over
            dropZone.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.add('drag-over');
            });

            // Drag leave
            dropZone.addEventListener('dragleave', function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('drag-over');
            });

            // Drop
            dropZone.addEventListener('drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
                this.classList.remove('drag-over');

                const files = e.dataTransfer.files;
                console.log('📥 Drop', files.length, 'fichier(s)');
                handleFiles(files);
            });

            // File input change
            fileInput.addEventListener('change', function (e) {
                const files = e.target.files;
                console.log('📁 Fichiers sélectionnés:', files.length);
                handleFiles(files);
            });
        }

        console.log('✅ Import configuré');
    }

async function handleFiles(files) {
    console.log(`📥 Traitement ${files.length} fichier(s)`);
    
    for (const file of files) {
        console.log(`📄 Fichier: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        
        // Vérifier taille
        const maxSize = file.name.endsWith('.csv') ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast(`Fichier ${file.name} trop volumineux (max ${maxSize / 1024 / 1024}MB)`, 'error');
            continue;
        }
        
        // Lire le fichier
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                let geojson;
                
                // Déterminer le type de fichier
                if (file.name.endsWith('.csv')) {
                    // CSV → GeoJSON
                    geojson = csvToGeoJSON(content, file.name);
                } else if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
                    // GeoJSON direct
                    geojson = JSON.parse(content);
                } else if (file.name.endsWith('.kml')) {
                    // KML → GeoJSON (nécessite toGeoJSON ou omnivore)
                    showToast('KML: conversion en cours...', 'info');
                    // TODO: Implémenter conversion KML
                    geojson = null;
                } else if (file.name.endsWith('.gpx')) {
                    // GPX → GeoJSON
                    showToast('GPX: conversion en cours...', 'info');
                    // TODO: Implémenter conversion GPX
                    geojson = null;
                } else {
                    throw new Error('Format non supporté');
                }
                
                if (geojson) {
                    // Valider GeoJSON
                    if (!geojson.type || !geojson.features) {
                        throw new Error('GeoJSON invalide: structure incorrecte');
                    }
                    
                    console.log(`✅ ${geojson.features.length} entités chargées`);
                    
                    // Afficher sur la carte
                    displayFeatures(geojson, file.name);
                    showToast(`${file.name} chargé (${geojson.features.length} entités)`, 'success');
                } else {
                    throw new Error('Impossible de convertir le fichier');
                }
                
            } catch (error) {
                console.error('❌ Erreur lecture fichier:', error);
                showToast(`Erreur: ${error.message}`, 'error');
            }
        };
        
        reader.onerror = function() {
            console.error('❌ Erreur FileReader');
            showToast(`Impossible de lire ${file.name}`, 'error');
        };
        
        // Lire comme texte
        reader.readAsText(file);
    }
}

    function displayGeoJSON(geojson, name) {
        console.log('🗺️ Affichage GeoJSON:', name);

        const layerId = 'layer_' + layerIdCounter++;
        let featureCount = 0;

        const layer = L.geoJSON(geojson, {
            style: function () {
                return {
                    color: getRandomColor(),
                    weight: 2,
                    fillOpacity: 0.5
                };
            },
            pointToLayer: function (feature, latlng) {
                featureCount++;
                return L.circleMarker(latlng, {
                    radius: 6,
                    fillColor: getRandomColor(),
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function (feature, layer) {
                featureCount++;

                const props = feature.properties || {};
                let popupContent = `<div class="feature-popup">`;
                popupContent += `<h6>${props.name || name}</h6>`;
                popupContent += `<span class="badge bg-primary">${feature.geometry.type}</span>`;

                for (let key in props) {
                    if (key !== 'name') {
                        popupContent += `<br><strong>${key}:</strong> ${props[key]}`;
                    }
                }

                popupContent += `</div>`;
                layer.bindPopup(popupContent);

                // Clic pour sélectionner
                layer.on('click', function () {
                    currentFeature = feature;
                    console.log('👆 Entité sélectionnée');
                });
            }
        });

        if (clusteringEnabled) {
            markerCluster.addLayer(layer);
        } else {
            layer.addTo(map);
        }

        // Sauvegarder
        dataLayers[layerId] = {
            name: name,
            layer: layer,
            featureCount: featureCount,
            geojson: geojson
        };

        // Zoom sur la couche
        if (layer.getBounds && layer.getBounds().isValid()) {
            map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }

        updateStats();
        updateLayersList();

        showToast(`${name} chargé (${featureCount} entités)`, 'success');
    }

    // ==================== ANALYSES ====================

    function runBuffer() {
        if (!currentFeature) {
            showToast('Sélectionnez une entité d\'abord', 'warning');
            return;
        }

        const distance = prompt('Distance du buffer (mètres):', '1000');
        if (!distance) return;

        try {
            const buffered = turf.buffer(currentFeature, parseFloat(distance) / 1000, { units: 'kilometers' });

            const bufferLayer = L.geoJSON(buffered, {
                style: {
                    color: '#ff7800',
                    weight: 2,
                    fillOpacity: 0.3
                }
            });

            bufferLayer.addTo(map);
            bufferLayer.bindPopup(`Buffer ${distance}m`);

            const layerId = 'buffer_' + layerIdCounter++;
            dataLayers[layerId] = {
                name: `Buffer ${distance}m`,
                layer: bufferLayer,
                featureCount: 1
            };

            updateStats();
            updateLayersList();

            showToast('Buffer créé', 'success');

        } catch (error) {
            console.error('❌ Erreur buffer:', error);
            showToast('Erreur lors du buffer', 'danger');
        }
    }

    // ==================== EXPORT ====================

    function exportData() {
        console.log('💾 Export des données');

        const features = [];

        // Collecter toutes les features
        for (let layerId in dataLayers) {
            const layerData = dataLayers[layerId];
            if (layerData.geojson) {
                features.push(...layerData.geojson.features);
            }
        }

        // Créer FeatureCollection
        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        // Télécharger
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `export_${Date.now()}.geojson`;
        link.click();

        showToast('Export réussi', 'success');
    }

    // ==================== UTILITAIRES ====================

    function clearAll() {
        console.log('🗑️ Effacement de toutes les données');

        drawnItems.clearLayers();
        markerCluster.clearLayers();

        for (let layerId in dataLayers) {
            const layerData = dataLayers[layerId];
            if (layerData.layer) {
                map.removeLayer(layerData.layer);
            }
        }

        dataLayers = {};
        currentFeature = null;
        selectedFeatures = [];

        updateStats();
        updateLayersList();

        showToast('Tout effacé', 'info');
    }

    function updateStats() {
        const layerCount = Object.keys(dataLayers).length;
        let featureCount = 0;

        for (let layerId in dataLayers) {
            featureCount += dataLayers[layerId].featureCount || 0;
        }

        const statsLayers = document.getElementById('stats-layers');
        const statsFeatures = document.getElementById('stats-features');

        if (statsLayers) statsLayers.textContent = layerCount;
        if (statsFeatures) statsFeatures.textContent = featureCount;
    }

    function updateLayersList() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;

        if (Object.keys(dataLayers).length === 0) {
            layersList.innerHTML = `
                <div class="text-muted text-center py-3">
                    <small>Aucune couche chargée</small>
                </div>
            `;
            return;
        }

        let html = '';

        for (let layerId in dataLayers) {
            const layerData = dataLayers[layerId];
            html += `
                <div class="layer-item" data-layer-id="${layerId}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <i class="fas fa-layer-group me-2 text-primary"></i>
                            <strong>${layerData.name}</strong>
                        </div>
                        <span class="badge bg-secondary">${layerData.featureCount || 0}</span>
                    </div>
                    <div class="layer-controls">
                        <button class="btn btn-sm btn-outline-primary" onclick="zoomToLayer('${layerId}')">
                            <i class="fas fa-search-plus"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteLayer('${layerId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        layersList.innerHTML = html;
    }

    function refreshLayers() {
        console.log('🔄 Rafraîchissement des couches');

        markerCluster.clearLayers();

        for (let layerId in dataLayers) {
            const layerData = dataLayers[layerId];

            if (clusteringEnabled) {
                map.removeLayer(layerData.layer);
                markerCluster.addLayer(layerData.layer);
            } else {
                markerCluster.removeLayer(layerData.layer);
                layerData.layer.addTo(map);
            }
        }
    }

    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const bgClass = {
            'success': 'bg-success',
            'danger': 'bg-danger',
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-info';

        const toastId = 'toast_' + Date.now();

        const toastHTML = `
            <div class="toast ${bgClass} text-white" role="alert" id="${toastId}">
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();

        setTimeout(() => {
            toastElement.remove();
        }, 3500);
    }

    function getRandomColor() {
        const colors = [
            '#3388ff', '#ff7800', '#00ff00', '#ff0000',
            '#ffff00', '#ff00ff', '#00ffff', '#ffa500'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ==================== FONCTIONS GLOBALES ====================

    window.zoomToLayer = function (layerId) {
        const layerData = dataLayers[layerId];
        if (layerData && layerData.layer) {
            if (layerData.layer.getBounds) {
                map.fitBounds(layerData.layer.getBounds(), { padding: [50, 50] });
            }
        }
    };

    window.deleteLayer = function (layerId) {
        if (!confirm('Supprimer cette couche ?')) return;

        const layerData = dataLayers[layerId];
        if (layerData) {
            if (layerData.layer) {
                map.removeLayer(layerData.layer);
                markerCluster.removeLayer(layerData.layer);
            }
            delete dataLayers[layerId];

            updateStats();
            updateLayersList();
            showToast('Couche supprimée', 'info');
        }
    };

    // ==================== DÉMARRAGE ====================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ Script carte 2D chargé');

})();
