import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { fetchGeocode, fetchDrivingRoute } from "../../api/campusMapAPI";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const DefaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

/** Default anchor if API meta not loaded — TIT Bhopal (Anand Nagar / Hataikheda). */
export const TIT_BHOPAL_FALLBACK = { lat: 23.2612, lng: 77.4985 };

const titCampusIcon = L.divIcon({
  className: "map-tit-anchor",
  html: '<span class="map-tit-anchor__dot"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10],
});

const destinationIcon = L.divIcon({
  className: "map-search-dest",
  html: '<span class="map-search-dest__dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -8],
});

function MapResize() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = window.setTimeout(() => map.invalidateSize(), 450);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}

function boundsKey(bounds) {
  if (!bounds?.isValid?.()) return "";
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
}

function FitBounds({ bounds }) {
  const map = useMap();
  const key = boundsKey(bounds);

  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;
    const run = () => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: 17,
        animate: false,
      });
    };
    requestAnimationFrame(run);
    const t = window.setTimeout(run, 120);
    return () => window.clearTimeout(t);
  }, [map, key, bounds]);

  return null;
}

function FitPositions({ positions, padding = 48 }) {
  const map = useMap();
  const sig = useMemo(() => {
    if (!positions?.length) return "";
    const first = positions[0];
    const last = positions[positions.length - 1];
    return `${positions.length}:${first[0]},${first[1]}:${last[0]},${last[1]}`;
  }, [positions]);

  useEffect(() => {
    if (!positions?.length) return;
    const b = L.latLngBounds(positions);
    if (!b.isValid()) return;
    const run = () => {
      map.invalidateSize();
      map.fitBounds(b, { padding: [padding, padding], maxZoom: 16, animate: true });
    };
    requestAnimationFrame(run);
    const t = window.setTimeout(run, 80);
    return () => window.clearTimeout(t);
  }, [map, sig, positions, padding]);

  return null;
}

function CampusView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center[0], center[1], zoom]);
  return null;
}

function normalizeMarkers(markers) {
  if (!Array.isArray(markers)) return [];
  return markers
    .map((m) => ({
      ...m,
      latitude: Number(m.latitude ?? m.lat),
      longitude: Number(m.longitude ?? m.lng),
    }))
    .filter(
      (m) =>
        Number.isFinite(m.latitude) &&
        Number.isFinite(m.longitude) &&
        Math.abs(m.latitude) <= 90 &&
        Math.abs(m.longitude) <= 180,
    );
}

