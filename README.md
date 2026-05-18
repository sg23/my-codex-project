# BAUV-Maps Deployment (S-57 + BSB/KAP)

This repository now provides a deployment wrapper for the upstream **BAUV-Maps** service, instead of a generic GeoTIFF WMS implementation.

Upstream project: https://github.com/kaaninan/BAUV-Maps

## Why this architecture

The upstream BAUV-Maps project is a Node.js + Docker stack that runs:
- **tileserver-gl** on port **8000** (map tiles, styles, fonts, preview UI)
- **express** on port **8001** (SVG symbol assets)

This repo follows that architecture directly by running the published `kaaninan/bauv-maps` container and mounting chart/style data as volumes.

---

## 1) Docker Compose setup

Create your data directories:

```bash
mkdir -p data/tilesets data/styles data/symbols
```

Start the service:

```bash
docker compose up -d
```

Stop it:

```bash
docker compose down
```

---

## 2) Volume mounting for chart files

Compose mounts these host paths into the BAUV-Maps container:

- `./data/tilesets` -> `/usr/src/server/src/tileserver/tilesets`
- `./data/styles` -> `/usr/src/server/src/tileserver/styles`
- `./data/symbols` -> `/usr/src/server/src/public`

Put chart MBTiles outputs in `data/tilesets`.

> BAUV-Maps supports native **S-57 ENC (`.000`)** and **BSB/KAP (`.kap`)** workflows via its documented GDAL pipeline to MBTiles, as described in upstream `USAGE.md`.

---

## 3) Service endpoints

With default compose settings:

- Preview/UI: `http://localhost:8000`
- Tile server root: `http://localhost:8000/`
- Styles endpoint (example): `http://localhost:8000/styles/`
- TileJSON endpoint (example): `http://localhost:8000/data/<tileset-id>.json`
- SVG symbols service: `http://localhost:8001`

Health check used by compose:

- `GET http://localhost:8000/`

---

## 4) Example request URLs

Replace `<tileset-id>` with the MBTiles key configured in BAUV-Maps config.

- TileJSON metadata:
  - `http://localhost:8000/data/<tileset-id>.json`
- Vector tile (z/x/y):
  - `http://localhost:8000/data/<tileset-id>/0/0/0.pbf`
- Raster tile (z/x/y):
  - `http://localhost:8000/data/<tileset-id>/0/0/0.png`
- Style JSON:
  - `http://localhost:8000/styles/<style-id>/style.json`
- Glyphs path pattern (from style JSON):
  - `http://localhost:8000/fonts/{fontstack}/{range}.pbf`

---

## 5) Loading worldwide nautical / aviation datasets

### Nautical datasets

Use upstream BAUV-Maps conversion guidance:

- **S-57 ENC (`.000`) -> MBTiles**
  ```bash
  ogr2ogr OUT.mbtiles -f "mbtiles" -oo SPLIT_MULTIPOINT=ON -oo ADD_SOUNDG_DEPTH=ON MAP_NAME.000 -skipfailures -dsco MINZOOM=0 -dsco MAXZOOM=16
  ```
- **BSB/KAP (`.kap`) workflow**
  1. Convert KAP to GeoTIFF:
     ```bash
     gdal_translate -of GTiff -expand rgba MAP.KAP out.tif
     ```
  2. Convert GeoTIFF to MBTiles (QGIS Generate XYZ Tiles or equivalent GDAL process).

Copy resulting `.mbtiles` into `data/tilesets/`.

### Worldwide basemap / aviation overlays

For global context layers, prepare MBTiles from your source datasets (for example OSM or aviation layers), place them in `data/tilesets`, and reference them from style JSON in `data/styles`.

---

## 6) QGIS / OpenLayers / Leaflet integration

### QGIS

- Add a **Vector Tile** connection using:
  - `http://localhost:8000/data/<tileset-id>.json`
- Or use **XYZ Tiles** for raster endpoints:
  - `http://localhost:8000/data/<tileset-id>/{z}/{x}/{y}.png`

### OpenLayers (VectorTile source)

```js
const layer = new ol.layer.VectorTile({
  source: new ol.source.VectorTile({
    format: new ol.format.MVT(),
    url: 'http://localhost:8000/data/<tileset-id>/{z}/{x}/{y}.pbf'
  })
});
```

### Leaflet (Raster tiles)

```js
L.tileLayer('http://localhost:8000/data/<tileset-id>/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: 'BAUV-Maps'
}).addTo(map);
```

### Leaflet + MapLibre GL (Vector style)

Use style URL:

- `http://localhost:8000/styles/<style-id>/style.json`

---

## Notes on upstream files inspected

This deployment model is aligned to upstream BAUV-Maps structure and docs:
- `Dockerfile`
- `docker-entrypoint.sh`
- `package.json`
- `USAGE.md`

