import { requireAuth } from '@/lib/auth';
import { QuoteClient } from './QuoteClient';

export const metadata = {
  title: 'New Quote | OrderFlow',
};

export default async function QuotePage() {
  const user = await requireAuth();

  return <QuoteClient user={user} />;
}
