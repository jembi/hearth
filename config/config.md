# Hearth config options

There are a few different ways to configure Hearth:

1. You may edit the config files in the `config/` folder directly. There is a default config file and override config files for production and testing environments can be created. These override files replace values in the default file. For example, if the `NODE_ENV` environment variable is set to `production` then the `production.json` override file is read, similarly if `NODE_ENV` is set to `test` then the `test.json` override file is read.
2. You may use environment variables. Environment variables override the values set in any of the config files. To overwrite json config variables with environment variables you can level down the object with `__` (double underscore).  For example `{ mongodb: { url: 'localhost' } }` can be overwritten with `mongodb__url=foreignhost`
3. You may start hearth with the `-c path/to/config.json` options to use a custom config file. Copy the `config/default.json` file to get started. With this method no other config files are read other than the one you specify.

## Config options

See an example file [here](default.json).

* `server.hostname` e.g. "0.0.0.0" - the address that the server listens on.
* `server.publicFhirBase` e.g. "http://localhost:3447/fhir" - the public address which this FHIR server is available on, this is used to produce full urls for references.
* `server.port` e.g. 3447 - the port the server listen on.
* `server.fhirVersion` e.g. "dstu2" - the fhirVersion to configure Hearth for. Valid  options: `dstu2`, `stu3`
* `mongodb.url` e.g. "mongodb://localhost/hearth" - the mongo connection url used to connect to the mongo database
* `authentication.authWindowSeconds` e.g. 10 - Only used when `authentication.type` = `openhim-style`, it describes the maximum amount of time to pass before a request using this auth style is no longer valid.
* `authentication.type` e.g. "disabled" - the authentication type to use. Valid options: `disabled`, `jwt` or `openhim-style`. OpenHIM style is the same auth mechanism that the OpenHIM project uses. See [here](http://openhim.readthedocs.io/en/latest/dev-guide/api-ref.html#initial-authentication-notification). For `jwt` see the following JWT options to configure how you use JWTs within Hearth.
* `authentication.enablePublicUserCreation` e.g. false - enables anyone to create users in hearth via the API, basically disabled authentication for create user endpoints.
* `authentication.secret` e.g. "super_secret" - deprecated, previously used for jwt secrets. Now use `authentication.jwt.secret`.
* `authentication.jwt.algorithm` e.g. "HS256" - the JWT algorithm to use for signing and verification
* `authentication.jwt.secret` e.g. "super_secret" - the JWT HMAC secret to use with HMAC algorithms
* `authentication.jwt.privKey` e.g. "/path/to/privKey.pem" - the JWT private key to use to sign token when using asymmetric JWT algorithms, only necessary if you are using Hearth users API. If you are creating token externally from Hearth this isn't needed.
* `authentication.jwt.pubKey` e.g. "/path/to/pubKey.pem" - the JWT public key to use when verifying JWT token when using asymmetric JWT algorithms.
* `authentication.jwt.issuer` e.g. "hearth" - the issuer to set in a JWT token and the issuer to verify exists in a JWT token.
* `authentication.jwt.setAudience` e.g. "hearth/example-app1" - The audience to set during signing in a JWT token.
* `authentication.jwt.validateAudience` e.g. "^hearth:example-app\\d+$" - a regular expression to match when validating the audience of a JWT token.
* `authentication.jwt.expiresIn` e.g. "1d" - the expiry time to set when signing a JWT token.
* `logger.level` e.g. "info" - the winston logger level, see [here](https://github.com/winstonjs/winston#logging-levels)
* `idGenerator` e.g. "uuidv4" - which uuid algorithm to use to generate unique identifier for resoruces. See [here](https://github.com/kelektiv/node-uuid). We recommend using uuidv4 as it produces random IDs which would be difficult to guess without knowing the actual ID.
* `atnaAudit.enabled` e.g. true - enables sending of ATNA audits for PIXm and PDQm IHE profiles.
* `atnaAudit.interface` e.g. "udp" - interface to send audits on. Valid options: `udp`, `tls` or `tcp`.
* `atnaAudit.host` e.g. "localhost" - the host to send ATNA audits to.
* `atnaAudit.port` e.g. 5050 - the port on the host which receives ATNA audits.
* `atnaAudit.certOptions.key` e.g. "/path/to/privKey.pem" - path to the private key to use when sending audits via tls.
* `atnaAudit.certOptions.cert` e.g. "/path/to/pubKey.pem" - path to the public key to use when sending audits via tls.
* `atnaAudit.certOptions.ca` e.g. "/path/to/privKey.pem" - path to a new certificate authority to trust when sending audits via tls.
* `matchingQueue.numberOfWorkers` e.g. 2 - the number of worker processes which run background matching. Set to 0 to turn off background matching. You must have a valid matching config (`matching.json`) for this to work correctly.
* `matchingQueue.pollingInterval` e.g. 1000 - how often to poll for new record to be matched, in ms.
* `validation.enabled` e.g. false - whether to enable basic resource validation.
* `validation.additionProfilePaths` e.g. [ 'lib/fhir/profiles/mhd' ] - array of paths to profiles that you want to make the validation module aware of.
* `operations.upsert` e.g. false (default) or true - whether to enable inserting if a record doesn't already exist for update operations.
* `knownIdentityDomains` e.g. [ 'some:identity:domain' ] - an array of identify domains that are known to the PIXm profile. Only necessary if you are using this IHE profile.
