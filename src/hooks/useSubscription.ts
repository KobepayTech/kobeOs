import { useCallback } from 'react';
import { useOSStore } from '@/os/store';
import type { SubscriptionTier } from '@/os/types';

/**
 * Returns helpers for reading and acting on the current OS license state.
 */
export function useSubscription() {
  const licenseStatus  = useOSStore((s) => s.licenseStatus);
  const licensePayload = useOSStore((s) => s.licensePayload);
  const canAccess      = useOSStore((s) => s.canAccess);
  const activateLicense = useOSStore((s) => s.activateLicense);
  const revokeLicense   = useOSStore((s) => s.revokeLicense);
  const refreshLicense  = useOSStore((s) => s.refreshLicense);

  const isActive  = licenseStatus === 'valid';
  const isExpired = licenseStatus === 'expired';
  const plan      = licensePayload?.plan ?? null;

  const expiresAt = licensePayload?.expiresAt
    ? new Date(licensePayload.expiresAt)
    : null;

  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
    : 0;

  const check = useCallback(
    (tier: SubscriptionTier) => canAccess(tier),
    [canAccess],
  );

  return {
    licenseStatus,
    isActive,
    isExpired,
    plan,
    expiresAt,
    daysRemaining,
    check,
    activateLicense,
    revokeLicense,
    refreshLicense,
  };
}
