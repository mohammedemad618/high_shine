import mongoose from 'mongoose';

// Updated by the player every 15 seconds.
const watchProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    positionSec: { type: Number, default: 0 },
    watchedSec: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'watch_progress' },
);

watchProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
watchProgressSchema.index({ userId: 1, courseId: 1 });
watchProgressSchema.index({ lessonId: 1 });

export const WatchProgress = mongoose.model('WatchProgress', watchProgressSchema);
