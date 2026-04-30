<template>
  <div v-if="enabled" class="vpad" :class="{ 'vpad-landscape': landscape }">
    <!-- Left: virtual analog stick — supports diagonals by finger position -->
    <div class="vpad-group vpad-left">
      <div
        ref="dpadEl"
        class="stick"
        :class="{ active: stickActive }"
        @pointerdown.prevent="onDpadDown"
        @pointermove.prevent="onDpadMove"
        @pointerup.prevent="onDpadEnd"
        @pointercancel.prevent="onDpadEnd"
      >
        <span class="stick-arrow stick-up"    :class="{ on: pressed.up }">▲</span>
        <span class="stick-arrow stick-right" :class="{ on: pressed.right }">▶</span>
        <span class="stick-arrow stick-down"  :class="{ on: pressed.down }">▼</span>
        <span class="stick-arrow stick-left"  :class="{ on: pressed.left }">◀</span>
        <span
          class="stick-knob"
          :style="{ transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)` }"
        ></span>
      </div>
    </div>

    <!-- Center: Start / Select — container-level pointer tracking so a finger
         can slide between SELECT/START without re-tapping (MOBA-style). -->
    <div
      class="vpad-group vpad-center"
      @pointerdown.prevent="onBtnPointerDown"
      @pointermove.prevent="onBtnPointerMove"
      @pointerup.prevent="onBtnPointerUp"
      @pointercancel.prevent="onBtnPointerUp"
    >
      <button
        v-if="has('select')"
        class="sys-btn"
        :class="{ pressed: pressed.select }"
        data-btn-key="select"
      >SELECT</button>
      <button
        v-if="has('start')"
        class="sys-btn sys-btn-start"
        :class="{ pressed: pressed.start }"
        data-btn-key="start"
      >START</button>
      <!-- 连发开关：持久化的 turbo toggle。开启后 A/B/X/Y/L/R 按住即 16Hz 自动射击 -->
      <button
        class="sys-btn turbo-toggle"
        :class="{ on: turboEnabled }"
        @pointerdown.stop.prevent="turboEnabled = !turboEnabled"
        :title="turboEnabled ? '连发已开启，再点关闭' : '点击开启连发'"
      >连发</button>
    </div>

    <!-- Right: Face buttons (layout adapts per platform — see FACE_LAYOUTS) -->
    <div class="vpad-group vpad-right">
      <!-- Face + shoulders share the same pointer-tracking surface so you can
           slide between L/R and face buttons — like HoK 技能键 -->
      <div
        class="face-wrap"
        @pointerdown.prevent="onBtnPointerDown"
        @pointermove.prevent="onBtnPointerMove"
        @pointerup.prevent="onBtnPointerUp"
        @pointercancel.prevent="onBtnPointerUp"
      >
        <div class="face" :class="`face-${layoutType}`">
          <button
            v-for="f in faceBtns"
            :key="f.key"
            class="face-btn"
            :class="[f.className, { pressed: pressed[f.key], turbo: turboEnabled }]"
            :style="{ '--fc': f.color }"
            :data-btn-key="f.key"
          >{{ f.label }}</button>
        </div>
        <div v-if="showShoulders && (has('l') || has('r'))" class="shoulders">
          <button v-if="has('l')" class="sh-btn" :class="{ pressed: pressed.l, turbo: turboEnabled }" data-btn-key="l">L</button>
          <button v-if="has('r')" class="sh-btn" :class="{ pressed: pressed.r, turbo: turboEnabled }" data-btn-key="r">R</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import { getPlatform } from '../../constants/platforms.js'
import { useInputMapping } from '../../composables/useInputMapping.js'

const props = defineProps({
  platform: { type: String, default: null },
  // Optional callback: guest mode forwards the button over the DataChannel
  // instead of dispatching a local key. Return true to swallow the default.
  onButton: { type: Function, default: null },
})

const { mapping } = useInputMapping()
const pressed = reactive({})
const dpadEl = ref(null)
const stickActive = ref(false)
const stickKnob = reactive({ x: 0, y: 0 })
let dpadPointerId = null

