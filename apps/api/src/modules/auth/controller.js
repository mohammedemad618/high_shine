import * as service from './service.js';

export async function register(req, res) {
  res.status(201).json(await service.register(req.valid.body));
}

export async function login(req, res) {
  res.json(await service.login(req.valid.body));
}

export async function refresh(req, res) {
  res.json(await service.refresh(req.valid.body));
}

export async function logout(req, res) {
  await service.logout(req.user, req.deviceId);
  res.status(204).end();
}
