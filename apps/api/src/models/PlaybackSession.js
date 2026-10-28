import mongoose from 'mongoose';

// One live session per account: blocks two people watching with the same login at the same time.
// Progress pings refresh lastSeenAt; the TTL index cleans up abandoned sessions.
const playbackSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    deviceId: { type: String, required: true },
    ip: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { collection: 'playback_sessions' },
);

playbackSessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 10 * 60 });

export const PlaybackSession = mongoose.model('PlaybackSession', playbackSessionSchema);
