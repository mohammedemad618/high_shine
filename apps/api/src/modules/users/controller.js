import * as service from './service.js';

export async function me(req, res) {
  res.json({ user: req.user.toPublic(), currentDeviceId: req.deviceId });
}

export async function changePassword(req, res) {
  await service.changePassword(req.user, req.deviceId, req.valid.body);
  res.status(204).end();
}

export async function deleteAccount(req, res) {
  await service.deleteAccount(req.user, req.valid.body);
  res.status(204).end();
}

export async function appConfig(_req, res) {
  res.set('Cache-Control', 'public, max-age=300').json(service.appConfig());
}
