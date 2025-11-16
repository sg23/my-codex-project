# Sentinel-1 Ship Detection Data Explorer

This lightweight web app helps you discover Sentinel-1 scenes that are suitable for ship detection workflows. Draw an area of interest (AOI), set a date range, and filter by polarisation or product type to retrieve matching products from the Copernicus Data Space catalogue.

## Features

- Interactive Leaflet map with rectangle drawing to define the AOI
- Date, polarisation, and product type filters tailored to ship detection use-cases
- Direct links to preview and download Sentinel-1 scenes
- Responsive Bootstrap UI that works on desktop and tablets

## Getting started

Because the project is a static web application, you only need a basic HTTP server to run it locally.

```bash
# from the repository root
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser and load `index.html`.

> **Note**
> The Copernicus Data Space API enforces rate limiting. For heavy usage, create a free account and generate an access token, then add it as a bearer token in your browser session or proxy server.

## Testing

Minimal structural checks are provided via a Node test script:

```bash
npm test
```

## Next steps

- Integrate with a backend that queues ship detection processing jobs using SNAP, SentinelHub, or bespoke SAR pipelines.
- Persist favourite AOIs and queries for frequently monitored regions.
- Add automatic vessel detection visualisation once detections are processed.
