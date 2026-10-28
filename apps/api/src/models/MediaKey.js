import mongoose from 'mongoose';

// AES-128 keys live only here, never on disk, so Nginx can never serve one by mistake.
// Only the playback module and the worker read this collection.
const mediaKeySchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, unique: true },
    key: { type: Buffer, required: true, select: false },
    iv: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'media_keys' },
);

export const MediaKey = mongoose.model('MediaKey', mediaKeySchema);
