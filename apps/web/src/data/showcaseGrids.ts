export type ShowcaseEntry = {
  slug: string;
  name: string;
  tagline?: string;
};

/** Curated featured grids — edit order and copy here as the showcase evolves. */
export const SHOWCASE_GRIDS: ShowcaseEntry[] = [
  { slug: 'staci', name: 'Staci Lawson', tagline: 'Designer · Lisbon' },
  { slug: 'stack', name: 'Whostacking', tagline: 'Photographer' },
  { slug: 'matt', name: 'Matthew Galley', tagline: 'Writer' },
  { slug: 'nath', name: 'Nath', tagline: 'Musician' },
  { slug: 'denis', name: 'Denis Dukhalov', tagline: 'Developer' },
  { slug: 'cam', name: 'Cam Watkins'},
  // { slug: 'prottoy', name: 'Prottoy', tagline: 'Developer' },
  { slug: 'lonni', name: 'Brickheadz', tagline: 'Developer' },
  { slug: 'jisenku', name: 'Jisenku', tagline: 'Developer' },
  { slug: 'froggo4', name: 'Froggo', tagline: 'Developer' },
  { slug: 'nikpavic', name: 'Nik Pavic', tagline: 'Developer' },
  { slug: 'rochdi', name: 'Rochdi ', tagline: 'Developer' },
  // { slug: 'harshit', name: 'Harshit Khemani', tagline: 'Developer' },
  { slug: 'slasher', name: 'Slasher', tagline: 'Developer' },
  { slug: 'rygarde', name: 'Agung Laksono', tagline: 'Developer' },
  { slug: 'katrella', name: 'Herramientas', tagline: 'Developer' },
  { slug: 'iden', name: 'IDEN', tagline: 'Developer' },
  { slug: 'mbuono', name: 'Michael Buono', tagline: 'Developer' },
  // { slug: 'gbdesign', name: 'Gabriele Ba' }, // page was incomplete, and they significantly fleshed out a page on a competitor platform
  { slug: 'zqiv', name: 'Music Guy', tagline: 'Developer' },
];
