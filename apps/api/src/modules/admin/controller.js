import * as service from './service.js';

function sendCsv(res, filename, body) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(body);
}

export async function createTeacher(req, res) {
  res.status(201).json(await service.createTeacher(req.valid.body));
}

export async function listUsers(req, res) {
  res.json(await service.listUsers(req.valid.query));
}

export async function getUser(req, res) {
  res.json(await service.getUser(req.valid.params.id));
}

export async function updateUser(req, res) {
  res.json(await service.updateUser(req.valid.params.id, req.valid.body, req.user));
}

export async function clearDevices(req, res) {
  res.json(await service.clearDevices(req.valid.params.id));
}

export async function generateCodes(req, res) {
  const { course, codes } = await service.generateCodes(req.valid.body, req.user);
  if (req.valid.query.format === 'csv') {
    return sendCsv(res, `codes-${req.valid.body.batchLabel}.csv`, service.codesToCsv(codes, course.title));
  }
  res.status(201).json({
    courseId: String(course._id),
    batchLabel: req.valid.body.batchLabel,
    count: codes.length,
    codes: codes.map((c) => c.code),
  });
}

export async function listCodes(req, res) {
  const { format, courseId, batchLabel } = req.valid.query;
  if (format === 'csv') {
    const codes = await service.findCodes({ courseId, batchLabel });
    return sendCsv(res, `codes-${batchLabel || 'all'}.csv`, service.codesToCsv(codes));
  }
  res.json(await service.listCodeBatches({ courseId }));
}

export async function listEnrollments(req, res) {
  res.json(await service.listEnrollments(req.valid.query));
}

export async function grantEnrollment(req, res) {
  res.status(201).json(await service.grantManually(req.valid.body));
}

export async function updateEnrollment(req, res) {
  res.json(await service.updateEnrollment(req.valid.params.id, req.valid.body));
}

export async function stats(_req, res) {
  res.json(await service.platformStats());
}
