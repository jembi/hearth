# Instructions

Make sure you have a running instance of Hearth

## Load Tests

Test the number of concurrent users that can be handled by the Hearth under
realistic circumstances.

To perform a load test, substitute `<BASE_URL>` with url of the running Hearth instance and `<PATH>` with the resource path. Some resource paths are given in the table below
run the following command:

```bash
docker run -e 'BASE_URL=<BASE_URL>' -e 'RESOURCE_PATH=<PATH>'--network="host" -i -v $PWD:/src loadimpact/k6 run /src/load.js

| Resource     | PATH                        |
| ------------ | --------------------------- |
| Patient      | `/fhir/patient`             |
| Practitioner | `/fhir/practitioner`        |
| Location     | `/fhir/location`            |
