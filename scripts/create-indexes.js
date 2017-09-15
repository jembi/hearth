 /**
 * Copyright (c) 2017-present, Jembi Health Systems NPC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* global db */

// Create simple unique indexes for IDs of all resources
db.AllergyIntolerance.createIndex({id: 1}, {unique: true})
db.Basic.createIndex({id: 1}, {unique: true})
db.Binary.createIndex({id: 1}, {unique: true})
db.Composition.createIndex({id: 1}, {unique: true})
db.DocumentManifest.createIndex({id: 1}, {unique: true})
db.DocumentReference.createIndex({id: 1}, {unique: true})
db.Encounter.createIndex({id: 1}, {unique: true})
db.Immunization.createIndex({id: 1}, {unique: true})
db.Location.createIndex({id: 1}, {unique: true})
db.Patient.createIndex({id: 1}, {unique: true})
db.Practitioner.createIndex({id: 1}, {unique: true})
db.Procedure.createIndex({id: 1}, {unique: true})
db.ProcedureRequest.createIndex({id: 1}, {unique: true})
db.Questionaire.createIndex({id: 1}, {unique: true})
db.QuestionaireResponse.createIndex({id: 1}, {unique: true})

// Create unique compound index for IDs and meta.versionIDs of all resource history
db.AllergyIntolerance_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Basic_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Binary_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Composition_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.DocumentManifest_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.DocumentReference_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Encounter_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Immunization_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Location_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Patient_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Practitioner_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Procedure_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.ProcedureRequest_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.Questionaire_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
db.QuestionaireResponse_history.createIndex({id: 1, 'meta.versionId': 1}, {unique: true})