// Show on touch devices OR narrow viewports
const hasTouch = typeof window !== 'undefined'
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
const narrow = ref(typeof window !== 'undefined' ? window.innerWidth < 900 : false)
function onResize() { narrow.value = window.innerWidth < 900 }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const landscape = computed(() =>
  typeof window !== 'undefined' && window.innerWidth > window.innerHeight,
)

const enabled = computed(() => hasTouch && narrow.value)

const platButtons = computed(() => {
  if (!props.platform) return null
  return new Set(getPlatform(props.platform).buttons || [])
})
function has(key) {
  if (!platButtons.value) return true
  return platButtons.value.has(key)
}
// Platform-specific face-button label (Arcade=A/B/C/D, Genesis=A/B/C/X/Y/Z,
// PSX=symbols, etc). Falls back to the generic label when no override exists.
const platLabels = computed(() => {
  if (!props.platform) return {}
  return getPlatform(props.platform).buttonLabels || {}
})
function labelOf(key, fallback) {
  return platLabels.value[key] || fallback
}

// Face-button layout presets. Each layout lists retropad keys in render order
// with its color. Physical positioning is CSS-driven via `.face-<layout>`.
// The Chinese-market platforms we kept are: arcade / nes+famicom+fds / sfc /
// snes / gb / gbc / gba / megadrive / genesis / sms / gamegear / psx.
// Colors roughly match the real hardware pads: FC-era A = 黄/橙, B = 红
// (classic 小霸王 2-button look); SNES Japan version has multi-colored
// buttons; PlayStation uses its iconic symbol colors.
const FACE_LAYOUTS = {
  // Famicom / NES / GB / GBC — 2 buttons: A 橙色, B 红色, 跟 小霸王 对齐
  fc:     { keys: ['a', 'b'],             colors: { a: '#FF9500', b: '#FF3B30' } },
  // GBA — 2-button diagonal, orange/red with L/R shoulders
  gba:    { keys: ['a', 'b'],             colors: { a: '#FF9500', b: '#FF3B30' } },
  // SNES (Japan) — 4-color diamond: Y绿 X蓝 A红 B黄
  snes:   { keys: ['x', 'y', 'a', 'b'],   colors: { x: '#007AFF', y: '#34C759', a: '#FF3B30', b: '#FFCC00' } },
  // PlayStation — △绿 □粉 ✕蓝 ◯红
  ps:     { keys: ['y', 'x', 'a', 'b'],   colors: { y: '#34C759', x: '#FF2D92', a: '#FF3B30', b: '#007AFF' } },
  // Mega Drive / Genesis 6-button cabinet — 2×3 grid A B C (top) / X Y Z
  // (bottom). retropad→label: b='A' a='B' y='C' l='X' x='Y' r='Z'.
  md:     { keys: ['b', 'a', 'y', 'l', 'x', 'r'],
            colors: { b: '#34C759', a: '#0A84FF', y: '#FF3B30',
                      l: '#FFCC00', x: '#FF9500', r: '#AF52DE' } },
  // Master System / Game Gear — 2 buttons: 1 蓝 2 红
  sms:    { keys: ['b', 'a'],             colors: { b: '#0A84FF', a: '#FF3B30' } },
  // Neo Geo arcade — 4 buttons 2×2, 经典 A B C D 配色. Street Fighter /
  // CPS-style 6-button cabinets exist but most CN 街机 (KOF, PGM, ...) are
  // 4-button. Users needing L/R (Capcom 6-button) can bind them on PC.
  arcade: { keys: ['b', 'a', 'y', 'x'],   colors: { b: '#FF3B30', a: '#FFCC00', y: '#34C759', x: '#007AFF' } },
}

function pickLayout(platform) {
  if (platform === 'arcade') return 'arcade'
  if (platform === 'psx') return 'ps'
  if (platform === 'sfc' || platform === 'snes') return 'snes'
  if (platform === 'megadrive' || platform === 'genesis') return 'md'
  if (platform === 'sms' || platform === 'gamegear') return 'sms'
  if (platform === 'gba') return 'gba'
  return 'fc'  // nes, famicom, fds, gb, gbc, and everything else
}

