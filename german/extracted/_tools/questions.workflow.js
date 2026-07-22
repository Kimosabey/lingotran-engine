export const meta = {
  name: 'extract-german-questions',
  description: 'Extract per-item questions + options + correct answers (from the Lösungen, if present) into a structured list',
  phases: [{ title: 'Extract', detail: 'one agent per collection reads the unified doc + answer key' }],
}

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) {} }
A = A || {}
const ROOT = String(A.root || '').replace(/[\\/]+$/, '')
let COLLECTIONS = A.collections
if (typeof COLLECTIONS === 'string') { try { COLLECTIONS = JSON.parse(COLLECTIONS) } catch (e) {} }
if (!ROOT) throw new Error('args.root (absolute path to german/extracted) is required')
if (!Array.isArray(COLLECTIONS)) throw new Error('args.collections must be an array of slugs')

const ITEM_TYPES = 'multiple-choice, true-false, matching, ordering, fill-in, open'
const TOPICS = 'travel, food, restaurant, weather, school, profession, family, vacation, hobby, shopping, home, daily-routine, health, city-places, time-dates, personal-info, communication, mixed, none'

const Q_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    collection: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          section: { type: 'string' },        // hoeren | lesen | schreiben | sprechen
          teil: { type: 'string' },            // e.g. "1", "2"
          item: { type: 'string' },            // printed item number/letter
          item_type: { type: 'string' },       // from ITEM_TYPES
          question: { type: 'string' },         // the item stem / prompt, verbatim
          option_a: { type: 'string' },
          option_b: { type: 'string' },
          option_c: { type: 'string' },
          correct_answer: { type: 'string' },   // from the Lösungen; "(open-ended)" for open tasks
          topic: { type: 'string' },
          source_page: { type: 'string' },      // e.g. "008"
        },
        required: ['section', 'item', 'item_type', 'question', 'correct_answer'],
      },
    },
  },
  required: ['collection', 'items'],
}

const prompt = slug => `Extract EVERY exam/exercise question as a structured item from a German A1 learning material (exam paper, coursebook, test booklet, or workbook), for a study database.
UNIFIED DOC (all pages under "## Page NNN" headings; it MAY OR MAY NOT contain a Lösungen/answer-key section): ${ROOT}/${slug}/${slug}.md
Read the whole file. Then, for every task item in the Hören / Lesen / Schreiben / Sprechen sections, output one record:
 - section: hoeren | lesen | schreiben | sprechen
 - teil: the Teil/part number as printed
 - item: the printed item number/letter (e.g. "1", "b")
 - item_type: one of: ${ITEM_TYPES}
 - question: the item's stem/prompt, VERBATIM German (for matching, state what is to be matched; for open Schreiben/Sprechen, the full prompt)
 - option_a / option_b / option_c: the answer options VERBATIM when the item has them (multiple-choice; for true-false use option_a="Richtig", option_b="Falsch"); leave "" when not applicable
 - correct_answer: IF this document has a Lösungen / answer-key section, take the correct option/value from it (e.g. "b", "Falsch", "1c 2a 3b"). For open-ended Schreiben/Sprechen tasks, use exactly "(open-ended)". If the document has NO answer key (common in a coursebook), leave "" — never guess.
 - topic: the real-world theme, chosen from: ${TOPICS} (use "mixed" if several; "none" for grammar/instructions/cover pages)
 - source_page: the 3-digit page number ("## Page NNN") where the item appears
Be faithful — do not invent questions or answers. Cross-reference the Lösungen carefully so correct_answer matches the right item.
WRITE the result as JSON to ${ROOT}/${slug}/pages/_questions.json in this shape:
{"collection":"${slug}","items":[ ... ]}
Return the same JSON.`

phase('Extract')
const results = await pipeline(
  COLLECTIONS,
  slug => agent(prompt(slug), { label: `questions:${slug}`, phase: 'Extract', schema: Q_SCHEMA, effort: 'medium' }),
)
const done = results.filter(Boolean)
log(`extracted questions for ${done.length}/${COLLECTIONS.length} collections`)
return { collections: done.map(r => ({ collection: r.collection, items: (r.items || []).length })) }
