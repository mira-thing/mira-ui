// clockwise is +1
export type KnobStep = 1 | -1

// the knob is REL_HWHEEL, so it arrives as horizontal deltaX, negative for clockwise
export function knobDir(e: { deltaX: number }): KnobStep | 0 {
  if (e.deltaX < 0) return 1
  if (e.deltaX > 0) return -1
  return 0
}

export interface StepFilterOptions {
  // drop steps that land closer together than this
  minMs?: number
  // a direction change this soon after a step is contact bounce, not a real reversal
  reversalMs?: number
  now?: () => number
}

// the quadrature encoder's two contact pads still send stray steps, even after the kernel fix
export function createStepFilter({
  minMs = 55,
  reversalMs = 140,
  now = () => Date.now(),
}: StepFilterOptions = {}): (dir: KnobStep) => boolean {
  let lastAt = 0
  let lastDir: KnobStep = 1
  return (dir) => {
    const at = now()
    const since = at - lastAt
    if (dir !== lastDir && since < reversalMs) return false
    if (since < minMs) return false
    lastAt = at
    lastDir = dir
    return true
  }
}
