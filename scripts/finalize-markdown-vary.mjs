import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const supportedNextVersion = '15.5.28'
const frameworkDimensions = ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch']

export function finalizeMarkdownVary({
  repository = repositoryRoot,
  distDir = process.env.NEXT_DIST_DIR || '.next',
} = {}) {
  const packagePath = path.join(repository, 'package.json')
  const declared = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  const installedPath = createRequire(packagePath).resolve('next/package.json')
  const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'))
  assert.equal(
    declared.dependencies?.next,
    supportedNextVersion,
    'Review Markdown Vary compatibility before changing Next',
  )
  assert.equal(
    installed.version,
    supportedNextVersion,
    'Installed Next differs from the reviewed Markdown Vary version',
  )

  const manifestPath = path.resolve(repository, distDir, 'routes-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.equal(manifest.version, 3, 'Unexpected Next routes manifest version; review Markdown Vary compatibility')
  const { rsc } = manifest
  assert(rsc && typeof rsc === 'object' && !Array.isArray(rsc), 'Missing Next RSC routes manifest metadata')
  assert.equal(rsc.header, 'rsc', 'Unexpected Next RSC request header')
  assert.equal(rsc.contentTypeHeader, 'text/x-component', 'Unexpected Next RSC content type')
  assert.equal(rsc.prefetchHeader, 'next-router-prefetch', 'Unexpected Next RSC prefetch header')
  assert.equal(rsc.prefetchSegmentHeader, 'next-router-segment-prefetch', 'Unexpected Next RSC segment prefetch header')
  assert.equal(typeof rsc.varyHeader, 'string', 'Missing Next RSC Vary metadata')
  const dimensions = rsc.varyHeader.split(',').map(value => value.trim().toLowerCase())
  assert.equal(new Set(dimensions).size, dimensions.length, 'Duplicate Next RSC Vary dimensions')
  assert(
    dimensions.every(value => frameworkDimensions.includes(value) || value === 'accept') &&
      frameworkDimensions.every(value => dimensions.includes(value)),
    'Unexpected Next RSC Vary dimensions; review Markdown negotiation before publishing',
  )

  const changed = !dimensions.includes('accept')
  if (changed) {
    // @vercel/next overwrites prerender initialHeaders.vary from this field,
    // after the complete build command. Response middleware cannot override it.
    // https://github.com/vercel/vercel/blob/main/packages/next/src/utils.ts#L3072-L3078
    // This also adds Accept to prerendered JSON/RSC responses. It retains every
    // framework dimension, static generation, payload and cache lifetime.
    rsc.varyHeader += ', Accept'
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  }
  return { changed, manifestPath, varyHeader: rsc.varyHeader }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'Usage: node scripts/finalize-markdown-vary.mjs')
    const result = finalizeMarkdownVary()
    console.log(
      `Vercel prerender Vary ${result.changed ? 'updated' : 'verified'} for HTML and Next data: ${result.varyHeader}; static generation and cache lifetimes are unchanged`,
    )
  } catch (error) {
    console.error(`Markdown Vary finalization failed: ${error.message}`)
    process.exitCode = 1
  }
}
