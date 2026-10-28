import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LESSON_STATUS } from '@lp/shared';
import { createApp } from '../src/app.js';
import { mediaPaths } from '../src/config/env.js';
import { Lesson, MediaKey, RefreshToken } from '../src/models/index.js';
import { auth, createStaff, login, register, startDb, stopDb, useQueueStub } from './helpers.js';

let db;
let app;
let jobs;
let admin;
let teacher;
let otherTeacher;

beforeAll(async () => {
  db = await startDb();
  jobs = useQueueStub();
  app = createApp();
  admin = await createStaff(app, { role: 'admin', phone: '07700000001' });
  teacher = await createStaff(app, { role: 'teacher', phone: '07700000002', name: 'أ. أحمد' });
  otherTeacher = await createStaff(app, { role: 'teacher', phone: '07700000003' });
});

afterAll(async () => {
  await stopDb(db);
});

describe('auth and devices', () => {
  it('registers, enforces the device limit and lets an admin clear devices', async () => {
    const reg = await register(app, { phone: '07701000001', deviceId: 'phone-aaaaaaaa' });
    expect(reg.user.role).toBe('student');
    expect(reg.user.devices).toHaveLength(1);

    // second device: allowed (limit 2); same device again: still fine
    expect((await login(app, { phone: '07701000001', deviceId: 'laptop-bbbbbbbb' })).status).toBe(200);
    expect((await login(app, { phone: '07701000001', deviceId: 'phone-aaaaaaaa' })).status).toBe(200);

    const third = await login(app, { phone: '07701000001', deviceId: 'tablet-cccccccc' });
    expect(third.status).toBe(403);
    expect(third.body.error.code).toBe('DEVICE_LIMIT');

    // the dashboard login refuses students before binding a device
    const dashboard = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '07701000001', password: 'password123', deviceId: 'tablet-cccccccc', audience: 'staff' });
    expect(dashboard.status).toBe(403);

    const wrong = await login(app, { phone: '07701000001', password: 'nope-nope', deviceId: 'phone-aaaaaaaa' });
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    // admin clears devices → the old access token stops working immediately
    const cleared = await request(app)
      .delete(`/api/v1/admin/users/${reg.user.id}/devices`)
      .set(auth(admin.accessToken));
    expect(cleared.status).toBe(200);
    const me = await request(app).get('/api/v1/me').set(auth(reg.accessToken));
    expect(me.body.error.code).toBe('DEVICE_REVOKED');
    expect((await login(app, { phone: '07701000001', deviceId: 'tablet-cccccccc' })).status).toBe(200);
  });

  it('rotates refresh tokens and revokes the device on reuse', async () => {
    const reg = await register(app, { phone: '07701000002', deviceId: 'phone-dddddddd' });
    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(reg.refreshToken);

    // replaying the rotated token is treated as theft
    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: reg.refreshToken });
    expect(replay.body.error.code).toBe('REFRESH_INVALID');
    const afterTheft = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(afterTheft.status).toBe(401);

    // only hashes are stored
    expect(await RefreshToken.exists({ tokenHash: reg.refreshToken })).toBeNull();
  });

  it('rejects duplicate phones and bad input', async () => {
    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'x y', phone: '07701000002', password: 'password123', deviceId: 'zzzzzzzzzz' });
    expect(dup.body.error.code).toBe('PHONE_TAKEN');
    const bad = await request(app).post('/api/v1/auth/register').send({ phone: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION');
  });
});

