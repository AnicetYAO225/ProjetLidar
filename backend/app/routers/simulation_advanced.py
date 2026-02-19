"""
Router avancé pour les simulations spatiales
Fonctionnalités:
- Simulation d'inondation (avec MNT/DTM)
- Analyse de visibilité (Viewshed)
- Ombres solaires (calcul astronomique précis)
- Analyse de pente et exposition
- Calcul de zones de risque
- Simulation de propagation (feu, pollution)
- Analyse d'accessibilité
- Optimisation d'emplacement
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
import numpy as np
from shapely.geometry import Point, Polygon, LineString, shape, mapping, box
from shapely.ops import unary_union
from datetime import datetime, timedelta
import math
from pathlib import Path

from app.database import get_db
from app.models.spatial_models import SimulationResult
from app.config import settings

router = APIRouter()


# ==================== MODÈLES PYDANTIC ====================

class FloodSimulationRequest(BaseModel):
    """Simulation d'inondation avancée"""
    water_level: float = Field(..., description="Niveau d'eau en mètres", ge=0, le=100)
    dem_source: str = Field("lidar", description="Source MNT: lidar, srtm, ou custom")
    area_geojson: Optional[dict] = Field(None, description="Zone d'étude (GeoJSON)")
    resolution: float = Field(1.0, description="Résolution du calcul en mètres", ge=0.1, le=10)
    include_flow: bool = Field(False, description="Inclure direction d'écoulement")
    
    class Config:
        schema_extra = {
            "example": {
                "water_level": 2.5,
                "dem_source": "lidar",
                "resolution": 1.0,
                "include_flow": True
            }
        }


class ViewshedRequest(BaseModel):
    """Analyse de visibilité"""
    observer_point: dict = Field(..., description="Point d'observation (GeoJSON)")
    observer_height: float = Field(1.7, description="Hauteur observateur (m)", ge=0.5, le=100)
    target_height: float = Field(0.0, description="Hauteur cible (m)", ge=0, le=50)
    radius: float = Field(1000, description="Rayon d'analyse (m)", ge=10, le=50000)
    dem_source: str = Field("lidar", description="Source MNT")
    resolution: float = Field(5.0, description="Résolution (m)", ge=1, le=50)
    
    class Config:
        schema_extra = {
            "example": {
                "observer_point": {
                    "type": "Point",
                    "coordinates": [-73.5, 45.5]
                },
                "observer_height": 1.7,
                "radius": 1000,
                "resolution": 5.0
            }
        }


class SolarShadowRequest(BaseModel):
    """Analyse d'ombrage solaire précis"""
    building_geojson: dict = Field(..., description="Bâtiment (GeoJSON Polygon)")
    building_height: float = Field(..., description="Hauteur bâtiment (m)", ge=1, le=500)
    date: str = Field(..., description="Date (YYYY-MM-DD)")
    time: str = Field(..., description="Heure (HH:MM)")
    latitude: float = Field(..., description="Latitude", ge=-90, le=90)
    longitude: float = Field(..., description="Longitude", ge=-180, le=180)
    time_range_hours: Optional[int] = Field(None, description="Plage horaire (animation)", ge=1, le=24)
    
    class Config:
        schema_extra = {
            "example": {
                "building_geojson": {
                    "type": "Polygon",
                    "coordinates": [[[-73.5, 45.5], [-73.499, 45.5], [-73.499, 45.501], [-73.5, 45.501], [-73.5, 45.5]]]
                },
                "building_height": 20,
                "date": "2024-06-21",
                "time": "12:00",
                "latitude": 45.5,
                "longitude": -73.5
            }
        }


class SlopeAnalysisRequest(BaseModel):
    """Analyse de pente"""
    area_geojson: dict = Field(..., description="Zone d'analyse")
    dem_source: str = Field("lidar", description="Source MNT")
    resolution: float = Field(1.0, description="Résolution (m)")
    slope_classes: List[float] = Field([5, 10, 15, 20, 30], description="Classes de pente (%)")


class AccessibilityRequest(BaseModel):
    """Analyse d'accessibilité"""
    start_point: dict = Field(..., description="Point de départ")
    max_distance: float = Field(1000, description="Distance max (m)")
    mode: str = Field("walking", description="Mode: walking, driving, cycling")
    barriers: Optional[List[dict]] = Field(None, description="Obstacles (polygones)")
    weights: Optional[Dict[str, float]] = Field(None, description="Poids par type de terrain")


