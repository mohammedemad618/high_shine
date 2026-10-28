import * as service from './service.js';

export async function save(req, res) {
  res.json(await service.saveProgress(req.valid.params.id, req.valid.body, req.user, req.deviceId));
}
