/**
 * Every `--dsw-*` custom property these stylesheets reference must be one the
 * harness theme actually publishes.
 *
 * An invented token is silent: CSS falls back to the initial value (or the
 * literal fallback beside it), so the page still renders and only looks subtly
 * wrong — usually in the theme you were not looking at. `--dsw-alias-bg-mask`
 * shipped that way until a dark-mode pass caught it; the real name is
 * `--dsw-alias-bg-mask-1`.
 *
 * 0.2.2-rc.1 injects the token sheets from the theme package's `lib/client.js`
 * instead of shipping them as stylesheets, so both sources are harvested. This
 * repository is standalone (no sibling plugin packages), so "our stylesheets"
 * means `src/client` here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

/** Custom properties declared by the theme package, from JS and CSS alike. */
function declaredTokens(): Set<string> {
  const themeRoot = dirname(require.resolve('@deepseek-ai/dsh-client-ui-theme/package.json'))
  const declared = new Set<string>()
  const harvest = (text: string): void => {
    for (const match of text.matchAll(/(--ds[a-z0-9-]+)\s*:/g)) declared.add(match[1] as string)
  }
  /** Walk a directory and harvest every stylesheet under it. */
  const walk = (directory: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(directory)
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (entry.endsWith('.css')) harvest(readFileSync(path, 'utf8'))
    }
  }
  walk(join(themeRoot, 'lib'))
  // The runtime-injected sheets (0.2.2-rc.1) carry the canonical token set.
  try {
    harvest(readFileSync(join(themeRoot, 'lib', 'client.js'), 'utf8'))
  } catch {
    // A future layout that drops the JS sheets still leaves the stylesheets.
  }
  return declared
}

/** Custom properties our own stylesheets consume through var(). */
function usedTokens(): Map<string, string[]> {
  const used = new Map<string, string[]>()
  const clientDir = join(import.meta.dirname, '..', 'src', 'client')
  for (const file of readdirSync(clientDir)) {
    if (!file.endsWith('.css')) continue
    const css = readFileSync(join(clientDir, file), 'utf8')
    for (const match of css.matchAll(/var\(\s*(--ds[a-z0-9-]+)/g)) {
      const token = match[1] as string
      used.set(token, [...(used.get(token) ?? []), file])
    }
  }
  return used
}

describe('theme tokens', () => {
  const declared = declaredTokens()
  const used = usedTokens()

  it('finds the theme package and its tokens', () => {
    expect(declared.size).toBeGreaterThan(50)
    expect(declared.has('--dsw-alias-bg-base')).toBe(true)
  })

  it('reads our stylesheets', () => {
    expect(used.size).toBeGreaterThan(5)
  })

  it('references only tokens the theme publishes', () => {
    const invented = [...used.entries()]
      .filter(([token]) => !declared.has(token))
      .map(([token, files]) => `${token} (in ${files.join(', ')})`)
    expect(invented).toEqual([])
  })
})
