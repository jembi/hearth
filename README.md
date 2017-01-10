[![Build Status](https://travis-ci.org/jembi/hearth.svg?branch=master)](https://travis-ci.org/jembi/hearth) [![codecov](https://codecov.io/gh/jembi/hearth/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/hearth)

# Hearth
A home for [FHIR](http://hl7.org/fhir/).

This project aim to provide a fast and lightweight FHIR server that also supports some of the FHIR-based IHE profiles. It is still in the early stages of development, follow the project to stay informed.

Our high level plan for the project can be found [here](https://docs.google.com/document/d/1wJr-A0xJFEwwR9y5c5tVGb0_rH7IQFBJRhMNRU31Fis/edit?usp=sharing).

## Usage
To run in development mode (mongodb needs to be available on your system)
```
npm run dev:start
```
otherwise for production
```
npm start
```

To run the tests
```
npm test
```
