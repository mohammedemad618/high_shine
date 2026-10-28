// Runs once, on the first start of an empty data volume (official mongo image, initdb phase).
// The application connects with this user: readWrite on the platform database only, never root.
const dbName = process.env.MONGO_DB || 'lectures';
const user = process.env.MONGO_APP_USER;
const pwd = process.env.MONGO_APP_PASSWORD;

if (!user || !pwd) throw new Error('MONGO_APP_USER and MONGO_APP_PASSWORD are required');

db.getSiblingDB(dbName).createUser({
  user,
  pwd,
  roles: [{ role: 'readWrite', db: dbName }],
});
print(`Created application user "${user}" on database "${dbName}"`);
