const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;
const MAX_RESULTS = 50;

const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: false,
    polyline: false,
    circle: false,
    marker: false,
    circlemarker: false,
    rectangle: {
      showArea: true,
      shapeOptions: {
        color: "#2563eb",
        weight: 2,
      },
    },
  },
  edit: {
    featureGroup: drawnItems,
  },
});

map.addControl(drawControl);

let currentBbox = null;

const bboxDisplay = document.getElementById("bbox-display");
const resultCount = document.getElementById("result-count");
const resultsBody = document.getElementById("results-body");
const form = document.getElementById("search-form");

function formatIsoDate(date, endOfDay = false) {
  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  if (endOfDay) {
    dt.setUTCHours(23, 59, 59, 999);
  } else {
    dt.setUTCHours(0, 0, 0, 0);
  }
  return dt.toISOString();
}

function updateBboxDisplay(bounds) {
  if (!bounds) {
    bboxDisplay.textContent = "No AOI selected.";
    bboxDisplay.classList.remove("text-break");
    return;
  }
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  currentBbox = [
    southWest.lng.toFixed(4),
    southWest.lat.toFixed(4),
    northEast.lng.toFixed(4),
    northEast.lat.toFixed(4),
  ];
  bboxDisplay.textContent = `Lon/Lat bounds: ${currentBbox.join(", ")}`;
  bboxDisplay.classList.add("text-break");
}

function clearResults(message = "Draw an AOI and run a search to see available scenes.") {
  resultsBody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center text-muted py-4">${message}</td>
    </tr>`;
  resultCount.textContent = "0 scenes";
}

map.on(L.Draw.Event.CREATED, (event) => {
  drawnItems.clearLayers();
  drawnItems.addLayer(event.layer);
  updateBboxDisplay(event.layer.getBounds());
});

map.on(L.Draw.Event.EDITED, (event) => {
  const layer = event.layers.getLayers()[0];
  updateBboxDisplay(layer ? layer.getBounds() : null);
});

map.on(L.Draw.Event.DELETED, () => {
  currentBbox = null;
  updateBboxDisplay(null);
  clearResults();
});

function buildSearchUrl(params) {
  const searchParams = new URLSearchParams({
    maxRecords: String(MAX_RESULTS),
    page: "1",
    sortParam: "completiondate",
    sortOrder: "descending",
    status: "all",
    startDate: formatIsoDate(params.startDate),
    completionDate: formatIsoDate(params.endDate, true),
    bbox: params.bbox.join(","),
  });

  if (params.polarisation) {
    searchParams.set("polarisationmode", params.polarisation);
  }
  if (params.productType) {
    searchParams.set("productType", params.productType);
  }

  return `https://catalogue.dataspace.copernicus.eu/resto/api/collections/Sentinel1/search.json?${searchParams.toString()}`;
}

function formatAcquisitionDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toUTCString();
}

function renderResults(features) {
  if (!features || features.length === 0) {
    clearResults("No scenes found. Try expanding the date range or AOI.");
    return;
  }

  resultCount.textContent = `${features.length} scene${features.length === 1 ? "" : "s"}`;

  const rows = features
    .map((feature) => {
      const properties = feature.properties || {};
      const services = properties.services || {};
      const downloadLink = services.download?.url || properties.productIdentifier;
      const quicklookLink = services.quicklook?.url || "";

      return `
        <tr>
          <td class="text-break">${properties.title || properties.productIdentifier || "Unknown"}</td>
          <td>${formatAcquisitionDate(properties.startdate)}</td>
          <td>${properties.polarisationmode || "-"}</td>
          <td>${properties.producttype || "-"}</td>
          <td>${
            quicklookLink
              ? `<a href="${quicklookLink}" target="_blank" rel="noopener">Preview</a>`
              : "-"
          }</td>
          <td>${
            downloadLink
              ? `<a href="${downloadLink}" target="_blank" rel="noopener">Download</a>`
              : "-"
          }</td>
        </tr>`;
    })
    .join("");

  resultsBody.innerHTML = rows;
}

async function performSearch(event) {
  event.preventDefault();

  if (!currentBbox) {
    clearResults("Please draw an AOI on the map before searching.");
    return;
  }

  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;
  const polarisation = document.getElementById("polarisation").value;
  const productType = document.getElementById("product-type").value;

  if (!startDate || !endDate) {
    clearResults("Please provide both start and end dates.");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    clearResults("Start date must be earlier than end date.");
    return;
  }

  const url = buildSearchUrl({
    startDate,
    endDate,
    polarisation,
    productType,
    bbox: currentBbox,
  });

  resultsBody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </td>
    </tr>`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    const features = data.features || [];
    renderResults(features);
  } catch (error) {
    console.error("Search failed", error);
    clearResults(
      "Failed to load results. The Copernicus catalogue may be temporarily unavailable or requires authentication."
    );
  }
}

form.addEventListener("submit", performSearch);

clearResults();
