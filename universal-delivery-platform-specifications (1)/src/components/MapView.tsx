"use client";

import { useEffect, useRef, useState } from "react";
import type * as LT from "leaflet";
import { LOCHES } from "@/lib/util";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "shop" | "home" | "courier" | "center" | "dot";
  emoji?: string;
  label?: string;
}

interface Props {
  markers?: MapMarker[];
  circle?: { lat: number; lng: number; km: number } | null;
  path?: [number, number][] | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  fit?: boolean;
  followId?: string | null;
  onPick?: (lat: number, lng: number) => void;
  draggableId?: string | null;
}

const KIND_EMOJI: Record<MapMarker["kind"], string> = {
  shop: "🏪",
  home: "🏠",
  courier: "🛵",
  center: "✛",
  dot: "•",
};

export default function MapView({
  markers = [],
  circle = null,
  path = null,
  center,
  zoom = 14,
  className = "h-64",
  fit = false,
  followId = null,
  onPick,
  draggableId = null,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LT.Map | null>(null);
  const lRef = useRef<typeof LT | null>(null);
  const entriesRef = useRef(
    new Map<string, { marker: LT.Marker; cur: { lat: number; lng: number }; target: { lat: number; lng: number } }>()
  );
  const circleRef = useRef<LT.Circle | null>(null);
  const pathRef = useRef<LT.Polyline | null>(null);
  const pathKeyRef = useRef("");
  const fittedRef = useRef(false);
  const dragPauseRef = useRef(0);
  const propsRef = useRef<Props>({});
  const [ready, setReady] = useState(false);
  propsRef.current = { markers, circle, path, fit, followId, onPick, draggableId };

  /* Initialisation unique */
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !divRef.current) return;
      lRef.current = L;
      const map = L.map(divRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView(center ?? [LOCHES.lat, LOCHES.lng], zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e: LT.LeafletMouseEvent) => {
        propsRef.current.onPick?.(e.latlng.lat, e.latlng.lng);
      });
      map.on("dragstart", () => {
        dragPauseRef.current = Date.now() + 5000;
      });
      mapRef.current = map;
      setReady(true);
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(divRef.current);

      const loop = () => {
        const follow = propsRef.current.followId;
        entriesRef.current.forEach((entry, id) => {
          const dx = entry.target.lat - entry.cur.lat;
          const dy = entry.target.lng - entry.cur.lng;
          if (Math.abs(dx) > 1e-7 || Math.abs(dy) > 1e-7) {
            entry.cur.lat += dx * 0.09;
            entry.cur.lng += dy * 0.09;
            entry.marker.setLatLng([entry.cur.lat, entry.cur.lng]);
          }
          if (follow === id && Date.now() > dragPauseRef.current) {
            const c = map.getCenter();
            if (Math.abs(c.lat - entry.cur.lat) > 0.0004 || Math.abs(c.lng - entry.cur.lng) > 0.0004) {
              map.panTo([entry.cur.lat, entry.cur.lng], { animate: true, duration: 0.6 });
            }
          }
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      entriesRef.current.clear();
      circleRef.current = null;
      pathRef.current = null;
      pathKeyRef.current = "";
      fittedRef.current = false;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Synchronisation des props → couches */
  useEffect(() => {
    const L = lRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const ids = new Set(markers.map((m) => m.id));
    entriesRef.current.forEach((entry, id) => {
      if (!ids.has(id)) {
        entry.marker.remove();
        entriesRef.current.delete(id);
      }
    });
    for (const m of markers) {
      const existing = entriesRef.current.get(m.id);
      if (existing) {
        existing.target = { lat: m.lat, lng: m.lng };
        continue;
      }
      const icon = L.divIcon({
        className: "locho-marker",
        html: `<div class="locho-pin ${m.kind}" title="${(m.label ?? "").replace(/"/g, "")}">${m.emoji ?? KIND_EMOJI[m.kind]}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([m.lat, m.lng], {
        icon,
        draggable: m.id === draggableId,
        keyboard: false,
      }).addTo(map);
      if (m.label) marker.bindTooltip(m.label, { direction: "top", offset: [0, -14] });
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        const entry = entriesRef.current.get(m.id);
        if (entry) {
          entry.cur = { lat: ll.lat, lng: ll.lng };
          entry.target = { lat: ll.lat, lng: ll.lng };
        }
        propsRef.current.onPick?.(ll.lat, ll.lng);
      });
      entriesRef.current.set(m.id, {
        marker,
        cur: { lat: m.lat, lng: m.lng },
        target: { lat: m.lat, lng: m.lng },
      });
    }

    if (fit && markers.length >= 2 && !fittedRef.current) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), {
        padding: [42, 42],
        maxZoom: 15,
      });
    }

    if (circle) {
      if (!circleRef.current) {
        circleRef.current = L.circle([circle.lat, circle.lng], {
          radius: circle.km * 1000,
          color: "#2667FF",
          weight: 1.5,
          dashArray: "6 6",
          fillColor: "#2667FF",
          fillOpacity: 0.07,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng([circle.lat, circle.lng]);
        circleRef.current.setRadius(circle.km * 1000);
      }
    } else if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    const key = path ? JSON.stringify(path) : "";
    if (key !== pathKeyRef.current) {
      pathKeyRef.current = key;
      if (pathRef.current) {
        pathRef.current.remove();
        pathRef.current = null;
      }
      if (path && path.length >= 2) {
        pathRef.current = L.polyline(path, {
          color: "#E4572E",
          weight: 3,
          dashArray: "10 14",
          className: "route-anim",
          opacity: 0.85,
        }).addTo(map);
      }
    }
  }, [ready, markers, circle, path, fit, draggableId]);

  return <div ref={divRef} className={`w-full overflow-hidden rounded-2xl border border-line ${className}`} />;
}
