export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
  download_count: number
}

export interface Release {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  assets: ReleaseAsset[]
}

export const REPO_URL = 'https://github.com/CrossPresenter/CrossPresenter'
export const RELEASES_URL = `${REPO_URL}/releases`

export function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function windowsAsset(release: Release): ReleaseAsset | undefined {
  if (!release) return undefined
  return release.assets.find((a) => /\.exe$/.test(a.name) && !a.name.endsWith('.blockmap'))
}

export async function getLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch('https://api.github.com/repos/CrossPresenter/CrossPresenter/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
