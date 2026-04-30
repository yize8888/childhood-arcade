export const cores = {
  fbneo:           { displayName: 'FinalBurn Neo' },
  fceumm:          { displayName: 'FCEUmm' },
  gambatte:        { displayName: 'Gambatte' },
  gearboy:         { displayName: 'Gearboy' },
  gearsystem:      { displayName: 'Gearsystem' },
  genesis_plus_gx: { displayName: 'Genesis Plus GX' },
  mame2003_plus:   { displayName: 'MAME 2003-Plus' },
  mgba:            { displayName: 'mGBA' },
  nestopia:        { displayName: 'Nestopia' },
  pcsx_rearmed:    { displayName: 'PCSX ReARMed' },
  picodrive:       { displayName: 'PicoDrive' },
  quicknes:        { displayName: 'QuickNES' },
  snes9x:          { displayName: 'Snes9x' },
  tgbdual:         { displayName: 'TGB Dual' },
  vba_next:        { displayName: 'VBA Next' },
}

export const coreDisplayName = Object.fromEntries(
  Object.entries(cores).map(([k, v]) => [k, v.displayName]),
)
