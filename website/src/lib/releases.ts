export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
  download_count: number
  /** GitHub now returns a content digest per asset, e.g. "sha256:<hex>". */
  digest?: string | null
}

export interface Release {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  body?: string
  assets: ReleaseAsset[]
}

export const REPO_URL = 'https://github.com/CrossPresenter/CrossPresenter'
export const RELEASES_URL = `${REPO_URL}/releases`
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`

export function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Strip the "sha256:" prefix and return the bare hex digest, if present. */
export function sha256Of(asset?: ReleaseAsset | null): string | null {
  const digest = asset?.digest
  if (!digest) return null
  const match = /^sha256:(.+)$/i.exec(digest)
  return match ? match[1] : null
}

/** Assets we surface as downloadable packages (drops blockmaps, checksum files, etc.). */
function packageAssets(release?: Release | null): ReleaseAsset[] {
  if (!release?.assets) return []
  return release.assets.filter(
    (a) => !/\.(blockmap|txt|json|ya?ml|sig|asc)$/i.test(a.name) && !/sha(256|512)sums?/i.test(a.name),
  )
}

function firstMatch(release: Release | null | undefined, pattern: RegExp): ReleaseAsset | undefined {
  return packageAssets(release).find((a) => pattern.test(a.name))
}

export function windowsSetupAsset(release?: Release | null): ReleaseAsset | undefined {
  return firstMatch(release, /\.exe$/i)
}

export function windowsPortableAsset(release?: Release | null): ReleaseAsset | undefined {
  return packageAssets(release).find(
    (a) => /\.zip$/i.test(a.name) && !/mac|darwin|linux|appimage/i.test(a.name),
  )
}

export type MacArch = 'arm64' | 'x64'

export function macDmgAsset(release: Release | null | undefined, arch: MacArch): ReleaseAsset | undefined {
  const dmgs = packageAssets(release).filter((a) => /\.dmg$/i.test(a.name))
  if (dmgs.length === 0) return undefined
  if (arch === 'arm64') {
    return (
      dmgs.find((a) => /arm64|aarch64|silicon/i.test(a.name)) ??
      dmgs.find((a) => !/x64|x86_64|intel/i.test(a.name))
    )
  }
  return (
    dmgs.find((a) => /x64|x86_64|intel/i.test(a.name)) ??
    dmgs.find((a) => !/arm64|aarch64|silicon/i.test(a.name))
  )
}

export function linuxAppImageAsset(release?: Release | null): ReleaseAsset | undefined {
  return firstMatch(release, /\.appimage$/i)
}

export function linuxDebAsset(release?: Release | null): ReleaseAsset | undefined {
  return firstMatch(release, /\.deb$/i)
}

export function linuxTarAsset(release?: Release | null): ReleaseAsset | undefined {
  return firstMatch(release, /\.(tar\.gz|tgz)$/i)
}

export async function getLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch('https://api.github.com/repos/CrossPresenter/CrossPresenter/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    return (await res.json()) as Release
  } catch {
    return null
  }
}
