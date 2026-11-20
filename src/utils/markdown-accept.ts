/** Only an explicit, higher-quality Markdown preference opts out of HTML. */
export function prefersMarkdown(accept: string | undefined): boolean {
  if (!accept) return false
  const ranges = accept.split(',').map(value => {
    const [media = '', ...parameters] = value.trim().toLowerCase().split(';')
    const qualityParameter = parameters.find(parameter => /^\s*q\s*=/.test(parameter))
    const rawQuality = qualityParameter?.split('=')[1]?.trim()
    const quality =
      rawQuality === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(rawQuality) ? Number(rawQuality) : 0
    return { media: media.trim(), quality }
  })
  const markdown = Math.max(0, ...ranges.filter(range => range.media === 'text/markdown').map(range => range.quality))
  if (!markdown) return false
  for (const media of ['text/html', 'text/*', '*/*']) {
    const matching = ranges.filter(range => range.media === media)
    if (matching.length) return markdown > Math.max(...matching.map(range => range.quality))
  }
  return true
}
