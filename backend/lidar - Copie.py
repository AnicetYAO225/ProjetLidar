import os
import json
import uuid
import numpy as np
import laspy

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/lidar", tags=["Lidar"])

DATA_DIR = "lidar_data"
os.makedirs(DATA_DIR, exist_ok=True)

TILE_SIZE = 200
GRID_SIZE = 5
SAMPLE_POINTS = 200_000

# -------------------------------------------------------
# Upload LIDAR
# -------------------------------------------------------
@router.post("/upload")
async def upload_lidar(file: UploadFile = File(...)):
    lidar_id = str(uuid.uuid4())
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")

    with open(path, "wb") as f:
        f.write(await file.read())

    return {"lidar_id": lidar_id}


# -------------------------------------------------------
# Chargement points
# -------------------------------------------------------
def load_points(path, max_points=None):
    las = laspy.read(path)
    pts = np.vstack((las.x, las.y, las.z)).transpose()

    if max_points and len(pts) > max_points:
        idx = np.random.choice(len(pts), max_points, replace=False)
        pts = pts[idx]

    return pts


# -------------------------------------------------------
# Sample viewer
# -------------------------------------------------------
@router.get("/files/{lidar_id}/sample")
def sample_points(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    if not os.path.exists(path):
        raise HTTPException(404)

    pts = load_points(path, SAMPLE_POINTS)
    return JSONResponse(content={"points": pts.tolist()})


# -------------------------------------------------------
# Découpage en tuiles
# -------------------------------------------------------
def compute_tile_index(x, y, min_x, min_y):
    tx = int((x - min_x) / TILE_SIZE)
    ty = int((y - min_y) / TILE_SIZE)
    return tx, ty


@router.post("/files/{lidar_id}/tiles")
def generate_tiles(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    min_x, min_y = pts[:, 0].min(), pts[:, 1].min()
    tiles = {}

    for p in pts:
        tx, ty = compute_tile_index(p[0], p[1], min_x, min_y)
        tiles.setdefault((tx, ty), []).append(p.tolist())

    tile_dir = os.path.join(DATA_DIR, f"tiles_{lidar_id}")
    os.makedirs(tile_dir, exist_ok=True)

    for (tx, ty), arr in tiles.items():
        with open(f"{tile_dir}/{tx}_{ty}.json", "w") as f:
            json.dump(arr, f)

    return {"tiles": len(tiles)}


# -------------------------------------------------------
# Octree LOD
# -------------------------------------------------------
def build_octree(points, depth=0, max_depth=6, max_points=50_000):
    if depth >= max_depth or len(points) <= max_points:
        return {"points": points.tolist(), "children": []}

    center = points.mean(axis=0)
    children = []

    for dx in [0, 1]:
        for dy in [0, 1]:
            for dz in [0, 1]:
                mask = (
                    ((points[:, 0] > center[0]) == dx)
                    & ((points[:, 1] > center[1]) == dy)
                    & ((points[:, 2] > center[2]) == dz)
                )

                subset = points[mask]
                if len(subset):
                    children.append(
                        build_octree(subset, depth + 1, max_depth, max_points)
                    )

    return {"points": [], "children": children}


@router.post("/files/{lidar_id}/octree")
def generate_octree(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    tree = build_octree(pts)

    out_dir = os.path.join(DATA_DIR, f"octree_{lidar_id}")
    os.makedirs(out_dir, exist_ok=True)

    with open(f"{out_dir}/tree.json", "w") as f:
        json.dump(tree, f)

    return {"status": "octree generated"}


@router.get("/octree/{lidar_id}")
def load_octree(lidar_id: str):
    path = os.path.join(DATA_DIR, f"octree_{lidar_id}/tree.json")
    if not os.path.exists(path):
        raise HTTPException(404)

    with open(path) as f:
        tree = json.load(f)

    return tree


# -------------------------------------------------------
# Streaming adaptatif
# -------------------------------------------------------
@router.get("/files/{lidar_id}/adaptive")
def adaptive_stream(lidar_id: str, distance: float = 1000):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    factor = min(1, 500 / distance)
    sample = max(1000, int(len(pts) * factor))

    idx = np.random.choice(len(pts), sample, replace=False)
    return {"points": pts[idx].tolist()}


# -------------------------------------------------------
# DTM
# -------------------------------------------------------
@router.post("/files/{lidar_id}/dtm")
def generate_dtm(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    min_x, min_y = pts[:, 0].min(), pts[:, 1].min()
    grid = {}

    for p in pts:
        gx = int((p[0] - min_x) / GRID_SIZE)
        gy = int((p[1] - min_y) / GRID_SIZE)
        key = (gx, gy)
        grid[key] = min(grid.get(key, p[2]), p[2])

    out = []
    for (gx, gy), z in grid.items():
        x = min_x + gx * GRID_SIZE
        y = min_y + gy * GRID_SIZE
        out.append([x, y, z])

    with open(os.path.join(DATA_DIR, f"dtm_{lidar_id}.json"), "w") as f:
        json.dump(out, f)

    return {"cells": len(out)}


# -------------------------------------------------------
# DSM
# -------------------------------------------------------
@router.post("/files/{lidar_id}/dsm")
def generate_dsm(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    min_x, min_y = pts[:, 0].min(), pts[:, 1].min()
    grid = {}

    for p in pts:
        gx = int((p[0] - min_x) / GRID_SIZE)
        gy = int((p[1] - min_y) / GRID_SIZE)
        key = (gx, gy)
        grid[key] = max(grid.get(key, p[2]), p[2])

    out = []
    for (gx, gy), z in grid.items():
        x = min_x + gx * GRID_SIZE
        y = min_y + gy * GRID_SIZE
        out.append([x, y, z])

    with open(os.path.join(DATA_DIR, f"dsm_{lidar_id}.json"), "w") as f:
        json.dump(out, f)

    return {"cells": len(out)}


# -------------------------------------------------------
# Mesh terrain
# -------------------------------------------------------
@router.get("/files/{lidar_id}/terrain-mesh")
def terrain_mesh(lidar_id: str):
    with open(os.path.join(DATA_DIR, f"dtm_{lidar_id}.json")) as f:
        vertices = json.load(f)

    faces = [[i, i + 1, i + 2] for i in range(len(vertices) - 2)]
    return {"vertices": vertices, "faces": faces}


# -------------------------------------------------------
# Classification
# -------------------------------------------------------
@router.post("/files/{lidar_id}/classify")
def classify_points(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    ground = np.percentile(pts[:, 2], 5)
    classified = []

    for p in pts:
        cls = "ground" if p[2] - ground < 1 else "building"
        classified.append([p[0], p[1], p[2], cls])

    with open(os.path.join(DATA_DIR, f"classified_{lidar_id}.json"), "w") as f:
        json.dump(classified, f)

    return {"points": len(classified)}


# -------------------------------------------------------
# Extraction bâtiments
# -------------------------------------------------------
@router.post("/files/{lidar_id}/buildings")
def extract_buildings(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    ground = np.percentile(pts[:, 2], 5)
    buildings = [p.tolist() for p in pts if p[2] - ground > 2]

    with open(os.path.join(DATA_DIR, f"buildings_{lidar_id}.json"), "w") as f:
        json.dump(buildings, f)

    return {"building_points": len(buildings)}


# -------------------------------------------------------
# Hauteurs bâtiments
# -------------------------------------------------------
@router.post("/files/{lidar_id}/building-heights")
def building_heights(lidar_id: str):
    with open(os.path.join(DATA_DIR, f"dtm_{lidar_id}.json")) as f:
        dtm = {tuple(p[:2]): p[2] for p in json.load(f)}

    with open(os.path.join(DATA_DIR, f"dsm_{lidar_id}.json")) as f:
        dsm = json.load(f)

    heights = []
    for x, y, z in dsm:
        ground = dtm.get((x, y), z)
        h = max(0, z - ground)
        if h > 2:
            heights.append([x, y, h])

    return {"buildings_detected": len(heights)}


# -------------------------------------------------------
# Volume
# -------------------------------------------------------
@router.post("/files/{lidar_id}/volume")
def compute_volume(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    ground = np.percentile(pts[:, 2], 5)
    area = GRID_SIZE * GRID_SIZE

    volume = sum(max(0, p[2] - ground) * area / 10 for p in pts)
    return {"estimated_volume_m3": float(volume)}


# -------------------------------------------------------
# Navigation drone
# -------------------------------------------------------
@router.get("/files/{lidar_id}/drone-path")
def drone_path(lidar_id: str):
    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path, 50_000)

    min_x, max_x = pts[:, 0].min(), pts[:, 0].max()
    min_y, max_y = pts[:, 1].min(), pts[:, 1].max()
    max_z = pts[:, 2].max() + 30

    path_pts = []
    steps = 20

    for i in range(steps):
        x = min_x + (max_x - min_x) * i / steps
        y = min_y + (max_y - min_y) * (i % 2)
        path_pts.append([x, y, max_z])

    return {"path": path_pts}
# -------------------------------------------------------
# Streaming par bounding box caméra
# -------------------------------------------------------
@router.get("/files/{lidar_id}/stream-bbox")
def stream_bbox(
    lidar_id: str,
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
    max_points: int = 200000,
):

    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    mask = (
        (pts[:, 0] >= minx)
        & (pts[:, 0] <= maxx)
        & (pts[:, 1] >= miny)
        & (pts[:, 1] <= maxy)
    )

    subset = pts[mask]

    if len(subset) > max_points:
        idx = np.random.choice(len(subset), max_points, replace=False)
        subset = subset[idx]

    return {"points": subset.tolist()}


# -------------------------------------------------------
# Streaming LOD selon distance caméra
# -------------------------------------------------------
@router.get("/files/{lidar_id}/stream-lod")
def stream_lod(
    lidar_id: str,
    camx: float,
    camy: float,
    distance: float = 1000,
    budget: int = 200000,
):

    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    dx = pts[:, 0] - camx
    dy = pts[:, 1] - camy
    dist = np.sqrt(dx * dx + dy * dy)

    factor = np.clip(distance / (dist + 1), 0.05, 1)
    keep = np.random.rand(len(pts)) < factor

    subset = pts[keep]

    if len(subset) > budget:
        idx = np.random.choice(len(subset), budget, replace=False)
        subset = subset[idx]

    return {"points": subset.tolist()}


# -------------------------------------------------------
# Streaming par tuiles visibles
# -------------------------------------------------------
@router.get("/files/{lidar_id}/visible-tiles")
def visible_tiles(
    lidar_id: str,
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
):

    tile_dir = os.path.join(DATA_DIR, f"tiles_{lidar_id}")

    if not os.path.exists(tile_dir):
        raise HTTPException(404, "Tiles not generated")

    tiles = []

    for fname in os.listdir(tile_dir):
        tx, ty = fname.replace(".json", "").split("_")
        tx, ty = int(tx), int(ty)

        x0 = tx * TILE_SIZE
        y0 = ty * TILE_SIZE
        x1 = x0 + TILE_SIZE
        y1 = y0 + TILE_SIZE

        if not (x1 < minx or x0 > maxx or y1 < miny or y0 > maxy):
            tiles.append(fname)

    return {"tiles": tiles}


# -------------------------------------------------------
# Budget GPU anti-freeze
# -------------------------------------------------------
@router.get("/files/{lidar_id}/point-budget")
def point_budget(lidar_id: str, budget: int = 150000):

    path = os.path.join(DATA_DIR, f"{lidar_id}.las")
    pts = load_points(path)

    if len(pts) > budget:
        idx = np.random.choice(len(pts), budget, replace=False)
        pts = pts[idx]

    return {"points": pts.tolist()}