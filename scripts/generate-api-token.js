#!/usr/bin/env node

'use strict'

const jwt = require('jsonwebtoken')
const cli = require('./util/cli')

const renderCliMessage = () => {
  const message = `generate-api-token

Generate an API token for service-to-service communication.

Usage:

$ ./scripts/generate-api-token.js --service-name "My Service" --admin-email admin@my-service.org --secret "my secret"
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiTXkgU2VydmljZSIsImVtYWlsIjoiYWRtaW5AbXktc2VydmljZS5vcmciLCJ0eXBlIjoic2VydmljZSIsImlhdCI6MTUzMjQyNjg2NywiaXNzIjoiSGVhcnRoIn0.bQomDjWkwSrTyYAiX917kiKZvbsh9httwqRGEMvqZak

$ ./scripts/generate-api-token.js -n test -e admin@jembi.org -s "\`cat privKey.pem\`" -u hearth:user -i hearth -a RS256
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoidGVzdCIsImVtYWlsIjoiYWRtaW5AamVtYmkub3JnIiwidHlwZSI6InNlcnZpY2UiLCJpYXQiOjE1MzM3MzQ2NDIsImF1ZCI6ImhlYXJ0aDp1c2VyIiwiaXNzIjoiaGVhcnRoIn0.YmmRJ_MEiqKi3ev0BsfdoAQIikAOlyfw2U9VNHjnuxgZS-8NHp02nN_Dr1yVvGKoOOeqUKdmSTEhRE6w4JSkkC2g91GcD6gG0cMzTXP6jK_t0Kzs0b69fTi4Nfc3XTwHHfbFOzuXrSf-YA-p2XmiZMJNADeNNQsaCUlQfe9adoc

curl -X GET \\
  https://myhearth.org/fhir/Person/222222 \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiTXkgU2VydmljZSIsImVtYWlsIjoiYWRtaW5AbXktc2VydmljZS5vcmciLCJ0eXBlIjoic2VydmljZSIsImlhdCI6MTUzMjQyNjg2NywiaXNzIjoiSGVhcnRoIn0.bQomDjWkwSrTyYAiX917kiKZvbsh9httwqRGEMvqZak"

Arguments:

-n --service-name\tService name
-e --admin-email\tService administrator email
-s --secret\t\tSecret or private key. Use -s "\`cat privKey.pem\`" to read from a file.
-a --algorithm\t\t(Optional) The JWT algorithm you have configured to use in Hearth (default: 'HS256')
-i --issuer\t\t(Optional) The issuer of the token, set this to the same value you have configured in Hearth (default: 'Hearth')
-u --audience\t\t(Optional) The audience of the token, if you have configured Hearth to validate Audience then set this to the appropriate value`

  console.log(
    message
      .split('\n')
      .map(line => `\t${line}`)
      .join('\n')
  )

  process.exit()
}

const renderErrorMessage = error => {
  console.error(error.message || error)
  process.exit(1)
}

const handleInvalidInput = error => {
  if (error) {
    renderErrorMessage(error)
  } else {
    renderCliMessage()
  }
}

const processInput = cli(
  [
    [/^(-n|--service-name)$/, 'serviceName'],
    [/^(-e|--admin-email)$/, 'adminEmail'],
    [/^(-s|--secret)$/, 'secretOrPrivateKey'],
    [/^(-a|--algorithm)$/, 'algorithm'],
    [/^(-i|--issuer)$/, 'issuer'],
    [/^(-u|--audience)$/, 'audience']
  ],
  handleInvalidInput
)

const {
  serviceName,
  adminEmail,
  secretOrPrivateKey,
  issuer,
  audience,
  algorithm
} = processInput(process.argv)

if (!serviceName || !adminEmail || !secretOrPrivateKey) {
  renderErrorMessage('Service name, administrator email and secret are required')
}

const payload = {
  service: serviceName,
  email: adminEmail,
  type: 'service'
}
const options = {
  algorithm: algorithm || 'HS256',
  issuer: issuer || 'Hearth'
}
if (audience) {
  options.audience = audience
}

jwt.sign(payload, secretOrPrivateKey, options, (err, token) => {
  if (err) {
    throw err
  }
  console.log(token)
})
