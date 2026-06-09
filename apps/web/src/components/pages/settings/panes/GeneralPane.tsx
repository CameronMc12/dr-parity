'use client';

import { GeneralSection } from './sections/GeneralSection';
import { CustomBrandingSection } from './sections/CustomBrandingSection';
import { PersonalLayoutSection } from './sections/PersonalLayoutSection';

/**
 * Workspace Settings — the default Settings content pane. A centered, max-width
 * column of full-width cards (each row = left label/description, right control),
 * matching the ClickUp General → Workspace Settings oracle 1:1.
 */
export function GeneralPane() {
  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <h1 className="text-[28px] font-bold text-white mb-8">Workspace Settings</h1>
      <GeneralSection />
      <CustomBrandingSection />
      <PersonalLayoutSection />
    </div>
  );
}
