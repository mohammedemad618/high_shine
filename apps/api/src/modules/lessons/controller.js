import * as service from './service.js';

export async function create(req, res) {
  res.status(201).json(await service.createLesson(req.valid.params.id, req.valid.body, req.user));
}

export async function get(req, res) {
  res.json(await service.getLesson(req.valid.params.id, req.user));
}

export async function update(req, res) {
  res.json(await service.updateLesson(req.valid.params.id, req.valid.body, req.user));
}

export async function remove(req, res) {
  await service.deleteLesson(req.valid.params.id, req.user);
  res.status(204).end();
}

export async function status(req, res) {
  res.json(await service.lessonStatus(req.valid.params.id, req.user));
}

export async function reprocess(req, res) {
  res.json(await service.reprocess(req.valid.params.id, req.user));
}

export async function addAttachment(req, res) {
  res.status(201).json(await service.addAttachment(req.valid.params.id, req.file, req.user));
}

export async function removeAttachment(req, res) {
  const { id, attachmentId } = req.valid.params;
  res.json(await service.removeAttachment(id, attachmentId, req.user));
}
