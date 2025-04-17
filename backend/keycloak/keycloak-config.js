const Keycloak = require('keycloak-connect');
const session = require('express-session');

let keycloak;

const getKeycloak = (options) => {
  if (!keycloak) {
    const {
      KEYCLOAK_REALM,
      KEYCLOAK_SERVER_URL,
      KEYCLOAK_CLIENT_ID,
      KEYCLOAK_SECRET
    } = process.env;

    if (!KEYCLOAK_REALM || !KEYCLOAK_SERVER_URL || !KEYCLOAK_CLIENT_ID || !KEYCLOAK_SECRET) {
      throw new Error("Missing Keycloak configuration in environment variables");
    }

    keycloak = new Keycloak(options, {
      realm: KEYCLOAK_REALM,
      authServerUrl: KEYCLOAK_SERVER_URL,
      sslRequired: "external",
      resource: KEYCLOAK_CLIENT_ID,
      credentials: {
        secret: KEYCLOAK_SECRET,
      },
      confidentialPort: 0
    });
  }

  return keycloak;
};

module.exports = getKeycloak;
