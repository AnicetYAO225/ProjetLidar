/**
 * Carte 2D avec Leaflet
 */

// Initialisation de la carte
const map = L.map('map').setView([45.5, -73.6], 11); // Montréal par défaut

// Couche de base OpenStreetMap
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Couche satellite
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 19
});

// Groupe de couches pour les entités
const featuresLayer = L.layerGroup().addTo(map);

// Couches dessinées
const drawnItems = new L.FeatureGroup();
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

// Variables globales
let currentFeature = null;
let selectedFeatures = [];

// ===== IMPORT DE DONNÉES =====
const importBtn = document.getElementById("btn-import");
const fileInput = document.getElementById("file-input");

// couche importée
const importedLayer = L.geoJSON().addTo(map);

importBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (event) {
        const geojson = JSON.parse(event.target.result);

        importedLayer.clearLayers();
        importedLayer.addData(geojson);

        map.fitBounds(importedLayer.getBounds());
    };

    reader.readAsText(file);
});
/**
 * Gestion des événements de dessin
 */
map.on(L.Draw.Event.CREATED, function(e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);
    
    // Demander un nom pour l'entité
    const name = prompt('Nom de l\'entité:');
    if (name) {
        const feature = layer.toGeoJSON();
        
        // Sauvegarder dans l'API
        apiClient.createFeature(feature, name, 'user_drawn')
            .then(response => {
                showToast('Entité créée avec succès', 'success');
                loadFeatures();
            })
            .catch(error => {
                showToast('Erreur: ' + error.message, 'danger');
            });
    }
});

/**
 * Suivi de la position de la souris
 */
map.on('mousemove', function(e) {
    document.getElementById('mouse-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('mouse-lng').value = e.latlng.lng.toFixed(6);
});

/**
 * Charger les entités depuis l'API
 */
async function loadFeatures() {
    try {
        const data = await apiClient.getFeatures();
        
        // Effacer les entités existantes
        featuresLayer.clearLayers();
        
        if (data.features && data.features.length > 0) {
            // Ajouter les entités à la carte
            const geojsonLayer = L.geoJSON(data, {
                style: function(feature) {
                    return {
                        color: '#3388ff',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.3
                    };
                },
                pointToLayer: function(feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: '#3388ff',
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                },
                onEachFeature: function(feature, layer) {
                    // Popup avec informations
                    let popupContent = `
                        <div class="feature-popup">
                            <h6>${feature.properties.name || 'Sans nom'}</h6>
                            <p><strong>Catégorie:</strong> ${feature.properties.category || 'N/A'}</p>
                    `;
                    
                    if (feature.properties.description) {
                        popupContent += `<p>${feature.properties.description}</p>`;
                    }
                    
                    popupContent += `</div>`;
                    
                    layer.bindPopup(popupContent);
                    
                    // Événement de clic
                    layer.on('click', function(e) {
                        currentFeature = feature;
                        selectedFeatures = [feature];
                    });
                }
            });
            
            geojsonLayer.addTo(featuresLayer);
            
            // Mettre à jour la liste
            updateFeaturesList(data.features);
        } else {
            document.getElementById('features-list').innerHTML = `
                <div class="text-muted text-center py-3">
                    <small>Aucune entité disponible</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur chargement entités:', error);
        showToast('Erreur lors du chargement des entités', 'danger');
    }
}

/**
 * Mettre à jour la liste des entités
 */
function updateFeaturesList(features) {
    const listContainer = document.getElementById('features-list');
    
    if (features.length === 0) {
        listContainer.innerHTML = `
            <div class="text-muted text-center py-3">
                <small>Aucune entité</small>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = '';
    
    features.forEach((feature, index) => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${feature.properties.name || 'Sans nom'}</h6>
                <small class="text-muted">${feature.geometry.type}</small>
            </div>
            ${feature.properties.category ? `<small class="text-muted">${feature.properties.category}</small>` : ''}
        `;
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Zoomer sur l'entité
            const layer = L.geoJSON(feature);
            map.fitBounds(layer.getBounds());
        });
        
        listContainer.appendChild(item);
    });
}

/**
 * Gestion des boutons d'outils
 */
document.getElementById('btn-draw-point')?.addEventListener('click', () => {
    new L.Draw.Marker(map, drawControl.options.draw.marker).enable();
});

document.getElementById('btn-draw-line')?.addEventListener('click', () => {
    new L.Draw.Polyline(map, drawControl.options.draw.polyline).enable();
});

document.getElementById('btn-draw-polygon')?.addEventListener('click', () => {
    new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
});

document.getElementById('btn-buffer')?.addEventListener('click', async () => {
    if (!currentFeature) {
        showToast('Veuillez sélectionner une entité', 'warning');
        return;
    }
    
    const distance = prompt('Distance du buffer (en mètres):', '1000');
    if (distance) {
        try {
            const result = await apiClient.createBuffer(currentFeature, parseFloat(distance));
            
            // Ajouter le buffer à la carte
            const bufferLayer = L.geoJSON(result, {
                style: {
                    color: '#ff7800',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.2
                }
            });
            bufferLayer.addTo(featuresLayer);
            
            showToast('Buffer créé avec succès', 'success');
            map.fitBounds(bufferLayer.getBounds());
        } catch (error) {
            showToast('Erreur: ' + error.message, 'danger');
        }
    }
});

document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (confirm('Effacer tous les dessins?')) {
        drawnItems.clearLayers();
        featuresLayer.clearLayers();
        selectedFeatures = [];
        currentFeature = null;
    }
});

/**
 * Gestion des couches
 */
document.getElementById('layer-osm')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        osmLayer.addTo(map);
        satelliteLayer.remove();
    }
});

document.getElementById('layer-satellite')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        satelliteLayer.addTo(map);
        osmLayer.remove();
    }
});

document.getElementById("btn-buffer").onclick = function () {

    if (!drawnItems.getLayers().length) return;

    const layer = drawnItems.getLayers()[0];
    const geojson = layer.toGeoJSON();

    const buffered = turf.buffer(geojson, 0.2, { units: "kilometers" });

    const bufferLayer = L.geoJSON(buffered).addTo(map);
    drawnItems.addLayer(bufferLayer);
};

document.getElementById('layer-features')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        featuresLayer.addTo(map);
    } else {
        featuresLayer.remove();
    }
});

/**
 * Initialisation au chargement
 */
window.addEventListener('DOMContentLoaded', () => {
    // Charger les entités existantes
    loadFeatures();
    
    // Vérifier la connexion API
    apiClient.healthCheck()
        .then(response => {
            console.log('API Status:', response);
            if (response.database !== 'connected') {
                showToast('Attention: Base de données non connectée', 'warning');
            }
        })
        .catch(error => {
            showToast('Erreur de connexion à l\'API', 'danger');
            console.error('API Health Check failed:', error);
        });
});
