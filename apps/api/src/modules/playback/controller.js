import * as service from './service.js';

const M3U8 = 'application/vnd.apple.mpegurl';

function noStore(res) {
  res.set('Cache-Control', 'private, no-store, max-age=0');
}

export async function start(req, res) {
  noStore(res);
  res.json(await service.startPlayback(req.valid.params.id, req.user, req.deviceId, req.ip));
}

export async function end(req, res) {
  await service.endPlayback(req.valid.params.id, req.user, req.deviceId);
  res.status(204).end();
}

export async function attachmentLink(req, res) {
  noStore(res);
  const { id, attachmentId } = req.valid.params;
  res.json(await service.attachmentLink(id, attachmentId, req.user, req.deviceId));
}

export async function attachmentFile(req, res) {
  const { id, attachmentId } = req.valid.params;
  const file = await service.attachmentFile(id, attachmentId, req.query.t);
  noStore(res);
  res
    .type(file.type)
    .set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`)
    .send(file.body);
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
