import * as service from './service.js';

const M3U8 = 'application/vnd.apple.mpegurl';

function noStore(res) {
  res.set('Cache-Control', 'private, no-store, max-age=0');
}

export async function start(req, res) {
  noStore(res);
  res.json(await service.startPlayback(req.valid.params.id, req.user, req.deviceId, req.ip));
}

export async function master(req, res) {
  const body = await service.getMaster(req.valid.params.lessonId, req.query.t);
  noStore(res);
  res.type(M3U8).send(body);
}

export async function variant(req, res) {
  const { lessonId, variant } = req.valid.params;
  const body = await service.getVariant(lessonId, variant, req.query.t);
  noStore(res);
  res.type(M3U8).send(body);
}

export async function key(req, res) {
  const buffer = await service.getKey(req.valid.params.lessonId, req.query.t);
  noStore(res);
  res.type('application/octet-stream').send(buffer);
}
