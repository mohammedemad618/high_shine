import { MongoClient, ObjectId } from 'mongodb';

// The worker uses the plain driver on the API's collections (no Mongoose schemas duplicated here).
let client;
let db;

export async function connect(uri) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  db = client.db();
  return db;
}

export async function close() {
  await client?.close();
}

export const collections = () => ({
  lessons: db.collection('lessons'),
  courses: db.collection('courses'),
  mediaKeys: db.collection('media_keys'),
});

export const toId = (id) => (id instanceof ObjectId ? id : new ObjectId(String(id)));

export async function updateLesson(lessonId, set) {
  await collections().lessons.updateOne({ _id: toId(lessonId) }, { $set: { ...set, updatedAt: new Date() } });
}

/** Same calculation as the API's refreshCourseStats: count and total duration of playable lessons (with HLS). */
export async function refreshCourseStats(courseId) {
  const { lessons, courses } = collections();
  const [agg] = await lessons
    .aggregate([
      { $match: { courseId: toId(courseId), 'video.hlsPath': { $ne: null } } },
      { $group: { _id: null, count: { $sum: 1 }, duration: { $sum: { $ifNull: ['$video.durationSec', 0] } } } },
    ])
    .toArray();
  await courses.updateOne(
    { _id: toId(courseId) },
    { $set: { 'stats.lessonsCount': agg?.count ?? 0, 'stats.totalDurationSec': Math.round(agg?.duration ?? 0) } },
  );
}
