import { getPlatform } from '../constants/platforms.js'

export function getPlatformInfo(platformId) {
  const p = getPlatform(platformId)
  return {
    core: p.cores[0],
    label: p.shortLabel,
    displayName: p.displayName,
    color: p.color,
    manufacturer: p.manufacturer,
  }
}

// Platforms that actually REQUIRE a BIOS to boot. Everything else (GB/GBC/GBA
// boot logos, Mega Drive TMSS splash, Famicom cartridge) works fine with the
// core's built-in HLE implementation, so we don't ship those files — they just
// add download weight without changing behavior.
//
// Files live in data/bios/<platform>/<file>, served by the /api/bios route.
// If a file is missing on disk the backend returns 404 and we drop it.
const BIOS_BY_PLATFORM = {
  arcade: [
    'neogeo.zip',    // Neo Geo — KOF / Metal Slug / Samurai Shodown / 95% of fighters
    'pgm.zip',       // IGS PolyGameMaster — Knights of Valour / Oriental Legend 等
    'nmk004.zip',    // NMK protection chip (Thunder Dragon / Hacha Mecha)
    'cchip.zip',     // Taito C-Chip (Rainbow Islands, Operation Wolf)
    'decocass.zip',  // Data East Cassette System
    'isgsm.zip',     // Sega IS Game Server (Ghouls'n Ghosts)
    'midssio.zip',   // Midway SSIO sound board
    'bubsys.zip',    // Konami Bubble System
    'ym2608.zip',    // Yamaha YM2608 ADPCM ROM (shared sound)
    'skns.zip',      // Kaneko Super Kaneko Nova System
  ],
  // PSX requires one of these — pcsx_rearmed picks whichever matches the
  // game region, so we ship all three mains plus a couple of fallbacks.
  psx: [
    'scph5500.bin',      // Japan v3.0
    'scph5501.bin',      // US v3.0
    'scph5502.bin',      // Europe v3.0
    'scph7001.bin',      // US v4.1 (fallback)
    'psxonpsp660.bin',   // PSP emulation BIOS (fallback)
  ],
  // Famicom Disk System — fceumm / nestopia load .fds disk images only when
  // this is present. Plain NES/Famicom cartridges do NOT need it.
  fds: ['disksys.rom'],
}

export function getBiosUrls(platformId) {
  const files = BIOS_BY_PLATFORM[platformId]
  if (!files?.length) return []
  return files.map((fileName) => ({
    fileName,
    fileContent: `/api/bios/${platformId}/${fileName}`,
  }))
}