const layoutType = computed(() => pickLayout(props.platform))

// Only layouts with real shoulder hardware show an L/R row: SNES / GBA / PS1.
// Arcade drops it (most 街机 cabinets are 4-button — CN players expect A B C D,
// not ABCD + L/R). MD 6-button cabinet puts A B C / X Y Z all in the face grid.
const showShoulders = computed(() => {
  const t = layoutType.value
  return t === 'snes' || t === 'ps' || t === 'gba'
})

const faceBtns = computed(() => {
  const spec = FACE_LAYOUTS[layoutType.value] || FACE_LAYOUTS.fc
  return spec.keys
    .filter((k) => has(k))
    .map((k) => ({
      key: k,
      label: labelOf(k, k.toUpperCase()),
      color: spec.colors[k] || '#FF9500',
      className: `fbtn-${k}`,
    }))
})

function resolveKey(btn) {
  return mapping.value.keyboard[btn] || null
}

function eventInit(key) {
  const DOM_KEY = {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    enter: 'Enter', space: ' ', shift: 'Shift', rshift: 'Shift',
    escape: 'Escape',
  }
  const CODE_KEY = {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    enter: 'Enter', space: 'Space',
    shift: 'ShiftLeft', rshift: 'ShiftRight',
    escape: 'Escape',
  }
  const k = key.toLowerCase()
  return {
    key: DOM_KEY[k] || key,
    code: CODE_KEY[k] || (key.length === 1 ? 'Key' + key.toUpperCase() : key),
    bubbles: true,
    cancelable: true,
    composed: true,
  }
}

function dispatch(type, key) {
  try {
    const ev = new KeyboardEvent(type, eventInit(key))
    window.dispatchEvent(ev)
    document.dispatchEvent(ev)
  } catch {}
}

// ── Turbo / 连发（显式开关） ────────────────────────────
// 用户点右下角 "连发" 开关决定 A/B/X/Y/L/R/L2/R2 是否自动连发。
// 默认关闭 → 按住就是保持按住（赛车加速、马里奥跑步 OK）。
// 开启后 → 按住即 ~16Hz 自动 press/release（魂斗罗扫射）。
// D-pad 和 start/select 永远不参与 —— 连发只会把它们搞乱。
// 开关状态持久化到 localStorage，下次进入游戏还在。
const TURBO_ELIGIBLE = new Set(['a', 'b', 'x', 'y', 'l', 'r', 'l2', 'r2'])
const TURBO_FIRE_MS = 60          // ~16 Hz — 经典 NES 连发芯片频率
const TURBO_STORAGE_KEY = 'vpad:turbo'
const turboEnabled = ref(localStorage.getItem(TURBO_STORAGE_KEY) === '1')
const turboLoops = new Map()      // btn → setInterval id

watch(turboEnabled, (v) => {
  localStorage.setItem(TURBO_STORAGE_KEY, v ? '1' : '0')
})

function emitDown(btn) {
  if (props.onButton && props.onButton('down', btn)) return
  const k = resolveKey(btn)
  if (k) dispatch('keydown', k)
}
function emitUp(btn) {
  if (props.onButton && props.onButton('up', btn)) return
  const k = resolveKey(btn)
  if (k) dispatch('keyup', k)
}

function press(btn) {
  if (pressed[btn]) return
  pressed[btn] = true

  // 连发模式 + 可连发键：直接跑 16Hz 循环
  if (turboEnabled.value && TURBO_ELIGIBLE.has(btn)) {
    let on = true
    emitDown(btn)
    const loop = setInterval(() => {
      if (!pressed[btn]) return
      on = !on
      if (on) emitDown(btn)
      else    emitUp(btn)
    }, TURBO_FIRE_MS)
    turboLoops.set(btn, loop)
  } else {
    emitDown(btn)
  }
}

