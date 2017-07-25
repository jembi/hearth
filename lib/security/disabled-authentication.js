'use strict'

module.exports = () => {
  return {
    authenticate: (req, res, next) => {
      res.locals.authenticatedUser = {
        email: 'sysadmin@jembi.org',
        type: 'sysadmin'
      }
      next()
    }
  }
}
