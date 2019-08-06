[![Build Status](https://travis-ci.org/jembi/hearth.svg?branch=master)](https://travis-ci.org/jembi/hearth) [![codecov](https://codecov.io/gh/jembi/hearth/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/hearth)

# Hearth
HEARTH (noun): the floor of a '[FHIR](http://hl7.org/fhir/)'place. A fast FHIR-compliant server focused on longitudinal data stores.

This project aims to provide a fast and lightweight FHIR server that also supports some of the FHIR-based IHE profiles. It is still in the early stages of development, follow the project to stay informed. Any contributions are welcomed!

Our high level plan for the project can be found [here](https://docs.google.com/document/d/1wJr-A0xJFEwwR9y5c5tVGb0_rH7IQFBJRhMNRU31Fis/edit?usp=sharing).

# Documentation
For more information regarding the capabilities of Hearth and how to get working with it please refer to the [wiki documentation](https://github.com/jembi/hearth/wiki)

# Usage
To run in development mode use the following commands. First Mongo needs to be available on your system. The easiest way to do this is through docker:

**Note:** Requires mongo 3.6+

```
docker run --name hearth-mongo -d -p 27017:27017 mongo
```
Install dependencies
```
yarn
```
Now start the server in dev mode (which uses a dev namespaced database)
```
yarn dev:start
```
otherwise for production just run:
```
yarn start
```

The default FHIR version is DSTU2 as set in the config files, to change this either change the config files or make use of overriding config variable via environment variables:
```
server__fhirVersion=stu3 yarn start
```

To run the tests:
```
yarn test
```

View the possible config fields [here](https://github.com/jembi/hearth/blob/master/config/default.json).

# Pro dev tips:
* To run only specific test files use `yarn test:these-files test/pdqm.js`.
* Run `yarn cov` to show coverage details in your browser.
