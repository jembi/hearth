export const weightObservation = {
  resourceType: 'Observation',
  status: 'preliminary',
  code: {
    coding: [
      {
        code: '29463-7',
        system: 'http://loinc.org'
      }
    ]
  },
  subject: {},
  context: {},
  valueQuantity: {
    value: 80,
    unit: 'kg'
  },
  dateTime: new Date().toISOString()
}

export const heightObservation = {
  resourceType: 'Observation',
  status: 'preliminary',
  coding: {
    system: 'https://loinc.org',
    code: '8302-2'
  },
  subject: {},
  context: {},
  valueQuantity: {
    value: 170,
    unit: 'cm'
  },
  dateTime: new Date().toISOString()
}
