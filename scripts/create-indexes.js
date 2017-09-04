/*
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
