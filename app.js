const fallbackLocations = [
  {
    id: "court-1",
    name: "Supreme Court (Demo)",
    type: "court",
    lat: 1.2897,
    lng: 103.8518,
    issues: ["criminal", "employment", "debt"],
    hours: { weekdays: "08:30-18:00", weekend: "closed" },
  },
  {
    id: "court-2",
    name: "State Courts (Demo)",
    type: "court",
    lat: 1.3084,
    lng: 103.8505,
    issues: ["criminal", "employment", "debt", "housing"],
    hours: { weekdays: "08:30-18:00", weekend: "closed" },
  },
  {
    id: "court-3",
    name: "Family Justice Courts (Demo)",
    type: "court",
    lat: 1.3039,
    lng: 103.8521,
    issues: ["divorce"],
    hours: { weekdays: "08:30-18:00", weekend: "closed" },
  },
  {
    id: "clinic-1",
    name: "Legal Aid (Demo)",
    type: "clinic",
    lat: 1.2890,
    lng: 103.8501,
    issues: ["divorce", "employment", "debt", "housing", "immigration"],
    hours: { weekdays: "09:00-17:30", weekend: "closed" },
  },
  {
    id: "clinic-2",
    name: "Community Legal Clinic (Demo)",
    type: "clinic",
    lat: 1.3521,
    lng: 103.8198,
    issues: ["employment", "debt", "housing"],
    hours: { weekdays: "18:30-21:00", weekend: "10:00-14:00" },
  },
  {
    id: "cjc-1",
    name: "Community Justice Centre (Demo)",
    type: "cjc",
    lat: 1.3080,
    lng: 103.8509,
    issues: ["debt", "housing", "criminal"],
    hours: { weekdays: "09:00-17:00", weekend: "closed" },
  },
];

let locations = [...fallbackLocations];

// Baseline estimate for MRT+bus blended travel (demo only)
const speedKmPerHour = 25;

