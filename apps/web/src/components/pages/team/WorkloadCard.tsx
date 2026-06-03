'use client';

/**
 * Workload box, 1:1 with ClickUp's `cu-workload-box`: a "Workload" header over a
 * row of thin (6px) vertical capacity columns — one per assignee — each filled
 * green to that member's done ratio, with their avatar pinned underneath. The
 * column track is the full body height; bar height scales to task count vs the
 * busiest member. 250px min-width, 4px radius, elevation-2 shadow.
 */

import { peakLoad, type TeamBucket } from './team-data';
import { MemberAvatar } from './MemberAvatar';
import { TEAM, TEAM_CARD } from './tokens';

const BODY_HEIGHT = 160;

interface WorkloadCardProps {
  buckets: TeamBucket[];
}

export function WorkloadCard({ buckets }: WorkloadCardProps) {
  const peak = Math.max(peakLoad(buckets), 1);

  return (
    <section
      style={{
        minWidth: TEAM_CARD.width,
        maxWidth: 'calc(100% - 15px)',
        minHeight: 230,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: TEAM.cardBg,
        borderRadius: TEAM_CARD.radius,
        boxShadow: TEAM_CARD.shadow,
        margin: `0 ${TEAM_CARD.gutter}px ${TEAM_CARD.gutter}px 0`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 15px 15px',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1, color: TEAM.textPrimary }}>
          Workload
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 0,
          padding: '0 10px 15px',
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
        {buckets.length === 0 ? (
          <div style={{ fontSize: 12, color: TEAM.textMuted, padding: '0 5px' }}>
            No assignees
          </div>
        ) : (
          buckets.map((b) => <WorkloadColumn key={b.key} bucket={b} peak={peak} />)
        )}
      </div>
    </section>
  );
}

function WorkloadColumn({ bucket, peak }: { bucket: TeamBucket; peak: number }) {
  const fillH = Math.round((bucket.tasks.length / peak) * BODY_HEIGHT);
  const doneRatio = bucket.tasks.length === 0 ? 0 : bucket.done / bucket.tasks.length;
  const doneH = Math.round(fillH * doneRatio);

  return (
    <div
      title={`${bucket.name}: ${bucket.tasks.length} task${bucket.tasks.length === 1 ? '' : 's'}`}
      style={{
        margin: '0 5px',
        display: 'grid',
        gridTemplate: '1fr auto / 1fr',
        justifyItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          height: BODY_HEIGHT,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 6,
            height: '100%',
            display: 'flex',
            background: TEAM.track,
            borderRadius: 3,
            overflow: 'hidden',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              width: '100%',
              height: fillH,
              background: bucket.color,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              transition: 'height 280ms ease',
            }}
          >
            <div
              style={{
                width: '100%',
                height: doneH,
                background: TEAM.done,
                transition: 'height 280ms ease',
              }}
            />
          </div>
        </div>
      </div>

      <MemberAvatar initials={bucket.initials} color={bucket.color} size={24} />
    </div>
  );
}
