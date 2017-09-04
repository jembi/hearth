<!--
 BSD 3-Clause License
 Copyright (c) 2017, Jembi Health Systems NPC
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 * Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

 * Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

 * Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 -->

[![Build Status](https://travis-ci.org/jembi/hearth.svg?branch=master)](https://travis-ci.org/jembi/hearth) [![codecov](https://codecov.io/gh/jembi/hearth/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/hearth)

# Hearth
A home for [FHIR](http://hl7.org/fhir/).

This project aims to provide a fast and lightweight FHIR server that also supports some of the FHIR-based IHE profiles. It is still in the early stages of development, follow the project to stay informed.

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

| Supported Resources | Maturity Level |
| ------------------- | -------------- |
| Allergy Intolerance     | 3 | 
| Basic                   | 1 | 
| Binary                  | 5 | 
| Composition             | 2 | 
| Document Manifest       | 2 | 
| Document Reference      | 3 | 
| Encounter               | 2 | 
| Immunization            | 1 | 
| Location                | 3 | 
| Patient                 | 5 | 
| Practitioner            | 3 | 
| Procedure Request       | 3 | 
| Procedure               | 3 | 
| Questionnaire Response  | 3 | 
| Questionnaire           | 3 | 

link to FHIR list (https://www.hl7.org/fhir/resourcelist.html)

## Supported Services
* Patient Identity Cross Reference ([PIXm](http://ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_PIXm.pdf))
* Terminology Service

## Pro tips:
* To run only specific test files use `npm run test:these-files -- test/pdqm.js`. Note the `--` is important!
* Run `npm run cov` to show coverage details in your browser.
* To overwrite json config variables with environment variables it is possible to level down the object with `__` (double underscore).  For example `{ mongodb: { url: 'localhost' } }` can be overwritten with `mongodb__url=foreignhost`
