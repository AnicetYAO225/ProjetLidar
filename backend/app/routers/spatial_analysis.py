"""Router pour les analyses spatiales"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from geoalchemy2.shape import to_shape, from_shape
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import json

from app.database import get_db
from app.models.spatial_models import SpatialFeature, AnalysisResult

router = APIRouter()


# Schémas Pydantic
class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: Optional[dict] = {}


class BufferRequest(BaseModel):
    feature: GeoJSONFeature
    distance: float  # Distance en mètres
    name: Optional[str] = "Buffer Analysis"


class IntersectionRequest(BaseModel):
    feature1: GeoJSONFeature
    feature2: GeoJSONFeature
    name: Optional[str] = "Intersection Analysis"


class DistanceRequest(BaseModel):
    feature1: GeoJSONFeature
    feature2: GeoJSONFeature


@router.get("/features")
async def get_all_features(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Récupère toutes les entités spatiales"""
    query = db.query(SpatialFeature)
    
    if category:
        query = query.filter(SpatialFeature.category == category)
    
    features = query.all()
    
    geojson_features = []
    for feature in features:
        if feature.geom:
            geom = to_shape(feature.geom)
            geojson_features.append({
                "type": "Feature",
                "id": feature.id,
                "geometry": mapping(geom),
                "properties": {
                    "name": feature.name,
                    "category": feature.category,
                    "description": feature.description,
                    **(feature.properties or {})
                }
            })
    
    return {
        "type": "FeatureCollection",
        "features": geojson_features
    }


@router.post("/features")
async def create_feature(
    feature: GeoJSONFeature,
    name: str = Query(...),
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Crée une nouvelle entité spatiale"""
    try:
        # Conversion GeoJSON vers Shapely
        geom = shape(feature.geometry)
        
        # Création de l'entité
        new_feature = SpatialFeature(
            name=name,
            category=category,
            geom=f"SRID=4326;{geom.wkt}",
            properties=feature.properties
        )
        
        db.add(new_feature)
        db.commit()
        db.refresh(new_feature)
        
        return {
            "status": "success",
            "feature_id": new_feature.id,
            "message": "Entité créée avec succès"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erreur: {str(e)}")


@router.post("/buffer")
async def create_buffer(
    request: BufferRequest,
    db: Session = Depends(get_db)
):
    """
    Crée une zone tampon (buffer) autour d'une géométrie
    
    - **distance**: Distance en mètres
    - **feature**: GeoJSON de l'entité
    """
    try:
        # Conversion en Shapely
        geom = shape(request.feature.geometry)
        
        # Transformation en système métrique (Web Mercator pour approximation)
        # Pour une vraie projection, utiliser pyproj
        
        # Buffer (approximation simple)
        # Pour convertir mètres en degrés (approximation à l'équateur)
        meters_to_degrees = request.distance / 111320.0
        buffered = geom.buffer(meters_to_degrees)
        
        # Sauvegarde du résultat
        result = AnalysisResult(
            analysis_type="buffer",
            input_features={"feature": request.feature.dict()},
            parameters={"distance": request.distance},
            result_geom=f"SRID=4326;{buffered.wkt}",
            result_data={"area": buffered.area}
        )
        
        db.add(result)
        db.commit()
        
        return {
            "type": "Feature",
            "geometry": mapping(buffered),
            "properties": {
                "analysis_id": result.id,
                "analysis_type": "buffer",
                "distance": request.distance,
                "area_sq_degrees": buffered.area
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur buffer: {str(e)}")


@router.post("/intersection")
async def calculate_intersection(
    request: IntersectionRequest,
    db: Session = Depends(get_db)
):
    """Calcule l'intersection entre deux géométries"""
    try:
        geom1 = shape(request.feature1.geometry)
        geom2 = shape(request.feature2.geometry)
        
        intersection = geom1.intersection(geom2)
        
        if intersection.is_empty:
            return {
                "message": "Pas d'intersection",
                "intersection": None
            }
        
        # Sauvegarde
        result = AnalysisResult(
            analysis_type="intersection",
            input_features={
                "feature1": request.feature1.dict(),
                "feature2": request.feature2.dict()
            },
            result_geom=f"SRID=4326;{intersection.wkt}",
            result_data={"area": intersection.area}
        )
        
        db.add(result)
        db.commit()
        
        return {
            "type": "Feature",
            "geometry": mapping(intersection),
            "properties": {
                "analysis_id": result.id,
                "analysis_type": "intersection",
                "area_sq_degrees": intersection.area
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur intersection: {str(e)}")


@router.post("/distance")
async def calculate_distance(request: DistanceRequest):
    """Calcule la distance entre deux géométries"""
    try:
        geom1 = shape(request.feature1.geometry)
        geom2 = shape(request.feature2.geometry)
        
        distance_degrees = geom1.distance(geom2)
        # Conversion approximative en mètres
        distance_meters = distance_degrees * 111320.0
        
        return {
            "distance_degrees": distance_degrees,
            "distance_meters": distance_meters,
            "distance_km": distance_meters / 1000
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur distance: {str(e)}")


@router.get("/analysis/{analysis_id}")
async def get_analysis_result(analysis_id: int, db: Session = Depends(get_db)):
    """Récupère le résultat d'une analyse"""
    result = db.query(AnalysisResult).filter(AnalysisResult.id == analysis_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Analyse non trouvée")
    
    geom = to_shape(result.result_geom)
    
    return {
        "type": "Feature",
        "id": result.id,
        "geometry": mapping(geom),
        "properties": {
            "analysis_type": result.analysis_type,
            "created_at": result.created_at.isoformat(),
            "parameters": result.parameters,
            "result_data": result.result_data
        }
    }


@router.get("/statistics")
async def get_spatial_statistics(db: Session = Depends(get_db)):
    """Statistiques sur les données spatiales"""
    
    total_features = db.query(SpatialFeature).count()
    total_analyses = db.query(AnalysisResult).count()
    
    # Nombre par catégorie
    categories = db.query(
        SpatialFeature.category,
        text("COUNT(*) as count")
    ).group_by(SpatialFeature.category).all()
    
    return {
        "total_features": total_features,
        "total_analyses": total_analyses,
        "features_by_category": {cat: count for cat, count in categories if cat}
    }
