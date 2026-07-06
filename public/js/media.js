// The media registry: three categories, each with its logs.
// chip = the [ XXXLOG ] label, menu = the picker label, aliases = accepted by `log change`.
export const CATEGORIES = [
  {
    id: 'watch',
    label: 'WATCH',
    verb: 'WATCHED',
    dateHead: 'Watch Date(s)',
    noun: ['watch', 'watches'],
    items: [
      { id: 'blu', chip: 'BLU·LOG', menu: 'BLU-RAY', aliases: ['blu', 'bluray', 'blu-ray'] },
      { id: 'dvd', chip: 'DVD·LOG', menu: 'DVD', aliases: ['dvd', 'dvds'] },
      { id: '4k', chip: '4K·LOG', menu: '4K UHD', aliases: ['4k', 'uhd'] },
      { id: 'vhs', chip: 'VHS·LOG', menu: 'VHS', aliases: ['vhs'] },
      { id: 'laserdisc', chip: 'LD·LOG', menu: 'LASERDISC', aliases: ['laserdisc', 'ld'] },
      { id: 'betamax', chip: 'BETA·LOG', menu: 'BETAMAX', aliases: ['betamax', 'beta'] },
      { id: 'hddvd', chip: 'HDDVD·LOG', menu: 'HD DVD', aliases: ['hddvd', 'hd-dvd'] }
    ]
  },
  {
    id: 'listen',
    label: 'LISTEN',
    verb: 'LISTENED',
    dateHead: 'Listen Date(s)',
    noun: ['listen', 'listens'],
    items: [
      { id: 'cd', chip: 'CD·LOG', menu: 'CD', aliases: ['cd', 'cds'] },
      { id: 'vinyl', chip: 'VINYL·LOG', menu: 'VINYL', aliases: ['vinyl', 'record', 'records'] },
      { id: 'cassette', chip: 'TAPE·LOG', menu: 'CASSETTE', aliases: ['cassette', 'tape'] },
      { id: '8track', chip: '8TRACK·LOG', menu: '8-TRACK', aliases: ['8track', '8-track'] }
    ]
  },
  {
    id: 'read',
    label: 'READ',
    verb: 'READ',
    dateHead: 'Read Date(s)',
    noun: ['read', 'reads'],
    items: [
      { id: 'book', chip: 'BOOK·LOG', menu: 'BOOKS', aliases: ['book', 'books'] },
      { id: 'manga', chip: 'MANGA·LOG', menu: 'MANGA', aliases: ['manga'] }
    ]
  }
];

export const ALL_MEDIA = CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => ({ ...item, category: cat }))
);

export const DEFAULT_MEDIA = 'blu';

export function findMedia(alias) {
  const n = String(alias || '').trim().toLowerCase();
  return ALL_MEDIA.find((m) => m.id === n || m.aliases.includes(n)) || null;
}
