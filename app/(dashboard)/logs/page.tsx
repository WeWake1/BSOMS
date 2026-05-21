import { requireAdmin } from '@/lib/auth';
import { LogsClient } from './LogsClient';

export const metadata = {
  title: 'Activity Log | OrderFlow',
};

export default async function LogsPage() {
  const user = await requireAdmin();
  return <LogsClient user={user} />;
}
