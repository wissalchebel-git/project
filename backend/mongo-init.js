db = db.getSiblingDB('security-portal');
db.createUser({
  user: 'root',
  pwd: 'password',
  roles: [{ role: 'readWrite', db: 'security-portal' }],
});
