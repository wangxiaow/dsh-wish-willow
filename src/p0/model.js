import { z } from 'zod';

export const editableSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  wish: z.string().max(10000),
  status: z.enum(['draft', 'confirmed', 'archived']),
});
export const productSchema = editableSchema.extend({
  id: z.uuid(),
  schemaVersion: z.literal(1),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const createSchema = editableSchema;
export const updateSchema = editableSchema.extend({
  id: z.uuid(),
  expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER - 1),
});

/** Storage Domain validates records when reopening, not on put/update in rc.2. */
export function parseInput(schema, input, failure) {
  const result = schema.safeParse(input);
  if (!result.success) throw failure('invalid-input', 'Invalid product input', {
    issues: result.error.issues.map(({ path, code }) => ({ path, code })),
  });
  return result.data;
}

/** Business adapter; durability and update serialization belong to DSH. */
export function createProductStore(table, { uuid, now, failure }) {
  return {
    list() {
      return [...table.entries()].map(([, value]) => structuredClone(value))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    },
    async create(input) {
      const fields = parseInput(createSchema, input, failure);
      const time = now();
      const record = productSchema.parse({ ...fields, id: uuid(), schemaVersion: 1,
        revision: 1, createdAt: time, updatedAt: time });
      if (table.get(record.id)) throw failure('id-collision', 'Product ID already exists', {});
      await table.put(record.id, record);
      return structuredClone(record);
    },
    async update(input) {
      const { id, expectedRevision, ...fields } = parseInput(updateSchema, input, failure);
      if (!table.get(id)) throw failure('not-found', 'Product does not exist', { id });
      // Compare inside the DSH serialized mutation, never before entering its queue.
      const record = await table.update(id, current => {
        if (current.revision !== expectedRevision) throw failure('conflict',
          'Product changed; reload before saving', { id, expectedRevision, actualRevision: current.revision });
        return productSchema.parse({ ...current, ...fields, revision: current.revision + 1, updatedAt: now() });
      });
      return structuredClone(record);
    },
  };
}
