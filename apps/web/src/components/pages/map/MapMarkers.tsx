'use client';

/**
 * SVG pin + cluster markers for the Map view. A single task renders as a teardrop
 * pin in its status colour; overlapping tasks collapse into a count badge that
 * expands (spider-fans its members outward) on click. Every marker is clickable
 * (open task) and right-clickable (task context menu), and syncs a hover
 * highlight with the left list panel.
 */

import { memo, useMemo } from 'react';
import type { Task } from '@/store/workspace/types';
import type { Cluster, PlacedTask } from './geo';
import { MAP } from './tokens';

const PIN_PATH = 'M0 0 C -6 -10 -6 -18 0 -24 C 6 -18 6 -10 0 0 Z';

function statusColor(task: Task): string {
  return task.statusColor || MAP.pinDefault;
}

interface MarkerHandlers {
  onOpen: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  onHover: (taskId: string | null) => void;
  hoveredId: string | null;
}

const Pin = memo(function Pin({
  placed,
  handlers,
}: {
  placed: PlacedTask;
  handlers: MarkerHandlers;
}) {
  const { task, point } = placed;
  const active = handlers.hoveredId === task.id;
  return (
    <g
      data-testid="map-pin"
      data-task-id={task.id}
      transform={`translate(${point.x} ${point.y})`}
      role="button"
      tabIndex={0}
      aria-label={task.name}
      style={{ cursor: 'pointer', transition: 'transform 120ms' }}
      onClick={() => handlers.onOpen(task.id)}
      onContextMenu={(e) => handlers.onContextMenu(e, task)}
      onMouseEnter={() => handlers.onHover(task.id)}
      onMouseLeave={() => handlers.onHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlers.onOpen(task.id);
        }
      }}
    >
      {active && <circle cx={0} cy={-12} r={16} fill={statusColor(task)} opacity={0.18} />}
      <path
        d={PIN_PATH}
        fill={statusColor(task)}
        stroke="var(--cu-bg-app)"
        strokeWidth={1.5}
        transform={active ? 'scale(1.18)' : 'scale(1)'}
        style={{ transition: 'transform 120ms' }}
      />
      <circle cx={0} cy={-15} r={3.4} fill="var(--cu-bg-app)" />
    </g>
  );
});

const ClusterBadge = memo(function ClusterBadge({
  cluster,
  handlers,
}: {
  cluster: Cluster;
  handlers: MarkerHandlers & { onExpand: (key: string) => void };
}) {
  const { point, members } = cluster;
  const dominant = members[0]?.task;
  const color = dominant ? statusColor(dominant) : MAP.pinDefault;
  return (
    <g
      data-testid="map-cluster"
      transform={`translate(${point.x} ${point.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${members.length} tasks here`}
      style={{ cursor: 'pointer' }}
      onClick={() => handlers.onExpand(cluster.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlers.onExpand(cluster.key);
        }
      }}
    >
      <circle r={15} fill={color} opacity={0.22} />
      <circle r={11} fill={color} stroke="var(--cu-bg-app)" strokeWidth={1.5} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        fill="#fff"
        style={{ pointerEvents: 'none' }}
      >
        {members.length}
      </text>
    </g>
  );
});

export function MapMarkers({
  clusters,
  expandedKey,
  onExpand,
  onOpen,
  onContextMenu,
  onHover,
  hoveredId,
}: {
  clusters: Cluster[];
  expandedKey: string | null;
  onExpand: (key: string) => void;
  onOpen: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  onHover: (taskId: string | null) => void;
  hoveredId: string | null;
}) {
  const handlers = useMemo<MarkerHandlers>(
    () => ({ onOpen, onContextMenu, onHover, hoveredId }),
    [onOpen, onContextMenu, onHover, hoveredId],
  );

  const clusterHandlers = useMemo(() => ({ ...handlers, onExpand }), [handlers, onExpand]);

  // When a cluster is expanded, fan its members out on a ring around the centroid.
  const expandedMembers = useMemo<PlacedTask[]>(() => {
    if (!expandedKey) return [];
    const target = clusters.find((c) => c.key === expandedKey);
    if (!target || target.members.length < 2) return [];
    const radius = 26;
    return target.members.map((member, i) => {
      const angle = (i / target.members.length) * Math.PI * 2;
      return {
        ...member,
        point: {
          x: target.point.x + Math.cos(angle) * radius,
          y: target.point.y + Math.sin(angle) * radius,
        },
      };
    });
  }, [expandedKey, clusters]);

  return (
    <g>
      {clusters.map((cluster) => {
        const [single] = cluster.members;
        if (cluster.members.length === 1 && single) {
          return <Pin key={cluster.key} placed={single} handlers={handlers} />;
        }
        if (cluster.key === expandedKey) {
          return expandedMembers.map((member) => (
            <Pin key={member.task.id} placed={member} handlers={handlers} />
          ));
        }
        return (
          <ClusterBadge key={cluster.key} cluster={cluster} handlers={clusterHandlers} />
        );
      })}
    </g>
  );
}
