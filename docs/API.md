# API reference (`/api/v1`)

Base URL: `${API_URL}` = `https://api.example.com/api/v1` (dev: `http://localhost:4000/api/v1`).
All bodies are JSON. Dates are ISO 8601 strings. Ids are 24-char hex strings.
Shared constants (roles, statuses, error codes, Arabic error messages) live in `packages/shared` (`@lp/shared`).

## Errors

Every error response is:

```json
{ "error": { "code": "DEVICE_LIMIT", "message": "...", "details": [] } }
```

Show `errorMessage(code)` from `@lp/shared` to the user (Arabic). Notable codes:
`TOKEN_EXPIRED` (401 → call `/auth/refresh` then retry once), `DEVICE_REVOKED` / `REFRESH_INVALID` (log out),
`DEVICE_LIMIT`, `NOT_ENROLLED`, `CONCURRENT_PLAYBACK`, `LESSON_NOT_READY`, `CODE_*`, `ALREADY_ENROLLED`.

## Auth

Access token: JWT, 15 minutes, header `Authorization: Bearer <accessToken>`.
Refresh token: opaque string, 30 days, rotated on every refresh (the old one stops working — store the new one).
Every login/register sends a stable per-install `deviceId` (8–128 chars). Accounts are limited to `maxDevices`
devices (default 2); only an admin can clear them. Logout does NOT free the device slot.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{name, phone, password(min 8), deviceId, deviceName?, platform?: ios\|android\|web\|other}` | 201 `AuthResult` |
| POST | `/auth/login` | `{phone, password, deviceId, deviceName?, platform?, audience?: 'staff'}` | `AuthResult`. The dashboard sends `audience: 'staff'` so students get 403 before a device slot is used |
| POST | `/auth/refresh` | `{refreshToken}` | `AuthResult` |
| POST | `/auth/logout` | – (auth) | 204 |
| GET | `/me` | – (auth) | `{user: User, currentDeviceId}` |

```ts
type AuthResult = { user: User; accessToken: string; refreshToken: string };
type User = {
  id: string; name: string; phone: string;
  role: 'student' | 'teacher' | 'admin'; status: 'active' | 'suspended';
  maxDevices: number;
  devices: { deviceId: string; name: string; platform: string; addedAt: string; lastSeenAt: string }[];
  createdAt: string;
};
```

## Courses

```ts
type CourseSummary = {
  id: string; title: string; slug: string; description: string; priceIqd: number;
  status: 'draft' | 'published' | 'hidden'; coverUrl: string | null;
  teacher: { id: string; name?: string };
  stats: { lessonsCount: number; totalDurationSec: number };
  createdAt: string; updatedAt: string;
};
type LessonSummary = {
  id: string; sectionId: string; title: string; order: number; isFreePreview: boolean;
  durationSec: number | null; thumbUrl: string | null; attachmentsCount: number;
  progress?: { positionSec: number; completed: boolean };      // students only, when they watched it
  // staff (course owner / admin) only:
  status?: 'draft' | 'uploading' | 'queued' | 'processing' | 'ready' | 'failed';
  processing?: { progress: number; attempts: number; error: string | null };
  video?: { originalName: string | null; sizeBytes: number | null; width: number | null; height: number | null;
            renditions: { name: string; height: number }[]; hasSource: boolean };
  attachments?: { id: string; name: string; size: number }[];
};
type CourseDetails = {
  course: CourseSummary;
  sections: { id: string; title: string; order: number; lessons: LessonSummary[] }[];
  canManage: boolean;
  enrollment: { id: string; expiresAt: string | null } | null;   // students only
};
```

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/courses?q=&page=&limit=&teacherId=` | optional | Published courses → `{items: CourseSummary[], page, limit, total}` |
| GET | `/courses?mine=true` | teacher/admin | Teacher: own courses, any status. Admin: all courses |
| GET | `/courses/:idOrSlug` | optional | `CourseDetails`. Students see only `ready` lessons. Send the token so `enrollment` and `progress` are filled |
| POST | `/courses` | teacher/admin | `{title, description?, priceIqd?, sections?: [{title}], teacherId? (admin only)}` → 201 `CourseDetails` |
| PATCH | `/courses/:id` | owner | `{title?, description?, priceIqd?, sections?: [{_id?, title}], lessonOrder?: [{lessonId, sectionId, order}]}` → `CourseDetails`. `sections` is the full ordered list; new sections have no `_id`; a removed section must be empty |
| POST | `/courses/:id/publish` | owner | `{published: boolean}` → `{course}` |
| POST | `/courses/:id/cover` | owner | multipart, field `file` (jpeg/png/webp ≤ 5 MB) → `{course}` |
| GET | `/courses/:id/stats` | owner | `{activeEnrollments, watchHours, lessons: [{id, title, viewers, completions, watchHours}]}` |

## Lessons (course owner or admin)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/courses/:id/lessons` | `{title, sectionId, isFreePreview?}` | 201 `{lesson}` (status `draft`) |
| GET | `/lessons/:id` | – | `{lesson}` (staff shape) |
| PATCH | `/lessons/:id` | `{title?, sectionId?, order?, isFreePreview?}` | `{lesson}` |
| DELETE | `/lessons/:id` | – | 204 (removes HLS, key, files). 409 `INVALID_STATE` while processing |
| GET | `/lessons/:id/status` | – | `{id, status, processing: {progress, attempts, error}}` — poll every ~3 s while queued/processing |
| POST | `/lessons/:id/reprocess` | – | `{lesson}` — only from `failed` or `ready` and while the source file is kept |
| POST | `/lessons/:id/attachments` | multipart field `file` (PDF ≤ 50 MB) | 201 `{lesson}` |
| DELETE | `/lessons/:id/attachments/:attachmentId` | – | `{lesson}` |

