'use strict'

const NOOP_HANDLER = () => {}

const cli = (availableOptions, onInvalidInput = NOOP_HANDLER) =>
  ([n, script, ...args]) => {
    const invalidArguments = []
    const mapOptions = input => {
      const option = availableOptions.find(([regex]) => regex.exec(input))
      if (!option) {
        invalidArguments.push(input)
      }
      return option && option[1]
    }

    const options = args
      .filter((x, i) => i % 2 === 0)
      .map(mapOptions)
      .filter(x => !!x)

    if (invalidArguments.length > 0) {
      return onInvalidInput(new Error(`Invalid option ${invalidArguments.join(', ')}`))
    } else if (options.length === 0) {
      return onInvalidInput()
    }

    const values = args.filter((x, i) => i % 2 !== 0)

    return options
      .map((option, i) => ({ [option]: values[i] }))
      .reduce((acc, option) => Object.assign({}, acc, option), {})
  }

module.exports = cli
