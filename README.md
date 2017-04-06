[![Build Status](https://travis-ci.org/jembi/hearth.svg?branch=master)](https://travis-ci.org/jembi/hearth) [![codecov](https://codecov.io/gh/jembi/hearth/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/hearth)

# Hearth
A home for [FHIR](http://hl7.org/fhir/).

This project aims to provide a fast and lightweight FHIR server that also supports some of the FHIR-based IHE profiles. It is still in the early stages of development, follow the project to stay informed.

Our high level plan for the project can be found [here](https://docs.google.com/document/d/1wJr-A0xJFEwwR9y5c5tVGb0_rH7IQFBJRhMNRU31Fis/edit?usp=sharing).

## Usage
To run in development mode use the followng commands. First Mongo needs to be available on your system. The easiest way to do this is through docker:

```
docker run --name hearth-mongo -d -p 27017:27017 mongo
```
Now start the server in dev mode (which uses a dev namespaced database)
```
npm run dev:start
```
otherwise for production just run:
```
npm start
```

To run the tests:
```
npm test
```

## Supported Resources
* Allergy Intolerance
* Basic
* Binary
* Document Manifest
* Document Reference
* Encounter
* Location
* Patient
* Practitioner
* Procedure Request
* Procedure
* Questionnaire Response
* Questionnaire

## Supported Services
* Patient Identity Cross Reference ([PIXm](http://ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_PIXm.pdf))
* Terminology Service

## Pro tips:
* To run only specific test files use `npm run test:these-files -- test/pdqm.js`. Note the `--` is important!
* Run `npm run cov` to show coverage details in your browser.
