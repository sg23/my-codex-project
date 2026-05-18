from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Dict
from xml.etree.ElementTree import Element, SubElement, tostring

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException, Query, Response
from PIL import Image
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds

MAPS_DIR = Path(os.getenv("MAPS_DIR", "maps"))
WMS_TITLE = os.getenv("WMS_TITLE", "BAUV Maps WMS")
WMS_ABSTRACT = os.getenv("WMS_ABSTRACT", "WMS endpoint for BAUV-Maps rasters")
WMS_ONLINE_RESOURCE = os.getenv("WMS_ONLINE_RESOURCE", "http://localhost:8000/wms")

app = FastAPI(title="BAUV-Maps WMS Service", version="0.1.0")


def discover_layers() -> Dict[str, Path]:
    MAPS_DIR.mkdir(parents=True, exist_ok=True)
    files = list(MAPS_DIR.glob("*.tif")) + list(MAPS_DIR.glob("*.tiff"))
    return {path.stem: path for path in files}


def get_layer_extent_epsg_4326(path: Path) -> tuple[float, float, float, float]:
    with rasterio.open(path) as src:
        bounds = src.bounds
        src_crs = src.crs
        if src_crs is None:
            raise HTTPException(status_code=500, detail=f"Layer {path.stem} has no CRS.")
        return transform_bounds(src_crs, "EPSG:4326", *bounds, densify_pts=21)


def build_capabilities_xml() -> bytes:
    root = Element("WMS_Capabilities", {
        "version": "1.3.0",
        "xmlns": "http://www.opengis.net/wms",
        "xmlns:xlink": "http://www.w3.org/1999/xlink",
    })

    service = SubElement(root, "Service")
    SubElement(service, "Name").text = "WMS"
    SubElement(service, "Title").text = WMS_TITLE
    SubElement(service, "Abstract").text = WMS_ABSTRACT
    SubElement(service, "OnlineResource", {"xlink:href": WMS_ONLINE_RESOURCE, "xlink:type": "simple"})

    capability = SubElement(root, "Capability")
    request = SubElement(capability, "Request")

    get_caps = SubElement(request, "GetCapabilities")
    SubElement(get_caps, "Format").text = "text/xml"

    get_map = SubElement(request, "GetMap")
    SubElement(get_map, "Format").text = "image/png"

    layer_root = SubElement(capability, "Layer")
    SubElement(layer_root, "Title").text = WMS_TITLE
    SubElement(layer_root, "CRS").text = "EPSG:4326"
    SubElement(layer_root, "CRS").text = "EPSG:3857"

    for layer_name, layer_path in discover_layers().items():
        minx, miny, maxx, maxy = get_layer_extent_epsg_4326(layer_path)
        layer = SubElement(layer_root, "Layer", {"queryable": "0"})
        SubElement(layer, "Name").text = layer_name
        SubElement(layer, "Title").text = layer_name
        SubElement(layer, "CRS").text = "EPSG:4326"
        SubElement(layer, "CRS").text = "EPSG:3857"
        SubElement(layer, "EX_GeographicBoundingBox")
        ex_geo = layer.find("EX_GeographicBoundingBox")
        SubElement(ex_geo, "westBoundLongitude").text = str(minx)
        SubElement(ex_geo, "eastBoundLongitude").text = str(maxx)
        SubElement(ex_geo, "southBoundLatitude").text = str(miny)
        SubElement(ex_geo, "northBoundLatitude").text = str(maxy)

    return tostring(root, encoding="utf-8", xml_declaration=True)


def render_png(
    layer_path: Path,
    bbox: tuple[float, float, float, float],
    crs: str,
    width: int,
    height: int,
) -> bytes:
    with rasterio.open(layer_path) as src:
        if src.crs is None:
            raise HTTPException(status_code=500, detail=f"Layer {layer_path.stem} has no CRS.")

        dst = np.zeros((src.count, height, width), dtype=np.uint8)

        rasterio.warp.reproject(
            source=rasterio.band(src, list(range(1, src.count + 1))),
            destination=dst,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=rasterio.transform.from_bounds(*bbox, width=width, height=height),
            dst_crs=crs,
            resampling=Resampling.bilinear,
        )

        if src.count == 1:
            img = Image.fromarray(dst[0], mode="L").convert("RGBA")
        else:
            rgb = np.transpose(dst[:3], (1, 2, 0))
            img = Image.fromarray(rgb, mode="RGB").convert("RGBA")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/wms")
def wms(
    service: str = Query(...),
    request: str = Query(...),
    version: str = Query("1.3.0"),
    layers: str | None = Query(None),
    styles: str | None = Query(None),
    crs: str | None = Query(None),
    bbox: str | None = Query(None),
    width: int | None = Query(None),
    height: int | None = Query(None),
    format: str | None = Query(None),
) -> Response:
    if service.upper() != "WMS":
        raise HTTPException(status_code=400, detail="Invalid service, expected WMS")

    req = request.lower()

    if req == "getcapabilities":
        return Response(content=build_capabilities_xml(), media_type="text/xml")

    if req == "getmap":
        if version != "1.3.0":
            raise HTTPException(status_code=400, detail="Only WMS 1.3.0 is supported")
        if not all([layers, crs, bbox, width, height, format]):
            raise HTTPException(status_code=400, detail="Missing required GetMap parameters")
        if format.lower() != "image/png":
            raise HTTPException(status_code=400, detail="Only image/png is supported")
        if styles is None:
            styles = ""

        available_layers = discover_layers()
        if layers not in available_layers:
            raise HTTPException(status_code=404, detail=f"Unknown layer '{layers}'")

        try:
            bbox_values = tuple(float(v) for v in bbox.split(","))
            if len(bbox_values) != 4:
                raise ValueError
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid bbox format") from exc

        png = render_png(available_layers[layers], bbox_values, crs, width, height)
        return Response(content=png, media_type="image/png")

    raise HTTPException(status_code=400, detail=f"Unsupported request '{request}'")
