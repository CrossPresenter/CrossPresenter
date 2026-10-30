export type OsPlatform = 'windows' | 'macos' | 'linux' | 'unknown'
export type CpuArch = 'arm64' | 'x64' | 'unknown'

/** Best-effort client OS detection from the browser. */
export function detectOs(): OsPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua) || /^Mac/i.test(platform)) return 'macos'
  if (/Linux|X11|CrOS/i.test(ua) || /^Linux/i.test(platform)) return 'linux'
  return 'unknown'
}

/** Best-effort CPU architecture detection (used to pick the right macOS build). */
export function detectArch(): CpuArch {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  if (/aarch64|arm64/i.test(ua)) return 'arm64'

  const nav = navigator as Navigator & { userAgentData?: { architecture?: string } }
  const hinted = nav.userAgentData?.architecture
  if (hinted) {
    const arch = hinted.toLowerCase()
    if (/arm|aarch/.test(arch)) return 'arm64'
    if (/x86|amd64|intel/.test(arch)) return 'x64'
  }

  if (/x86_64|win64|wow64|amd64|\bx64\b/i.test(ua)) return 'x64'
  // macOS Safari/Chrome don't expose arch in the UA; default to x64 (runs via Rosetta on Apple Silicon).
  return 'unknown'
}
