import mongoose from 'mongoose';
import { COURSE_STATUS } from '@lp/shared';

// Sections are embedded: few per course and always read with it.
const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
});

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    priceIqd: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(COURSE_STATUS), default: COURSE_STATUS.DRAFT },
    coverPath: { type: String, default: null },
    sections: { type: [sectionSchema], default: [] },
    // Updated by the worker whenever a lesson becomes ready, and by the API when one is deleted.
    stats: {
      lessonsCount: { type: Number, default: 0 },
      totalDurationSec: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'courses' },
);

courseSchema.index({ status: 1, createdAt: -1 });
courseSchema.index({ title: 'text', description: 'text' }, { default_language: 'none' });

export const Course = mongoose.model('Course', courseSchema);
