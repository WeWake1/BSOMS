import { requireAuth } from '@/lib/auth';
import { PricelistClient } from './PricelistClient';

export const metadata = {
  title: 'Pricelist | OrderFlow',
};

export default async function PricelistPage() {
  const user = await requireAuth();

  return <PricelistClient user={user} />;
}
