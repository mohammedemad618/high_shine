import { ERROR_CODES, errorMessage } from '@lp/shared';

// Neutral wording for content the student has no access to. App Store rule 3.1.1: no purchase or
// activation hints in the app, so this overrides the shared NOT_ENROLLED message.
export const SUBSCRIBERS_ONLY = 'هذا المحتوى متاح للمشتركين';

const NETWORK_MESSAGE = 'تعذّر الاتصال بالخادم، تحقق من الإنترنت';

/** Arabic message for any thrown error (ApiError or otherwise). */
export function messageFor(err) {
  if (!err) return errorMessage(ERROR_CODES.INTERNAL);
  if (err.code === 'NETWORK') return NETWORK_MESSAGE;
  if (err.code === ERROR_CODES.NOT_ENROLLED) return SUBSCRIBERS_ONLY;
  return errorMessage(err.code);
}
