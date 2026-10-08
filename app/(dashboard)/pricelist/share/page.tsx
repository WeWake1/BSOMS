import { requireAuth } from '@/lib/auth';
import { ShareClient } from './ShareClient';

export const metadata = {
  title: 'Share Price List | OrderFlow',
};

export default async function SharePricelistPage() {
  const user = await requireAuth();

  return <ShareClient user={user} />;
}
