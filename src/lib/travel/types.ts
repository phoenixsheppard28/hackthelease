export type WalkingStatus = 'ok' | 'no_route' | 'invalid_address' | 'unavailable' | 'not_configured' | 'limited';
export type DestinationWalk = {
  name: string;
  minutes: number | null;
  distanceMeters: number | null;
  status: WalkingStatus;
  checkedAt: string | null;
};

export function walkingStatusText(status: WalkingStatus): string {
  return {
    ok: 'Walking estimate available', no_route: 'No walking route found',
    invalid_address: 'Address needs verification', unavailable: 'Walking estimate unavailable',
    not_configured: 'Walking estimates not configured', limited: 'Walking request limit reached',
  }[status];
}
