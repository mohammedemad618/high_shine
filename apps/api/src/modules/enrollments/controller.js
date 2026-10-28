import * as service from './service.js';

export async function redeem(req, res) {
  res.status(201).json(await service.redeem(req.valid.body.code, req.user));
}

export async function myCourses(req, res) {
  res.json(await service.myCourses(req.user));
}
