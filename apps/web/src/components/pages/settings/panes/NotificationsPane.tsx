'use client';

import { useState } from 'react';
import { PaneTitle, SettingsSection, ToggleRow } from './primitives';

/**
 * Notifications pane — grouped toggle rows for the notification channels and
 * categories ClickUp exposes in My Settings → Notifications.
 */
interface NotifState {
  browser: boolean;
  email: boolean;
  mobile: boolean;
  desktop: boolean;
  assigned: boolean;
  mentions: boolean;
  comments: boolean;
  statusChanges: boolean;
  dueDates: boolean;
  digest: boolean;
}

export function NotificationsPane() {
  const [state, setState] = useState<NotifState>({
    browser: true,
    email: true,
    mobile: false,
    desktop: true,
    assigned: true,
    mentions: true,
    comments: true,
    statusChanges: false,
    dueDates: true,
    digest: false,
  });

  const set = (key: keyof NotifState) => (v: boolean) =>
    setState((s) => ({ ...s, [key]: v }));

  return (
    <div>
      <PaneTitle>Notifications</PaneTitle>

      <SettingsSection
        label="Notification channels"
        description="Choose where you want to receive notifications."
      >
        <ToggleRow
          title="Browser"
          description="Show notifications in your browser."
          checked={state.browser}
          onChange={set('browser')}
        />
        <ToggleRow
          title="Email"
          description="Send notifications to your inbox."
          checked={state.email}
          onChange={set('email')}
        />
        <ToggleRow
          title="Mobile push"
          description="Push notifications to the ClickUp mobile app."
          checked={state.mobile}
          onChange={set('mobile')}
        />
        <ToggleRow
          title="Desktop"
          description="Native notifications from the desktop app."
          checked={state.desktop}
          onChange={set('desktop')}
        />
      </SettingsSection>

      <SettingsSection
        label="What to notify me about"
        description="Pick the activity that triggers a notification."
      >
        <ToggleRow
          title="Tasks assigned to me"
          checked={state.assigned}
          onChange={set('assigned')}
        />
        <ToggleRow
          title="Mentions"
          description="When someone @mentions you in a comment or doc."
          checked={state.mentions}
          onChange={set('mentions')}
        />
        <ToggleRow
          title="Comments"
          checked={state.comments}
          onChange={set('comments')}
        />
        <ToggleRow
          title="Status changes"
          checked={state.statusChanges}
          onChange={set('statusChanges')}
        />
        <ToggleRow
          title="Due dates"
          description="Reminders before a task is due."
          checked={state.dueDates}
          onChange={set('dueDates')}
        />
        <ToggleRow
          title="Daily digest"
          description="A once-a-day summary email of your activity."
          checked={state.digest}
          onChange={set('digest')}
        />
      </SettingsSection>
    </div>
  );
}