const map = L.map("map").setView([1.3521, 103.8198], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

const markers = new Map();
const markerLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const routeGroups = {
  driving: L.layerGroup().addTo(routeLayer),
  walking: L.layerGroup().addTo(routeLayer),
  transit: L.layerGroup().addTo(routeLayer),
};

const activeRoutes = [];
let activeRouteId = null;
let userMarker = null;

function markerColor(type) {
  if (type === "court") return "#ef4444";
  if (type === "clinic") return "#10b981";
  return "#f59e0b";
}

function renderMarkers(data) {
  markerLayer.clearLayers();
  markers.clear();

  data.forEach((location) => {
    const marker = L.circleMarker([location.lat, location.lng], {
      radius: 8,
      color: markerColor(location.type),
      fillColor: markerColor(location.type),
      fillOpacity: 0.85,
    }).addTo(markerLayer);

    marker.bindPopup(
      `<strong>${location.name}</strong><br/>${labelType(
        location.type
      )}<br/>Issues: ${location.issues.join(", ")}<br/>Weekdays: ${
        location.hours.weekdays
      }<br/>Weekend: ${location.hours.weekend}`
    );

    markers.set(location.id, marker);
  });
}

function labelType(type) {
  if (type === "court") return "Court";
  if (type === "clinic") return "Legal Aid Clinic";
  return "Community Justice Center";
}

function parseLatLng(value) {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  return { lat: parts[0], lng: parts[1] };
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  const r = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return r * c;
}

function estimateTravelMinutes(distanceKm) {
  return Math.round((distanceKm / speedKmPerHour) * 60);
}

function estimateWalkingMinutes(distanceKm) {
  const walkingKmPerHour = 5;
  return Math.round((distanceKm / walkingKmPerHour) * 60);
}

function ensureUserMarker(latlng) {
  if (userMarker) {
    userMarker.setLatLng(latlng);
    return;
  }

  userMarker = L.circleMarker(latlng, {
    radius: 8,
    color: "#111827",
    fillColor: "#111827",
    fillOpacity: 0.9,
  }).addTo(routeLayer);
  userMarker.bindPopup("<strong>You are here</strong>");
}

function clearRoutes() {
  Object.values(routeGroups).forEach((group) => group.clearLayers());
  activeRoutes.length = 0;
  activeRouteId = null;
}

function modeColor(mode) {
  if (mode === "driving") return "#2563eb";
  if (mode === "walking") return "#059669";
  return "#7c3aed";
}

function addRouteLine(route, isPrimary) {
  const polyline = L.polyline(route.latlngs, {
    color: modeColor(route.mode),
    weight: isPrimary ? 5 : 4,
    opacity: isPrimary ? 0.9 : 0.6,
    dashArray: isPrimary ? null : "8 8",
  }).addTo(routeGroups[route.mode]);

  polyline.on("click", () => setActiveRoute(route.id));

  activeRoutes.push({ ...route, polyline });
}

async function fetchOsrmRoutes(from, to, mode, maxAlternatives = 3) {
  const profile = mode === "walking" ? "walking" : "driving";
  const url = new URL(
    `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}`
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  // OSRM supports alternatives=true or a number on many deployments.
  url.searchParams.set("alternatives", String(maxAlternatives));
  url.searchParams.set("steps", "false");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`OSRM ${mode} failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  const routes = Array.isArray(json?.routes) ? json.routes : [];
  if (routes.length === 0) {
    throw new Error(`OSRM ${mode} failed: no routes`);
  }

  return routes
    .map((route, index) => {
      const coords = route?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      return {
        id: `osrm-${mode}-${index}`,
        mode,
        provider: "OSRM",
        index,
        latlngs: coords.map(([lng, lat]) => [lat, lng]),
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    })
    .filter(Boolean);
}

function getTimePartsInTimeZone(timeZone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-SG", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const weekday = (partMap.weekday || "").toLowerCase();
  const hour = Number(partMap.hour);
  const minute = Number(partMap.minute);

  const dayIndex =
    weekday === "sun"
      ? 0
      : weekday === "mon"
        ? 1
        : weekday === "tue"
          ? 2
          : weekday === "wed"
            ? 3
            : weekday === "thu"
              ? 4
              : weekday === "fri"
                ? 5
                : 6;

  return { dayIndex, hour, minute };
}

function getOpeningStatus(hours, timeZone = "Asia/Singapore") {
  const { dayIndex, hour, minute } = getTimePartsInTimeZone(timeZone);
  const day = dayIndex;
  const isWeekend = day === 0 || day === 6;
  const schedule = isWeekend ? hours.weekend : hours.weekdays;

  if (schedule === "closed") {
    return { open: false, schedule };
  }

  const [start, end] = schedule.split("-");
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const currentMinutes = hour * 60 + minute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const open = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  return { open, schedule };
}

function formatMinutes(minutes) {
  if (minutes <= 0) return "a few steps";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatKmFromMeters(meters) {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

function formatDurationSeconds(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return formatMinutes(minutes);
}

function decodePolyline(encoded, precision = 5) {
  // Minimal Google polyline decoder implementation.
  let index = 0;
  const coordinates = [];
  let lat = 0;
  let lng = 0;
  const factor = 10 ** precision;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

function extractTransitRoutesFromOneMapJson(json) {
  // Best-effort parsing: OneMap PT responses may vary.
  const candidates = [];

  // Case A: OTP-like: plan.itineraries[].legs[].legGeometry.points
  const itineraries = json?.plan?.itineraries;
  if (Array.isArray(itineraries)) {
    itineraries.forEach((itinerary, idx) => {
      const legs = Array.isArray(itinerary.legs) ? itinerary.legs : [];
      const points = legs
        .map((leg) => leg?.legGeometry?.points)
        .filter((p) => typeof p === "string");

      if (points.length > 0) {
        // Stitch legs (may have overlaps). Keep it simple for demo.
        const stitched = [];
        points.forEach((p) => {
          decodePolyline(p, 5).forEach((ll) => stitched.push(ll));
        });
        if (stitched.length >= 2) {
          candidates.push({
            id: `onemap-transit-${idx}`,
            mode: "transit",
            provider: "OneMap",
            index: idx,
            latlngs: stitched,
            distanceMeters: itinerary?.walkDistance,
            durationSeconds: itinerary?.duration,
          });
        }
      }
    });
  }

  // Case B: Single geometry string
  if (typeof json?.route_geometry === "string") {
    const latlngs = decodePolyline(json.route_geometry, 5);
    if (latlngs.length >= 2) {
      candidates.push({
        id: "onemap-transit-0",
        mode: "transit",
        provider: "OneMap",
        index: 0,
        latlngs,
        distanceMeters: json?.route_summary?.total_distance,
        durationSeconds: json?.route_summary?.total_time,
      });
    }
  }

  // Case C: GeoJSON
  const coords = json?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    candidates.push({
      id: "onemap-transit-0",
      mode: "transit",
      provider: "OneMap",
      index: 0,
      latlngs: coords.map(([lng, lat]) => [lat, lng]),
      distanceMeters: json?.distance,
      durationSeconds: json?.duration,
    });
  }

  return candidates;
}

async function fetchOneMapTransitRoutes(from, to, token) {
  const url = new URL("https://developers.onemap.sg/privateapi/routingsvc/route");
  url.searchParams.set("start", `${from.lat},${from.lng}`);
  url.searchParams.set("end", `${to.lat},${to.lng}`);
  url.searchParams.set("routeType", "pt");
  url.searchParams.set("token", token);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`OneMap transit failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  const routes = extractTransitRoutesFromOneMapJson(json);
  if (routes.length === 0) {
    throw new Error("OneMap transit failed: could not parse routes");
  }

  return routes;
}

function applyFilters(data, issue, openNow, weekdayOnly) {
  return data.filter((location) => {
    if (!location.issues.includes(issue)) return false;

    const status = getOpeningStatus(location.hours);
    if (weekdayOnly && location.hours.weekend !== "closed") {
      return false;
    }

    if (openNow && !status.open) {
      return false;
    }

    return true;
  });
}

function buildResultMessage(nearest, issue, summaryLines) {
  const status = getOpeningStatus(nearest.hours);
  const weekdayOnly = nearest.hours.weekend === "closed";
  const openText = status.open
    ? "open right now"
    : `currently closed (hours: ${status.schedule})`;

  const summary = summaryLines.length ? `\n\n${summaryLines.join("\n")}` : "";

  return `Your nearest legal help for ${issue} is ${nearest.name}. It is ${openText}${
    weekdayOnly ? ", and only open on weekdays." : ", with weekend hours."}${summary}`;
}

function setRouteSummary(text) {
  const el = document.getElementById("routeSummary");
  el.textContent = text;
}

function clearRouteList() {
  const el = document.getElementById("routeList");
  el.innerHTML = "";
}

function setActiveRoute(routeId) {
  activeRouteId = routeId;
  const list = document.getElementById("routeList");
  [...list.querySelectorAll(".route-item")].forEach((item) => {
    item.classList.toggle("active", item.dataset.routeId === routeId);
  });

  activeRoutes.forEach((route) => {
    const isActive = route.id === routeId;
    route.polyline.setStyle({
      weight: isActive ? 6 : route.index === 0 ? 5 : 4,
      opacity: isActive ? 1.0 : route.index === 0 ? 0.9 : 0.6,
    });
  });

  const route = activeRoutes.find((r) => r.id === routeId);
  if (route) {
    map.fitBounds(L.latLngBounds(route.latlngs).pad(0.2));
  }
}

function renderRouteList(routes) {
  const el = document.getElementById("routeList");
  el.innerHTML = "";

  routes.forEach((route) => {
    const distanceText =
      typeof route.distanceMeters === "number"
        ? formatKmFromMeters(route.distanceMeters)
        : "—";
    const durationText =
      typeof route.durationSeconds === "number"
        ? formatDurationSeconds(route.durationSeconds)
        : "—";

    const item = document.createElement("div");
    item.className = "route-item";
    item.dataset.routeId = route.id;

    const left = document.createElement("div");
    left.innerHTML = `<div><strong>${durationText}</strong> • ${distanceText}</div><div class="meta">${route.provider} • option ${
      route.index + 1
    }</div>`;

    const pill = document.createElement("div");
    pill.className = `pill ${route.mode}`;
    pill.textContent = route.mode === "transit" ? "Public transport" : route.mode;

    item.appendChild(left);
    item.appendChild(pill);
    item.addEventListener("click", () => setActiveRoute(route.id));

    el.appendChild(item);
  });
}

function focusMarker(location) {
  const marker = markers.get(location.id);
  if (marker) {
    marker.openPopup();
  }
}

function displayResult(text, tone = "") {
  const result = document.getElementById("result");
  result.classList.toggle("highlight", tone === "success");
  result.textContent = text;
}

async function loadServices() {
  try {
    const response = await fetch("/api/services");
    if (!response.ok) return;
    const json = await response.json();
    const services = Array.isArray(json?.services) ? json.services : null;
    if (services && services.length) {
      locations = services;
      renderMarkers(locations);
    }
  } catch {
    // Keep fallback data
  }
}

renderMarkers(locations);
loadServices();

const searchButton = document.getElementById("searchButton");
const geoButton = document.getElementById("geoButton");
const locationInput = document.getElementById("locationInput");

geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    displayResult("Geolocation is not supported in this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      locationInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      map.setView([latitude, longitude], 13);
      displayResult("Location captured. Choose your issue and search.");
    },
    () => {
      displayResult("Could not access your location. Enter lat, lng manually.");
    }
  );
});

