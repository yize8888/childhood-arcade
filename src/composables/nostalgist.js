// Thin wrapper around Nostalgist. Cores + shaders are loaded from Nostalgist's
// default jsdelivr CDN. We use the two-phase prepare/start pattern — same as
// retroassembly — so the caller can grab the canvas (via `emulator.getCanvas()`)
// and insert it into their own layout before the emulator actually runs.

import { Nostalgist } from 'nostalgist'
import { cachedFetch } from './useBlobCache.js'

// Sensible defaults cribbed from retroassembly's emulator-portal. Rewind +
// run-ahead are low-latency quality-of-life wins that users expect today;
// analog→dpad lets stick-only gamepads still navigate menus.
const DEFAULT_RETROARCH_CONFIG = {
  fastforward_ratio: 10,
  input_player1_analog_dpad_mode: 1,
  input_player2_analog_dpad_mode: 1,
  input_player3_analog_dpad_mode: 1,
  input_player4_analog_dpad_mode: 1,
  rewind_enable: true,
  rewind_granularity: 4,
  rgui_menu_color_theme: 1,
  run_ahead_enabled: true,
  run_ahead_frames: 1,
}

/**
 * Prepare a Nostalgist instance (loads core + ROM + BIOS but does NOT start
 * the emulator loop yet). Call `.start()` on the returned instance once the
 * canvas is in the DOM.
 *
 * @param {Object} opts
 * @param {string} opts.core
 * @param {string} opts.romUrl
 * @param {string} [opts.romFileName]
 * @param {Array<{fileName,fileContent}>} [opts.bios]
 * @param {Object} [opts.retroarchConfig]
 * @param {string} [opts.shader]
 */
export async function prepareEmulator({
  core,
  rom,           // string | { fileName, fileContent } | Array<{fileName, fileContent}>
  romUrl,        // legacy
  romFileName,   // legacy
  bios = [],
  retroarchConfig = {},
  shader,
}) {
  // Normalize legacy arguments. When `rom` isn't passed, fall back to
  // romUrl/romFileName; otherwise pass `rom` through (Nostalgist accepts
  // strings, single {fileName,fileContent} objects, or arrays of them).
  const resolvedRom = rom !== undefined
    ? rom
    : (romFileName ? { fileName: romFileName, fileContent: romUrl } : romUrl)

  const options = {
    core,
    rom: resolvedRom,
    retroarchConfig: { ...DEFAULT_RETROARCH_CONFIG, ...retroarchConfig },
    // Route core downloads through our backend, and cache the bytes in
    // IndexedDB so reopening a game is near-instant and works offline.
    // Backend already fetches once from jsdelivr and caches to disk
    // (server/routes/cores.js); IDB is the client-side tier on top.
    resolveCoreJs:   (c) => cachedFetch(`/api/cores/${c}.js`),
    resolveCoreWasm: (c) => cachedFetch(`/api/cores/${c}.wasm`),
  }
  if (bios?.length) options.bios = bios
  if (shader) options.shader = shader

  return Nostalgist.prepare(options)
}
