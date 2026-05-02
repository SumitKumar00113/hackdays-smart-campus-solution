import { useEffect, useState } from "react";
import { fetchMapMarkers, fetchMapMeta } from "../../api/campusMapAPI";
import CampusMap from "../../components/map/CampusMap";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

const CampusMapPage = () => {
  const [markers, setMarkers] = useState([]);
  const [campusCenter, setCampusCenter] = useState(null);
  const [campusLabel, setCampusLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [markersRes, metaRes] = await Promise.all([
          fetchMapMarkers(),
          fetchMapMeta().catch(() => ({ data: null })),
        ]);
        if (!cancelled) {
          setMarkers(Array.isArray(markersRes.data) ? markersRes.data : []);
          const o = metaRes?.data?.origin;
          if (o && Number.isFinite(o.lat) && Number.isFinite(o.lng)) {
            setCampusCenter({ lat: o.lat, lng: o.lng });
          }
          const lbl = metaRes?.data?.label;
          if (typeof lbl === "string" && lbl.trim()) {
            setCampusLabel(lbl.trim());
          }
        }
      } catch (e) {
        if (!cancelled)
          setError(getApiErrorMessage(e, "Could not load campus map."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page-pad map-page">
      <h1>TIT campus map — Bhopal</h1>
      <p className="page-lead">
        Map centered on <strong>Technocrats Institute of Technology (TIT)</strong>
        , Anand Nagar / Hataikheda, Bhopal. Search for a place in the city, pick a
        result, then show a driving route from campus or open{" "}
        <strong>Google Maps</strong> for turn-by-turn directions. Campus pins
        come from your database; override the anchor with{" "}
        <code>CAMPUS_ORIGIN_LAT</code> / <code>CAMPUS_ORIGIN_LNG</code> in{" "}
        <code>backend/.env</code> if needed.
      </p>
      {error ? (
        <p className="page-banner error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p>Loading map…</p>
      ) : (
        <CampusMap
          markers={markers}
          campusCenter={campusCenter}
          campusLabel={campusLabel}
        />
      )}
    </main>
  );
};

export default CampusMapPage;
