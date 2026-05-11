// Static asset version — bumped on each deploy that changes the
// admin / survey JavaScript or stylesheet. The version string is appended
// as a `?v=...` query string to /static/*.{js,css} URLs to bust the
// browser cache when we ship a new build.
//
// IMPORTANT: bump this value whenever you change:
//   - public/static/admin.js
//   - public/static/admin-new-survey.js
//   - public/static/survey.js
//   - public/static/styles.css
// Format: YYYYMMDD-HHMM (UTC) to keep monotonic ordering.

export const ASSET_VERSION = '20260511-1500'

/** Helper: append ?v=... to a static path (preserves existing query). */
export function v(path: string): string {
  return path + (path.includes('?') ? '&' : '?') + 'v=' + ASSET_VERSION
}
