import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('typescript')

const directory = path.dirname(fileURLToPath(import.meta.url))

function renderFooter() {
  const events = []
  const statuses = []
  const filename = path.join(directory, 'KnowledgeFooter.tsx')
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  const imports = {
    react: { useState: () => ['', value => statuses.push(value)] },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: 'a' },
    'next/image': { default: 'img' },
    '../Footer/logo.svg': { default: 'svg' },
    './footer-v2.module.scss': { default: {} },
    './analytics': {
      trackKBEvent: (name, data) => events.push({ name, data: { ...data } }),
    },
  }
  vm.runInNewContext(outputText, {
    exports,
    require: name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected footer dependency: ${name}`)
      return imports[name]
    },
  })
  return { tree: exports.KnowledgeFooter(), events, statuses }
}

function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}

test('footer navigation emits bounded IDs without changing destinations or opening behavior', () => {
  const { tree, events } = renderFooter()
  const navigation = nodes(tree).find(node => node.props?.['aria-label'] === 'Footer navigation')
  const links = nodes(navigation).filter(node => node.props?.href)
  assert.equal(links.length, 24)
  assert.equal(events.length, 0, 'Rendering alone must not count as navigation')
  for (const link of links) {
    assert.equal(link.props.target, '_blank')
    assert.equal(link.props.rel, 'noopener noreferrer')
    link.props.onClick()
  }
  assert.equal(events.length, links.length)
  assert.deepEqual(
    events.map(event => event.data.link_id),
    [
      'ckb',
      'mining',
      'wallets',
      'wiki',
      'press_kit',
      'developers_heading',
      'documentation',
      'github',
      'explorer',
      'ecosystem_heading',
      'nervos_foundation',
      'cryptape',
      'godwoken',
      'nervina_labs',
      'tunnel_vision_labs',
      'community_heading',
      'community_fund_dao',
      'nervos_talk_forum',
      'rfcs',
      'learn_heading',
      'knowledge_base',
      'blog',
      'medium',
      'youtube',
    ],
  )
  for (const event of events) {
    assert.equal(event.name, 'kb_footer_link_click')
    assert.deepEqual(Object.keys(event.data).sort(), ['group', 'link_id'])
    assert.match(event.data.group, /^(discover|developers|ecosystem|community|learn)$/)
  }
})

test('footer social links identify the selected network, not its URL', () => {
  const { tree, events } = renderFooter()
  const links = nodes(tree).filter(node => node.props?.href && node.props?.['aria-label'])
  assert.equal(links.length, 7)
  for (const link of links) link.props.onClick()
  assert.deepEqual(
    events.map(event => event.data.network),
    ['twitter', 'discord', 'telegram', 'linkedin', 'reddit', 'youtube', 'talk'],
  )
  for (const event of events) {
    assert.equal(event.name, 'kb_social_click')
    assert.deepEqual(Object.keys(event.data).sort(), ['network', 'placement'])
    assert.equal(event.data.placement, 'footer')
  }
})

test('footer email submission records a preview attempt, never the email or a signup success', () => {
  const { tree, events, statuses } = renderFooter()
  const form = nodes(tree).find(node => node.type === 'form')
  let prevented = false
  form.props.onSubmit({
    preventDefault: () => {
      prevented = true
    },
    currentTarget: { email: 'private@example.test' },
  })
  assert.equal(prevented, true)
  assert.deepEqual(events, [{ name: 'kb_newsletter_submit_preview', data: { placement: 'footer' } }])
  assert.deepEqual(statuses, ['Static preview only. Your email was not sent or stored.'])
})
