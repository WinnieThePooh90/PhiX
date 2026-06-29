/**
 * Prisma Client Extension: transparente Feldverschlüsselung wenn DEK im Request-Kontext.
 */
const { getCryptoContext, isCryptoBypassed } = require('./crypto-context');
const { encryptRow, decryptRow } = require('./encrypted-fields');
const { getEncryptedFields } = require('./encryption-registry');

const READ_OPS = new Set(['findMany', 'findFirst', 'findUnique']);
const WRITE_OPS = new Set(['create', 'update', 'upsert']);

function processWriteData(model, data, dek) {
  if (!data || typeof data !== 'object') return data;
  return encryptRow(dek, model, data, { partial: true });
}

function processWriteArgs(model, args, dek) {
  const next = { ...args };
  if (next.data) next.data = processWriteData(model, next.data, dek);
  if (next.create) next.create = processWriteData(model, next.create, dek);
  if (next.update) next.update = processWriteData(model, next.update, dek);
  return next;
}

function processResult(model, result, dek) {
  if (result == null) return result;
  if (Array.isArray(result)) return result.map((r) => decryptRow(dek, model, r));
  return decryptRow(dek, model, result);
}

function createPrismaWithCrypto(basePrisma) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const fields = getEncryptedFields(model);
          if (!fields) return query(args);

          if (isCryptoBypassed()) return query(args);
          const ctx = getCryptoContext();
          const dek = ctx?.dek;
          if (!dek) {
            if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
              throw new Error(`Verschlüsselungskontext fehlt (${model}.${operation})`);
            }
            return query(args);
          }

          let nextArgs = args;
          if (WRITE_OPS.has(operation)) {
            nextArgs = processWriteArgs(model, args, dek);
          }

          const result = await query(nextArgs);
          if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
            return processResult(model, result, dek);
          }
          return result;
        },
      },
    },
  });
}

module.exports = { createPrismaWithCrypto };
