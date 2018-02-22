'use strict'

require('../lib/init')

const commonFactory = require('../lib/fhir/common')
const moduleLoaderFactory = require('../lib/fhir/module-loader')
const sinon = require('sinon')
const tap = require('tap')

const cursor = {
  toArray () {
    return Promise.resolve([])
  }
}

const db = {
  collection () {
    return this
  },

  find () {
    return cursor
  }
}

const mongo = {
  getDB (callback) {
    return callback(null, db)
  }
}

tap.test('Reverse include resources', t => {
  const common = commonFactory(mongo)

  const moduleLoader = moduleLoaderFactory(mongo)
  moduleLoader.loadModules()

  const sandbox = sinon.sandbox.create()

  t.afterEach(next => {
    sandbox.restore()
    next()
  })

  t.test('should return an empty array when there is no _revincude', t => {
    return common.reverseIncludeResources(void 0, []).then(results => {
      t.deepEqual(results, [])
    })
  })

  t.test('should return an emtpy array when there are no results', t => {
    return common
      .reverseIncludeResources('Encounter:patient', [])
      .then(results => {
        t.deepEqual(results, [])
      })
  })

  t.test('should return an error when the _revincude parameter is invalid', t => {
    return common
      .reverseIncludeResources('Encounter.patient', [
        {resourceType: 'Patient', id: '1'}
      ])
      .then(() => t.fail('Expected an error'))
      .catch(err => {
        t.type(err, Error)
        t.equal(
          err.message,
          'Invalid _revinclude parameter value: "Encounter.patient"'
        )
      })
  })

  t.test('should return an error when the _revincude parameter is for an unsupported resource', t => {
    return common
      .reverseIncludeResources('Unsupported:patient', [
        {resourceType: 'Patient', id: '1'}
      ])
      .then(() => t.fail('Expected an error'))
      .catch(err => {
        t.type(err, Error)
        t.equal(
          err.message,
          'The _revinclude parameter is not supported for "Unsupported"'
        )
      })
  })

  t.test('should return an error when the _revincude query parameter is invalid', t => {
    return common
      .reverseIncludeResources('Encounter:patients', [
        {resourceType: 'Patient', id: '1'}
      ])
      .then(() => t.fail('Expected an error'))
      .catch(err => {
        t.type(err, Error)
        t.equal(
          err.message,
          'Invalid _revinclude query parameter value: "Encounter:patients"'
        )
      })
  })

  t.test('should search for _revinclude resources and return the results', t => {
    const expectedResources = [
      {
        resourceType: 'Encounter',
        id: '96d5af0a-bfcf-41eb-9d3f-e6868ff93150',
        patient: {
          reference: 'Patient/1'
        }
      }
    ]
    sandbox.spy(db, 'collection')
    sandbox.spy(db, 'find')
    sandbox.stub(cursor, 'toArray').returns(Promise.resolve(expectedResources))
    return common
      .reverseIncludeResources('Encounter:patient', [
        {resourceType: 'Patient', id: '1'}
      ])
      .then(resources => {
        t.ok(db.collection.calledWith('Encounter'))
        t.ok(db.find.calledOnce)
        t.ok(cursor.toArray.calledOnce)
        t.deepEqual(resources, expectedResources)
      })
  })

  t.test('should perform multiple searches when there are multiple _revinclude parameters', t => {
    const expectedEncounterResources = [
      {
        resourceType: 'Encounter',
        id: '96d5af0a-bfcf-41eb-9d3f-e6868ff93150',
        patient: {
          reference: 'Patient/1'
        }
      }
    ]
    const expectedProcedureResources = [
      {
        resourceType: 'Procedure',
        id: 'e94095b3-2063-43c8-90a2-f36a9c9a434a',
        subject: {
          reference: 'Patient/1'
        }
      }
    ]
    sandbox.spy(db, 'collection')
    sandbox.stub(cursor, 'toArray').callThrough()
    cursor.toArray.onFirstCall().returns(Promise.resolve(expectedEncounterResources))
    cursor.toArray.onSecondCall().returns(Promise.resolve(expectedProcedureResources))
    return common
      .reverseIncludeResources(
        ['Encounter:patient', 'Procedure:patient'],
        [{resourceType: 'Patient', id: '1'}]
      )
      .then(resources => {
        t.equal(db.collection.callCount, 2)
        t.equal(db.collection.firstCall.args[0], 'Encounter')
        t.equal(db.collection.secondCall.args[0], 'Procedure')
        t.deepEqual(resources, [...expectedEncounterResources, ...expectedProcedureResources])
      })
  })

  t.end()
})
