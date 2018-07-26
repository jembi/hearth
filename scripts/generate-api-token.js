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

curl -X GET \\
  https://myhearth.org/fhir/Person/222222 \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiTXkgU2VydmljZSIsImVtYWlsIjoiYWRtaW5AbXktc2VydmljZS5vcmciLCJ0eXBlIjoic2VydmljZSIsImlhdCI6MTUzMjQyNjg2NywiaXNzIjoiSGVhcnRoIn0.bQomDjWkwSrTyYAiX917kiKZvbsh9httwqRGEMvqZak"

Arguments:

-n --service-name\tService name
-e --admin-email\tService administrator email
-s --secret\t\tSecret or private key`

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
    [/^(-s|--secret)$/, 'secretOrPrivateKey']
  ],
  handleInvalidInput
)

const {
  serviceName,
  adminEmail,
  secretOrPrivateKey
} = processInput(process.argv)

if (!serviceName || !adminEmail || !secretOrPrivateKey) {
  renderErrorMessage('Service name, administrator email and secret are required')
}

const payload = {
  service: serviceName,
  email: adminEmail,
  type: 'service'
}
const options = {issuer: 'Hearth'}

jwt.sign(payload, secretOrPrivateKey, options, (err, token) => {
  if (err) {
    throw err
  }
  console.log(token)
})
