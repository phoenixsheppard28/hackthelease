import { destinations } from '../travel/destinations';

const buildings = [
  ...Object.entries(destinations).map(([name, place]) => ({ name, ...place })),
  { name: 'Leinweber Building', address: '2200 Hayward St, Ann Arbor, MI 48109', source: 'https://leinweber.bldg.umich.edu/location/' },
  { name: 'Beyster Building', address: '2260 Hayward St, Ann Arbor, MI 48105', source: 'https://cse.engin.umich.edu/about/visit/directions-parking-transit/' },
];

export function calendarBuilding(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const names: Record<string, string[]> = {
    'Leinweber Building': ['leinweber', 'lcsib'],
    'Beyster Building': ['beyster', 'bbb'],
    'Hatcher Library': ['hatcher'],
    'Duderstadt Center': ['duderstadt'],
  };
  const matches = buildings.filter(building => [building.name.toLowerCase(), ...(names[building.name] ?? [])]
    .some(name => ` ${normalized} `.includes(` ${name} `)));
  return matches.length === 1 ? matches[0] : undefined;
}
