'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAction } from 'convex/react';
import { api } from '@Ordio/convex';

export function usePaymentRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const confirmPaystackPayment = useAction(api.users.confirmPaystackPayment);

  useEffect(() => {
    const upgrade = searchParams.get('upgrade');
    if (!upgrade) return;

    if (upgrade === 'stripe-success') {
      toast.success('Payment received! Your account is being upgraded…');
      router.replace('/');
      return;
    }

    if (upgrade === 'paystack-success') {
      const reference = searchParams.get('reference') ?? searchParams.get('trxref');
      if (!reference) { router.replace('/'); return; }

      toast.loading('Confirming payment…', { id: 'paystack-confirm' });
      confirmPaystackPayment({ reference })
        .then(() => toast.success('Upgraded to Creator!', { id: 'paystack-confirm' }))
        .catch(() => toast.error('Could not confirm payment. Contact support.', { id: 'paystack-confirm' }))
        .finally(() => router.replace('/'));
    }
  }, [searchParams, router, confirmPaystackPayment]);
}
