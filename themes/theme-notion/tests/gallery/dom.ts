const NO_OP_METHODS = ["hasPointerCapture", "setPointerCapture", "releasePointerCapture", "scrollIntoView"] as const;

// The browser APIs Radix calls that happy-dom does not implement; no-ops are enough to open, choose and close.
export function installDomShims(): void {
  for (const method of NO_OP_METHODS) {
    if (!(method in Element.prototype)) Object.defineProperty(Element.prototype, method, { configurable: true, value: () => false });
  }
}
