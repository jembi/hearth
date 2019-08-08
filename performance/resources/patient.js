export const patientResource = {
  "resourceType": "Patient",
  "active": true,
  "identifier": [
    {
      "use": "official",
      "system": "pshr:sanid",
      "value": "1007211154902",
      "assigner": {
        "display": "SA National"
      }
    },
    {
      "use": "official",
      "system": "pshr:passport:za",
      "value": "1001113333933",
      "assigner": {
        "display": "Passport South Africa"
      }
    },
    {
      "use": "official",
      "system": "pshr:passport:gbr",
      "value": "1111111111111",
      "assigner": {
        "display": "Passport South Africa"
      }
    },
    {
      "use": "official",
      "value": "no-system-identifier",
      "assigner": {
        "display": "Identifier with no system specified"
      }
    }
  ],
  "name": [
    {
      "use": "official",
      "prefix": [
        "Mr"
      ],
      "family": [
        "Matinyana"
      ],
      "given": [
        "Charlton",
        "Joseph"
      ]
    }
  ],
  "gender": "male",
  "birthDate": "1970-07-21",
  "telecom": [
    {
      "system": "email",
      "value": "charlton@email.com"
    },
    {
      "system": "phone",
      "value": "27831234567",
      "use": "mobile"
    }
  ],
  "address": [
    {
      "use": "home",
      "type": "both",
      "line": [
        "2760 Mlosi Street",
        "Wallacedene",
        "Kraaifontein"
      ],
      "state": "Western Cape",
      "city": "Cape Town",
      "postalCode": "7570",
      "country": "South Africa"
    }
  ],
  "communication": [
    {
      "language": {
        "coding": [
          {
            "system": "urn:ietf:bcp:47",
            "code": "en"
          }
        ],
        "text": "English"
      },
      "preferred": true
    }
  ],
  "contact": [
    {
      "relationship": [
        {
          "coding": [
            {
              "system": "http://hl7.org/fhir/patient-contact-relationship",
              "code": "emergency"
            }
          ]
        },
        {
          "coding": [
            {
              "system": "http://hl7.org/fhir/patient-contact-relationship",
              "code": "family"
            }
          ]
        }
      ],
      "name": [
        {
          "use": "official",
          "family": [
            "Mqobhane"
          ],
          "given": [
            "Mamoya"
          ]
        }
      ],
      "telecom": [
        {
          "system": "phone",
          "value": "27831234567",
          "use": "mobile"
        },
        {
          "system": "email",
          "value": "mamoya@email.com"
        }
      ]
    }
  ],
  "extension": [
    {
      "url": "pshr:medicalaid:name",
      "valueString": "Discovery"
    },
    {
      "url": "pshr:medicalaid:option",
      "valueString": "Super Health Saver"
    },
    {
      "url": "pshr:medicalaid:number",
      "valueString": "123456"
    },
    {
      "url": "pshr:gapcover",
      "valueBoolean": true
    },
    {
      "url": "http://pdqm-sample:8080/ITI-78/Profile/pdqm#mothersMaidenName",
      "valueHumanName": {
        "family": [ "Smith", "Mc", "extra" ],
        "given": [ "Mary", "Jane" ]
      }
    }
  ]
} 