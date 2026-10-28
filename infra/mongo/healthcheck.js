// Docker healthcheck: initiates the single-node replica set the first time, then reports its health.
try {
  const status = rs.status();
  if (status.myState !== 1) quit(1); // not PRIMARY yet
} catch (e) {
  if (e.codeName === 'NotYetInitialized') {
    rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] });
    quit(1); // healthy on the next check, once it has become primary
  }
  throw e;
}
