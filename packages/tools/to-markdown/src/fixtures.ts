import { DnaInput } from './types'

/**
 * Self-contained bookshop DNA used by the renderer's tests.
 *
 * Invented for the tests — not derived from or coupled to any domain under
 * dna/. If a shape drifts in @dna/core's schemas, update this fixture and
 * assert that the renderer still produces the expected output.
 */
export const bookshopInput: DnaInput = {
  operational: {
    domain: {
      name: 'shop',
      path: 'shop.books',
      description: 'Tiny bookshop domain for @dna/to-markdown tests.',
      nouns: [
        {
          name: 'Book',
          description: 'A book for sale.',
          attributes: [
            { name: 'id', type: 'string', required: true, description: 'Unique identifier' },
            { name: 'title', type: 'string', required: true, description: 'Book title' },
            {
              name: 'status',
              type: 'enum',
              required: true,
              description: 'draft | active | retired',
            },
          ],
          verbs: [
            { name: 'Publish', description: 'Publish a draft book.' },
            { name: 'Retire', description: 'Retire an active book.' },
          ],
        },
      ],
    },
    capabilities: [
      {
        name: 'Book.Publish',
        noun: 'Book',
        verb: 'Publish',
        description: 'Publish a draft book to the storefront.',
      },
      {
        name: 'Book.Retire',
        noun: 'Book',
        verb: 'Retire',
        description: 'Remove an active book from sale.',
      },
    ],
    rules: [
      { capability: 'Book.Publish', type: 'access', allow: [{ role: 'editor' }] },
      {
        capability: 'Book.Publish',
        type: 'condition',
        condition: 'book.status == "draft"',
      },
    ],
    outcomes: [
      {
        capability: 'Book.Publish',
        changes: [{ attribute: 'book.status', set: 'active' }],
        emits: ['shop.Book.Published'],
      },
    ],
    causes: [
      {
        capability: 'Book.Publish',
        source: 'user',
        description: 'Editor publishes a book.',
      },
    ],
    signals: [
      {
        name: 'shop.Book.Published',
        capability: 'Book.Publish',
        description: 'Emitted when a book goes live on the storefront.',
        payload: [{ name: 'book_id', type: 'string', required: true }],
      },
    ],
    relationships: [
      {
        name: 'Book.author',
        from: 'Book',
        to: 'Author',
        attribute: 'author_id',
        cardinality: 'many-to-one',
      },
    ],
    positions: [
      {
        name: 'Editor',
        description: 'Reviews and publishes books.',
        roles: ['editor'],
      },
    ],
    persons: [{ name: 'Ada', position: 'Editor' }],
    tasks: [
      {
        name: 'ReviewBook',
        position: 'Editor',
        capability: 'Book.Publish',
        description: 'Editor reviews the draft.',
      },
      {
        name: 'ApproveBook',
        position: 'Editor',
        capability: 'Book.Publish',
        description: 'Editor approves and publishes.',
      },
      {
        name: 'RejectBook',
        position: 'Editor',
        capability: 'Book.Retire',
        description: 'Editor rejects the draft.',
      },
    ],
    processes: [
      {
        name: 'PublishFlow',
        description: 'How a draft book becomes live.',
        operator: 'Editor',
        steps: [
          { id: 'review', task: 'ReviewBook' },
          {
            id: 'approve',
            task: 'ApproveBook',
            depends_on: ['review'],
            branch: { when: 'passed' },
          },
          {
            id: 'reject',
            task: 'RejectBook',
            depends_on: ['review'],
            branch: { else: true },
          },
        ],
      },
    ],
  },
}
