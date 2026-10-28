import { z } from 'zod';

// Codes are stored as XXXX-XXXX-XXXX; accept any spacing, dashes or case from the student.
export function normalizeCode(raw) {
  const compact = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.match(/.{1,4}/g)?.join('-') ?? '';
}

export const redeemSchema = z.object({
  code: z.string().trim().min(4).max(40).transform(normalizeCode),
});
