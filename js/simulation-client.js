/**
 * Client JavaScript pour les simulations spatiales
 * À placer dans : frontend/js/simulation-client.js
 * 
 * Gère toutes les interactions avec l'API de simulation:
 * - Inondation
 * - Viewshed
 * - Ombres solaires
 * - Analyse de pente
 */

(function() {
    'use strict';
    
    console.log('📊 Module Simulations chargé');
    
    // ==================== CONFIGURATION ====================
    
    const SIMULATION_API = {
        BASE_URL: 'http://localhost:8000/api/simulation',
        ENDPOINTS: {
            FLOOD: '/flood',
            VIEWSHED: '/viewshed',
            SOLAR_SHADOW: '/solar-shadow',
            SLOPE: '/slope-analysis',
            RESULTS: '/results',
            TYPES: '/types'
        }
    };
    
    // ==================== CLASSE PRINCIPALE ====================
    
    class SimulationClient {
        constructor(map) {
            this.map = map;
            this.simulationLayers = {};
            this.currentSimulation = null;
        }
        
        /**
         * Simulation d'inondation
         */
        async runFloodSimulation(waterLevel, bounds, options = {}) {
            console.log(`🌊 Simulation inondation: ${waterLevel}m`);
            
            const payload = {
                water_level: waterLevel,
                dem_source: options.demSource || 'lidar',
                resolution: options.resolution || 1.0,
                include_flow: options.includeFlow || false,
                area_geojson: bounds ? this._boundsToGeoJSON(bounds) : null
            };
            
            try {
                const response = await fetch(SIMULATION_API.BASE_URL + SIMULATION_API.ENDPOINTS.FLOOD, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Simulation inondation réussie:', data);
                
                // Afficher sur la carte
                this._displayFloodResult(data);
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur simulation inondation:', error);
                throw error;
            }
        }
        
        /**
         * Analyse de visibilité (Viewshed)
         */
        async runViewshedAnalysis(observerPoint, options = {}) {
            console.log('👁️ Analyse viewshed');
            
            const payload = {
                observer_point: {
                    type: 'Point',
                    coordinates: [observerPoint.lng, observerPoint.lat]
                },
                observer_height: options.observerHeight || 1.7,
                target_height: options.targetHeight || 0,
                radius: options.radius || 1000,
                dem_source: options.demSource || 'lidar',
                resolution: options.resolution || 5.0
            };
            
            try {
                const response = await fetch(SIMULATION_API.BASE_URL + SIMULATION_API.ENDPOINTS.VIEWSHED, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Analyse viewshed réussie:', data);
                
                // Afficher sur la carte
                this._displayViewshedResult(data, observerPoint);
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur viewshed:', error);
                throw error;
            }
        }
        
        /**
         * Calcul ombre solaire
         */
        async runSolarShadow(buildingGeoJSON, buildingHeight, datetime, coordinates) {
            console.log('☀️ Calcul ombre solaire');
            
            const payload = {
                building_geojson: buildingGeoJSON,
                building_height: buildingHeight,
                date: datetime.date,
                time: datetime.time,
                latitude: coordinates.lat,
                longitude: coordinates.lng
            };
            
            try {
                const response = await fetch(SIMULATION_API.BASE_URL + SIMULATION_API.ENDPOINTS.SOLAR_SHADOW, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Ombre solaire calculée:', data);
                
                // Afficher sur la carte
                this._displayShadowResult(data, buildingGeoJSON);
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur ombre solaire:', error);
                throw error;
            }
        }
        
        /**
         * Analyse de pente
         */
        async runSlopeAnalysis(area, options = {}) {
            console.log('📐 Analyse de pente');
            
            const payload = {
                area_geojson: area,
                dem_source: options.demSource || 'lidar',
                resolution: options.resolution || 1.0,
                slope_classes: options.slopeClasses || [5, 10, 15, 20, 30]
            };
            
            try {
                const response = await fetch(SIMULATION_API.BASE_URL + SIMULATION_API.ENDPOINTS.SLOPE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Analyse pente réussie:', data);
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur analyse pente:', error);
                throw error;
            }
        }
        
        /**
         * Liste toutes les simulations
         */
        async listSimulations(type = null) {
            console.log('📋 Liste des simulations');
            
            let url = SIMULATION_API.BASE_URL + SIMULATION_API.ENDPOINTS.RESULTS;
            if (type) {
                url += `?simulation_type=${type}`;
            }
            
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log(`✅ ${data.count} simulation(s) trouvée(s)`);
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur liste simulations:', error);
                throw error;
            }
        }
        
        /**
         * Récupère une simulation par ID
         */
        async getSimulation(simulationId) {
            console.log(`🔍 Récupération simulation ${simulationId}`);
            
            try {
                const response = await fetch(`${SIMULATION_API.BASE_URL}${SIMULATION_API.ENDPOINTS.RESULTS}/${simulationId}`);
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Simulation récupérée:', data);
                
                // Afficher sur la carte
                if (data.geometry) {
                    this._displaySimulationResult(data);
                }
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur récupération simulation:', error);
                throw error;
            }
        }
        
        /**
         * Supprime une simulation
         */
        async deleteSimulation(simulationId) {
            console.log(`🗑️ Suppression simulation ${simulationId}`);
            
            try {
                const response = await fetch(`${SIMULATION_API.BASE_URL}${SIMULATION_API.ENDPOINTS.RESULTS}/${simulationId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('✅ Simulation supprimée');
                
                // Retirer de la carte
                if (this.simulationLayers[simulationId]) {
                    this.map.removeLayer(this.simulationLayers[simulationId]);
                    delete this.simulationLayers[simulationId];
                }
                
                return data;
                
            } catch (error) {
                console.error('❌ Erreur suppression simulation:', error);
                throw error;
            }
        }
        
        // ==================== AFFICHAGE CARTE ====================
        
        /**
         * Affiche résultat inondation
         */
        _displayFloodResult(data) {
            if (!data.results || !data.results.geometry) return;
            
            const layer = L.geoJSON(data.results.geometry, {
                style: {
                    color: '#0066ff',
                    fillColor: '#0099ff',
                    fillOpacity: 0.5,
                    weight: 2
                }
            });
            
            // Popup avec stats
            const stats = data.results.statistics;
            const popupContent = `
                <div class="simulation-popup">
                    <h6>🌊 Simulation Inondation</h6>
                    <p><strong>Niveau d'eau:</strong> ${data.parameters.water_level}m</p>
                    <p><strong>Zone inondée:</strong> ${(stats.flooded_area_sqm / 10000).toFixed(2)} ha</p>
                    <p><strong>Pourcentage:</strong> ${stats.flooded_percentage?.toFixed(1)}%</p>
                    <p><strong>Profondeur max:</strong> ${stats.max_depth_m?.toFixed(2)}m</p>
                    <p><strong>Profondeur moy:</strong> ${stats.avg_depth_m?.toFixed(2)}m</p>
                </div>
            `;
            
            layer.bindPopup(popupContent);
            layer.addTo(this.map);
            
            this.simulationLayers[data.simulation_id] = layer;
            this.currentSimulation = data;
            
            // Zoom sur la zone
            this.map.fitBounds(layer.getBounds());
        }
        
        /**
         * Affiche résultat viewshed
         */
        _displayViewshedResult(data, observerPoint) {
            if (!data.result || !data.result.geometry) return;
            
            const layer = L.geoJSON(data.result, {
                style: {
                    color: '#00ff00',
                    fillColor: '#00ff00',
                    fillOpacity: 0.2,
                    weight: 2
                }
            });
            
            // Popup avec stats
            const stats = data.statistics;
            const popupContent = `
                <div class="simulation-popup">
                    <h6>👁️ Analyse Visibilité</h6>
                    <p><strong>Rayon:</strong> ${stats.radius}m</p>
                    <p><strong>Zone visible:</strong> ${(stats.visible_area_sqm / 10000).toFixed(2)} ha</p>
                    <p><strong>Visibilité:</strong> ${stats.visibility_percentage?.toFixed(1)}%</p>
                </div>
            `;
            
            layer.bindPopup(popupContent);
            layer.addTo(this.map);
            
            // Marqueur observateur
            const observerMarker = L.marker([observerPoint.lat, observerPoint.lng], {
                icon: L.divIcon({
                    className: 'observer-marker',
                    html: '<i class="fas fa-eye" style="color: #00ff00; font-size: 24px;"></i>',
                    iconSize: [30, 30]
                })
            });
            observerMarker.bindPopup('<strong>Point d\'observation</strong>');
            observerMarker.addTo(this.map);
            
            this.simulationLayers[data.simulation_id] = L.layerGroup([layer, observerMarker]);
            this.currentSimulation = data;
            
            this.map.fitBounds(layer.getBounds());
        }
        
        /**
         * Affiche ombre solaire
         */
        _displayShadowResult(data, buildingGeoJSON) {
            if (!data.result || !data.result.geometry) return;
            
            // Bâtiment
            const buildingLayer = L.geoJSON(buildingGeoJSON, {
                style: {
                    color: '#ff0000',
                    fillColor: '#ff0000',
                    fillOpacity: 0.3,
                    weight: 2
                }
            });
            
            // Ombre
            const shadowLayer = L.geoJSON(data.result, {
                style: {
                    color: '#333333',
                    fillColor: '#000000',
                    fillOpacity: 0.6,
                    weight: 1
                }
            });
            
            // Popup
            const sunPos = data.sun_position;
            const stats = data.statistics;
            const popupContent = `
                <div class="simulation-popup">
                    <h6>☀️ Ombre Solaire</h6>
                    <p><strong>Date:</strong> ${data.parameters.date}</p>
                    <p><strong>Heure:</strong> ${data.parameters.time}</p>
                    <p><strong>Azimut soleil:</strong> ${sunPos.azimuth.toFixed(1)}°</p>
                    <p><strong>Élévation:</strong> ${sunPos.elevation.toFixed(1)}°</p>
                    <p><strong>Longueur ombre:</strong> ${stats.shadow_length_m.toFixed(1)}m</p>
                    <p><strong>Surface ombre:</strong> ${(stats.shadow_area_sqm).toFixed(1)}m²</p>
                </div>
            `;
            
            shadowLayer.bindPopup(popupContent);
            
            const group = L.layerGroup([buildingLayer, shadowLayer]);
            group.addTo(this.map);
            
            this.simulationLayers[data.simulation_id] = group;
            this.currentSimulation = data;
            
            this.map.fitBounds(shadowLayer.getBounds());
        }
        
        /**
         * Affiche résultat générique
         */
        _displaySimulationResult(data) {
            if (!data.geometry) return;
            
            const colors = {
                'flood': '#0099ff',
                'viewshed': '#00ff00',
                'solar_shadow': '#333333',
                'slope_analysis': '#ff9900'
            };
            
            const color = colors[data.simulation_type] || '#ff0000';
            
            const layer = L.geoJSON(data.geometry, {
                style: {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    weight: 2
                }
            });
            
            const popupContent = `
                <div class="simulation-popup">
                    <h6>${data.name}</h6>
                    <p><strong>Type:</strong> ${data.simulation_type}</p>
                    <p><strong>Date:</strong> ${new Date(data.created_at).toLocaleString()}</p>
                </div>
            `;
            
            layer.bindPopup(popupContent);
            layer.addTo(this.map);
            
            this.simulationLayers[data.id] = layer;
            
            this.map.fitBounds(layer.getBounds());
        }
        
        /**
         * Efface toutes les simulations de la carte
         */
        clearAllSimulations() {
            console.log('🗑️ Effacement simulations');
            
            for (const layerId in this.simulationLayers) {
                this.map.removeLayer(this.simulationLayers[layerId]);
            }
            
            this.simulationLayers = {};
            this.currentSimulation = null;
        }
        
        /**
         * Efface une simulation spécifique
         */
        clearSimulation(simulationId) {
            if (this.simulationLayers[simulationId]) {
                this.map.removeLayer(this.simulationLayers[simulationId]);
                delete this.simulationLayers[simulationId];
            }
        }
        
        // ==================== UTILITAIRES ====================
        
        _boundsToGeoJSON(bounds) {
            return {
                type: 'Polygon',
                coordinates: [[
                    [bounds.getWest(), bounds.getSouth()],
                    [bounds.getEast(), bounds.getSouth()],
                    [bounds.getEast(), bounds.getNorth()],
                    [bounds.getWest(), bounds.getNorth()],
                    [bounds.getWest(), bounds.getSouth()]
                ]]
            };
        }
    }
    
    // Exposer globalement
    window.SimulationClient = SimulationClient;
    
    console.log('✅ SimulationClient disponible');
    
})();
