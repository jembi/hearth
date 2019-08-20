# Instructions

The k6 performance testing tool is used for these tests. The results of the tests are stored in influxdb and can be visualized on chronograf. These visualization tools and hearth have to be running for the tests to be executed. All these can be started using the following command:

```bash
docker-compose up -d
```

## Load Tests

Test the number of concurrent users that can be handled by Hearth under
realistic circumstances. To perform a load test, substitute `<BASE_URL>` with url of the running Hearth instance and `<RESOURCE_PATH>` with the resource path and then run the following command:

```bash
docker run -e 'BASE_URL=<BASE_URL>' -e 'RESOURCE_PATH=<RESOURCE_PATH>' --network host -i -v $PWD:/src loadimpact/k6 run /src/load.js
```

The default base url is `http://localhost:3447` and `fhir/Patient` for the path. Below are some examples of paths that can be used

| Resource     | Path                        |
| ------------ | --------------------------- |
| Patient      | `/fhir/Patient`             |
| Practitioner | `/fhir/Practitioner`        |
| Location     | `/fhir/Location`            |

## Volume Tests

Test the throughput of Hearth when handlng large volumes. Substitute the `<BASE_URL>`and the `<RESOURCE_PATH>` and run:

```bash
docker run -e 'BASE_URL=<BASE_URL>' -e 'RESOURCE_PATH=<RESOURCE_PATH>' --network host -i -v $PWD:/src loadimpact/k6 run /src/volume.js
```

## Stress Tests

Test the routing overhead of Hearth under maximum throughput. Substitute the `<BASE_URL>`and the `<RESOURCE_PATH>` and run:

```bash
docker run -e 'BASE_URL=<BASE_URL>' -e 'RESOURCE_PATH=<RESOURCE_PATH>' --network host -i -v $PWD:/src loadimpact/k6 run /src/stress.js
```

## Patient, encounter and observation create Test

To test a realistic case where a patient, an encounter (for the patient) and observations (in the encounter) are created sequentially, substitute the `<BASE_URL>` and run the following:

```bash
docker run -e 'BASE_URL=<BASE_URL>' --network host -i -v $PWD:/src loadimpact/k6 run /src/patient-encounter-observation-create.js
```

## Patient, encounter and observation bundle create Test

To test a case where a patient, an encounter (for the patient) and observations (in the encounter) are created using a bundle resource, substitute the `<BASE_URL>` and run the following:

```bash
docker run -e 'BASE_URL=<BASE_URL>' --network host -i -v $PWD:/src loadimpact/k6 run /src/patient-encounter-observation-bundle-create.js
```

## InfluxDB Output

Ensure that influxdb and chronograf docker containers are running. Once they are up and running you can access Chronograf at <http://localhost:8888>. This is if the docker containers are hosted on a local machine. If not the ip address will be different but the ports are the same (same applies for the influxdb url).

Inorder to insert the results into the influxdb pass in the option `-o influxdb=http://localhost:8086/k6` to the `k6 run` like below:

```bash
docker run -e 'BASE_URL=<BASE_URL>' -e 'RESOURCE_PATH=<RESOURCE_PATH>' --network host -i -v $PWD:/src loadimpact/k6 -o influxdb=http://localhost:8086/k6 run /src/load.js
```

A graph can then be created using the data in the influxdb on chronograf. Dashboard config files exist (in dashboards folder) and these can be used to create different graphs. To use the files, import them on the chronograf console.
