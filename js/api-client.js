/**
 * API Client pour communication avec le backend FastAPI
 */

const API_BASE_URL = 'http://localhost:8000/api';

class APIClient {
    constructor(baseURL = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    /**
     * Effectue une requête HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Une erreur est survenue');
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    /**
     * SPATIAL ANALYSIS ENDPOINTS
     */

    // Récupérer toutes les entités
    async getFeatures(category = null) {
        const endpoint = category 
            ? `/spatial/features?category=${category}`
            : '/spatial/features';
        return this.request(endpoint);
    }

    // Créer une nouvelle entité
    async createFeature(feature, name, category = null) {
        return this.request('/spatial/features', {
            method: 'POST',
            body: JSON.stringify({
                type: 'Feature',
                geometry: feature.geometry,
                properties: feature.properties || {}
            }),
            headers: {
                'Content-Type': 'application/json',
            },
            // Ajout des paramètres query
        }).then(data => {
            // Note: pour les paramètres query, on doit les ajouter à l'URL
            const params = new URLSearchParams({ name });
            if (category) params.append('category', category);
            return this.request(`/spatial/features?${params}`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'Feature',
                    geometry: feature.geometry,
                    properties: feature.properties || {}
                })
            });
        });
    }

    // Créer un buffer
    async createBuffer(feature, distance, name = 'Buffer Analysis') {
        return this.request('/spatial/buffer', {
            method: 'POST',
            body: JSON.stringify({
                feature: {
                    type: 'Feature',
                    geometry: feature.geometry,
                    properties: feature.properties || {}
                },
                distance: distance,
                name: name
            })
        });
    }

    // Calculer l'intersection
    async calculateIntersection(feature1, feature2, name = 'Intersection') {
        return this.request('/spatial/intersection', {
            method: 'POST',
            body: JSON.stringify({
                feature1: {
                    type: 'Feature',
                    geometry: feature1.geometry,
                    properties: feature1.properties || {}
                },
                feature2: {
                    type: 'Feature',
                    geometry: feature2.geometry,
                    properties: feature2.properties || {}
                },
                name: name
            })
        });
    }

    // Calculer la distance
    async calculateDistance(feature1, feature2) {
        return this.request('/spatial/distance', {
            method: 'POST',
            body: JSON.stringify({
                feature1: {
                    type: 'Feature',
                    geometry: feature1.geometry,
                    properties: feature1.properties || {}
                },
                feature2: {
                    type: 'Feature',
                    geometry: feature2.geometry,
                    properties: feature2.properties || {}
                }
            })
        });
    }

    // Récupérer une analyse
    async getAnalysis(analysisId) {
        return this.request(`/spatial/analysis/${analysisId}`);
    }

    // Statistiques spatiales
    async getSpatialStatistics() {
        return this.request('/spatial/statistics');
    }

    /**
     * LIDAR ENDPOINTS
     */

    // Upload fichier LIDAR
    async uploadLidarFile(file, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);

        return fetch(`${this.baseURL}/lidar/upload`, {
            method: 'POST',
            body: formData,
            // Note: pas de Content-Type header, le browser le définit automatiquement avec boundary
        }).then(async response => {
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Erreur upload');
            }
            return response.json();
        });
    }

    // Liste des fichiers LIDAR
    async getLidarFiles() {
        return this.request('/lidar/files');
    }

    // Informations d'un fichier LIDAR
    async getLidarInfo(lidarId) {
        return this.request(`/lidar/files/${lidarId}`);
    }

    // Échantillon de points LIDAR
    async getLidarSample(lidarId, sampleSize = 10000) {
        return this.request(`/lidar/files/${lidarId}/sample?sample_size=${sampleSize}`);
    }

    // Traiter un fichier LIDAR
    async processLidar(lidarId, operation = 'classification') {
        return this.request(`/lidar/files/${lidarId}/process?operation=${operation}`, {
            method: 'POST'
        });
    }

    // Supprimer un fichier LIDAR
    async deleteLidarFile(lidarId) {
        return this.request(`/lidar/files/${lidarId}`, {
            method: 'DELETE'
        });
    }

    /**
     * SIMULATION ENDPOINTS
     */

    // Simulation d'inondation
    async simulateFlood(waterLevel, demSource = 'lidar', areaGeoJSON = null) {
        return this.request('/simulation/flood', {
            method: 'POST',
            body: JSON.stringify({
                water_level: waterLevel,
                dem_source: demSource,
                area_geojson: areaGeoJSON
            })
        });
    }

    // Analyse de visibilité
    async calculateViewshed(observerPoint, observerHeight = 1.7, radius = 1000) {
        return this.request('/simulation/viewshed', {
            method: 'POST',
            body: JSON.stringify({
                observer_point: observerPoint,
                observer_height: observerHeight,
                radius: radius,
                dem_source: 'lidar'
            })
        });
    }

    // Ombrage solaire
    async calculateSolarShadow(buildingGeoJSON, buildingHeight, date, time, lat, lng) {
        return this.request('/simulation/solar-shadow', {
            method: 'POST',
            body: JSON.stringify({
                building_geojson: buildingGeoJSON,
                building_height: buildingHeight,
                date: date,
                time: time,
                latitude: lat,
                longitude: lng
            })
        });
    }

    // Liste des simulations
    async getSimulations(simulationType = null) {
        const endpoint = simulationType
            ? `/simulation/results?simulation_type=${simulationType}`
            : '/simulation/results';
        return this.request(endpoint);
    }

    // Résultat d'une simulation
    async getSimulationResult(simulationId) {
        return this.request(`/simulation/results/${simulationId}`);
    }

    // Supprimer une simulation
    async deleteSimulation(simulationId) {
        return this.request(`/simulation/results/${simulationId}`, {
            method: 'DELETE'
        });
    }

    /**
     * HEALTH CHECK
     */
    async healthCheck() {
        return this.request('/health');
    }
}

// Instance globale de l'API client
const apiClient = new APIClient();

// Utilitaires pour les notifications
function showToast(message, type = 'info') {
    // Créer un toast Bootstrap
    const toastHTML = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    // Ajouter à un conteneur de toasts
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(container);
    }
    
    container.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = container.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Supprimer après disparition
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, apiClient, showToast };
}
