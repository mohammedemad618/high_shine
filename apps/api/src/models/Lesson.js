import mongoose from 'mongoose';
import { LESSON_STATUS } from '@lp/shared';

const renditionSchema = new mongoose.Schema(
  { name: String, height: Number, width: Number, bandwidth: Number },
  { _id: false },
);

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, default: 0 },
});

// A standalone document (not embedded in the course) because the worker updates it while transcoding.
const lessonSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    isFreePreview: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(LESSON_STATUS), default: LESSON_STATUS.DRAFT },
    video: {
      uploadId: { type: String, default: null },
      sourcePath: { type: String, default: null },
      originalName: { type: String, default: null },
      sizeBytes: { type: Number, default: null },
      durationSec: { type: Number, default: null },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      hlsPath: { type: String, default: null },
      thumbPath: { type: String, default: null },
      renditions: { type: [renditionSchema], default: [] },
    },
    processing: {
      progress: { type: Number, default: 0 },
      attempts: { type: Number, default: 0 },
      error: { type: String, default: null },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
    },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true, collection: 'lessons' },
);

lessonSchema.index({ courseId: 1, sectionId: 1, order: 1 });
lessonSchema.index({ status: 1 });

export const Lesson = mongoose.model('Lesson', lessonSchema);
