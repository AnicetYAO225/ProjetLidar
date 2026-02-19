"""Router pour le traitement LIDAR"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import laspy
import numpy as np
from pathlib import Path
import json
from datetime import datetime

from app.database import get_db
from app.models.spatial_models import LidarData
from app.config import settings

router = APIRouter()


@router.post("/upload")
async def upload_lidar_file(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Upload un fichier LIDAR (.las ou .laz)
    
    Traite automatiquement le fichier et extrait les métadonnées
    """
    if not file.filename.endswith(('.las', '.laz')):
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Utilisez .las ou .laz"
        )
    
    try:
        # Création du répertoire si nécessaire
        lidar_dir = Path(settings.LIDAR_DIR)
        lidar_dir.mkdir(parents=True, exist_ok=True)
        
        # Sauvegarde du fichier
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        filepath = lidar_dir / safe_filename
        
        content = await file.read()
        
        # Vérification de la taille
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Fichier trop volumineux (max {settings.MAX_UPLOAD_SIZE / 1024 / 1024} MB)"
            )
        
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Lecture des métadonnées LIDAR
        las = laspy.read(filepath)
        
        # Extraction des informations
        min_elevation = float(las.z.min())
        max_elevation = float(las.z.max())
        point_count = len(las.points)
        
        # Calcul de l'emprise (bounding box)
        min_x, max_x = float(las.x.min()), float(las.x.max())
        min_y, max_y = float(las.y.min()), float(las.y.max())
        
        # Création du polygon bounds en WKT
        bounds_wkt = f"SRID=4326;POLYGON(({min_x} {min_y},{max_x} {min_y},{max_x} {max_y},{min_x} {max_y},{min_x} {min_y}))"
        
        # Métadonnées complètes
        metadata = {
            "point_format": str(las.point_format),
            "version": f"{las.header.version.major}.{las.header.version.minor}",
            "creation_date": str(las.header.creation_date) if las.header.creation_date else None,
            "system_identifier": las.header.system_identifier,
            "generating_software": las.header.generating_software,
            "scales": [float(las.header.x_scale), float(las.header.y_scale), float(las.header.z_scale)],
            "offsets": [float(las.header.x_offset), float(las.header.y_offset), float(las.header.z_offset)]
        }
        
        # Sauvegarde en base de données
        lidar_entry = LidarData(
            filename=safe_filename,
            filepath=str(filepath),
            point_count=point_count,
            min_elevation=min_elevation,
            max_elevation=max_elevation,
            bounds=bounds_wkt,
            crs=las.header.parse_crs().to_string() if las.header.parse_crs() else "Unknown",
            point_format=str(las.point_format),
            metadata=metadata,
            processed=0
        )
        
        db.add(lidar_entry)
        db.commit()
        db.refresh(lidar_entry)
        
        return {
            "status": "success",
            "lidar_id": lidar_entry.id,
            "filename": safe_filename,
            "point_count": point_count,
            "elevation_range": {
                "min": min_elevation,
                "max": max_elevation
            },
            "bounds": {
                "min_x": min_x,
                "max_x": max_x,
                "min_y": min_y,
                "max_y": max_y
            },
            "message": "Fichier LIDAR uploadé avec succès"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'upload: {str(e)}")


@router.get("/files")
async def list_lidar_files(db: Session = Depends(get_db)):
    """Liste tous les fichiers LIDAR uploadés"""
    files = db.query(LidarData).order_by(LidarData.uploaded_at.desc()).all()
    
    return {
        "count": len(files),
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "point_count": f.point_count,
                "elevation_range": {
                    "min": f.min_elevation,
                    "max": f.max_elevation
                },
                "uploaded_at": f.uploaded_at.isoformat(),
                "processed": bool(f.processed)
            }
            for f in files
        ]
    }


@router.get("/files/{lidar_id}")
async def get_lidar_info(lidar_id: int, db: Session = Depends(get_db)):
    """Informations détaillées sur un fichier LIDAR"""
    lidar = db.query(LidarData).filter(LidarData.id == lidar_id).first()
    
    if not lidar:
        raise HTTPException(status_code=404, detail="Fichier LIDAR non trouvé")
    
    return {
        "id": lidar.id,
        "filename": lidar.filename,
        "point_count": lidar.point_count,
        "elevation_range": {
            "min": lidar.min_elevation,
            "max": lidar.max_elevation
        },
        "crs": lidar.crs,
        "point_format": lidar.point_format,
        "metadata": lidar.metadata,
        "uploaded_at": lidar.uploaded_at.isoformat()
    }


