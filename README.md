[![Build Status](https://travis-ci.org/jembi/hearth.svg?branch=master)](https://travis-ci.org/jembi/hearth) [![codecov](https://codecov.io/gh/jembi/hearth/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/hearth)

# Hearth
A home for [FHIR](http://hl7.org/fhir/).

This project aims to provide a fast and lightweight FHIR server that also supports some of the FHIR-based IHE profiles. It is still in the early stages of development, follow the project to stay informed. Currently, Hearth supports the DSTU2 version of FHIR, however, in the future multiple version support is planned.

Our high level plan for the project can be found [here](https://docs.google.com/document/d/1wJr-A0xJFEwwR9y5c5tVGb0_rH7IQFBJRhMNRU31Fis/edit?usp=sharing).

## Usage
To run in development mode use the following commands. First Mongo needs to be available on your system. The easiest way to do this is through docker:

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

All resources are supported with the default FHIR interactions and default search parameters, however, specific resources have been implement with support for particular search paramater in the FHIR spec.

| Supported Resources    | Supported Query Parameters | Maturity Level |
| ---------------------- | -------------------------- | -------------- |
| Allergy Intolerance    | patient | 3 |
| Audit Event            | _id | 2 |
| Basic                  | code, subject, author | 1 |
| Binary                 | contenttype | 1 |
| Composition            | entry, patient, status, subject, type | 2 |
| Document Manifest      | patient, patient.identifier, created, author.given, author.family, type, status | 2 |
| Document Reference     | patient, patient.identifier, indexed, author.given, author.family, status, class, type, setting, period, facility, event, securityLabel, format, related-id | 3 |
| Encounter              | patient, practitioner, practitioner.organization, participant, location, status | 2 |
| Immunization           | encounter | 1 |
| Location               | organization, type | 3 |
| Observation            | encounter | 3 |
| Organization           | identifier | 1 |
| Patient                | _id, identifier, given, family, gender, birthDate, address, mothersMaidenName.given, mothersMaidenName.family, telecom, multipleBirthInteger | 5 |
| Practitioner           | identifier, given, family, role, organization, telecom | 3 |
| Procedure Request      | encounter, patient | 3 |
| Procedure              | encounter, patient | 3 |
| Questionnaire Response | encounter, patient, questionnaire | 3 |
| Questionnaire          | identifier | 3 |
| ValueSet               | url, system | 3 |

link to FHIR list (https://www.hl7.org/fhir/resourcelist.html)

## Supported Services
* Mobile access to Health Documents - not yet up to date with the latest release ([MHD](http://www.ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_MHD.pdf))
* Patient Identity Cross Reference for Module ([PIXm](http://ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_PIXm.pdf))
* Patient Demographics Query for Mobile ([PDQm](http://www.ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_PDQm.pdf))
* Terminology Service `$lookup` operation - ([$lookup](https://www.hl7.org/fhir/DSTU2/valueset-operations.html#lookup))

## Pro tips:
* To run only specific test files use `npm run test:these-files -- test/pdqm.js`. Note the `--` is important!
* Run `npm run cov` to show coverage details in your browser.
* To overwrite json config variables with environment variables it is possible to level down the object with `__` (double underscore).  For example `{ mongodb: { url: 'localhost' } }` can be overwritten with `mongodb__url=foreignhost`
