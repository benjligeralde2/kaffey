"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

const KAFFEY_LOCATION: [number, number] = [-73.9577, 40.7216];

export function MapboxMap() {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !mapContainer.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: KAFFEY_LOCATION,
      zoom: 14.8,
      attributionControl: false,
    });

    new mapboxgl.Marker({ color: "#b86a4b" }).setLngLat(KAFFEY_LOCATION).addTo(map);
    map.on("load", () => map.resize());

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, []);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return <div className="mapbox-fallback">Add a Mapbox public token to view the map.</div>;
  }

  return <div className="mapbox-map" ref={mapContainer} aria-label="Map showing Kaffey at 243 Wythe Avenue" role="application" />;
}
