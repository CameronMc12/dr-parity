/**
 * Geographic derivation for the Map view. Our tasks carry no real geo field, so
 * we derive a STABLE pseudo-location per task by hashing its id to one of a fixed
 * set of well-known cities, then applying a small deterministic jitter. The same
 * task always lands on the same spot. An equirectangular projection maps each
 * lat/lng into the SVG view box.
 *
 * Pure module — no React, no store. Safe to call from useMemo.
 */

import type { Task } from '@/store/workspace/types';

/** SVG view-box dimensions used by the world map + projection. */
export const MAP_W = 1000;
export const MAP_H = 500;

export interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/** Eight well-known cities spread across the globe. Order is stable (hash index). */
export const CITIES: readonly City[] = [
  { name: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194 },
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006 },
  { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
] as const;

/** Guaranteed-present anchor city (CITIES is a non-empty literal). */
const FALLBACK_CITY: City = {
  name: 'San Francisco',
  country: 'USA',
  lat: 37.7749,
  lng: -122.4194,
};

/** Deterministic 32-bit FNV-1a hash of a string. Stable across renders/reloads. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Map a 32-bit hash slice to a signed jitter in degrees within ±range. */
function jitterFromHash(hash: number, range: number): number {
  // Use the top 16 bits as a 0..1 fraction, re-centred to -1..1.
  const frac = (hash >>> 16) / 0xffff;
  return (frac * 2 - 1) * range;
}

export interface DerivedLocation {
  city: City;
  lat: number;
  lng: number;
}

/**
 * Stable derived location for a task. The city is chosen by hashing the task id;
 * a small (~±1.4°) jitter keeps tasks in the same city from stacking exactly,
 * while staying close enough to read as that city.
 */
export function deriveLocation(taskId: string): DerivedLocation {
  const hash = hashString(taskId);
  const city = CITIES[hash % CITIES.length] ?? FALLBACK_CITY;
  const latJitter = jitterFromHash(hash, 1.4);
  const lngJitter = jitterFromHash(hashString(`${taskId}:lng`), 1.4);
  return {
    city,
    lat: city.lat + latJitter,
    lng: city.lng + lngJitter,
  };
}

export interface Point {
  x: number;
  y: number;
}

/** Equirectangular projection of lat/lng into the SVG view box. */
export function project(lat: number, lng: number): Point {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return { x, y };
}

export interface PlacedTask {
  task: Task;
  location: DerivedLocation;
  point: Point;
}

/** Derive + project a task into a placed marker ready for the SVG layer. */
export function placeTask(task: Task): PlacedTask {
  const location = deriveLocation(task.id);
  return { task, location, point: project(location.lat, location.lng) };
}

export interface Cluster {
  /** Stable key from the member ids it contains. */
  key: string;
  /** Centroid in SVG space. */
  point: Point;
  members: PlacedTask[];
}

/**
 * Grid-cluster placed tasks so overlapping pins collapse into a single count
 * badge. `cellPx` is the SVG-space cell edge; smaller = looser clustering.
 */
export function clusterTasks(placed: PlacedTask[], cellPx: number): Cluster[] {
  const buckets = new Map<string, PlacedTask[]>();
  for (const item of placed) {
    const col = Math.floor(item.point.x / cellPx);
    const row = Math.floor(item.point.y / cellPx);
    const key = `${col}:${row}`;
    const existing = buckets.get(key);
    buckets.set(key, existing ? [...existing, item] : [item]);
  }

  const out: Cluster[] = [];
  for (const members of buckets.values()) {
    let sumX = 0;
    let sumY = 0;
    for (const m of members) {
      sumX += m.point.x;
      sumY += m.point.y;
    }
    const count = members.length;
    out.push({
      key: members.map((m) => m.task.id).join(','),
      point: { x: sumX / count, y: sumY / count },
      members,
    });
  }
  return out;
}