function release(btn) {
  if (!pressed[btn]) return
  pressed[btn] = false
  const l = turboLoops.get(btn)
  if (l) { clearInterval(l); turboLoops.delete(btn) }
  emitUp(btn)
}

// ── Safety-net: document-level pointerup/cancel ─────────
// Some browsers (notably WeChat WebView) can cancel a pointer mid-stroke
// without firing pointercancel on our element (e.g. their native 选中 menu
// pops up). Without this fallback the D-pad knob could stick in a held
// direction. Listen globally and force-release whatever that pointer owned.
function onGlobalPointerEnd(e) {
  // D-pad
  if (dpadPointerId === e.pointerId) {
    dpadPointerId = null
    stickActive.value = false
    stickKnob.x = 0
    stickKnob.y = 0
    applyDirs(new Set())
  }
  // Face / shoulder / center buttons
  if (pointerMap.has(e.pointerId)) {
    const key = pointerMap.get(e.pointerId)
    if (key) release(key)
    pointerMap.delete(e.pointerId)
  }
}
onMounted(() => {
  window.addEventListener('pointerup', onGlobalPointerEnd)
  window.addEventListener('pointercancel', onGlobalPointerEnd)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerup', onGlobalPointerEnd)
  window.removeEventListener('pointercancel', onGlobalPointerEnd)
  // Clear any pending turbo state on teardown
  for (const l of turboLoops.values()) clearInterval(l)
  turboLoops.clear()
})

// ── MOBA-style multi-touch ─────────────────────────────
// Honor of Kings 技能键 pattern: each finger independently tracks, and
// sliding from one button onto another releases the first and engages the
// second without needing to lift. Enables A+B combos, quick switch between
// SELECT/START, and shoulder + face 叠加 press.
//
// How it works:
// 1. pointerdown on the container: setPointerCapture so moves outside still
//    fire here, then resolve which button is under the finger via
//    elementFromPoint + [data-btn-key].
// 2. pointermove: if the finger drifted to a different button, release the
//    old one and press the new one. Same button = no-op.
// 3. pointerup / cancel: release whatever this finger was on.
// 4. pointerMap tracks per-pointer state, so N fingers can each hold a
//    different button simultaneously (combos work).
const pointerMap = new Map()  // pointerId → currentBtnKey

function keyAtPoint(x, y) {
  const el = document.elementFromPoint(x, y)
  return el?.closest?.('[data-btn-key]')?.dataset?.btnKey || null
}

function onBtnPointerDown(e) {
  try { e.currentTarget?.setPointerCapture?.(e.pointerId) } catch {}
  const key = keyAtPoint(e.clientX, e.clientY)
  pointerMap.set(e.pointerId, key)
  if (key) press(key)
}

function onBtnPointerMove(e) {
  if (!pointerMap.has(e.pointerId)) return
  const prev = pointerMap.get(e.pointerId)
  const next = keyAtPoint(e.clientX, e.clientY)
  if (prev === next) return
  if (prev) release(prev)
  if (next) press(next)
  pointerMap.set(e.pointerId, next)
}

function onBtnPointerUp(e) {
  const key = pointerMap.get(e.pointerId)
  if (key) release(key)
  pointerMap.delete(e.pointerId)
}

// ── D-pad: single touch surface, 8-way angle split ──
// Finger position relative to the pad center is mapped to one of 8 octants.
// Diagonals activate two directions simultaneously — so sliding the thumb
// around naturally walks the player in the expected direction.
const DPAD_KEYS = ['up', 'down', 'left', 'right']

