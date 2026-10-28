import * as service from './service.js';

export async function list(req, res) {
  res.json(await service.listCourses(req.valid.query, req.user));
}

export async function get(req, res) {
  res.json(await service.getCourseDetails(req.valid.params.id, req.user));
}

export async function create(req, res) {
  res.status(201).json(await service.createCourse(req.valid.body, req.user));
}

export async function update(req, res) {
  res.json(await service.updateCourse(req.valid.params.id, req.valid.body, req.user));
}

export async function publish(req, res) {
  res.json(await service.setPublished(req.valid.params.id, req.valid.body.published, req.user));
}

export async function cover(req, res) {
  res.json(await service.setCover(req.valid.params.id, req.file, req.user));
}

export async function stats(req, res) {
  res.json(await service.courseStats(req.valid.params.id, req.user));
}