describe('courses, lessons, codes, playback', () => {
  let courseId;
  let sectionId;
  let lessonId;
  let student;

  it('lets a teacher build a course and blocks other teachers', async () => {
    const created = await request(app)
      .post('/api/v1/courses')
      .set(auth(teacher.accessToken))
      .send({ title: 'رياضيات السادس الإعدادي', priceIqd: 25000, sections: [{ title: 'الفصل الأول' }] });
    expect(created.status).toBe(201);
    courseId = created.body.course.id;
    sectionId = created.body.sections[0].id;

    const lesson = await request(app)
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set(auth(teacher.accessToken))
      .send({ title: 'المحاضرة 1: المشتقات', sectionId });
    expect(lesson.status).toBe(201);
    expect(lesson.body.lesson.status).toBe(LESSON_STATUS.DRAFT);
    lessonId = lesson.body.lesson.id;

    const foreign = await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set(auth(otherTeacher.accessToken))
      .send({ title: 'hijack' });
    expect(foreign.status).toBe(403);

    const studentTry = await request(app).post('/api/v1/courses').set(auth(admin.accessToken)).send({ title: 'admin course' });
    expect(studentTry.status).toBe(201);

    // drafts are invisible to the public
    expect((await request(app).get(`/api/v1/courses/${courseId}`)).status).toBe(404);
    await request(app).post(`/api/v1/courses/${courseId}/publish`).set(auth(teacher.accessToken)).send({ published: true });
    const list = await request(app).get('/api/v1/courses');
    expect(list.body.items.map((c) => c.id)).toContain(courseId);
  });

  it('reorders sections and lessons and refuses to drop a section that has lessons', async () => {
    const res = await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set(auth(teacher.accessToken))
      .send({ sections: [{ title: 'مقدمة' }, { _id: sectionId, title: 'الفصل الأول' }] });
    expect(res.status).toBe(200);
    expect(res.body.sections.map((s) => s.title)).toEqual(['مقدمة', 'الفصل الأول']);
    const introId = res.body.sections[0].id;

    const moved = await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set(auth(teacher.accessToken))
      .send({ lessonOrder: [{ lessonId, sectionId: introId, order: 0 }] });
    expect(moved.body.sections[0].lessons[0].id).toBe(lessonId);

    const drop = await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set(auth(teacher.accessToken))
      .send({ sections: [{ _id: sectionId, title: 'الفصل الأول' }] });
    expect(drop.status).toBe(409);
    sectionId = introId;
  });

  it('generates codes and redeems them inside a transaction (no double use)', async () => {
    const gen = await request(app)
      .post('/api/v1/admin/codes')
      .set(auth(admin.accessToken))
      .send({ courseId, count: 3, batchLabel: 'دفعة-1', durationDays: 30 });
    expect(gen.status).toBe(201);
    expect(gen.body.codes).toHaveLength(3);
    expect(gen.body.codes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const csv = await request(app)
      .get(`/api/v1/admin/codes?courseId=${courseId}&batchLabel=${encodeURIComponent('دفعة-1')}&format=csv`)
      .set(auth(admin.accessToken));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\n').filter(Boolean)).toHaveLength(4);

    // five students race for one single-use code: exactly one wins
    const racers = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => register(app, { phone: `0772000000${i}`, deviceId: `race-device-${i}` })),
    );
    const code = gen.body.codes[0];
    const results = await Promise.all(
      racers.map((r) => request(app).post('/api/v1/enrollments/redeem').set(auth(r.accessToken)).send({ code: code.toLowerCase().replace(/-/g, ' ') })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status !== 201).every((r) => r.body.error.code === 'CODE_USED_UP')).toBe(true);

    student = racers[results.findIndex((r) => r.status === 201)];
    const again = await request(app).post('/api/v1/enrollments/redeem').set(auth(student.accessToken)).send({ code: gen.body.codes[1] });
    expect(again.status).toBe(201); // a second time-limited code extends the enrollment
    const invalid = await request(app).post('/api/v1/enrollments/redeem').set(auth(student.accessToken)).send({ code: 'AAAA-BBBB-CCCC' });
    expect(invalid.body.error.code).toBe('CODE_INVALID');

    const mine = await request(app).get('/api/v1/me/courses').set(auth(student.accessToken));
    expect(mine.body.items).toHaveLength(1);
    const days = (new Date(mine.body.items[0].enrollment.expiresAt) - Date.now()) / 86400000;
    expect(Math.round(days)).toBe(60);
  });

  it('serves a ready lesson only to enrolled students, with signed URLs and a per-lesson key', async () => {
    // Fake a finished transcode: playlists as FFmpeg writes them, and a key in Mongo.
    const dir = path.join(mediaPaths.hls, lessonId);
    await fs.mkdir(path.join(dir, 'v0'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'master.m3u8'),
      '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-STREAM-INF:BANDWIDTH=464000,RESOLUTION=640x360\nv0/index.m3u8\n',
    );
    await fs.writeFile(
      path.join(dir, 'v0', 'index.m3u8'),
      '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:6\n#EXT-X-PLAYLIST-TYPE:VOD\n' +
        '#EXT-X-KEY:METHOD=AES-128,URI="KEY_URI",IV=0x00000000000000000000000000000001\n' +
        '#EXTINF:6.000000,\nseg_00000.ts\n#EXTINF:4.000000,\nseg_00001.ts\n#EXT-X-ENDLIST\n',
    );
    const key = crypto.randomBytes(16);
    await MediaKey.create({ lessonId, key, iv: '00000000000000000000000000000001' });
    await Lesson.updateOne(
      { _id: lessonId },
      { status: LESSON_STATUS.READY, 'video.durationSec': 100, 'video.renditions': [{ name: '360p', height: 360 }] },
    );

    const outsider = await register(app, { phone: '07703000001', deviceId: 'outsider-device' });
    const denied = await request(app).post(`/api/v1/lessons/${lessonId}/playback`).set(auth(outsider.accessToken));
    expect(denied.body.error.code).toBe('NOT_ENROLLED');

    const play = await request(app).post(`/api/v1/lessons/${lessonId}/playback`).set(auth(student.accessToken));
    expect(play.status).toBe(200);
    expect(play.body.watermark.text).toContain(student.user.phone);
    const url = new URL(play.body.playbackUrl);
    const token = url.searchParams.get('t');

    const master = await request(app).get(`/api/v1/play/${lessonId}/master.m3u8?t=${token}`);
    expect(master.headers['content-type']).toMatch(/mpegurl/);
    expect(master.text).toContain(`v0/index.m3u8?t=${encodeURIComponent(token)}`);

    const variant = await request(app).get(`/api/v1/play/${lessonId}/v0/index.m3u8?t=${token}`);
    expect(variant.text).toContain(`URI="http://api.test/api/v1/play/${lessonId}/key?t=`);
    const segLine = variant.text.split('\n').find((l) => l.includes('seg_00000.ts'));
    const seg = new URL(segLine);
    expect(seg.origin).toBe('http://media.test');
    // the same md5 Nginx computes: base64url(md5(expires + uri + " " + secret))
    const expected = crypto
      .createHash('md5')
      .update(`${seg.searchParams.get('expires')}${seg.pathname} test-secure-link-secret`)
      .digest('base64url');
    expect(seg.searchParams.get('md5')).toBe(expected);

    const keyRes = await request(app).get(`/api/v1/play/${lessonId}/key?t=${token}`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(keyRes.headers['cache-control']).toMatch(/no-store/);
    expect(Buffer.compare(keyRes.body, key)).toBe(0);

    // a token for this lesson does not open another lesson, and a forged token is refused
    expect((await request(app).get(`/api/v1/play/${courseId}/key?t=${token}`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/play/${lessonId}/key?t=forged`)).status).toBe(401);
  });

  it('blocks simultaneous playback from a second device and records progress', async () => {
    const second = await login(app, { phone: student.user.phone, deviceId: 'second-device-xyz' });
    expect(second.status).toBe(200);
    const blocked = await request(app).post(`/api/v1/lessons/${lessonId}/playback`).set(auth(second.body.accessToken));
    expect(blocked.body.error.code).toBe('CONCURRENT_PLAYBACK');

    const p1 = await request(app)
      .post(`/api/v1/lessons/${lessonId}/progress`)
      .set(auth(student.accessToken))
      .send({ positionSec: 40, watchedDeltaSec: 15 });
    expect(p1.body).toMatchObject({ positionSec: 40, completed: false, watchedSec: 15 });
    const p2 = await request(app)
      .post(`/api/v1/lessons/${lessonId}/progress`)
      .set(auth(student.accessToken))
      .send({ positionSec: 95, watchedDeltaSec: 500 });
    expect(p2.body.completed).toBe(true);
    expect(p2.body.watchedSec).toBe(45); // delta capped at 30

    const replay = await request(app).post(`/api/v1/lessons/${lessonId}/playback`).set(auth(student.accessToken));
    expect(replay.body.resumePositionSec).toBe(0); // completed lessons restart from the beginning

    const details = await request(app).get(`/api/v1/courses/${courseId}`).set(auth(student.accessToken));
    expect(details.body.enrollment).not.toBeNull();
    expect(details.body.sections[0].lessons[0].progress.completed).toBe(true);
    expect(details.body.sections[0].lessons[0].status).toBeUndefined(); // no staff fields for students

    const stats = await request(app).get(`/api/v1/courses/${courseId}/stats`).set(auth(teacher.accessToken));
    expect(stats.body.activeEnrollments).toBe(1);
    expect(stats.body.lessons[0].completions).toBe(1);
  });

  it('queues a reprocess and deletes a lesson with its files and key', async () => {
    const re = await request(app).post(`/api/v1/lessons/${lessonId}/reprocess`).set(auth(teacher.accessToken));
    expect(re.status).toBe(409); // no source file in this test
    await Lesson.updateOne({ _id: lessonId }, { 'video.sourcePath': 'uploads/fake' });
    const ok = await request(app).post(`/api/v1/lessons/${lessonId}/reprocess`).set(auth(teacher.accessToken));
    expect(ok.body.lesson.status).toBe(LESSON_STATUS.QUEUED);
    expect(jobs.at(-1).data.lessonId).toBe(lessonId);

    await Lesson.updateOne({ _id: lessonId }, { status: LESSON_STATUS.READY });
    const del = await request(app).delete(`/api/v1/lessons/${lessonId}`).set(auth(teacher.accessToken));
    expect(del.status).toBe(204);
    expect(await MediaKey.exists({ lessonId })).toBeNull();
    await expect(fs.access(path.join(mediaPaths.hls, lessonId))).rejects.toThrow();
  });

  it('reports platform stats to admins only', async () => {
    const res = await request(app).get('/api/v1/admin/stats').set(auth(admin.accessToken));
    expect(res.body.teachers).toBe(2);
    expect(res.body.codes.total).toBe(3);
    expect((await request(app).get('/api/v1/admin/stats').set(auth(teacher.accessToken))).status).toBe(403);
  });
});
