export const meta = {
  name: 'classify-german-pages',
  description: 'Classify each German A1 page by activity type + topic + a one-line summary (for the catalog)',
  phases: [{ title: 'Classify', detail: 'one agent per collection reads the unified doc' }],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) {} }
A = A || {}
const ROOT = String(A.root || '').replace(/[\\/]+$/, '')
let COLLECTIONS = A.collections
if (typeof COLLECTIONS === 'string') { try { COLLECTIONS = JSON.parse(COLLECTIONS) } catch (e) {} }
if (!ROOT) throw new Error('args.root (absolute path to german/extracted) is required')
if (!Array.isArray(COLLECTIONS)) throw new Error('args.collections must be an array of slugs')

const ACTIVITY = 'multiple-choice, matching, true-false, fill-in, ordering, short-answer, writing-task, speaking-task, listening-comprehension, reading-comprehension, vocabulary, instructions, cover, answer-key, none'
const TOPIC = 'travel, food, restaurant, weather, school, profession, family, vacation, hobby, shopping, home, daily-routine, health, city-places, time-dates, personal-info, communication, mixed, none'

const CLASS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    collection: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          page: { type: 'integer' },
          activity_type: { type: 'string' },
          topic: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['page', 'activity_type', 'topic', 'summary'],
      },
    },
  },
  required: ['collection', 'items'],
}

const prompt = slug => `Classify each page of a German A1 learning material (exam paper, coursebook, test booklet, or workbook) for a learning catalog.
UNIFIED DOC (all pages, each under a "## Page NNN" heading): ${ROOT}/${slug}/${slug}.md
Read that file. For EVERY page section, decide:
 - activity_type: the dominant task/activity on the page, chosen from: ${ACTIVITY}
 - topic: the main real-world theme, chosen from: ${TOPIC} (use "mixed" if several; "none" for covers/instructions/answer-keys/transcripts)
 - summary: ONE short English line (<= 15 words) describing what the page contains, so a human scanning the catalog instantly understands it.
Then WRITE the result as JSON to ${ROOT}/${slug}/pages/_class.json in EXACTLY this shape:
{"collection":"${slug}","items":[{"page":1,"activity_type":"...","topic":"...","summary":"..."}, ...]}
Include exactly one item per page present in the doc. Return the same JSON.`

phase('Classify')
const results = await pipeline(
  COLLECTIONS,
  slug => agent(prompt(slug), { label: `classify:${slug}`, phase: 'Classify', schema: CLASS_SCHEMA, effort: 'low' }),
)
const done = results.filter(Boolean)
log(`classified ${done.length}/${COLLECTIONS.length} collections`)
return { collections: done.map(r => ({ collection: r.collection, pages: (r.items || []).length })) }
