import { ROLES } from '@lp/shared';
import { AppError } from '../utils/AppError.js';

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}

export const isStaff = (user) => user && (user.role === ROLES.TEACHER || user.role === ROLES.ADMIN);

// Teachers may only touch their own courses; admins may touch any.
export function assertCourseOwner(course, user) {
  if (!course) throw AppError.notFound('Course not found');
  if (user.role === ROLES.ADMIN) return;
  if (user.role === ROLES.TEACHER && String(course.teacherId) === String(user._id)) return;
  throw AppError.forbidden();
}