function processPointer(e) {
  const el = dpadEl.value
  if (!el) return { dirs: new Set(), knobX: 0, knobY: 0 }
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = e.clientX - cx
  let dy = e.clientY - cy
  const r = Math.min(rect.width, rect.height) / 2
  const dist = Math.hypot(dx, dy)
  // Clamp knob position to the stick radius so it never leaves the base.
  const knobRadius = r * 0.5
  if (dist > knobRadius) {
    const s = knobRadius / dist
    dx *= s
    dy *= s
  }
  // Dead zone: ignore tiny touches near the center so the user can rest
  // their thumb without sending phantom inputs.
  const dirs = new Set()
  if (dist >= r * 0.22) {
    const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360
    if (deg >= 337.5 || deg < 22.5)      dirs.add('right')
    else if (deg < 67.5)                 { dirs.add('right'); dirs.add('down') }
    else if (deg < 112.5)                dirs.add('down')
    else if (deg < 157.5)                { dirs.add('left'); dirs.add('down') }
    else if (deg < 202.5)                dirs.add('left')
    else if (deg < 247.5)                { dirs.add('left'); dirs.add('up') }
    else if (deg < 292.5)                dirs.add('up')
    else                                 { dirs.add('right'); dirs.add('up') }
  }
  return { dirs, knobX: dx, knobY: dy }
}

function applyDirs(wanted) {
  for (const k of DPAD_KEYS) {
    if (wanted.has(k) && !pressed[k]) press(k)
    else if (!wanted.has(k) && pressed[k]) release(k)
  }
}

function onDpadDown(e) {
  if (dpadPointerId !== null) return
  dpadPointerId = e.pointerId
  stickActive.value = true
  try { dpadEl.value?.setPointerCapture?.(e.pointerId) } catch {}
  const { dirs, knobX, knobY } = processPointer(e)
  stickKnob.x = knobX
  stickKnob.y = knobY
  applyDirs(dirs)
}
function onDpadMove(e) {
  if (e.pointerId !== dpadPointerId) return
  const { dirs, knobX, knobY } = processPointer(e)
  stickKnob.x = knobX
  stickKnob.y = knobY
  applyDirs(dirs)
}
function onDpadEnd(e) {
  if (e && e.pointerId !== dpadPointerId && dpadPointerId !== null) return
  dpadPointerId = null
  stickActive.value = false
  stickKnob.x = 0
  stickKnob.y = 0
  applyDirs(new Set())
}
</script>

<style scoped>
.vpad {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 30;
  pointer-events: none;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  padding:
    14px
    calc(16px + env(safe-area-inset-right))
    calc(14px + env(safe-area-inset-bottom))
    calc(16px + env(safe-area-inset-left));
  gap: 12px;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.vpad-group { pointer-events: auto; display: flex; align-items: center; justify-content: center; }
.vpad-left  { justify-content: flex-start; }
.vpad-right { justify-content: flex-end; flex-direction: column; gap: 10px; align-items: flex-end; }
.vpad-center { flex-direction: column; gap: 8px; justify-content: flex-end; padding-bottom: 14px; touch-action: none; }

/* MOBA-style pointer surface — face + shoulders share one capture area so
   a finger can slide between any button without needing to lift. */
.face-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  touch-action: none;
}

