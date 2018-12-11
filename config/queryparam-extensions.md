# Configuring query params for extensions

Hearth supports querying by extension values, however, to do this you need to tell Hearth a little bit about the extension and the name of the query parameter that you want to use.

To do this you may add entries to the `queryparam-extensions.json` file in the config folder. This file is a map where the top level is the name of the resourceType the extension is used in, the second level is the name of the queryparameter as used in the query url and the remainder of the object is configuration of the query parameter and the path it maps to in the resource. E.g.

```json
{
  "Task": { // this is the resourceType the extension is used in
    "location": { // this is the query param name that will be used in the url
      "extension": true, // this is a required field for hearth to know this is an extension query param
      "url": "http://opencrvs.org/specs/extension/regLastLocation", // this is the url that the extension uses
      "path": "valueReference", // this is the path in the extension object that we should match the value to, often a value[x] property
      "type": "reference", // the is the type of the query param as defined here - https://www.hl7.org/fhir/search.html#reference
      "propertyDef": { // this is an object that describes the value of the extension
        "min": 0, // min cardinality
        "max": "1", // max cardinality
        "types": [
          {
            "code": "reference" // the datatype of the value as defined here - https://www.hl7.org/fhir/datatypes.html
          }
        ]
      }
    }
  }
}
```

Extension searches support all the main feature for searching that Hearth does (modifiers etc.) except for chained parameters that span different resources.
