/**
 * Logique pour la page d'analyses spatiales
 */

// Initialisation de la carte
const analysisMap = L.map('analysis-map').setView([45.5, -73.6], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(analysisMap);

// Couche pour les résultats
const resultsLayer = L.layerGroup().addTo(analysisMap);

/**
 * Analyse Buffer
 */
document.getElementById('btn-run-buffer')?.addEventListener('click', async () => {
    const coordsInput = document.getElementById('buffer-coords').value;
    const distance = parseFloat(document.getElementById('buffer-distance').value);
    const resultDiv = document.getElementById('buffer-result');
    
    try {
        // Parser les coordonnées
        const [lng, lat] = coordsInput.split(',').map(c => parseFloat(c.trim()));
        
        if (isNaN(lng) || isNaN(lat)) {
            throw new Error('Coordonnées invalides');
        }
        
        // Afficher loading
        resultDiv.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Calcul en cours...</p>
            </div>
        `;
        
        // Appel API
        const feature = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            properties: {}
        };
        
        const result = await apiClient.createBuffer(feature, distance, 'Buffer Analysis');
        
        // Afficher le résultat
        resultDiv.innerHTML = `
            <div class="result-card">
                <h5 class="text-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Analyse terminée !
                </h5>
                <hr>
                <p><strong>Distance:</strong> ${distance} mètres</p>
                <p><strong>Surface:</strong> ${(result.properties.area_sq_degrees * 111320 * 111320).toFixed(2)} m²</p>
                <p class="mb-0"><strong>ID:</strong> #${result.properties.analysis_id}</p>
            </div>
        `;
        
        // Afficher sur la carte
        resultsLayer.clearLayers();
        
        // Point original
        L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(resultsLayer).bindPopup('Point d\'origine');
        
        // Buffer
        const bufferLayer = L.geoJSON(result, {
            style: {
                color: '#ff7800',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.3
            }
        }).addTo(resultsLayer);
        
        analysisMap.fitBounds(bufferLayer.getBounds());
        
        showToast('Buffer créé avec succès', 'success');
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Erreur: ${error.message}
            </div>
        `;
        showToast('Erreur: ' + error.message, 'danger');
    }
});

/**
 * Calcul de distance
 */
document.getElementById('btn-calc-distance')?.addEventListener('click', async () => {
    const point1Input = document.getElementById('distance-point1').value;
    const point2Input = document.getElementById('distance-point2').value;
    const resultDiv = document.getElementById('distance-result');
    
    try {
        // Parser les coordonnées
        const [lng1, lat1] = point1Input.split(',').map(c => parseFloat(c.trim()));
        const [lng2, lat2] = point2Input.split(',').map(c => parseFloat(c.trim()));
        
        if (isNaN(lng1) || isNaN(lat1) || isNaN(lng2) || isNaN(lat2)) {
            throw new Error('Coordonnées invalides');
        }
        
        // Afficher loading
        resultDiv.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-success" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Calcul en cours...</p>
            </div>
        `;
        
        // Appel API
        const feature1 = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lng1, lat1]
            },
            properties: {}
        };
        
        const feature2 = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lng2, lat2]
            },
            properties: {}
        };
        
        const result = await apiClient.calculateDistance(feature1, feature2);
        
        // Afficher le résultat
        resultDiv.innerHTML = `
            <div class="result-card">
                <h5 class="text-success">
                    <i class="fas fa-check-circle me-2"></i>
                    Distance calculée !
                </h5>
                <hr>
                <p><strong>Distance (degrés):</strong> ${result.distance_degrees.toFixed(6)}°</p>
                <p><strong>Distance (mètres):</strong> ${result.distance_meters.toFixed(2)} m</p>
                <p class="mb-0"><strong>Distance (km):</strong> ${result.distance_km.toFixed(3)} km</p>
            </div>
        `;
        
        // Afficher sur la carte
        resultsLayer.clearLayers();
        
        // Point 1
        L.marker([lat1, lng1], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(resultsLayer).bindPopup('Point 1');
        
        // Point 2
        L.marker([lat2, lng2], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(resultsLayer).bindPopup('Point 2');
        
        // Ligne entre les points
        L.polyline([[lat1, lng1], [lat2, lng2]], {
            color: '#0d6efd',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 5'
        }).addTo(resultsLayer).bindPopup(`Distance: ${result.distance_km.toFixed(3)} km`);
        
        // Centrer la vue
        analysisMap.fitBounds([[lat1, lng1], [lat2, lng2]], { padding: [50, 50] });
        
        showToast('Distance calculée avec succès', 'success');
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Erreur: ${error.message}
            </div>
        `;
        showToast('Erreur: ' + error.message, 'danger');
    }
});

/**
 * Simulations
 */
document.getElementById('btn-flood-sim')?.addEventListener('click', async () => {
    const waterLevel = prompt('Niveau d\'eau (mètres):', '5');
    if (!waterLevel) return;
    
    try {
        const result = await apiClient.simulateFlood(parseFloat(waterLevel));
        
        alert(`Simulation créée !\n\nID: ${result.simulation_id}\nSurface affectée: ${result.results.affected_area_sqm} m²\n\nNote: ${result.note}`);
        
        showToast('Simulation d\'inondation créée', 'success');
        
    } catch (error) {
        showToast('Erreur: ' + error.message, 'danger');
    }
});

document.getElementById('btn-viewshed-sim')?.addEventListener('click', async () => {
    const coords = prompt('Coordonnées du point d\'observation (lng, lat):', '-73.5, 45.5');
    if (!coords) return;
    
    const radius = prompt('Rayon d\'analyse (mètres):', '1000');
    if (!radius) return;
    
    try {
        const [lng, lat] = coords.split(',').map(c => parseFloat(c.trim()));
        
        const observerPoint = {
            type: 'Point',
            coordinates: [lng, lat]
        };
        
        const result = await apiClient.calculateViewshed(observerPoint, 1.7, parseFloat(radius));
        
        // Afficher sur la carte
        resultsLayer.clearLayers();
        
        // Point d'observation
        L.marker([lat, lng]).addTo(resultsLayer).bindPopup('Point d\'observation');
        
        // Zone visible
        const visibleLayer = L.geoJSON(result.result, {
            style: {
                color: '#28a745',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.2
            }
        }).addTo(resultsLayer);
        
        analysisMap.fitBounds(visibleLayer.getBounds());
        
        showToast('Analyse de visibilité créée', 'success');
        
    } catch (error) {
        showToast('Erreur: ' + error.message, 'danger');
    }
});

document.getElementById('btn-shadow-sim')?.addEventListener('click', () => {
    alert('Cette fonctionnalité nécessite de dessiner un bâtiment sur la carte.\n\nUtilisez la page "Carte 2D" pour dessiner un polygone représentant le bâtiment.');
    window.location.href = 'map.html';
});

/**
 * Initialisation au chargement
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log('Page d\'analyses chargée');
    
    // Vérifier la connexion API
    apiClient.healthCheck()
        .then(response => {
            console.log('API Status:', response);
        })
        .catch(error => {
            showToast('Erreur de connexion à l\'API', 'warning');
        });
});