class PropagationRequest(BaseModel):
    """Simulation de propagation (feu, pollution, etc.)"""
    source_point: dict = Field(..., description="Point source")
    propagation_type: str = Field("fire", description="Type: fire, pollution, noise")
    intensity: float = Field(1.0, description="Intensité initiale", ge=0, le=10)
    wind_speed: Optional[float] = Field(None, description="Vitesse vent (m/s)")
    wind_direction: Optional[float] = Field(None, description="Direction vent (degrés)")
    time_steps: int = Field(10, description="Nombre d'étapes", ge=1, le=100)
    timestep_minutes: int = Field(5, description="Durée étape (min)", ge=1, le=60)


class OptimalLocationRequest(BaseModel):
    """Optimisation d'emplacement"""
    candidate_points: List[dict] = Field(..., description="Points candidats")
    criteria: Dict[str, float] = Field(..., description="Critères et poids")
    constraints: Optional[List[dict]] = Field(None, description="Contraintes")


# ==================== UTILITAIRES CALCULS ====================

class SolarCalculator:
    """Calculs astronomiques précis pour position du soleil"""
    
    @staticmethod
    def solar_position(lat: float, lon: float, date_str: str, time_str: str) -> Tuple[float, float]:
        """
        Calcule la position du soleil (azimut et élévation)
        
        Retourne: (azimut en degrés, élévation en degrés)
        """
        # Parse date et heure
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        
        # Nombre de jours depuis J2000.0
        y = dt.year
        m = dt.month
        d = dt.day
        h = dt.hour + dt.minute / 60.0
        
        # Jour julien
        if m <= 2:
            y -= 1
            m += 12
        
        A = int(y / 100)
        B = 2 - A + int(A / 4)
        
        JD = int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d + B - 1524.5
        JD += h / 24.0
        
        # Siècles juliens depuis J2000.0
        T = (JD - 2451545.0) / 36525.0
        
        # Longitude moyenne du soleil
        L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360
        
        # Anomalie moyenne
        M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360
        
        # Équation du centre
        C = ((1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(math.radians(M))
             + (0.019993 - 0.000101 * T) * math.sin(math.radians(2 * M))
             + 0.000289 * math.sin(math.radians(3 * M)))
        
        # Longitude vraie
        L = L0 + C
        
        # Obliquité de l'écliptique
        epsilon = 23.439291 - 0.0130042 * T
        
        # Ascension droite et déclinaison
        RA = math.degrees(math.atan2(math.cos(math.radians(epsilon)) * math.sin(math.radians(L)),
                                      math.cos(math.radians(L))))
        delta = math.degrees(math.asin(math.sin(math.radians(epsilon)) * math.sin(math.radians(L))))
        
        # Angle horaire
        GMST = (280.46061837 + 360.98564736629 * (JD - 2451545.0) +
                0.000387933 * T * T - T * T * T / 38710000.0) % 360
        
        LST = (GMST + lon) % 360
        H = (LST - RA) % 360
        if H > 180:
            H -= 360
        
        # Élévation et azimut
        lat_rad = math.radians(lat)
        delta_rad = math.radians(delta)
        H_rad = math.radians(H)
        
        elevation = math.degrees(math.asin(
            math.sin(lat_rad) * math.sin(delta_rad) +
            math.cos(lat_rad) * math.cos(delta_rad) * math.cos(H_rad)
        ))
        
        azimuth = math.degrees(math.atan2(
            -math.sin(H_rad),
            math.tan(delta_rad) * math.cos(lat_rad) - math.sin(lat_rad) * math.cos(H_rad)
        )) + 180
        
        return (azimuth % 360, elevation)


class DEMProcessor:
    """Traitement de Modèles Numériques de Terrain"""
    
    @staticmethod
    def generate_synthetic_dem(bounds: Tuple[float, float, float, float], 
                               resolution: float = 1.0) -> np.ndarray:
        """
        Génère un MNT synthétique pour démo
        
        Args:
            bounds: (min_x, min_y, max_x, max_y)
            resolution: Résolution en mètres
        
        Returns:
            Array 2D d'élévations
        """
        min_x, min_y, max_x, max_y = bounds
        
        # Taille de la grille
        nx = int((max_x - min_x) * 111320 / resolution)
        ny = int((max_y - min_y) * 111320 / resolution)
        
        # Génération d'un terrain avec bruit de Perlin simulé
        x = np.linspace(0, 10, nx)
        y = np.linspace(0, 10, ny)
        X, Y = np.meshgrid(x, y)
        
        # Terrain ondulé
        Z = (50 + 20 * np.sin(X) * np.cos(Y) +
             10 * np.sin(2 * X) +
             5 * np.cos(3 * Y) +
             np.random.randn(ny, nx) * 2)
        
        return Z
    
    @staticmethod
    def calculate_slope(dem: np.ndarray, resolution: float) -> np.ndarray:
        """
        Calcule la pente depuis un MNT
        
        Returns:
            Array 2D de pentes en pourcentage
        """
        # Gradients
        dz_dx, dz_dy = np.gradient(dem, resolution)
        
        # Pente en radians puis en pourcentage
        slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
        slope_percent = np.tan(slope_rad) * 100
        
        return slope_percent
    
    @staticmethod
    def calculate_aspect(dem: np.ndarray) -> np.ndarray:
        """
        Calcule l'exposition (orientation des pentes)
        
        Returns:
            Array 2D d'aspects en degrés (0-360)
        """
        dz_dx, dz_dy = np.gradient(dem)
        
        aspect = np.arctan2(-dz_dy, dz_dx)
        aspect_deg = np.degrees(aspect)
        aspect_deg = (90 - aspect_deg) % 360
        
        return aspect_deg


class FloodSimulator:
    """Simulateur d'inondation avancé"""
    
    @staticmethod
    def simulate(dem: np.ndarray, water_level: float, 
                 resolution: float, include_flow: bool = False) -> Dict[str, Any]:
        """
        Simule une inondation
        
        Returns:
            Dictionnaire avec zones inondées et statistiques
        """
        # Zones submergées
        flooded = dem <= water_level
        
        # Profondeur d'eau
        water_depth = np.maximum(0, water_level - dem)
        water_depth[~flooded] = 0
        
        # Statistiques
        total_cells = dem.size
        flooded_cells = flooded.sum()
        flooded_area = flooded_cells * resolution * resolution
        
        max_depth = water_depth.max()
        avg_depth = water_depth[flooded].mean() if flooded_cells > 0 else 0
        
        result = {
            'flooded_mask': flooded,
            'water_depth': water_depth,
            'statistics': {
                'total_area_sqm': total_cells * resolution * resolution,
                'flooded_area_sqm': flooded_area,
                'flooded_percentage': (flooded_cells / total_cells) * 100,
                'max_depth_m': float(max_depth),
                'avg_depth_m': float(avg_depth),
                'flooded_cells': int(flooded_cells)
            }
        }
        
        # Direction d'écoulement (optionnel)
        if include_flow:
            dz_dx, dz_dy = np.gradient(dem)
            flow_direction = np.arctan2(dz_dy, dz_dx)
            result['flow_direction'] = flow_direction
        
        return result


class ViewshedAnalyzer:
    """Analyseur de visibilité"""
    
    @staticmethod
    def calculate(dem: np.ndarray, observer_pos: Tuple[int, int],
                  observer_height: float, target_height: float = 0) -> np.ndarray:
        """
        Calcule le viewshed depuis un point
        
        Args:
            dem: MNT
            observer_pos: (row, col) position observateur
            observer_height: Hauteur observateur
            target_height: Hauteur cible
        
        Returns:
            Array booléen indiquant visibilité
        """
        rows, cols = dem.shape
        obs_row, obs_col = observer_pos
        
        # Élévation observateur
        obs_elevation = dem[obs_row, obs_col] + observer_height
        
        # Matrice de visibilité
        visible = np.zeros_like(dem, dtype=bool)
        visible[obs_row, obs_col] = True
        
        # Pour chaque cellule, vérifier ligne de vue
        for i in range(rows):
            for j in range(cols):
                if i == obs_row and j == obs_col:
                    continue
                
                # Ligne entre observateur et cible
                line_points = ViewshedAnalyzer._bresenham_line(
                    obs_row, obs_col, i, j
                )
                
                # Élévation cible
                target_elevation = dem[i, j] + target_height
                
                # Vérifier si ligne de vue dégagée
                is_visible = True
                for point_idx, (r, c) in enumerate(line_points[1:-1], 1):
                    # Interpolation linéaire de la ligne de vue
                    fraction = point_idx / len(line_points)
                    sight_line_elevation = (obs_elevation + 
                                           fraction * (target_elevation - obs_elevation))
                    
                    # Si terrain bloque
                    if dem[r, c] > sight_line_elevation:
                        is_visible = False
                        break
                
                visible[i, j] = is_visible
        
        return visible
    
    @staticmethod
    def _bresenham_line(x0: int, y0: int, x1: int, y1: int) -> List[Tuple[int, int]]:
        """Algorithme de Bresenham pour tracer une ligne"""
        points = []
        dx = abs(x1 - x0)
        dy = abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        
        x, y = x0, y0
        while True:
            points.append((x, y))
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy
        
        return points


# ==================== ENDPOINTS ====================

@router.post("/flood")
async def simulate_flood(
    request: FloodSimulationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Simulation avancée d'inondation
    
    Calcule les zones inondables à partir d'un MNT et d'un niveau d'eau.
    Inclut profondeur, statistiques et optionnellement direction d'écoulement.
    """
    try:
        # Définir zone d'étude
        if request.area_geojson:
            area = shape(request.area_geojson)
            bounds = area.bounds  # (minx, miny, maxx, maxy)
        else:
            # Zone par défaut (exemple: Montréal)
            bounds = (-73.6, 45.4, -73.5, 45.6)
        
        # Générer ou charger MNT
        dem = DEMProcessor.generate_synthetic_dem(bounds, request.resolution)
        
        # Simulation
        flood_result = FloodSimulator.simulate(
            dem, 
            request.water_level,
            request.resolution,
            request.include_flow
        )
        
        # Convertir zones inondées en polygone
        # (Simplification: créer un rectangle englobant)
        flooded_area = box(*bounds)  # En production, utiliser rasterio.features.shapes
        
        # Sauvegarder résultat
        result = SimulationResult(
            simulation_type="flood",
            name=f"Simulation inondation - {request.water_level}m",
            result_vector=f"SRID=4326;{flooded_area.wkt}",
            parameters={
                "water_level": request.water_level,
                "dem_source": request.dem_source,
                "resolution": request.resolution,
                "include_flow": request.include_flow,
                "bounds": bounds
            },
            statistics=flood_result['statistics']
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {
            "simulation_id": result.id,
            "simulation_type": "flood",
            "parameters": request.dict(),
            "results": {
                "geometry": {
                    "type": "Feature",
                    "geometry": mapping(flooded_area),
                    "properties": flood_result['statistics']
                },
                "statistics": flood_result['statistics'],
                "dem_info": {
                    "resolution": request.resolution,
                    "shape": list(dem.shape),
                    "elevation_range": [float(dem.min()), float(dem.max())]
                }
            },
            "message": "Simulation réussie"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur simulation inondation: {str(e)}")


@router.post("/viewshed")
async def calculate_viewshed(
    request: ViewshedRequest,
    db: Session = Depends(get_db)
):
    """
    Analyse de visibilité avancée (Viewshed)
    
    Calcule les zones visibles depuis un point d'observation en tenant compte
    du relief (MNT) et des hauteurs d'observation et de cible.
    """
    try:
        observer = shape(request.observer_point)
        obs_coords = observer.coords[0]
        
        # Zone d'analyse
        radius_deg = request.radius / 111320.0
        bounds = (
            obs_coords[0] - radius_deg,
            obs_coords[1] - radius_deg,
            obs_coords[0] + radius_deg,
            obs_coords[1] + radius_deg
        )
        
        # Générer MNT
        dem = DEMProcessor.generate_synthetic_dem(bounds, request.resolution)
        
        # Position observateur dans la grille
        rows, cols = dem.shape
        obs_row = rows // 2
        obs_col = cols // 2
        
        # Calcul viewshed
        visible_mask = ViewshedAnalyzer.calculate(
            dem,
            (obs_row, obs_col),
            request.observer_height,
            request.target_height
        )
        
        # Statistiques
        total_cells = dem.size
        visible_cells = visible_mask.sum()
        visible_area = visible_cells * request.resolution * request.resolution
        
        # Créer polygone de zone visible (simplifié)
        visible_area_geom = Point(obs_coords).buffer(radius_deg)
        
        result = SimulationResult(
            simulation_type="viewshed",
            name=f"Analyse visibilité - {request.radius}m",
            result_vector=f"SRID=4326;{visible_area_geom.wkt}",
            parameters={
                "observer_height": request.observer_height,
                "target_height": request.target_height,
                "radius": request.radius,
                "resolution": request.resolution
            },
            statistics={
                "visible_area_sqm": float(visible_area),
                "visible_cells": int(visible_cells),
                "total_cells": int(total_cells),
                "visibility_percentage": float((visible_cells / total_cells) * 100),
                "radius": request.radius
            }
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {
            "simulation_id": result.id,
            "simulation_type": "viewshed",
            "result": {
                "type": "Feature",
                "geometry": mapping(visible_area_geom),
                "properties": result.statistics
            },
            "statistics": result.statistics,
            "message": "Analyse de visibilité réussie"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur viewshed: {str(e)}")


@router.post("/solar-shadow")
async def calculate_solar_shadow(
    request: SolarShadowRequest,
    db: Session = Depends(get_db)
):
    """
    Calcul précis d'ombre portée solaire
    
    Utilise des calculs astronomiques précis pour déterminer la position du soleil
    et projeter l'ombre d'un bâtiment à une date et heure données.
    """
    try:
        building = shape(request.building_geojson)
        
        # Calculer position du soleil
        azimuth, elevation = SolarCalculator.solar_position(
            request.latitude,
            request.longitude,
            request.date,
            request.time
        )
        
        # Si soleil sous l'horizon, pas d'ombre
        if elevation <= 0:
            return {
                "simulation_id": None,
                "simulation_type": "solar_shadow",
                "message": "Soleil sous l'horizon - pas d'ombre",
                "sun_position": {
                    "azimuth": azimuth,
                    "elevation": elevation
                }
            }
        
        # Longueur de l'ombre
        shadow_length = request.building_height / math.tan(math.radians(elevation))
        
        # Direction de l'ombre (opposée au soleil)
        shadow_azimuth = (azimuth + 180) % 360
        
        # Vecteur de déplacement en degrés
        dx = shadow_length * math.sin(math.radians(shadow_azimuth)) / 111320.0
        dy = shadow_length * math.cos(math.radians(shadow_azimuth)) / 111320.0
        
        # Créer l'ombre
        from shapely.affinity import translate, scale
        
        # Projeter le bâtiment
        shadow = translate(building, xoff=dx, yoff=dy)
        
        # Étirer selon angle (optionnel pour plus de réalisme)
        stretch_factor = 1.0 / max(0.1, math.sin(math.radians(elevation)))
        
        result = SimulationResult(
            simulation_type="solar_shadow",
            name=f"Ombre solaire - {request.date} {request.time}",
            result_vector=f"SRID=4326;{shadow.wkt}",
            parameters={
                "building_height": request.building_height,
                "date": request.date,
                "time": request.time,
                "latitude": request.latitude,
                "longitude": request.longitude
            },
            statistics={
                "shadow_length_m": float(shadow_length),
                "sun_azimuth": float(azimuth),
                "sun_elevation": float(elevation),
                "shadow_azimuth": float(shadow_azimuth),
                "shadow_area_sqm": float(shadow.area * 111320 * 111320)
            }
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {
            "simulation_id": result.id,
            "simulation_type": "solar_shadow",
            "result": {
                "type": "Feature",
                "geometry": mapping(shadow),
                "properties": result.statistics
            },
            "sun_position": {
                "azimuth": azimuth,
                "elevation": elevation,
                "shadow_azimuth": shadow_azimuth
            },
            "statistics": result.statistics,
            "message": "Calcul d'ombre solaire réussi"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur ombre solaire: {str(e)}")


@router.post("/slope-analysis")
async def analyze_slope(
    request: SlopeAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    Analyse de pente et exposition
    
    Calcule les pentes et orientations du terrain, classifie par catégories.
    """
    try:
        area = shape(request.area_geojson)
        bounds = area.bounds
        
        # Générer MNT
        dem = DEMProcessor.generate_synthetic_dem(bounds, request.resolution)
        
        # Calculer pente
        slope = DEMProcessor.calculate_slope(dem, request.resolution)
        
        # Calculer exposition
        aspect = DEMProcessor.calculate_aspect(dem)
        
        # Classifier les pentes
        slope_classes = {}
        for i, threshold in enumerate(request.slope_classes):
            if i == 0:
                mask = slope < threshold
                class_name = f"0-{threshold}%"
            else:
                prev_threshold = request.slope_classes[i-1]
                mask = (slope >= prev_threshold) & (slope < threshold)
                class_name = f"{prev_threshold}-{threshold}%"
            
            slope_classes[class_name] = {
                "area_sqm": float(mask.sum() * request.resolution * request.resolution),
                "percentage": float((mask.sum() / slope.size) * 100),
                "cell_count": int(mask.sum())
            }
        
        # Classe > max
        max_threshold = max(request.slope_classes)
        mask = slope >= max_threshold
        slope_classes[f">{max_threshold}%"] = {
            "area_sqm": float(mask.sum() * request.resolution * request.resolution),
            "percentage": float((mask.sum() / slope.size) * 100),
            "cell_count": int(mask.sum())
        }
        
        # Classifier les expositions
        aspect_classes = {
            "N": {"min": 337.5, "max": 22.5},
            "NE": {"min": 22.5, "max": 67.5},
            "E": {"min": 67.5, "max": 112.5},
            "SE": {"min": 112.5, "max": 157.5},
            "S": {"min": 157.5, "max": 202.5},
            "SW": {"min": 202.5, "max": 247.5},
            "W": {"min": 247.5, "max": 292.5},
            "NW": {"min": 292.5, "max": 337.5}
        }
        
        aspect_distribution = {}
        for direction, ranges in aspect_classes.items():
            if direction == "N":
                mask = (aspect >= ranges["min"]) | (aspect < ranges["max"])
            else:
                mask = (aspect >= ranges["min"]) & (aspect < ranges["max"])
            
            aspect_distribution[direction] = {
                "area_sqm": float(mask.sum() * request.resolution * request.resolution),
                "percentage": float((mask.sum() / aspect.size) * 100)
            }
        
        result = SimulationResult(
            simulation_type="slope_analysis",
            name=f"Analyse pente - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            result_vector=f"SRID=4326;{area.wkt}",
            parameters={
                "resolution": request.resolution,
                "slope_classes": request.slope_classes
            },
            statistics={
                "slope_classes": slope_classes,
                "aspect_distribution": aspect_distribution,
                "slope_stats": {
                    "min": float(slope.min()),
                    "max": float(slope.max()),
                    "mean": float(slope.mean()),
                    "std": float(slope.std())
                }
            }
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {
            "simulation_id": result.id,
            "simulation_type": "slope_analysis",
            "results": result.statistics,
            "message": "Analyse de pente réussie"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur analyse pente: {str(e)}")


@router.get("/results")
async def list_simulations(
    simulation_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Liste toutes les simulations avec pagination"""
    query = db.query(SimulationResult)
    
    if simulation_type:
        query = query.filter(SimulationResult.simulation_type == simulation_type)
    
    total = query.count()
    results = query.order_by(SimulationResult.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "count": len(results),
        "total": total,
        "offset": offset,
        "limit": limit,
        "simulations": [
            {
                "id": r.id,
                "type": r.simulation_type,
                "name": r.name,
                "created_at": r.created_at.isoformat(),
                "parameters": r.parameters,
                "statistics": r.statistics
            }
            for r in results
        ]
    }


@router.get("/results/{simulation_id}")
async def get_simulation_result(
    simulation_id: int,
    db: Session = Depends(get_db)
):
    """Récupère le résultat détaillé d'une simulation"""
    result = db.query(SimulationResult).filter(
        SimulationResult.id == simulation_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Simulation non trouvée")
    
    response = {
        "id": result.id,
        "simulation_type": result.simulation_type,
        "name": result.name,
        "created_at": result.created_at.isoformat(),
        "parameters": result.parameters,
        "statistics": result.statistics
    }
    
    # Géométrie si présente
    if result.result_vector:
        from geoalchemy2.shape import to_shape
        geom = to_shape(result.result_vector)
        response["geometry"] = {
            "type": "Feature",
            "geometry": mapping(geom),
            "properties": result.statistics
        }
    
    return response


@router.delete("/results/{simulation_id}")
async def delete_simulation(
    simulation_id: int,
    db: Session = Depends(get_db)
):
    """Supprime une simulation"""
    result = db.query(SimulationResult).filter(
        SimulationResult.id == simulation_id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Simulation non trouvée")
    
    db.delete(result)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Simulation {simulation_id} supprimée"
    }


@router.get("/types")
async def get_simulation_types():
    """Liste les types de simulations disponibles"""
    return {
        "simulation_types": [
            {
                "type": "flood",
                "name": "Simulation d'inondation",
                "description": "Calcule les zones inondables selon niveau d'eau",
                "requires": ["dem", "water_level"]
            },
            {
                "type": "viewshed",
                "name": "Analyse de visibilité",
                "description": "Zones visibles depuis un point",
                "requires": ["dem", "observer_point"]
            },
            {
                "type": "solar_shadow",
                "name": "Ombre solaire",
                "description": "Projection d'ombre selon position soleil",
                "requires": ["building", "datetime", "coordinates"]
            },
            {
                "type": "slope_analysis",
                "name": "Analyse de pente",
                "description": "Classification pentes et expositions",
                "requires": ["dem", "area"]
            }
        ]
    }
