import { currentListingAvailability, type ListingAvailability as AvailabilityReport } from '@/lib/availability/listing-status';
import styles from './ListingAvailability.module.scss';

export function ListingAvailability({ report, compact = false }: { report?: AvailabilityReport | null; compact?: boolean }) {
  const current = currentListingAvailability(report);
  if (!current) return null;
  const date = new Date(current.reportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const source = current.source === 'landlord_email' ? 'Landlord email' : 'User reported';
  const term = current.leaseStart && current.leaseEnd ? `${current.leaseStart} to ${current.leaseEnd}` : 'Lease dates not specified';
  return <div className={styles.notice}>
    <span className={styles.badge} title={`${source} · ${date} · ${term}`}>{current.status === 'lease_signed' ? 'Not available · Lease signed' : 'Tenants renewing'}</span>
    {!compact && <p>{source} · {date}<br />{term}</p>}
  </div>;
}
