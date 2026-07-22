export const meta = {
  name: 'extract-german-vocabulary',
  description: 'Extract word-level vocabulary entries (word · article · plural · example) from German A1 word-list / Wortschatz pages',
  phases: [{ title: 'Extract', detail: 'one agent per ~5-page chunk (word lists are dense)' }],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) {} }
A = A || {}
const ROOT = String(A.root || '').replace(/[\\/]+$/, '')
let TASKS = A.tasks
if (typeof TASKS === 'string') { try { TASKS = JSON.parse(TASKS) } catch (e) {} }
if (!ROOT) throw new Error('args.root (absolute path to german/extracted) is required')
if (!Array.isArray(TASKS)) throw new Error('args.tasks must be an array of {slug, pages:[…]}')

const TOPICS = 'travel, food, restaurant, weather, school, profession, family, vacation, hobby, shopping, home, daily-routine, health, city-places, time-dates, personal-info, communication, mixed, none'
const pad = n => String(n).padStart(3, '0')

const VOCAB_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    collection: { type: 'string' },
    chunk: { type: 'string' },
    entries: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          word: { type: 'string' },          // headword, verbatim
          article: { type: 'string' },        // der | die | das | "" (non-nouns)
          plural: { type: 'string' },         // e.g. "-e", "Häuser", "" if none/NA
          word_class: { type: 'string' },     // noun | verb | adjective | adverb | preposition | phrase | other
          example: { type: 'string' },        // example sentence/phrase as printed, "" if none
          topic: { type: 'string' },
          source_page: { type: 'string' },    // 3-digit page
        },
        required: ['word', 'word_class', 'source_page'],
      },
    },
  },
  required: ['collection', 'chunk', 'entries'],
}

const prompt = (slug, pages) => {
  const first = pad(pages[0]), last = pad(pages[pages.length - 1])
  const files = pages.map(p => `${ROOT}/${slug}/pages/page-${pad(p)}.md`).join('\n  ')
  return `Extract EVERY vocabulary entry from these German A1 word-list / Wortschatz pages, for a study database.
FILES (read all of them):
  ${files}

For each headword entry printed on these pages, output one record:
 - word: the headword VERBATIM (German spelling, umlauts/ß exact)
 - article: for nouns the definite article as printed (der / die / das); "" for non-nouns
 - plural: the plural form/ending as printed (e.g. "-e", "-en", "Häuser"); "" if not given
 - word_class: noun | verb | adjective | adverb | preposition | phrase | other
 - example: the example sentence/phrase printed with the entry, VERBATIM; "" if none
 - topic: the real-world theme, chosen from: ${TOPICS} (use "none" if the word is generic/grammatical)
 - source_page: the 3-digit page number the entry appears on (e.g. "007")

Rules:
 - Be exhaustive — these are dense alphabetical lists; include EVERY entry on these pages.
 - Do NOT invent entries. If a page is front-matter/instructions with no word entries, return no records for it.
 - Keep German exactly as printed; do not translate.

WRITE the result as JSON to ${ROOT}/${slug}/pages/_vocab/chunk-${first}-${last}.json in this shape:
{"collection":"${slug}","chunk":"${first}-${last}","entries":[ ... ]}
Return the same JSON.`
}

phase('Extract')
const results = await pipeline(
  TASKS,
  t => agent(prompt(t.slug, t.pages), {
    label: `vocab:${t.slug} p${pad(t.pages[0])}-${pad(t.pages[t.pages.length - 1])}`,
    phase: 'Extract', schema: VOCAB_SCHEMA, effort: 'medium',
  }),
)
const done = results.filter(Boolean)
const total = done.reduce((n, r) => n + (r.entries || []).length, 0)
log(`vocabulary: ${done.length}/${TASKS.length} chunks, ${total} entries`)
return { chunks: done.length, entries: total, by_chunk: done.map(r => ({ collection: r.collection, chunk: r.chunk, entries: (r.entries || []).length })) }
