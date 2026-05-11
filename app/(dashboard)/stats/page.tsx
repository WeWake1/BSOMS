import { requireAdmin } from '@/lib/auth';
import { StatsClient } from './StatsClient';

export const metadata = {
  title: 'Statistics | OrderFlow',
};

export default async function StatsPage() {
  const user = await requireAdmin();
  return <StatsClient user={user} />;
}
