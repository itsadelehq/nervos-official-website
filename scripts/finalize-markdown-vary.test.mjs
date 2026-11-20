import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { finalizeMarkdownVary } from './finalize-markdown-vary.mjs'

const originalVary = 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'

function fixture(t, { declaredVersion = '15.5.28', installedVersion = '15.5.28', distDir = '.next' } = {}) {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-vary-'))
  t.after(() => fs.rmSync(repository, { recursive: true, force: true }))
  fs.mkdirSync(path.join(repository, 'node_modules/next'), { recursive: true })
  fs.mkdirSync(path.join(repository, distDir), { recursive: true })
  fs.writeFileSync(path.join(repository, 'package.json'), JSON.stringify({ dependencies: { next: declaredVersion } }))
  fs.writeFileSync(
    path.join(repository, 'node_modules/next/package.json'),
    JSON.stringify({ name: 'next', version: installedVersion }),
  )
  const manifestPath = path.join(repository, distDir, 'routes-manifest.json')
  const manifest = {
    version: 3,
    pages404: true,
    redirects: [{ source: '/old', destination: '/new', permanent: true }],
    headers: [{ source: '/knowledge-base', headers: [{ key: 'Vary', value: 'Accept' }] }],
    dataRoutes: [{ page: '/knowledge-base', dataRouteRegex: '^/_next/data/build/knowledge-base\\.json$' }],
    i18n: { defaultLocale: 'en', locales: ['en', 'zh'], localeDetection: false },
    rsc: {
      header: 'rsc',
      varyHeader: originalVary,
      prefetchHeader: 'next-router-prefetch',
      prefetchSegmentHeader: 'next-router-segment-prefetch',
      contentTypeHeader: 'text/x-component',
      suffix: '.rsc',
      prefetchSegmentDirSuffix: '.segments',
    },
  }
  const write = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  write()
  return { repository, distDir, manifestPath, manifest, write }
}

test('B9 finalization adds Accept only to the reviewed RSC Vary field', t => {
  const setup = fixture(t)
  const original = structuredClone(setup.manifest)
  const result = finalizeMarkdownVary(setup)
  const written = JSON.parse(fs.readFileSync(setup.manifestPath, 'utf8'))
  assert.equal(result.changed, true)
  assert.equal(result.manifestPath, setup.manifestPath)
  assert.equal(result.varyHeader, originalVary + ', Accept')
  assert.deepEqual(written, { ...original, rsc: { ...original.rsc, varyHeader: originalVary + ', Accept' } })
})

test('B9 finalization is byte-for-byte idempotent once Accept is present', t => {
  const setup = fixture(t)
  setup.manifest.rsc.varyHeader = 'Accept, ' + originalVary
  setup.write()
  const before = fs.readFileSync(setup.manifestPath, 'utf8')
  const result = finalizeMarkdownVary(setup)
  assert.equal(result.changed, false)
  assert.equal(fs.readFileSync(setup.manifestPath, 'utf8'), before)
})

test('B9 finalization supports the configured Next build directory', t => {
  const setup = fixture(t, { distDir: '.next-custom' })
  finalizeMarkdownVary(setup)
  assert.equal(JSON.parse(fs.readFileSync(setup.manifestPath, 'utf8')).rsc.varyHeader, originalVary + ', Accept')
  assert.equal(fs.existsSync(path.join(setup.repository, '.next')), false)
})

test('B9 finalization rejects changed declared or installed Next versions without writing', async t => {
  for (const versions of [
    { declaredVersion: '^15.5.28' },
    { declaredVersion: '15.5.29' },
    { installedVersion: '15.5.29' },
  ]) {
    await t.test(JSON.stringify(versions), t => {
      const setup = fixture(t, versions)
      const before = fs.readFileSync(setup.manifestPath, 'utf8')
      assert.throws(() => finalizeMarkdownVary(setup), /Next/)
      assert.equal(fs.readFileSync(setup.manifestPath, 'utf8'), before)
    })
  }
})

test('B9 finalization fails closed on unknown manifest structures and Vary dimensions', async t => {
  const mutations = [
    ['manifest version', manifest => (manifest.version = 4)],
    ['missing RSC', manifest => delete manifest.rsc],
    ['RSC array', manifest => (manifest.rsc = [])],
    ['RSC request header', manifest => (manifest.rsc.header = 'new-rsc')],
    ['RSC content type', manifest => (manifest.rsc.contentTypeHeader = 'application/json')],
    ['RSC prefetch header', manifest => (manifest.rsc.prefetchHeader = 'new-prefetch')],
    ['RSC segment header', manifest => delete manifest.rsc.prefetchSegmentHeader],
    ['missing Vary', manifest => delete manifest.rsc.varyHeader],
    ['non-string Vary', manifest => (manifest.rsc.varyHeader = [])],
    ['missing framework dimension', manifest => (manifest.rsc.varyHeader = 'rsc, next-router-prefetch')],
    ['unknown dimension', manifest => (manifest.rsc.varyHeader += ', next-url')],
    ['duplicate framework dimension', manifest => (manifest.rsc.varyHeader += ', RSC')],
    ['duplicate Accept', manifest => (manifest.rsc.varyHeader += ', Accept, accept')],
    ['empty dimension', manifest => (manifest.rsc.varyHeader += ',')],
    ['wildcard Vary', manifest => (manifest.rsc.varyHeader = '*')],
  ]
  for (const [name, mutate] of mutations) {
    await t.test(name, t => {
      const setup = fixture(t)
      mutate(setup.manifest)
      setup.write()
      const before = fs.readFileSync(setup.manifestPath, 'utf8')
      assert.throws(() => finalizeMarkdownVary(setup))
      assert.equal(fs.readFileSync(setup.manifestPath, 'utf8'), before)
    })
  }
})

test('B9 build pipeline finalizes the manifest after Next and before release verification', () => {
  const { scripts } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(
    scripts.build,
    /next build && node scripts\/finalize-markdown-vary\.mjs && node scripts\/verify-kb-content-release\.mjs$/,
  )
  assert.doesNotMatch(scripts.dev, /finalize-markdown-vary/)
})
