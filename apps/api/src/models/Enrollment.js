import mongoose from 'mongoose';
import { ENROLLMENT_SOURCE, ENROLLMENT_STATUS } from '@lp/shared';

const enrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    source: { type: String, enum: Object.values(ENROLLMENT_SOURCE), default: ENROLLMENT_SOURCE.CODE },
    activationCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ActivationCode', default: null },
    startsAt: { type: Date, default: Date.now },
    // null means a permanent enrollment
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: Object.values(ENROLLMENT_STATUS), default: ENROLLMENT_STATUS.ACTIVE },
  },
  { timestamps: true, collection: 'enrollments' },
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

enrollmentSchema.statics.activeFilter = function activeFilter(now = new Date()) {
  return {
    status: ENROLLMENT_STATUS.ACTIVE,
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
};

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