searchButton.addEventListener("click", () => {
  const locationValue = parseLatLng(locationInput.value);
  if (!locationValue) {
    displayResult("Enter your location as latitude, longitude.");
    return;
  }

  const issue = document.getElementById("issueSelect").value;
  const openNow = document.getElementById("openNow").checked;
  const weekdayOnly = document.getElementById("weekdayOnly").checked;
  const oneMapToken = document.getElementById("oneMapToken").value.trim();

  ensureUserMarker([locationValue.lat, locationValue.lng]);
  clearRoutes();
  clearRouteList();
  setRouteSummary("Fetching driving/walking routes…");

  const filtered = applyFilters(locations, issue, openNow, weekdayOnly);
  if (filtered.length === 0) {
    displayResult("No locations match that issue and availability filters.");
    return;
  }

  let nearest = null;
  let nearestDistance = Infinity;
  filtered.forEach((location) => {
    const distance = haversineKm(locationValue, location);
    if (distance < nearestDistance) {
      nearest = location;
      nearestDistance = distance;
    }
  });

  displayResult("Fetching route alternatives…", "success");

  (async () => {
    const summaryLines = [];
    const allRoutes = [];

    let drivingRoutes = [];
    let walkingRoutes = [];
    let transitRoutes = [];

    try {
      [drivingRoutes, walkingRoutes] = await Promise.all([
        fetchOsrmRoutes(locationValue, nearest, "driving", 3),
        fetchOsrmRoutes(locationValue, nearest, "walking", 3),
      ]);
    } catch (e) {
      // If OSRM is down, draw at least a straight line so the demo still works.
      const latlngs = [
        [locationValue.lat, locationValue.lng],
        [nearest.lat, nearest.lng],
      ];

      drivingRoutes = [
        {
          id: "fallback-driving",
          mode: "driving",
          provider: "Fallback",
          index: 0,
          latlngs,
          distanceMeters: nearestDistance * 1000,
          durationSeconds: estimateTravelMinutes(nearestDistance) * 60,
        },
      ];
      walkingRoutes = [
        {
          id: "fallback-walking",
          mode: "walking",
          provider: "Fallback",
          index: 0,
          latlngs,
          distanceMeters: nearestDistance * 1000,
          durationSeconds: estimateWalkingMinutes(nearestDistance) * 60,
        },
      ];

      summaryLines.push("OSRM unavailable; using straight-line estimates.");
    }

    if (oneMapToken) {
      try {
        setRouteSummary("Fetching public transport routes…");
        transitRoutes = await fetchOneMapTransitRoutes(locationValue, nearest, oneMapToken);
      } catch {
        summaryLines.push("Public transport: could not fetch (token/CORS/endpoint).");
      }
    } else {
      summaryLines.push("Public transport: paste a OneMap token to enable.");
    }

    // Render polylines (primary = index 0)
    drivingRoutes.forEach((r) => addRouteLine(r, r.index === 0));
    walkingRoutes.forEach((r) => addRouteLine(r, r.index === 0));
    transitRoutes.forEach((r) => addRouteLine(r, r.index === 0));

    allRoutes.push(...drivingRoutes, ...walkingRoutes, ...transitRoutes);
    renderRouteList(allRoutes);

    // Build a compact mode summary
    const fastest = (routes) =>
      routes
        .filter((r) => typeof r.durationSeconds === "number")
        .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];

    const bestDriving = fastest(drivingRoutes);
    const bestWalking = fastest(walkingRoutes);
    const bestTransit = fastest(transitRoutes);

    if (bestDriving) {
      summaryLines.unshift(
        `Driving: ${formatDurationSeconds(bestDriving.durationSeconds)} • ${formatKmFromMeters(
          bestDriving.distanceMeters
        )} (showing ${drivingRoutes.length} option(s))`
      );
    }
    if (bestWalking) {
      summaryLines.unshift(
        `Walking: ${formatDurationSeconds(bestWalking.durationSeconds)} • ${formatKmFromMeters(
          bestWalking.distanceMeters
        )} (showing ${walkingRoutes.length} option(s))`
      );
    }
    if (bestTransit) {
      summaryLines.unshift(
        `Public transport: ${formatDurationSeconds(bestTransit.durationSeconds)} • ${
          typeof bestTransit.distanceMeters === "number"
            ? formatKmFromMeters(bestTransit.distanceMeters)
            : "—"
        } (showing ${transitRoutes.length} option(s))`
      );
    }

    setRouteSummary(summaryLines.join("\n"));
    displayResult(buildResultMessage(nearest, issue, summaryLines), "success");

    // Default selection: fastest route among everything we have
    const fastestOverall = fastest(allRoutes);
    if (fastestOverall) {
      setActiveRoute(fastestOverall.id);
    } else if (allRoutes[0]) {
      setActiveRoute(allRoutes[0].id);
    }

    focusMarker(nearest);
  })();
});
