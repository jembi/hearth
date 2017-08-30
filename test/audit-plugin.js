'use strict'

const tap = require('tap')

const auditPlugin = require('../lib/plugins/audit')()

const testResourceTemplate = {
  'resourceType': 'Patient',
  'id': '1',
  'active': true,
  'identifier': [
    {
      'use': 'official',
      'system': 'pshr:passport:za',
      'value': '1001113333933',
      'assigner': {
        'display': 'Passport South Africa'
      }
    }
  ],
  'name': [
    {
      'use': 'official',
      'prefix': [
        'Mr'
      ],
      'family': [
        'Matinyana'
      ],
      'given': [
        'Charlton',
        'Joseph'
      ]
    }
  ],
  'gender': 'male',
  'birthDate': '1970-07-21'
}

tap.test('Audit Plugin', { autoend: true }, (t) => {
  t.test('should create an auditEvent object on read interactions', (t) => {
    // given
    const resource = JSON.parse(JSON.stringify(testResourceTemplate))
    const ctx = {
      authenticatedUser: {
        email: 'jenny@sssa.org',
        type: 'practitioner',
        resource: 'Practitioner/b7aeb450-8bde-11e7-812f-bbfc0872406b'
      },
      url: '/fhir/Questionnaire?identifier=preoperative-questionnaire',
      query: { identifier: 'preoperative-questionnaire' },
      headers: {
        referer: 'http://localhost:9000/'
      }
    }

    // when
    auditPlugin.hooks.after[0].function('read', ctx, 'Patient', resource, (err, badRequest) => {
      // then
      t.error(err)
      t.notOk(badRequest, 'should not return badRequest')

      console.log(resource)

      // TODO check audit object values

      t.end()
    })
  })
})
