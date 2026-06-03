import { ClickUpWorkspace } from '@/components/ClickUpWorkspace';
import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    route?: string[];
  }>;
};

export default async function WorkspaceRoutePage({ params }: PageProps) {
  const { route = [] } = await params;
  if (route.length === 0) {
    redirect('/90152566819/home');
  }
  return <ClickUpWorkspace route={route} />;
}
