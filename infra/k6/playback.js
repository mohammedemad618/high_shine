// Load test of the streaming path (phase 8). Each virtual user logs in as a test student, opens a lesson,
// then fetches the playlist, the key and segments at roughly real-time pace, like a player would.
//
//   k6 run -e API=https://api.example.com/api/v1 -e LESSON_ID=<ready lesson id> \
//          -e PHONE_PREFIX=0799000 -e PASSWORD=password123 infra/k6/playback.js
//
// Create the test students first (e.g. 0799000001 … 0799000200) and enroll them, or use a free-preview lesson.
// Every VU needs its own account: one account cannot play on two devices at once (CONCURRENT_PLAYBACK).
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    viewers: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '1m', target: 0 },
    ] },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:segment}': ['p(95)<2000'],
    'http_req_duration{kind:api}': ['p(95)<500'],
  },
};

const API = __ENV.API;
const LESSON_ID = __ENV.LESSON_ID;

export default function () {
  const phone = `${__ENV.PHONE_PREFIX}${String(__VU).padStart(3, '0')}`;
  const headers = { 'Content-Type': 'application/json' };
  const login = http.post(
    `${API}/auth/login`,
    JSON.stringify({ phone, password: __ENV.PASSWORD, deviceId: `k6-device-${__VU}`, platform: 'other' }),
    { headers, tags: { kind: 'api' } },
  );
  if (!check(login, { 'login 200': (r) => r.status === 200 })) return sleep(5);
  const auth = { ...headers, Authorization: `Bearer ${login.json('accessToken')}` };

  const play = http.post(`${API}/lessons/${LESSON_ID}/playback`, null, { headers: auth, tags: { kind: 'api' } });
  if (!check(play, { 'playback 200': (r) => r.status === 200 })) return sleep(5);

  const masterUrl = play.json('playbackUrl');
  const master = http.get(masterUrl, { tags: { kind: 'api' } });
  // pick the lowest rendition, as a phone on a weak connection would
  const variantPath = master.body.split('\n').find((l) => l && !l.startsWith('#'));
  const variantUrl = masterUrl.replace(/master\.m3u8\?.*$/, variantPath);
  const variant = http.get(variantUrl, { tags: { kind: 'api' } });

  const keyUrl = variant.body.match(/URI="([^"]+)"/)[1];
  check(http.get(keyUrl, { tags: { kind: 'api' } }), { 'key is 16 bytes': (r) => r.body && r.body.length === 16 });

  const segments = variant.body.split('\n').filter((l) => l.startsWith('http'));
  for (const segment of segments.slice(0, 20)) {
    check(http.get(segment, { tags: { kind: 'segment' } }), { 'segment 200': (r) => r.status === 200 });
    sleep(6); // one 6-second segment per 6 seconds = real-time playback
  }
}
