[![Build Status](https://travis-ci.org/jembi/hearth.svg?branch=master)](https://travis-ci.org/jembi/hearth) [![codecov](https://codecov.io/gh/jembi/hearth/branch/master/graph/badge.svg)](https://codecov.io/gh/jembi/hearth)

# Hearth
HEARTH (noun): the floor of a '[FHIR](http://hl7.org/fhir/)'place. A fast FHIR-compliant server focused on longitudinal data stores.

This project aims to provide a fast and lightweight FHIR server that also supports some of the FHIR-based IHE profiles. It is still in the early stages of development, follow the project to stay informed. Any contributions are welcomed!

Our high level plan for the project can be found [here](https://docs.google.com/document/d/1wJr-A0xJFEwwR9y5c5tVGb0_rH7IQFBJRhMNRU31Fis/edit?usp=sharing).

# Features

* Supports both **DSTU2** and **STU3** - the current version can be set in config, see [here](https://github.com/jembi/hearth/blob/master/config/default.json#L6)
* Supports both **JSON** and **XML** with conversion between the two using the [FHIR.js module](https://www.npmjs.com/package/fhir). Supports using both the `Accepts:` header and the `_format` parameter for defining the response format.
* Supports read, vread, search, create, update, delete, _history (on either resource types or specific resources, global history is not supported) and batch/transaction FHIR interactions for ALL resources
* Supports creation of a resource through the update method for ALL resources. An update where the resource does not exist will create a new resource
* Supports ALL query parameters defined for ALL resources with the exception of parameters of type number or quantity - this is done by reading and processing the downloadable FHIR definitions files (only support the _since param for _history)
* Supports chained parameter queries to the nth degree
* Supports query parameter modifiers for string types, including `exact` and `contains`
* Supports query parameter prefixes for dates, including `eq`, `ne`, `lt`, `le`, `gt` and `ge`
* Supports query parameters for choice-of-type resource properties
* Supports basic resource matching using the `$match` operation on a query, see `config/matching.json` for configuration options.
* Supports basic (cardinality only) resource validation using the [FHIR.js module](https://www.npmjs.com/package/fhir), this is not enabled by default allowing you to store any extensions or profiles by default - toggle this in the config

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

# Configuration

To configure Hearth you may either edit the config files directly in the `config/` folder or you may use environment variables. There is a default config file and config files for production and or testing environments that override the default config file. Environment variables override the values set in any of the config files. To overwrite json config variables with environment variables you can level down the object with `__` (double underscore).  For example `{ mongodb: { url: 'localhost' } }` can be overwritten with `mongodb__url=foreignhost`

View the possible config fields [here](https://github.com/jembi/hearth/blob/master/config/default.json).

## Supported Services
* Mobile access to Health Documents - ([MHD](http://www.ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_MHD.pdf))
* Patient Identity Cross-Reference for mobile - ([PIXm](http://ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_PIXm.pdf))
* Patient Demographics Query for mobile - ([PDQm](http://www.ihe.net/uploadedFiles/Documents/ITI/IHE_ITI_Suppl_PDQm.pdf))
* Terminology Service `$lookup` operation - ([$lookup](https://www.hl7.org/fhir/DSTU2/valueset-operations.html#lookup))

## Service-to-service JWT Authentication

Enable JWT authentication middleware by including the following configuration in your config file:

```json
"authentication": {
  "type": "jwt",
  "jwt": {
    "secret": "my secret"
  }
}
```

Generate an API token:

```bash
$ ./scripts/generate-api-token --service-name "My Service" --admin-email admin@my-service.org --secret "my secret"

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiTXkgU2VydmljZSIsImVtYWlsIjoiYWRtaW5AbXktc2VydmljZS5vcmciLCJ0eXBlIjoic2VydmljZSIsImlhdCI6MTUzMjQyNjg2NywiaXNzIjoiSGVhcnRoIn0.bQomDjWkwSrTyYAiX917kiKZvbsh9httwqRGEMvqZak
```

Include the `Authorization` header in Hearth API calls with the Bearer token set to the token output by the script:

```bash
curl -X GET \\
  https://myhearth.org/fhir/Person/222222 \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2aWNlIjoiTXkgU2VydmljZSIsImVtYWlsIjoiYWRtaW5AbXktc2VydmljZS5vcmciLCJ0eXBlIjoic2VydmljZSIsImlhdCI6MTUzMjQyNjg2NywiaXNzIjoiSGVhcnRoIn0.bQomDjWkwSrTyYAiX917kiKZvbsh9httwqRGEMvqZak"
```

# Pro dev tips:
* To run only specific test files use `yarn test:these-files test/pdqm.js`.
* Run `yarn cov` to show coverage details in your browser.
