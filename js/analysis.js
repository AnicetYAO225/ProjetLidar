/**
 * Script pour la page analysis.html
 * Compatible avec backend spatial_analysis.py existant
 */

(function() {
    'use strict';
    
    console.log('📊 Initialisation module analyses...');
    
    // ==================== CONFIGURATION ====================
    
    const API_BASE = 'http://localhost:8000/api';
    
    // ==================== INITIALISATION CARTE ====================
    
    let map = null;
    let resultLayers = {};
    let layerCounter = 0;
    
    function initMap() {
        try {
            console.log('🗺️ Initialisation carte analyses...');
            
            map = L.map('analysis-map').setView([45.5, -73.6], 11);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
            
            console.log('✅ Carte analyses initialisée');
        } catch (e) {
            console.error('❌ Erreur init carte:', e);
        }
    }
    
    // ==================== UTILITAIRES ====================
    
    function showResult(containerId, html, type = 'info') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';
        
        container.innerHTML = `<div class="alert ${alertClass}">${html}</div>`;
    }
    
    function clearLayers() {
        for (const id in resultLayers) {
            map.removeLayer(resultLayers[id]);
        }
        resultLayers = {};
    }
    
    function addResultLayer(layer, name) {
        const id = 'layer_' + layerCounter++;
        resultLayers[id] = layer;
        layer.addTo(map);
        
        if (layer.getBounds && layer.getBounds().isValid()) {
            map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }
        
        return id;
    }
    
    // ==================== ANALYSE BUFFER ====================
    
    async function runBufferAnalysis() {
        console.log('⭕ Analyse Buffer');
        
        const coordsInput = document.getElementById('buffer-coords').value;
        const distance = parseFloat(document.getElementById('buffer-distance').value);
        
        // Parser coordonnées
        const coords = coordsInput.split(',').map(c => parseFloat(c.trim()));
        if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
            showResult('buffer-result', 'Coordonnées invalides. Format: longitude, latitude', 'error');
            return;
        }
        
        const [lon, lat] = coords;
        
        try {
            showResult('buffer-result', '<i class="spinner-border spinner-border-sm me-2"></i>Calcul en cours...', 'info');
            
            // Format compatible avec BufferRequest du backend
            const response = await fetch(`${API_BASE}/analysis/buffer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lon, lat]
                        },
                        properties: {}
                    },
                    distance: distance,
                    name: 'Buffer Analysis'
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Buffer calculé:', data);
            
            // Afficher sur la carte
            clearLayers();
            
            // Point original
            const pointMarker = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'buffer-point',
                    html: '<i class="fas fa-map-marker-alt" style="color: #0d6efd; font-size: 24px;"></i>',
                    iconSize: [30, 30]
                })
            });
            pointMarker.bindPopup('<strong>Point original</strong>');
            addResultLayer(pointMarker, 'Point');
            
            // Zone buffer
            if (data.geometry) {
                const bufferLayer = L.geoJSON(data, {
                    style: {
                        color: '#0d6efd',
                        fillColor: '#0d6efd',
                        fillOpacity: 0.3,
                        weight: 2
                    }
                });
                
                const area_sqm = data.properties.area_sq_degrees * 111320 * 111320;
                
                bufferLayer.bindPopup(`
                    <strong>Zone Buffer</strong><br>
                    Distance: ${distance}m<br>
                    Surface: ${(area_sqm / 10000).toFixed(2)} ha
                `);
                
                addResultLayer(bufferLayer, 'Buffer');
                
                // Afficher résultat
                const html = `
                    <h6><i class="fas fa-check-circle text-success me-2"></i>Analyse réussie</h6>
                    <p><strong>Distance:</strong> ${distance} m</p>
                    <p><strong>Surface:</strong> ${(area_sqm / 10000).toFixed(2)} ha</p>
                    <p><strong>ID Analyse:</strong> ${data.properties.analysis_id}</p>
                `;
                
                showResult('buffer-result', html, 'success');
            }
            
        } catch (error) {
            console.error('❌ Erreur buffer:', error);
            showResult('buffer-result', `Erreur: ${error.message}`, 'error');
        }
    }
    
    // ==================== CALCUL DISTANCE ====================
    
    async function calculateDistance() {
        console.log('📏 Calcul distance');
        
        const point1Input = document.getElementById('distance-point1').value;
        const point2Input = document.getElementById('distance-point2').value;
        
        // Parser coordonnées
        const coords1 = point1Input.split(',').map(c => parseFloat(c.trim()));
        const coords2 = point2Input.split(',').map(c => parseFloat(c.trim()));
        
        if (coords1.length !== 2 || coords2.length !== 2 || 
            isNaN(coords1[0]) || isNaN(coords1[1]) || 
            isNaN(coords2[0]) || isNaN(coords2[1])) {
            showResult('distance-result', 'Coordonnées invalides', 'error');
            return;
        }
        
        const [lon1, lat1] = coords1;
        const [lon2, lat2] = coords2;
        
        try {
            showResult('distance-result', '<i class="spinner-border spinner-border-sm me-2"></i>Calcul...', 'info');
            
            // Format compatible avec DistanceRequest
            const response = await fetch(`${API_BASE}/analysis/distance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feature1: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lon1, lat1]
                        },
                        properties: {}
                    },
                    feature2: {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lon2, lat2]
                        },
                        properties: {}
                    }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Distance calculée:', data);
            
            // Afficher sur la carte
            clearLayers();
            
            // Points
            const marker1 = L.marker([lat1, lon1]);
            marker1.bindPopup('<strong>Point 1</strong>');
            addResultLayer(marker1, 'Point 1');
            
            const marker2 = L.marker([lat2, lon2]);
            marker2.bindPopup('<strong>Point 2</strong>');
            addResultLayer(marker2, 'Point 2');
            
            // Ligne
            const line = L.polyline([[lat1, lon1], [lat2, lon2]], {
                color: '#198754',
                weight: 3,
                dashArray: '5, 10'
            });
            line.bindPopup(`Distance: ${data.distance_km.toFixed(2)} km`);
            addResultLayer(line, 'Ligne');
            
            // Résultat
            const html = `
                <h6><i class="fas fa-check-circle text-success me-2"></i>Distance calculée</h6>
                <p><strong>Distance:</strong> ${data.distance_km.toFixed(2)} km</p>
                <p><strong>En mètres:</strong> ${data.distance_meters.toFixed(2)} m</p>
                <p><strong>En degrés:</strong> ${data.distance_degrees.toFixed(6)}°</p>
            `;
            
            showResult('distance-result', html, 'success');
            
        } catch (error) {
            console.error('❌ Erreur distance:', error);
            showResult('distance-result', `Erreur: ${error.message}`, 'error');
        }
    }
    
    // ==================== SIMULATION INONDATION ====================
    
    async function runFloodSimulation() {
        console.log('🌊 Simulation inondation');
        
        const level = prompt('Niveau d\'eau (mètres):', '2.5');
        if (!level) return;
        
        try {
            const bounds = map.getBounds();
            
            const response = await fetch(`${API_BASE}/simulation/flood`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    water_level: parseFloat(level),
                    dem_source: 'lidar',
                    resolution: 1.0,
                    include_flow: true,
                    area_geojson: {
                        type: 'Polygon',
                        coordinates: [[
                            [bounds.getWest(), bounds.getSouth()],
                            [bounds.getEast(), bounds.getSouth()],
                            [bounds.getEast(), bounds.getNorth()],
                            [bounds.getWest(), bounds.getNorth()],
                            [bounds.getWest(), bounds.getSouth()]
                        ]]
                    }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `Erreur HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Simulation inondation:', data);
            
            // Afficher sur la carte
            clearLayers();
            
            if (data.results && data.results.geometry) {
                const floodLayer = L.geoJSON(data.results.geometry, {
                    style: {
                        color: '#0066ff',
                        fillColor: '#0099ff',
                        fillOpacity: 0.5,
                        weight: 2
                    }
                });
                
                const stats = data.results.statistics;
                floodLayer.bindPopup(`
                    <strong>🌊 Zone Inondée</strong><br>
                    Niveau: ${level}m<br>
                    Surface: ${(stats.flooded_area_sqm / 10000).toFixed(2)} ha<br>
                    Profondeur max: ${stats.max_depth_m?.toFixed(2)} m<br>
                    Profondeur moy: ${stats.avg_depth_m?.toFixed(2)} m
                `);
                
                addResultLayer(floodLayer, 'Inondation');
            }
            
            alert('✅ Simulation inondation terminée !');
            
        } catch (error) {
            console.error('❌ Erreur simulation:', error);
            alert('Erreur: ' + error.message);
        }
    }
    
    // ==================== SIMULATION VIEWSHED ====================
    
    async function runViewshedSimulation() {
        console.log('👁️ Simulation viewshed');
        
        alert('Cliquez sur la carte pour placer l\'observateur');
        
        map.once('click', async function(e) {
            const height = prompt('Hauteur observateur (mètres):', '1.7');
            if (!height) return;
            
            const radius = prompt('Rayon d\'analyse (mètres):', '1000');
            if (!radius) return;
            
            try {
                const response = await fetch(`${API_BASE}/simulation/viewshed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        observer_point: {
                            type: 'Point',
                            coordinates: [e.latlng.lng, e.latlng.lat]
                        },
                        observer_height: parseFloat(height),
                        target_height: 0,
                        radius: parseFloat(radius),
                        dem_source: 'lidar',
                        resolution: 5.0
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || `Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Viewshed calculé:', data);
                
                // Afficher
                clearLayers();
                
                // Observateur
                const observer = L.marker([e.latlng.lat, e.latlng.lng], {
                    icon: L.divIcon({
                        className: 'observer-marker',
                        html: '<i class="fas fa-eye" style="color: #198754; font-size: 24px;"></i>',
                        iconSize: [30, 30]
                    })
                });
                observer.bindPopup('<strong>Point d\'observation</strong>');
                addResultLayer(observer, 'Observateur');
                
                // Zone visible
                if (data.result && data.result.geometry) {
                    const viewshedLayer = L.geoJSON(data.result, {
                        style: {
                            color: '#198754',
                            fillColor: '#00ff00',
                            fillOpacity: 0.2,
                            weight: 2
                        }
                    });
                    
                    const stats = data.statistics;
                    viewshedLayer.bindPopup(`
                        <strong>👁️ Zone Visible</strong><br>
                        Rayon: ${radius}m<br>
                        Surface visible: ${(stats.visible_area_sqm / 10000).toFixed(2)} ha<br>
                        Visibilité: ${stats.visibility_percentage?.toFixed(1)}%
                    `);
                    
                    addResultLayer(viewshedLayer, 'Viewshed');
                }
                
                alert('✅ Analyse visibilité terminée !');
                
            } catch (error) {
                console.error('❌ Erreur viewshed:', error);
                alert('Erreur: ' + error.message);
            }
        });
    }
    
    // ==================== SIMULATION OMBRE SOLAIRE ====================
    
    async function runShadowSimulation() {
        console.log('☀️ Simulation ombre solaire');
        
        alert('Cette simulation nécessite un bâtiment.\nRedirection vers la carte interactive...');
        
        // Attendre confirmation
        setTimeout(() => {
            window.location.href = 'map.html';
        }, 1000);
    }
    
    // ==================== CHARGER STATISTIQUES ====================
    
    async function loadStatistics() {
        try {
            const response = await fetch(`${API_BASE}/analysis/statistics`);
            
            if (response.ok) {
                const stats = await response.json();
                console.log('📊 Statistiques:', stats);
                
                // Afficher dans la console pour debug
                console.log(`Total entités: ${stats.total_features}`);
                console.log(`Total analyses: ${stats.total_analyses}`);
                console.log('Catégories:', stats.features_by_category);
            }
        } catch (error) {
            console.warn('⚠️ Impossible de charger les statistiques:', error);
        }
    }
    
    // ==================== INITIALISATION ====================
    
    window.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 DOM chargé - initialisation analyses');
        
        // Initialiser la carte
        initMap();
        
        // Charger statistiques
        loadStatistics();
        
        // ==================== BOUTONS ====================
        
        // Buffer
        const btnBuffer = document.getElementById('btn-run-buffer');
        if (btnBuffer) {
            btnBuffer.addEventListener('click', runBufferAnalysis);
            console.log('✅ Bouton buffer configuré');
        }
        
        // Distance
        const btnDistance = document.getElementById('btn-calc-distance');
        if (btnDistance) {
            btnDistance.addEventListener('click', calculateDistance);
            console.log('✅ Bouton distance configuré');
        }
        
        // Simulations
        const btnFlood = document.getElementById('btn-flood-sim');
        if (btnFlood) {
            btnFlood.addEventListener('click', runFloodSimulation);
            console.log('✅ Bouton flood configuré');
        }
        
        const btnViewshed = document.getElementById('btn-viewshed-sim');
        if (btnViewshed) {
            btnViewshed.addEventListener('click', runViewshedSimulation);
            console.log('✅ Bouton viewshed configuré');
        }
        
        const btnShadow = document.getElementById('btn-shadow-sim');
        if (btnShadow) {
            btnShadow.addEventListener('click', runShadowSimulation);
            console.log('✅ Bouton shadow configuré');
        }
        
        console.log('✅ Module analyses prêt !');
    });
    
})();

console.log('✅ Script analysis.js chargé');
