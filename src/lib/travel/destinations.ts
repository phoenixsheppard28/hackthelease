import type { HousingProfile } from '../contracts/housing-profile';

export type CampusHub = HousingProfile['hubs'][number];
// Building addresses verified against the linked first-party directories on 2026-11-20.
// These are building-level routes, not promises of a particular accessible entrance.
export const destinations: Record<CampusHub, { id: string; address: string; source: string }> = {
  'Hatcher Library': { id: 'hatcher', address: '913 S University Ave, Ann Arbor, MI 48109', source: 'https://www.lib.umich.edu/locations-and-hours/hatcher-library/' },
  'Target on State': { id: 'target-state', address: '231 S State St, Ann Arbor, MI 48104', source: 'https://www.target.com/sl/location/3415' },
  'IM Building': { id: 'imsb', address: '606 E Hoover Ave, Ann Arbor, MI 48109', source: 'https://recreation.umich.edu/facility/imsb/' },
  'Duderstadt Center': { id: 'duderstadt', address: '2281 Bonisteel Blvd, Ann Arbor, MI 48109', source: 'https://www.dc.umich.edu/about-the-dc/maps-floor-plans-hours/' },
  Fishbowl: { id: 'fishbowl', address: '436 S State St, Ann Arbor, MI 48109', source: 'https://its.umich.edu/sites/node/3224' },
  'Michigan Union': { id: 'union', address: '530 S State St, Ann Arbor, MI 48109', source: 'https://uunions.umich.edu/union/' },
  Ross: { id: 'ross', address: '701 Tappan St, Ann Arbor, MI 48109', source: 'https://michiganross.umich.edu/campus-locations/ann-arbor' },
};
