import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LESSON_STATUS } from '@lp/shared';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Lesson } from '../src/models/index.js';
import * as workerDb from '../../worker/src/db.js';
import { transcodeLesson } from '../../worker/src/jobs/transcode.js';
import { createStaff, register, startDb, stopDb, useQueueStub } from './helpers.js';

const exec = promisify(execFile);
const b64 = (s) => Buffer.from(s).toString('base64');

let db;
let server;
let base;
let jobs;
let sample;

beforeAll(async () => {
  db = await startDb();
  await workerDb.connect(db.uri);
  jobs = useQueueStub();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/v1`;

  // 14 s of 720p test pattern with a tone: enough for 3 segments per rendition.
  sample = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'lp-sample-')), 'lecture.mp4');
  await exec('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '14', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', sample,
  ]);
});

afterAll(async () => {
  server?.close();
  await workerDb.close();
  await stopDb(db);
});

async function api(method, url, token, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe('video pipeline end to end', () => {
  it('uploads with tus, transcodes to encrypted HLS and plays back through signed links', async () => {
    // supertest accepts the live http.Server, so the helpers can share it with the tus requests below
    const live = server;
    const teacher = await createStaff(live, { role: 'teacher', phone: '07709000001' });

    const course = await api('POST', '/courses', teacher.accessToken, { title: 'فيزياء', sections: [{ title: 'الحركة' }] });
    const courseId = course.body.course.id;
    await api('POST', `/courses/${courseId}/publish`, teacher.accessToken, { published: true });
    const lesson = await api('POST', `/courses/${courseId}/lessons`, teacher.accessToken, {
      title: 'المحاضرة 1',
      sectionId: course.body.sections[0].id,
      isFreePreview: true,
    });
    const lessonId = lesson.body.lesson.id;

    // --- tus: create, upload the first half, ask for the offset, upload the rest (a resumed upload) ---
    const file = await fs.readFile(sample);
    const tusHeaders = { 'Tus-Resumable': '1.0.0', Authorization: `Bearer ${teacher.accessToken}` };
    const create = await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: {
        ...tusHeaders,
        'Upload-Length': String(file.length),
        'Upload-Metadata': `lessonId ${b64(lessonId)},filename ${b64('lecture.mp4')}`,
      },
    });
    expect(create.status).toBe(201);
    const location = new URL(create.headers.get('location'), base).toString();
    expect((await Lesson.findById(lessonId)).status).toBe(LESSON_STATUS.UPLOADING);

    const half = Math.floor(file.length / 2);
    const patch = (offset, chunk) =>
      fetch(location, {
        method: 'PATCH',
        headers: { ...tusHeaders, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
        body: chunk,
      });
    expect((await patch(0, file.subarray(0, half))).status).toBe(204);
    const head = await fetch(location, { method: 'HEAD', headers: tusHeaders });
    expect(Number(head.headers.get('upload-offset'))).toBe(half);
    expect((await patch(half, file.subarray(half))).status).toBe(204);

    let row = await Lesson.findById(lessonId);
    expect(row.status).toBe(LESSON_STATUS.QUEUED);
    expect(jobs.at(-1).data.lessonId).toBe(lessonId);

    // A different teacher cannot touch this upload.
    const intruder = await createStaff(live, { role: 'teacher', phone: '07709000002' });
    const stolen = await fetch(location, {
      method: 'HEAD',
      headers: { 'Tus-Resumable': '1.0.0', Authorization: `Bearer ${intruder.accessToken}` },
    });
    expect(stolen.status).toBe(403);

    // --- worker: the job the API queued ---
    const result = await transcodeLesson(lessonId, { log: { warn() {}, info() {} } });
    expect(result.renditions).toEqual(['360p', '480p', '720p']);
    row = await Lesson.findById(lessonId);
    expect(row.status).toBe(LESSON_STATUS.READY);
    expect(row.video.durationSec).toBe(14);
    expect(row.processing.progress).toBe(100);
    await fs.access(path.join(env.mediaRoot, row.video.thumbPath));

    // --- student playback ---
    const student = await register(live, { phone: '07709000003', deviceId: 'student-device-1' });
    const play = await api('POST', `/lessons/${lessonId}/playback`, student.accessToken);
    expect(play.status).toBe(200);
    const token = new URL(play.body.playbackUrl).searchParams.get('t');

    const master = await (await fetch(`${base}/play/${lessonId}/master.m3u8?t=${token}`)).text();
    expect(master.match(/#EXT-X-STREAM-INF/g)).toHaveLength(3);

    const variant = await (await fetch(`${base}/play/${lessonId}/v2/index.m3u8?t=${token}`)).text();
    const keyLine = variant.split('\n').find((l) => l.startsWith('#EXT-X-KEY'));
    const iv = Buffer.from(keyLine.match(/IV=0x([0-9a-fA-F]+)/)[1], 'hex');
    const keyUrl = keyLine.match(/URI="([^"]+)"/)[1].replace('http://api.test/api/v1', base);
    const key = Buffer.from(await (await fetch(keyUrl)).arrayBuffer());
    expect(key).toHaveLength(16);

    // Segments on disk are encrypted; decrypting with the served key yields MPEG-TS (sync byte 0x47 every 188 bytes).
    const segUrl = new URL(variant.split('\n').find((l) => l.startsWith('http://media.test/')));
    const encrypted = await fs.readFile(path.join(env.mediaRoot, segUrl.pathname));
    expect(encrypted[0] === 0x47 && encrypted[188] === 0x47).toBe(false);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    const ts = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    expect(ts[0]).toBe(0x47);
    expect(ts[188]).toBe(0x47);

    const clear = path.join(os.tmpdir(), `lp-seg-${Date.now()}.ts`);
    await fs.writeFile(clear, ts);
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,height', '-of', 'csv=p=0', clear]);
    expect(stdout).toContain('h264,720');
    expect(stdout).toContain('aac');
  });
});
