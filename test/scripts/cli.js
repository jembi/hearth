const tap = require('tap')
const sinon = require('sinon')

const cli = require('../../scripts/util/cli')

const autoend = { autoend: true }

const fakeArgv = args => [null, null, ...args]

tap.test('CLI', autoend, t => {
  t.test('should zip arguments with their respective values', autoend, t => {
    const processInput = cli([
      [/--foo/, 'foo']
    ])
    t.deepEqual(
      processInput(fakeArgv(['--foo', 'bar'])),
      { foo: 'bar' }
    )
  })

  t.test('should zip the correct arguments with their respective values', autoend, t => {
    const processInput = cli([
      [/--foo/, 'foo'],
      [/--bar/, 'bar'],
      [/--baz/, 'baz']
    ])
    t.deepEqual(
      processInput(fakeArgv(['--foo', 'bar', '--baz', 'foobar'])),
      {
        foo: 'bar',
        baz: 'foobar'
      }
    )
  })

  t.test('should call callback with an error when incorrect arguments are provided', autoend, t => {
    const stub = sinon.stub()
    const processInput = cli([], stub)
    processInput(fakeArgv(['--foo', 'bar']))
    t.equal(stub.calledOnce, true)
    const errorArg = stub.args[0][0]
    t.type(errorArg, Error)
    t.equal(errorArg.message, 'Invalid option --foo')
  })

  t.test('should call callback with an error when multiple incorrect arguments are provided', autoend, t => {
    const stub = sinon.stub()
    const processInput = cli([], stub)
    processInput(fakeArgv(['--foo', 'bar', '--bar', 'baz']))
    t.equal(stub.calledOnce, true)
    const errorArg = stub.args[0][0]
    t.type(errorArg, Error)
    t.equal(errorArg.message, 'Invalid option --foo, --bar')
  })

  t.test('should call callback with no arguments when no arguments are provided', autoend, t => {
    const stub = sinon.stub()
    const processInput = cli([], stub)
    processInput(fakeArgv([]))
    t.equal(stub.calledOnce, true)
    t.equal(stub.args[0][0], undefined)
  })
})
