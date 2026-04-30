// Platform registry. Trimmed to the platforms actually played in the CN market
// (arcade / Nintendo family / Sega family / PS1). Obscure hardware like
// Virtual Boy, 32X, SG-1000, Neo Geo Pocket, PC Engine, Atari, Channel F,
// Odyssey², Videopac, WonderSwan, Game & Watch has been removed.
//
// Each entry: displayName (cn), shortLabel (tab badge), manufacturer,
// releaseDate, libretroName, fileExtensions, cores (priority order — first is
// default), buttons (which retropad buttons the platform actually uses).

const DPAD = ['up', 'down', 'left', 'right']
const BTN_NES   = [...DPAD, 'a', 'b', 'start', 'select']
const BTN_GB    = [...DPAD, 'a', 'b', 'start', 'select']
const BTN_GBA   = [...DPAD, 'a', 'b', 'l', 'r', 'start', 'select']
const BTN_SNES  = [...DPAD, 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select']
const BTN_MD    = [...DPAD, 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select']
const BTN_PSX   = [...DPAD, 'a', 'b', 'x', 'y', 'l', 'r', 'l2', 'r2', 'start', 'select']
const BTN_ARCADE = [...DPAD, 'a', 'b', 'x', 'y', 'l', 'r', 'start', 'select']
const BTN_SIMPLE = [...DPAD, 'a', 'b', 'start']

export const platforms = {
  arcade: {
    displayName: '街机',
    shortLabel: 'ARCADE',
    manufacturer: '多厂商',
    releaseDate: '1971-10-15',
    libretroName: 'MAME',
    color: '#af52de',
    fileExtensions: ['.zip'],
    cores: ['fbneo', 'mame2003_plus'],
    requiresBios: true,
  },

  // Nintendo
  nes: {
    displayName: 'Nintendo Entertainment System',
    shortLabel: 'NES',
    manufacturer: 'Nintendo',
    releaseDate: '1983-07-15',
    libretroName: 'Nintendo - Nintendo Entertainment System',
    color: '#ff3b30',
    fileExtensions: ['.nes', '.unif', '.unf', '.zip'],
    cores: ['fceumm', 'nestopia', 'quicknes'],
  },
  famicom: {
    displayName: '任天堂红白机 (Famicom)',
    shortLabel: 'FC',
    manufacturer: 'Nintendo',
    releaseDate: '1983-07-15',
    libretroName: 'Nintendo - Famicom',
    color: '#ff3b30',
    fileExtensions: ['.nes', '.unif', '.unf', '.zip'],
    cores: ['fceumm', 'nestopia', 'quicknes'],
  },
  fds: {
    displayName: '任天堂磁碟机',
    shortLabel: 'FDS',
    manufacturer: 'Nintendo',
    releaseDate: '1986-02-21',
    libretroName: 'Nintendo - Family Computer Disk System',
    color: '#ff3b30',
    fileExtensions: ['.fds', '.zip'],
    cores: ['fceumm', 'nestopia'],
  },
  sfc: {
    displayName: 'Super Famicom',
    shortLabel: 'SFC',
    manufacturer: 'Nintendo',
    releaseDate: '1990-11-21',
    libretroName: 'Nintendo - Super Famicom',
    color: '#007aff',
    fileExtensions: ['.smc', '.sfc', '.zip'],
    cores: ['snes9x'],
  },
  snes: {
    displayName: 'Super Nintendo',
    shortLabel: 'SNES',
    manufacturer: 'Nintendo',
    releaseDate: '1991-08-23',
    libretroName: 'Nintendo - Super Nintendo Entertainment System',
    color: '#409fff',
    fileExtensions: ['.smc', '.sfc', '.zip'],
    cores: ['snes9x'],
  },
  gb: {
    displayName: 'Game Boy',
    shortLabel: 'GB',
    manufacturer: 'Nintendo',
    releaseDate: '1989-04-21',
    libretroName: 'Nintendo - Game Boy',
    color: '#8e8e93',
    fileExtensions: ['.gb', '.zip'],
    cores: ['mgba', 'gambatte', 'gearboy', 'tgbdual'],
  },
  gbc: {
    displayName: 'Game Boy Color',
    shortLabel: 'GBC',
    manufacturer: 'Nintendo',
    releaseDate: '1998-10-21',
    libretroName: 'Nintendo - Game Boy Color',
    color: '#5856d6',
    fileExtensions: ['.gb', '.gbc', '.cgb', '.sgb', '.zip'],
    cores: ['mgba', 'gambatte', 'gearboy', 'tgbdual'],
  },
  gba: {
    displayName: 'Game Boy Advance',
    shortLabel: 'GBA',
    manufacturer: 'Nintendo',
    releaseDate: '2001-06-11',
    libretroName: 'Nintendo - Game Boy Advance',
    color: '#34c759',
    fileExtensions: ['.gba', '.zip'],
    cores: ['mgba', 'vba_next'],
  },

  // Sega
  megadrive: {
    displayName: 'Mega Drive',
    shortLabel: 'MD',
    manufacturer: 'Sega',
    releaseDate: '1988-10-29',
    libretroName: 'Sega - Mega Drive',
    color: '#ff9500',
    fileExtensions: ['.md', '.gen', '.smd', '.bin', '.zip'],
    cores: ['genesis_plus_gx', 'picodrive'],
  },
  genesis: {
    displayName: 'Genesis',
    shortLabel: 'GEN',
    manufacturer: 'Sega',
    releaseDate: '1989-08-14',
    libretroName: 'Sega - Genesis',
    color: '#ff9500',
    fileExtensions: ['.md', '.gen', '.smd', '.bin', '.zip'],
    cores: ['genesis_plus_gx', 'picodrive'],
  },
  sms: {
    displayName: 'Master System',
    shortLabel: 'SMS',
    manufacturer: 'Sega',
    releaseDate: '1985-10-20',
    libretroName: 'Sega - Master System',
    color: '#ff9f0a',
    fileExtensions: ['.sms', '.zip'],
    cores: ['genesis_plus_gx', 'picodrive', 'gearsystem'],
  },
  gamegear: {
    displayName: 'Game Gear',
    shortLabel: 'GG',
    manufacturer: 'Sega',
    releaseDate: '1990-10-06',
    libretroName: 'Sega - Game Gear',
    color: '#ffb340',
    fileExtensions: ['.gg', '.zip'],
    cores: ['genesis_plus_gx', 'gearsystem'],
  },

  // Sony
  psx: {
    displayName: 'PlayStation',
    shortLabel: 'PS1',
    manufacturer: 'Sony',
    releaseDate: '1994-12-03',
    libretroName: 'Sony - PlayStation',
    color: '#ff375f',
    fileExtensions: ['.chd', '.cue', '.bin', '.iso', '.pbp', '.m3u'],
    cores: ['pcsx_rearmed'],
  },
}

// Tab grouping by manufacturer (for Gallery tabs)
export const tabGroups = {
  arcade:   { label: '街机',   platforms: ['arcade'] },
  nintendo: { label: '任天堂', platforms: ['nes', 'famicom', 'fds', 'sfc', 'snes', 'gb', 'gbc', 'gba'] },
  sega:     { label: '世嘉',   platforms: ['megadrive', 'genesis', 'sms', 'gamegear'] },
  sony:     { label: '索尼',   platforms: ['psx'] },
}

// Button profile per platform — attached after definition to keep the registry
// table tidy. Anything not listed falls back to BTN_NES (basic 2-button + D-pad).
const BUTTON_PROFILES = {
  arcade:     BTN_ARCADE,
  nes:        BTN_NES,
  famicom:    BTN_NES,
  fds:        BTN_NES,
  sfc:        BTN_SNES,
  snes:       BTN_SNES,
  gb:         BTN_GB,
  gbc:        BTN_GB,
  gba:        BTN_GBA,
  megadrive:  BTN_MD,
  genesis:    BTN_MD,
  sms:        BTN_SIMPLE,
  gamegear:   BTN_SIMPLE,
  psx:        BTN_PSX,
}

for (const [id, p] of Object.entries(platforms)) {
  p.buttons = BUTTON_PROFILES[id] || BTN_NES
}

// Per-platform face-button label overrides. The internal retropad keys
// (a/b/x/y/l/r/l2/r2) never change — we just relabel what the user sees so
// arcade shows "A B C D" (Neo Geo convention) instead of the confusing
// "A B X Y", Genesis shows "A B C X Y Z", PlayStation uses the symbols etc.
// Platforms not listed use the generic A/B/X/Y which is already correct for
// SNES/SFC/GB/GBC/GBA/NES families.
const BUTTON_LABELS = {
  // Arcade — FBNeo retropad→Neo Geo mapping is NOT one-to-one:
  //   retropad a → game's B,  retropad b → game's A
  //   retropad x → game's D,  retropad y → game's C
  // Show labels that match what the game actually sees, so users binding keys
  // aren't surprised by "A" triggering B.
  arcade:    { a: 'B', b: 'A', x: 'D', y: 'C', l: 'E', r: 'F' },

  // Sega Genesis / Mega Drive — genesis_plus_gx core maps retropad:
  //   b→A, a→B, y→C, x→Y, l→X, r→Z   (retropad_b is the "primary" action)
  megadrive: { a: 'B', b: 'A', x: 'Y', y: 'C', l: 'X', r: 'Z' },
  genesis:   { a: 'B', b: 'A', x: 'Y', y: 'C', l: 'X', r: 'Z' },

  // Sega Master System / Game Gear — retropad_b is Button 1 (primary)
  sms:       { a: '2', b: '1' },
  gamegear:  { a: '2', b: '1' },

  // PlayStation — retropad_a → ◯, retropad_b → ✕ (matches physical layout)
  psx:       { a: '◯', b: '✕', x: '△', y: '□', l: 'L1', r: 'R1', l2: 'L2', r2: 'R2' },

  // NES/SNES/GB/GBC/GBA/FC/SFC/FDS intentionally unlisted → they already ship
  // as A/B (+X/Y/L/R for SFC/SNES/GBA) which is the native hardware labeling.
}
for (const [id, p] of Object.entries(platforms)) {
  p.buttonLabels = BUTTON_LABELS[id] || null
}

export function getPlatform(id) {
  return platforms[id] || platforms.nes
}