@router.get("/files/{lidar_id}/sample")
async def get_lidar_sample(
    lidar_id: int,
    sample_size: int = 10000,
    db: Session = Depends(get_db)
):
    """
    Récupère un échantillon de points LIDAR pour visualisation 3D
    
    - **sample_size**: Nombre de points à retourner (max 50000)
    """
    lidar = db.query(LidarData).filter(LidarData.id == lidar_id).first()
    
    if not lidar:
        raise HTTPException(status_code=404, detail="Fichier LIDAR non trouvé")
    
    try:
        # Lecture du fichier LIDAR
        las = laspy.read(lidar.filepath)
        
        # Limite de sécurité
        sample_size = min(sample_size, 50000, len(las.points))
        
        # Échantillonnage aléatoire
        indices = np.random.choice(len(las.points), sample_size, replace=False)
        
        # Extraction des coordonnées
        x = las.x[indices].tolist()
        y = las.y[indices].tolist()
        z = las.z[indices].tolist()
        
        # Classification (si disponible)
        classifications = None
        if hasattr(las, 'classification'):
            classifications = las.classification[indices].tolist()
        
        # Intensité (si disponible)
        intensities = None
        if hasattr(las, 'intensity'):
            intensities = las.intensity[indices].tolist()
        
        return {
            "point_count": sample_size,
            "points": {
                "x": x,
                "y": y,
                "z": z
            },
            "classifications": classifications,
            "intensities": intensities,
            "bounds": {
                "min_x": float(las.x.min()),
                "max_x": float(las.x.max()),
                "min_y": float(las.y.min()),
                "max_y": float(las.y.max()),
                "min_z": float(las.z.min()),
                "max_z": float(las.z.max())
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lecture LIDAR: {str(e)}")


@router.post("/files/{lidar_id}/process")
async def process_lidar(
    lidar_id: int,
    operation: str = "dtm",  # dtm, dsm, density, classification
    db: Session = Depends(get_db)
):
    """
    Traite un fichier LIDAR
    
    - **dtm**: Modèle Numérique de Terrain
    - **dsm**: Modèle Numérique de Surface
    - **density**: Carte de densité de points
    - **classification**: Statistiques par classification
    """
    lidar = db.query(LidarData).filter(LidarData.id == lidar_id).first()
    
    if not lidar:
        raise HTTPException(status_code=404, detail="Fichier LIDAR non trouvé")
    
    try:
        las = laspy.read(lidar.filepath)
        
        if operation == "classification":
            # Statistiques par classe
            if hasattr(las, 'classification'):
                unique, counts = np.unique(las.classification, return_counts=True)
                
                # Noms de classes standards LAS
                class_names = {
                    0: "Never classified",
                    1: "Unassigned",
                    2: "Ground",
                    3: "Low Vegetation",
                    4: "Medium Vegetation",
                    5: "High Vegetation",
                    6: "Building",
                    7: "Low Point",
                    9: "Water",
                    17: "Bridge Deck"
                }
                
                stats = {
                    str(int(cls)): {
                        "name": class_names.get(int(cls), "Unknown"),
                        "count": int(count),
                        "percentage": float(count / len(las.points) * 100)
                    }
                    for cls, count in zip(unique, counts)
                }
                
                return {
                    "operation": "classification",
                    "total_points": len(las.points),
                    "classes": stats
                }
            else:
                return {"error": "Pas de classification disponible"}
        
        elif operation == "density":
            # Calcul simple de densité
            area = (las.x.max() - las.x.min()) * (las.y.max() - las.y.min())
            density = len(las.points) / area if area > 0 else 0
            
            return {
                "operation": "density",
                "points_per_sqm": float(density),
                "total_points": len(las.points),
                "area_sqm": float(area)
            }
        
        else:
            return {
                "message": f"Opération '{operation}' en développement",
                "available_operations": ["classification", "density"]
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur traitement: {str(e)}")


@router.delete("/files/{lidar_id}")
async def delete_lidar_file(lidar_id: int, db: Session = Depends(get_db)):
    """Supprime un fichier LIDAR"""
    lidar = db.query(LidarData).filter(LidarData.id == lidar_id).first()
    
    if not lidar:
        raise HTTPException(status_code=404, detail="Fichier LIDAR non trouvé")
    
    try:
        # Suppression du fichier physique
        filepath = Path(lidar.filepath)
        if filepath.exists():
            filepath.unlink()
        
        # Suppression de la base de données
        db.delete(lidar)
        db.commit()
        
        return {"status": "success", "message": "Fichier supprimé"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur suppression: {str(e)}")
