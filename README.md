# BAUV-Maps WMS Service

This repository now contains a lightweight WMS 1.3.0 service you can run against map rasters exported from the [BAUV-Maps](https://github.com/kaaninan/BAUV-Maps) project.

## What this service provides

- `GetCapabilities` endpoint for WMS 1.3.0 clients.
- `GetMap` endpoint returning PNG map images.
- Pluggable local raster source directory (`MAPS_DIR`) so you can drop in BAUV map rasters and publish them as WMS layers.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open:

- Capabilities: `http://localhost:8000/wms?service=WMS&request=GetCapabilities`
- Example map: `http://localhost:8000/wms?service=WMS&version=1.3.0&request=GetMap&layers=example&styles=&crs=EPSG:3857&bbox=-20037508.34,-20037508.34,20037508.34,20037508.34&width=1024&height=1024&format=image/png`

## Loading BAUV-Maps data

1. Export or prepare your BAUV map imagery as georeferenced GeoTIFF files.
2. Copy those `.tif`/`.tiff` files into `./maps` (or set `MAPS_DIR=/path/to/maps`).
3. Each file name becomes a WMS layer name (without extension).

## Environment variables

- `MAPS_DIR` (default: `maps`) – directory containing GeoTIFF rasters.
- `WMS_TITLE` (default: `BAUV Maps WMS`) – service title in capabilities.
- `WMS_ABSTRACT` (default: `WMS endpoint for BAUV-Maps rasters`) – service abstract.
- `WMS_ONLINE_RESOURCE` (default: `http://localhost:8000/wms`) – advertised endpoint URL.

## Notes

- The service currently supports only `image/png` responses.
- `GetFeatureInfo` is not implemented yet.
