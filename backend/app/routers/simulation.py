"""Router pour les simulations spatiales"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from shapely.geometry import Point, Polygon, shape, mapping
from datetime import datetime
import math

from app.database import get_db
from app.models.spatial_models import SimulationResult

router = APIRouter()


class FloodSimulationRequest(BaseModel):
    """Paramètres de simulation d'inondation"""
    water_level: float  # Niveau d'eau en mètres
    dem_source: str = "lidar"  # Source: lidar ou srtm
    area_geojson: Optional[dict] = None  # Zone d'étude


class ViewshedRequest(BaseModel):
    """Paramètres d'analyse de visibilité"""
    observer_point: dict  # GeoJSON Point
    observer_height: float = 1.7  # Hauteur de l'observateur en mètres
    radius: float = 1000  # Rayon d'analyse en mètres
    dem_source: str = "lidar"


class SolarShadowRequest(BaseModel):
    """Paramètres d'analyse d'ombrage solaire"""
    building_geojson: dict  # GeoJSON Polygon du bâtiment
    building_height: float
    date: str  # Format: YYYY-MM-DD
    time: str  # Format: HH:MM
    latitude: float
    longitude: float


@router.post("/flood")
async def simulate_flood(
    request: FloodSimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Simulation de zone inondable
    
    Utilise un MNT pour calculer les zones submergées à un niveau d'eau donné
    """
    try:
        # Cette fonction nécessiterait un vrai MNT
        # Pour la démo, on crée une simulation simplifiée
        
        # Exemple de résultat
        result = SimulationResult(
            simulation_type="flood",
            name=f"Flood simulation - {request.water_level}m",
            parameters={
                "water_level": request.water_level,
                "dem_source": request.dem_source
            },
            statistics={
                "affected_area_sqm": 15000,
                "population_at_risk": 250,
                "buildings_affected": 12
            }
        )
        
        db.add(result)
        db.commit()
        db.refresh(result)
        
        return {
            "simulation_id": result.id,
            "simulation_type": "flood",
            "parameters": request.dict(),
            "results": {
                "affected_area_sqm": 15000,
                "message": "Simulation créée. Utilisez /simulation/{id} pour les détails"
            },
            "note": "Version démo - nécessite un MNT réel pour calculs précis"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur simulation: {str(e)}")


@router.post("/viewshed")
async def calculate_viewshed(
    request: ViewshedRequest,
    db: Session = Depends(get_db)
):
    """
    Analyse de visibilité (viewshed)
    
    Calcule les zones visibles depuis un point d'observation
    """
    try:
        observer = shape(request.observer_point)
        
        # Simulation simplifiée
        # Dans un vrai cas, on utiliserait GDAL pour le calcul viewshed
        
        # Création d'une zone visible circulaire (simplification)
        visible_area = observer.buffer(request.radius / 111320.0)  # Conversion mètres -> degrés
        
        result = SimulationResult(
            simulation_type="viewshed",
            name=f"Viewshed analysis - {request.radius}m radius",
            result_vector=f"SRID=4326;{visible_area.wkt}",
            parameters={
                "observer_height": request.observer_height,
                "radius": request.radius,
                "dem_source": request.dem_source
            },
            statistics={
                "visible_area_sqm": visible_area.area * 111320 * 111320,
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
                "geometry": mapping(visible_area),
                "properties": {
                    "visible_area_sqm": visible_area.area * 111320 * 111320,
                    "radius": request.radius
                }
            },
            "note": "Simulation simplifiée - version complète nécessite un MNT"
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
    Calcule l'ombre portée d'un bâtiment à une heure donnée
    
    Utilise la position du soleil pour calculer la projection de l'ombre
    """
    try:
        building = shape(request.building_geojson)
        
        # Calcul de la position du soleil (simplifié)
        # Pour un calcul précis, utiliser la bibliothèque pysolar
        
        # Exemple simplifié: on suppose le soleil à 45° d'élévation
        sun_elevation = 45  # degrés
        sun_azimuth = 180  # Sud
        
        # Calcul de la longueur de l'ombre
        shadow_length = request.building_height / math.tan(math.radians(sun_elevation))
        
        # Direction de l'ombre (opposé au soleil)
        shadow_direction = sun_azimuth + 180
        
        # Calcul du vecteur de déplacement (simplifié)
        dx = shadow_length * math.sin(math.radians(shadow_direction)) / 111320.0
        dy = shadow_length * math.cos(math.radians(shadow_direction)) / 111320.0
        
        # Création de l'ombre (translation du bâtiment)
        from shapely.affinity import translate
        shadow = translate(building, xoff=dx, yoff=dy)
        
        result = SimulationResult(
            simulation_type="solar_shadow",
            name=f"Solar shadow - {request.date} {request.time}",
            result_vector=f"SRID=4326;{shadow.wkt}",
            parameters={
                "building_height": request.building_height,
                "date": request.date,
                "time": request.time,
                "latitude": request.latitude,
                "longitude": request.longitude
            },
            statistics={
                "shadow_length_m": shadow_length,
                "sun_elevation": sun_elevation,
                "sun_azimuth": sun_azimuth
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
                "properties": {
                    "shadow_length_m": shadow_length,
                    "sun_elevation": sun_elevation,
                    "sun_azimuth": sun_azimuth
                }
            },
            "note": "Calcul simplifié - pour précision utiliser pysolar"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur shadow: {str(e)}")


@router.get("/results")
async def list_simulations(
    simulation_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Liste toutes les simulations"""
    query = db.query(SimulationResult)
    
    if simulation_type:
        query = query.filter(SimulationResult.simulation_type == simulation_type)
    
    results = query.order_by(SimulationResult.created_at.desc()).all()
    
    return {
        "count": len(results),
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
    """Récupère le résultat d'une simulation"""
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
    
    # Ajout de la géométrie si elle existe
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
    
    return {"status": "success", "message": "Simulation supprimée"}
