# KB content integration: review build

## Source and reproducibility

The existing `public/education_hub_articles` submodule now points to
`https://github.com/HappySonnyDev/EducationHubArticles`, branch
`feat/kb-metadata-cleanup`. The gitlink pins the exact reviewed source revision;
normal setup must not implicitly pull latest main.

```sh
git submodule update --init public/education_hub_articles
yarn kb:validate
SKIP_ENV_VALIDATION=1 yarn dev --port 3001
```

`SKIP_ENV_VALIDATION` is for local content/UI review without SendGrid credentials,
not a production configuration. An isolated second review server can use
`NEXT_DIST_DIR=.next-kb-validation` and port 3002.

The workbook and PDF supplied by the content team were consulted. The workbook
explicitly describes candidate mappings, not an approved bulk import. Only its
taxonomy, proposed tags/classification, and featured references were exported;
private analytics/evidence columns were not published.

Source snapshot: 211 article concepts, 318 Markdown renditions: 211 English,
64 Chinese, 43 Spanish. No article directory, Markdown body or original
frontmatter was edited. Metadata is a sidecar in the fork's `metadata/` folder.
Existing `/knowledge-base/[slug]` paths and source filename locale conventions
determine the manifest. Historical URL normalization is used only for proposed
classification matching, never for redirects or canonical paths.

Run `node scripts/prepare-kb-content.mjs <content-checkout>` to regenerate the
sidecar after a source change. This overwrites generated catalog/reconciliation
files, not Markdown. Review the resulting diff and commit it in the content
branch, then update the website gitlink to that commit. Do not rerun blindly over
manual metadata edits. The application fails on mismatched source hashes rather
than silently loading stale metadata.

## Implemented routes

- `/knowledge-base`: actual Hub counts, manually referenced starter picks with same-Hub
  fallback, honest Recommended reading label, five search suggestions.
- `/knowledge-base/topic?hub=<id>`: original Subjects tabs, selected-Subject article grid,
  density slider and Filter menu. Real data fills the approved layout; selecting
  View all removes the Subject filter without adding grouped section headings.
  Optional `subject=<id>` selects a Subject from article breadcrumbs/categories.
  Latest-to-oldest is supported; popularity/editorial filters remain disabled
  until their data is supplied.
- `/knowledge-base/articles?page=2`: 24 articles per server-rendered page, normal next/previous
  links, newest first with stable ID tiebreak. Invalid pages return 404.
- `/knowledge-base/search?q=...`: weighted title/summary/taxonomy/tags/body search with
  technical punctuation and Chinese handling. No external search service.
- `/knowledge-base/<original-slug>`: directly renders the approved article UI
  with original Markdown, images, sanitized HTML, heading navigation,
  Topic/Subject links and up to three relevant related articles. Existing slugs,
  including case and underscores, are preserved. Locale prefixes are unchanged.
  There is no redirect to a new Hub- or Subject-based article URL.
- Start Here further-reading links reference real source IDs. These initial
  editorial suggestions and existing English guide copy still need content review.
- Listings use actual locale files. Existing public article routes retain
  their established English fallback when the requested translation is absent,
  so previously valid locale-prefixed URLs still serve directly. This fallback
  does not create translated source files. Draft/future entries are excluded
  independently of metadata review status. Unknown metadata does not remove
  existing articles.

The redesigned homepage and supporting pages now live under `/knowledge-base`,
matching the existing public prefix. The old `/kb` route family, including the
static article/style-guide and duplicate article previews, has been removed
without redirects. Existing `/knowledge-base/[slug]` routes keep serving the
approved data-backed article UI directly. Public pages no longer inherit the
preview noindex flag; search results remain noindex. This branch has not been
deployed to production.
Cards, search results, reading lists, recent posts and related articles use the
stored canonical article paths. Next Link adds the current locale prefix once;
review catalogs are scoped to the current locale. Existing public locale routes
keep English fallback where translations are missing. Hub/Subject changes affect
navigation and metadata, never the article address. Original article-body links
keep their established destinations. No public article redirects or article route renames are introduced.

The accepted UI is the pre-integration `951c139` design. Data integration must
preserve its page structure, styling, cards and controls. Handoff document
interaction proposals do not override the approved UI without user approval.

## Remaining review / release gates

- 248 renditions have proposed Hub assignments; general and unmatched material
  remains in All Articles. All classifications retain `pending-editorial` status.
- 40 renditions have no matching workbook proposal; 85 historical workbook
  candidates have no source match. Do not invent articles or redirect them.
- One of 18 historical featured URLs has no exact match (the VM article's old
  explainCKBot suffix). The Hub currently uses eligible fallback content.
- 73 renditions have no supplied author. Show that absence rather than inventing
  attribution. Existing website date corrections were reused and audited.
- Production taxonomy approval, curated fallback/Start Here approval, translated
  Hub labels/guide copy, URL alias review, sitemap/canonical/hreflang rollout and
  a production crawl remain required before release.
- No current-year GA snapshot was supplied. There is no fake popularity ranking
  or Like counter on data-backed pages. Newsletter forms remain explicit previews;
  connecting subscriptions and unresolved external destination choices is separate.

## Checks

`yarn kb:validate` checks all source/body hashes, route and identity uniqueness,
original source-directory slugs, canonical article links (including case,
underscores and locale prefixes), and stable addresses after reclassification.
It also exercises the real article route loaders: public paths include every
English article across all seven configured locales, missing public translations
serve English directly without a redirect, actual translations stay localized,
and unknown articles return 404.
Taxonomy ownership, available cover paths, review-catalog locale isolation,
recommendation deduplication and technical/Chinese search examples are covered.
This is not an editorial review or proof that every historical public URL was
live. Actual production HTTP URL reconciliation is still needed before
introducing redirects.