### Video upload (tus, resumable)

Endpoint: `${API_URL}/uploads` (tus 1.0.0). Use Uppy + `@uppy/tus`:

```js
uppy.use(Tus, {
  endpoint: `${API_URL}/uploads`,
  chunkSize: 50 * 1024 * 1024,            // UPLOAD_CHUNK_BYTES from @lp/shared
  retryDelays: [0, 3000, 10000, 30000],
  // The access token lives 15 min and a big upload takes longer: set a fresh token on EVERY request.
  async onBeforeRequest(req) { req.setHeader('Authorization', `Bearer ${await getFreshAccessToken()}`); },
});
uppy.setFileMeta(fileId, { lessonId, filename: file.name });   // lessonId is required
```

Flow: create lesson → upload with `meta.lessonId` → lesson goes `uploading` → `queued` when the upload finishes →
`processing` (with `processing.progress` 0–100) → `ready` or `failed` (`processing.error`).

## Enrollments (students)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/enrollments/redeem` | `{code}` (any case/spacing; stored as `XXXX-XXXX-XXXX`) | 201 `{course: CourseSummary, enrollment: {id, expiresAt}}` |
| GET | `/me/courses` | – | `{items: [{course, enrollment: {id, expiresAt}, completedLessons, totalLessons, percent, continueLesson: {id, title, positionSec} \| null}]}` |

The iOS app must NOT contain the redeem screen or any purchase wording (App Store rule 3.1.1). Codes are redeemed on the website.

## Playback

1. `POST /lessons/:id/playback` (auth) →
```ts
{
  lesson: { id, title, courseId },
  playbackUrl: string,          // https://api.../api/v1/play/<lessonId>/master.m3u8?t=<token> — give it to the player as-is
  expiresAt: string,            // token lifetime (4 h); request a new one after that
  durationSec: number,
  renditions: { name: '360p'|'480p'|'720p', height: number }[],
  resumePositionSec: number,    // seek here on start
  watermark: { text: string, userId: string },  // draw it over the video, moving every few seconds
  attachments: { id, name, size, url }[],       // signed links, valid until expiresAt
}
```
Errors: 403 `NOT_ENROLLED`, 409 `LESSON_NOT_READY`, 409 `CONCURRENT_PLAYBACK` (the account is playing on another device right now).

2. The player loads `playbackUrl`. The playlists, the AES-128 key and the Nginx-signed segments need no headers.
   Native HLS (Safari, iOS AVPlayer, Android ExoPlayer) and hls.js both work.

3. While playing, every 15 s (`PROGRESS_PING_SECONDS`) and on pause/exit:
   `POST /lessons/:id/progress` `{positionSec, watchedDeltaSec}` → `{positionSec, completed, watchedSec}`.
   `watchedDeltaSec` = seconds actually played since the last ping. This ping also keeps the playback session alive;
   without it another device can take over after ~60 s.

## Admin (role admin)

| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/admin/teachers` | `{name, phone, password}` | 201 `{user}` |
| GET | `/admin/users?role=&status=&q=&page=&limit=` | | `{items: User[], page, limit, total}` |
| GET | `/admin/users/:id` | | `{user, enrollments: [{id, course: {id,title}, status, source, startsAt, expiresAt}]}` |
| PATCH | `/admin/users/:id` | `{name?, status?: active\|suspended, maxDevices?, password?}` | `{user}` |
| DELETE | `/admin/users/:id/devices` | | `{user}` — unbinds all devices, ends all sessions |
| POST | `/admin/codes[?format=csv]` | `{courseId, count (1–5000), batchLabel, durationDays?: number\|null, maxUses?: 1, expiresAt?: ISO\|null}` | JSON `{courseId, batchLabel, count, codes: string[]}` or a CSV file download |
| GET | `/admin/codes?courseId=` | | `{items: [{courseId, courseTitle, batchLabel, total, used, durationDays, createdAt}]}` |
| GET | `/admin/codes?courseId=&batchLabel=&format=csv` | | CSV download (`code,course,batch,durationDays,maxUses,usedCount,expiresAt`) |
| GET | `/admin/enrollments?courseId=&userId=&page=&limit=` | | `{items: [{id, user:{id,name,phone}, course:{id,title}, status, source, startsAt, expiresAt, createdAt}], page, limit, total}` |
| POST | `/admin/enrollments` | `{userId, courseId, durationDays?: number\|null}` | 201 `{enrollment}` |
| PATCH | `/admin/enrollments/:id` | `{status?: active\|revoked, expiresAt?: ISO\|null}` | `{enrollment}` |
| GET | `/admin/stats` | | `{students, teachers, courses, publishedCourses, lessons, activeEnrollments, watchHours, codes: {total, redeemed}}` |

CSV downloads need the `Authorization` header, so fetch them with `fetch()` and save the blob (not a plain link).

## Media URLs

`coverUrl` and `thumbUrl` are public (`https://media.example.com/covers/...`, `/thumbs/...`).
HLS segments and attachments are only reachable through signed, expiring links handed out by the API.