function formatRouteMeta(distanceM, durationS) {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return "";
  const km = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${Math.round(distanceM)} m`;
  const min = Math.round(durationS / 60);
  return `${km} · about ${min} min by car (OSRM estimate)`;
}

function googleDirectionsUrl(from, to) {
  const o = `${from.lat},${from.lng}`;
  const d = `${to.lat},${to.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`;
}

/**
 * @param {{ markers?: unknown[], campusCenter?: { lat: number, lng: number }, campusLabel?: string }} props
 */
const CampusMap = ({ markers = [], campusCenter, campusLabel }) => {
  const anchor = useMemo(() => {
    if (
      campusCenter &&
      Number.isFinite(campusCenter.lat) &&
      Number.isFinite(campusCenter.lng)
    ) {
      return { lat: campusCenter.lat, lng: campusCenter.lng };
    }
    return TIT_BHOPAL_FALLBACK;
  }, [campusCenter]);

  const label =
    campusLabel || "Technocrats Institute of Technology (TIT), Bhopal";

  const valid = useMemo(() => normalizeMarkers(markers), [markers]);

  const bounds = useMemo(() => {
    if (!valid.length) return null;
    if (valid.length === 1) {
      const { latitude: lat, longitude: lng } = valid[0];
      return L.latLngBounds(
        [lat - 0.008, lng - 0.008],
        [lat + 0.008, lng + 0.008],
      );
    }
    const pts = valid.map((m) => [m.latitude, m.longitude]);
    return L.latLngBounds(pts).pad(0.002);
  }, [valid]);

  const center = useMemo(
    () => [anchor.lat, anchor.lng],
    [anchor.lat, anchor.lng],
  );

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [destination, setDestination] = useState(null);
  const [routePositions, setRoutePositions] = useState(null);
  const [routeSummary, setRouteSummary] = useState("");
  const [panelError, setPanelError] = useState("");

  const clearRoute = useCallback(() => {
    setRoutePositions(null);
    setRouteSummary("");
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault?.();
    const q = query.trim();
    if (q.length < 2) {
      setPanelError("Type a place name (e.g. DB Mall, Habibganj station).");
      return;
    }
    setSearching(true);
    setPanelError("");
    setResults([]);
    clearRoute();
    setDestination(null);
    try {
      const { data } = await fetchGeocode(q);
      const list = Array.isArray(data) ? data : [];
      setResults(list);
      if (!list.length) {
        setPanelError("No results. Try another spelling or add “Bhopal”.");
      }
    } catch (err) {
      setPanelError(getApiErrorMessage(err, "Search failed."));
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (p) => {
    setDestination({ lat: p.lat, lng: p.lng, name: p.name });
    clearRoute();
    setPanelError("");
  };

  const loadDirections = async () => {
    if (!destination) return;
    setPanelError("");
    clearRoute();
    try {
      const { data } = await fetchDrivingRoute({
        fromLat: anchor.lat,
        fromLng: anchor.lng,
        toLat: destination.lat,
        toLng: destination.lng,
      });
      const positions = data?.positions;
      if (!Array.isArray(positions) || positions.length < 2) {
        setPanelError("Could not draw a route. Try Google Maps below.");
        return;
      }
      setRoutePositions(positions);
      setRouteSummary(formatRouteMeta(data.distance, data.duration));
    } catch (err) {
      setPanelError(
        getApiErrorMessage(
          err,
          "Directions unavailable. Open in Google Maps instead.",
        ),
      );
    }
  };

  return (
    <div className="campus-map-wrap">
      <div className="campus-map-leaflet-root">
        <MapContainer
          center={center}
          zoom={valid.length ? 15 : 16}
          className="campus-leaflet-map"
          scrollWheelZoom
          style={{ width: "100%", height: "100%" }}
        >
          <MapResize />
          {bounds && !routePositions ? <FitBounds bounds={bounds} /> : null}
          {!bounds && !routePositions ? (
            <CampusView center={center} zoom={16} />
          ) : null}
          {routePositions?.length ? (
            <FitPositions positions={routePositions} />
          ) : null}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center} icon={titCampusIcon}>
            <Popup>
              <strong>{label}</strong>
              <p className="map-popup-lead">Directions start here</p>
            </Popup>
          </Marker>
          {destination ? (
            <Marker
              position={[destination.lat, destination.lng]}
              icon={destinationIcon}
            >
              <Popup>
                <strong>Destination</strong>
                <p className="map-popup-meta">{destination.name}</p>
              </Popup>
            </Marker>
          ) : null}
          {routePositions?.length ? (
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "#2563eb",
                weight: 6,
                opacity: 0.88,
              }}
            />
          ) : null}
          {valid.map((m) => (
            <Marker
              key={
                m._id != null
                  ? String(m._id)
                  : `${m.latitude}-${m.longitude}-${m.name}`
              }
              position={[m.latitude, m.longitude]}
            >
              <Popup>
                <strong>{m.name}</strong>
                {m.description ? (
                  <p style={{ margin: "6px 0 0", fontSize: "0.9em" }}>
                    {m.description}
                  </p>
                ) : null}
                <small style={{ textTransform: "capitalize", opacity: 0.85 }}>
                  {m.category}
                </small>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <aside className="campus-map-sidebar">
        <div className="map-search-panel panel-card">
          <h2 className="map-search-title">Find a place in Bhopal</h2>
          <p className="muted-line map-search-lead">
            Search is biased to <strong>Bhopal</strong>. Routes run from{" "}
            <strong>TIT campus</strong> (green pin) to your result (red pin),
            using open data (OSRM). For turn-by-turn navigation, use Google Maps.
          </p>
          <form className="map-search-form" onSubmit={handleSearch}>
            <input
              type="search"
              className="map-search-input"
              placeholder="e.g. DB Mall, AIIMS Bhopal, Habibganj"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="map-search-btn" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {panelError ? (
            <p className="page-banner error map-search-banner" role="alert">
              {panelError}
            </p>
          ) : null}
          {results.length ? (
            <ul className="map-search-results">
              {results.map((p) => (
                <li key={`${p.placeId}-${p.lat}-${p.lng}`}>
                  <button
                    type="button"
                    className={
                      destination?.lat === p.lat && destination?.lng === p.lng
                        ? "is-selected"
                        : ""
                    }
                    onClick={() => selectPlace(p)}
                  >
                    <span className="map-search-result-name">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {destination ? (
            <div className="map-direction-actions">
              <button
                type="button"
                className="map-dir-primary"
                onClick={loadDirections}
              >
                Show driving route on map
              </button>
              <a
                className="map-dir-google"
                href={googleDirectionsUrl(anchor, destination)}
                target="_blank"
                rel="noreferrer"
              >
                Open directions in Google Maps
              </a>
              {routeSummary ? (
                <p className="map-route-summary">{routeSummary}</p>
              ) : null}
              <button
                type="button"
                className="map-dir-clear"
                onClick={() => {
                  setDestination(null);
                  setResults([]);
                  clearRoute();
                  setPanelError("");
                }}
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>

        <div className="map-legend-wrap">
          <h3 className="map-legend-heading">Campus pins</h3>
          {valid.length === 0 ? (
            <p className="muted-line">
              No building markers yet. From the backend run{" "}
              <code>npm run seed</code> or <code>node seed/seedMap.js</code>,
              then refresh.
            </p>
          ) : (
            <ul className="map-legend">
              {valid.map((m) => (
                <li
                  key={
                    m._id != null
                      ? String(m._id)
                      : `${m.latitude}-${m.longitude}-${m.name}`
                  }
                >
                  <strong>{m.name}</strong>
                  <span>{m.category}</span>
                  <small>
                    {Number(m.latitude).toFixed(5)},{" "}
                    {Number(m.longitude).toFixed(5)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};

export default CampusMap;
