import { ClickUpWorkspace } from '@/components/ClickUpWorkspace';
import { getDefaultListUrl } from '@/data/workspace-tree';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    route?: string[];
  }>;
};

export default async function WorkspaceRoutePage({ params }: PageProps) {
  const { route = [] } = await params;
  // Land on the seeded Backlog List view so the first screen shows real tasks
  // (data-driven: first non-empty list under DR-PARITY-SEED), not an empty hero.
  if (route.length === 0) {
    redirect(getDefaultListUrl());
  }
  return <ClickUpWorkspace route={route} />;
}