/* ===== Virtual analog stick ===== */
.stick {
  position: relative;
  width: 150px; height: 150px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%,
    rgba(28, 28, 30, 0.68) 0%,
    rgba(28, 28, 30, 0.72) 55%,
    rgba(28, 28, 30, 0.8) 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,0.06),
    inset 0 -2px 8px rgba(0,0,0,0.4),
    0 6px 16px rgba(0,0,0,0.35);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  touch-action: none;
  cursor: pointer;
  transition: border-color 0.1s ease;
}
.stick.active { border-color: color-mix(in srgb, var(--accent) 60%, transparent); }
.stick-knob {
  position: absolute;
  top: 50%; left: 50%;
  width: 66px; height: 66px;
  margin: -33px 0 0 -33px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%,
    rgba(255,255,255,0.22) 0%,
    rgba(110, 110, 120, 0.85) 40%,
    rgba(40, 40, 45, 0.95) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,0.22),
    0 4px 12px rgba(0,0,0,0.5);
  pointer-events: none;
  transition: transform 0.08s cubic-bezier(0.22, 1, 0.36, 1), background 0.1s ease;
}
.stick.active .stick-knob {
  background: radial-gradient(circle at 35% 30%,
    rgba(255,255,255,0.28) 0%,
    color-mix(in srgb, var(--accent) 80%, transparent) 40%,
    color-mix(in srgb, var(--accent) 95%, #000) 100%);
  transition: transform 0s;
}
.stick-arrow {
  position: absolute;
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255, 255, 255, 0.28);
  font-size: 11px;
  pointer-events: none;
  transition: color 0.1s ease;
}
.stick-arrow.on { color: var(--accent); }
.stick-up    { top: 8px;  left: 50%; transform: translateX(-50%); }
.stick-right { right: 8px; top: 50%; transform: translateY(-50%); }
.stick-down  { bottom: 8px; left: 50%; transform: translateX(-50%); }
.stick-left  { left: 8px; top: 50%; transform: translateY(-50%); }

/* ===== Face buttons ===== */
.face {
  display: grid;
  width: 150px;
  height: 150px;
  gap: 4px;
}
.face-btn {
  --fc: #FF9500;
  width: 52px; height: 52px;
  border-radius: 50%;
  border: 2px solid var(--fc);
  background: rgba(20, 20, 22, 0.7);
  color: var(--fc);
  font-weight: 800;
  font-size: 16px;
  font-family: inherit;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 12px rgba(0,0,0,0.35);
  transition: background 0.08s ease, transform 0.08s ease, color 0.08s ease;
  place-self: center;
  padding: 0;
  /* Block all native touch gestures so rapid tapping never triggers
     double-tap-zoom, text selection, or the iOS long-press callout. */
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.face-btn.pressed {
  background: var(--fc);
  color: #fff;
  transform: scale(0.95);
}

/* Turbo / 连发 indicator — pulsing glow ring while auto-firing */
.face-btn.turbo,
.sh-btn.turbo {
  animation: turbo-pulse 0.5s ease-in-out infinite;
}
@keyframes turbo-pulse {
  0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 12px rgba(0,0,0,0.35), 0 0 0 0 var(--fc, #fff); }
  50%      { box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 12px rgba(0,0,0,0.35), 0 0 14px 3px var(--fc, #fff); }
}

/* FC / Famicom / GB — 2 large buttons on a clean diagonal, 小霸王 style.
   2x2 grid gives the A/B pair breathing room without them overflowing a
   crowded 3x3 cell. */
.face-fc, .face-gba {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    ".  a"
    "b  .";
  gap: 8px;
}
.face-fc .face-btn, .face-gba .face-btn { width: 60px; height: 60px; font-size: 18px; }
.face-fc .fbtn-a, .face-gba .fbtn-a { grid-area: a; }
.face-fc .fbtn-b, .face-gba .fbtn-b { grid-area: b; }

/* SNES — diamond X-top, Y-left, A-right, B-bottom */
.face-snes {
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-areas:
    ".  x  ."
    "y  .  a"
    ".  b  .";
}
.face-snes .fbtn-x { grid-area: x; }
.face-snes .fbtn-y { grid-area: y; }
.face-snes .fbtn-a { grid-area: a; }
.face-snes .fbtn-b { grid-area: b; }

/* PlayStation — same diamond positions, Sony symbol colors */
.face-ps {
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-areas:
    ".  y  ."
    "x  .  a"
    ".  b  .";
}
.face-ps .fbtn-y { grid-area: y; }
.face-ps .fbtn-x { grid-area: x; }
.face-ps .fbtn-a { grid-area: a; }
.face-ps .fbtn-b { grid-area: b; }

/* Neo Geo arcade — 2x2 grid: A B on top, C D on bottom */
.face-arcade {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    "ab bb"
    "yb xb";
  gap: 10px;
}
.face-arcade .fbtn-b { grid-area: ab; }   /* label "A" */
.face-arcade .fbtn-a { grid-area: bb; }   /* label "B" */
.face-arcade .fbtn-y { grid-area: yb; }   /* label "C" */
.face-arcade .fbtn-x { grid-area: xb; }   /* label "D" */

/* Mega Drive 6-button cabinet — top row A B C, bottom row X Y Z.
   retropad→label mapping: b='A' a='B' y='C' l='X' x='Y' r='Z'. */
.face-md {
  width: 186px;
  height: 124px;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    "a b c"
    "x y z";
  gap: 6px;
}
.face-md .face-btn { width: 48px; height: 48px; font-size: 15px; }
.face-md .fbtn-b { grid-area: a; }   /* 'A' */
.face-md .fbtn-a { grid-area: b; }   /* 'B' */
.face-md .fbtn-y { grid-area: c; }   /* 'C' */
.face-md .fbtn-l { grid-area: x; }   /* 'X' */
.face-md .fbtn-x { grid-area: y; }   /* 'Y' */
.face-md .fbtn-r { grid-area: z; }   /* 'Z' */

/* Master System / Game Gear — 2 buttons horizontal: 1 2 */
.face-sms {
  width: 140px;
  height: 70px;
  grid-template-columns: 1fr 1fr;
  grid-template-areas: "ab bb";
}
.face-sms .fbtn-b { grid-area: ab; }
.face-sms .fbtn-a { grid-area: bb; }

/* ===== Shoulders ===== */
.shoulders { display: flex; gap: 10px; margin-right: 4px; }
.sh-btn {
  padding: 8px 18px;
  border-radius: 10px 10px 20px 20px;
  border: none;
  background: rgba(20, 20, 22, 0.72);
  color: rgba(255,255,255,0.85);
  font-weight: 700;
  font-size: 12px;
  font-family: inherit;
  backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 3px 8px rgba(0,0,0,0.3);
  transition: background 0.08s ease, transform 0.08s ease;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.sh-btn.pressed { background: color-mix(in srgb, var(--accent) 65%, transparent); color: #fff; transform: translateY(1px); }

/* ===== System (Start/Select) ===== */
.sys-btn {
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(20, 20, 22, 0.72);
  color: rgba(255,255,255,0.85);
  font-weight: 700;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  font-family: inherit;
  backdrop-filter: blur(14px);
  transition: background 0.08s ease;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.sys-btn.pressed { background: color-mix(in srgb, var(--accent) 65%, transparent); color: #fff; }

/* 连发开关 — 默认灰色，开启时发橙色光示警 */
.turbo-toggle {
  border-color: rgba(255,255,255,0.18);
}
.turbo-toggle.on {
  background: color-mix(in srgb, #FF9500 70%, transparent);
  color: #fff;
  border-color: #FF9500;
  box-shadow: 0 0 8px color-mix(in srgb, #FF9500 60%, transparent);
}

/* Portrait mobile: compact */
@media (max-width: 480px) {
  .stick, .face { width: 132px; height: 132px; }
  .face-md { width: 168px; height: 112px; }
  .face-sms { width: 128px; height: 64px; }
  .stick-knob { width: 58px; height: 58px; margin: -29px 0 0 -29px; }
  .face-btn { width: 46px; height: 46px; font-size: 14px; }
  .face-fc .face-btn, .face-gba .face-btn { width: 54px; height: 54px; font-size: 16px; }
  .face-md .face-btn { width: 42px; height: 42px; font-size: 13px; }
}

/* Landscape: push stick / face buttons toward corners */
@media (orientation: landscape) and (max-height: 500px) {
  .vpad {
    padding:
      8px
      calc(12px + env(safe-area-inset-right))
      calc(8px + env(safe-area-inset-bottom))
      calc(12px + env(safe-area-inset-left));
  }
  .vpad-center { padding-bottom: 8px; flex-direction: row; }
  .stick, .face { width: 128px; height: 128px; }
  .face-md { width: 162px; height: 106px; }
  .face-sms { width: 122px; height: 60px; }
  .stick-knob { width: 56px; height: 56px; margin: -28px 0 0 -28px; }
  .face-btn { width: 44px; height: 44px; }
  .face-fc .face-btn, .face-gba .face-btn { width: 52px; height: 52px; font-size: 15px; }
  .face-md .face-btn { width: 40px; height: 40px; font-size: 13px; }
}
</style>
