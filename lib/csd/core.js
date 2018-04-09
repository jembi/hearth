'use strict'

const logger = require('winston')
const pd = require('pretty-data').pd
const async = require("async")
const xmlbuilder = require('xmlbuilder')

module.exports = (mongo,fhirResources) => {
  const fhirCore = require('../fhir/core.js')(mongo, fhirResources)
  function getPractitionerRole(resource,ctx,query,callback) {
    const entryCtx = JSON.parse(JSON.stringify(ctx))
    entryCtx.url = '/fhir/'+resource+"?"+query
    entryCtx.query = {}
    entryCtx.query.practitioner = query
    fhirCore.search(entryCtx, resource, (err,results)=>{
      callback(results)
    })
  }

  function getLocationByIdentifier(ctx,identifier,callback) {
    const entryCtx = JSON.parse(JSON.stringify(ctx))
    entryCtx.url = '/fhir/Location'
    entryCtx.query = {}
    entryCtx.query.identifier = identifier
    fhirCore.search(entryCtx, 'Location', (err,results)=>{
      callback(results)
    }) 
  }

  const translatePractitionerToCSD = (bundleResource,ctx,callback) => {
    const promises = []
    let providerDir = xmlbuilder.begin().ele("csd:providerDirectory")
    bundleResource.resource.entry.forEach( (entry)=>{
      let provider = providerDir.ele("csd:provider")
      let providerDemographic = provider.ele("csd:demographic")
      var resource = entry.resource
      let entityID = null
      resource.identifier.forEach((identifier)=>{
        if(identifier.system == "urn:ihe:iti:csd:2013:entityID")
          entityID = identifier.value
      })
      if(entityID != null)
      var practitioner = "Practitioner/"+entityID
      else {
        var practitioner = resource.id
        entityID = "urn:uuid:" + resource.id
      }

      provider.att("entityID",entityID)
      promises.push(new Promise((resolve1, reject1) => {
        getPractitionerRole("PractitionerRole",ctx,practitioner,(practitionerRole)=>{
          async.parallel({
            //codedType
            codedType: function(callback) {
              async.eachSeries(practitionerRole.resource.entry,(entryPractRole,nxtEntry)=>{
                if(entryPractRole.resource.hasOwnProperty("code"))
                  async.eachSeries(entryPractRole.resource.code,(code,nxtCode)=>{
                    async.eachSeries(code.coding,(coding,nxtCoding)=>{
                      var codedType = provider.ele("csd:codedType",coding.display)
                      codedType.att("code",coding.code)
                      codedType.att("codingScheme",coding.system)
                      return nxtCoding()
                    },function(){
                      nxtCode()
                    })

                  },function(){
                    nxtEntry()
                  })
                else
                  return nxtEntry()
              },function(){
                callback()
              })
            },
            //otherID
            otherID: function(callback) {
              const otheridPromises = []
              if(resource.hasOwnProperty("identifier")) {
                resource.identifier.forEach((identifier)=>{
                  otheridPromises.push(new Promise((resolve, reject) => {
                    if(identifier.system != "urn:ihe:iti:csd:2013:entityID") {
                      if(!identifier.hasOwnProperty("value")) {
                        identifier.value = ''
                      }
                      if(!identifier.hasOwnProperty("system")) {
                        identifier.system = ''
                      }
                      var otherID = provider.ele("csd:otherID",identifier.value)
                      otherID.att("assigningAuthorityName",identifier.system)
                      resolve()
                    }
                    else
                      resolve()
                  }))
                })
              }
              Promise.all(otheridPromises).then(()=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //name
            name: (callback)=> {
              const namePromises = []
              let providerName = ''
              resource.name.forEach((name)=>{
                namePromises.push(new Promise((resolve, reject) => {
                  var commonName = name.text
                  var surname = name.family
                  var given = name.given.split(" ")
                  if(given.length>0) {
                    var forename = given[0]
                    given.splice(0,1)
                    if(given.length>0)
                      var otherName = given.join(" ")
                    else
                      var otherName = ''
                  }
                  else {
                    var forename = ''
                    var otherName = ''
                  }
                  var honoric = name.prefix
                  var suffix = name.suffix
                  providerName = providerDemographic.ele("csd:name")
                  providerName.ele("csd:commonName",commonName)
                  providerName.ele("csd:surname",surname)
                  providerName.ele("csd:forename",forename)
                  providerName.ele("csd:otherName",otherName)
                  providerName.ele("csd:honoric",honoric)
                  providerName.ele("csd:suffix",suffix)
                  resolve()
                }))

              })
              Promise.all(namePromises).then(()=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //dob
            dob: function(callback){
              providerDemographic.ele("csd:dateOfBirth",resource.birthDate)    
              callback()
            },
            //gender
            gender: function(callback){
              providerDemographic.ele("csd:gender",resource.gender)
              callback()    
            },
            //address
            address: function(callback){
              const addressPromises = []
              let providerAddress = ''
              if(resource.hasOwnProperty("address")) {
                resource.address.forEach((address)=>{
                  addressPromises.push(new Promise((resolve, reject) => {
                    var type = ''
                    if(address.type == 'mailing address')
                      type = address.type
                    else if(address.type == 'postal')
                      type = "Mailing"
                    else if(address.type == 'physical')
                      type = "Physical"
                    providerAddress = providerDemographic.ele("csd:address").att("type",type)
                    providerAddress.ele("csd:addressLine",address.line).att("component","streetAddress")
                    providerAddress.ele("csd:addressLine",address.city).att("component","city")
                    providerAddress.ele("csd:addressLine",address.state).att("component","stateProvince")
                    providerAddress.ele("csd:addressLine",address.country).att("component","country")
                    providerAddress.ele("csd:addressLine",address.postalCode).att("component","postalCode")
                    resolve()
                  }))

                })
              }

              Promise.all(addressPromises).then(()=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //contacts
            contacts: function(callback) {
              const contactsPromises = []
              let providerContactPoint = ''
              if(resource.hasOwnProperty("telecom")){
                resource.telecom.forEach((telecom)=>{
                  contactsPromises.push(new Promise((resolve, reject) => {
                    providerContactPoint = providerDemographic.ele("csd:contactPoint")
                    var code = ''
                    if(telecom.system == 'phone')
                      code = "BP"
                    if(telecom.system == 'email')
                      code = "EMAIL"
                    if(telecom.system == 'fax')
                      code = "FAX"
                    else if(telecom.system == "other")
                      code = "OTHER"
                    providerContactPoint.ele("csd:codedType",telecom.value).att("code",code)
                    resolve()
                  }))
                })
              }
              Promise.all(contactsPromises).then(()=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //credentials
            credentials: function(callback){
              const credentialsPromises = []
              let providerCredentials = ''
              if(resource.hasOwnProperty("qualification")) {
                resource.qualification.forEach((qualification)=>{
                  credentialsPromises.push(new Promise((resolve, reject) => {
                    providerCredentials = provider.ele("csd:credential")
                    if(qualification.hasOwnProperty("identifier")) {
                      qualification.identifier.forEach((identifier)=>{
                        providerCredentials.ele("csd:number",identifier.value)
                      })
                    }
                    if(qualification.hasOwnProperty("code") && qualification.code.hasOwnProperty("coding")) {
                      qualification.code.coding.forEach((coding)=>{
                        credentialsPromises.push(new Promise((resolve, reject) => {
                          let codedType = providerCredentials.ele("csd:codedType",coding.display)
                          codedType.att("code",coding.code).att("codingScheme",coding.system)
                          resolve()
                        }))
                      })  
                    }
                    
                    if(qualification.hasOwnProperty('issuer') && qualification.issuer.hasOwnProperty("display"))
                      providerCredentials.ele("csd:issuingAuthority",qualification.issuer.display)
                    if(qualification.hasOwnProperty('period') && qualification.period.hasOwnProperty('start'))
                      providerCredentials.ele("csd:credentialIssueDate",qualification.period.start)
                    if(qualification.hasOwnProperty('period') && qualification.period.hasOwnProperty('end'))
                      providerCredentials.ele("csd:csd:credentialRenewalDate",qualification.period.end)
                    resolve()
                  }))
                })
              }
              Promise.all(credentialsPromises).then(()=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //language
            language: function(callback){
              const languagePromises = []
              if(resource.hasOwnProperty("communication")) {
                resource.communication.forEach((communication)=>{
                  languagePromises.push(new Promise((resolve, reject) => {
                    if(communication.hasOwnProperty("coding")) {
                      communication.coding.forEach((coding)=>{
                        languagePromises.push(new Promise((resolve, reject) => {
                          provider.ele("csd:language",coding.display).att("code",coding.code).att("codingScheme",coding.system)
                          resolve()
                        }))
                      })
                      resolve()
                    }
                    else
                      resolve()
                  }))
                })
              }
              Promise.all(languagePromises).then(()=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //specialty
            specialty: function(callback){
              let providerSpecialty = ''
                async.eachSeries(practitionerRole.resource.entry,(entryPractRole,nxtEntry)=>{
                  if(entryPractRole.resource.hasOwnProperty("specialty")) {
                    async.eachSeries(entryPractRole.resource.specialty,(specialty,nxtSpec)=>{
                      if(specialty.hasOwnProperty("code") && specialty.code.hasOwnProperty("coding")) {
                        async.eachSeries(specialty.code.coding,(coding,nxtCoding)=>{
                          providerSpecialty = provider.ele("csd:specialty",coding.display)
                          providerSpecialty.att("code",coding.code)
                          providerSpecialty.att("codingScheme",coding.system)
                          return nxtCoding()
                        },function(){
                          nxtSpec()
                        })
                      }
                      else
                        nxtSpec()
                    },function(){
                      nxtEntry()
                    })
                  }
                  else
                    return nxtEntry()
                },function(){
                  callback()
                })
            },
            //organization
            organization: function(callback){
              const organizationPromises = []
              let providerOrganizations = ''
                var organizations = false
                if(practitionerRole.resource.entry.length > 0)
                practitionerRole.resource.entry.forEach((entryPractRole)=>{
                  if(entryPractRole.resource.hasOwnProperty("location")) {
                    entryPractRole.resource.location.forEach((location)=>{
                      organizationPromises.push(new Promise((resolve, reject) => {
                        if(!location.hasOwnProperty("reference")) {
                          return resolve()
                        }
                      var referenceArr = location.reference.split("Location/")
                      var reference = referenceArr[referenceArr.length-1]
                      getLocationByIdentifier(ctx,reference,(loc)=>{
                        if(loc.resource.entry.length > 0) {
                          loc.resource.entry.forEach((entryLoc)=>{
                            if( entryLoc.resource.hasOwnProperty("physicalType") && 
                                entryLoc.resource.physicalType.hasOwnProperty("coding")
                              ) {
                              entryLoc.resource.physicalType.coding.forEach((coding)=>{
                                if(coding.code == "jdn") {
                                  if(!organizations)
                                  providerOrganizations = provider.ele("csd:organizations")
                                  organizations = true
                                  providerOrganizations.ele("csd:organization").att("entityID",reference)
                                }
                             })
                            }
                          })
                          resolve()
                        }
                        else {
                        resolve()
                        }
                      })
                    }))
                    })
                  }
                })
              Promise.all(organizationPromises).then((values)=>{
                callback()
              }).catch(function(reason){
                logger.error(reason)
              })
            },
            //providerFacilities
            providerFacilities: function(callback){
              const providerFacilitiesPromises = []
              let providerFacilities = ''
              var facilities = false
              practitionerRole.resource.entry.forEach((entryPractRole)=>{
                providerFacilitiesPromises.push(new Promise((resolve, reject) => {
                  if(entryPractRole.resource.hasOwnProperty("location")) {
                    entryPractRole.resource.location.forEach((location)=>{
                      if(!location.hasOwnProperty("reference")) {
                        return resolve()
                      }
                      var referenceArr = location.reference.split("Location/")
                      var reference = referenceArr[referenceArr.length-1]
                      getLocationByIdentifier(ctx,reference,(loc)=>{
                        if(loc.resource.entry.length > 0) {
                          loc.resource.entry.forEach((entryLoc)=>{
                            if( entryLoc.resource.hasOwnProperty("physicalType") && 
                                entryLoc.resource.physicalType.hasOwnProperty("coding")
                              ) {
                              async.eachSeries(entryLoc.resource.physicalType.coding,(coding,nxtCoding)=>{
                                if(coding.code == "bu") {
                                  if(!facilities)
                                    providerFacilities = provider.ele("csd:facilities")
                                  facilities = true
                                  providerFacilities.ele("csd:facility").att("entityID",reference)
                                  nxtCoding()
                                }
                              },function(){
                                resolve()
                              })
                            }
                            else{
                              resolve()
                            }
                          })  
                        }
                        else{
                          resolve()
                        }
                      })
                    })
                  }
                  else{
                    resolve()
                  }
                }))
              })
              Promise.all(providerFacilitiesPromises).then(()=>{
                callback()
              }).catch((reason)=>{
                logger.error(reason)
              })
            },
            //record status
            providerRecord: function(callback){
              const providerRecordPromises = []
              let providerRecord = ''
              var practLastUpdated = resource.meta.lastUpdated
              var practLastUpdatedHR = new Date(practLastUpdated)
              var practRoleLastUpdated = ''
              var practRoleLastUpdatedHR = ''
              practitionerRole.resource.entry.forEach((entryPractRole)=>{
                providerRecordPromises.push(new Promise((resolve, reject) => {
                  practRoleLastUpdated = entryPractRole.resource.meta.lastUpdated
                  practRoleLastUpdatedHR = new Date(practRoleLastUpdated)
                  resolve()
                }))
              })
              
              if (practLastUpdatedHR > practRoleLastUpdatedHR)
                var lastUpdated = practLastUpdated
              else if (practLastUpdatedHR < practRoleLastUpdatedHR)
                var lastUpdated = practRoleLastUpdated
              else
                var lastUpdated = practLastUpdated
              var status = ''
              if(resource.active === true || resource.active == "true")
                status = "Active"
              else if(resource.active === false || resource.active == "false")
                status = "Inactive"
              provider.ele("csd:record").att("updated",lastUpdated).att("status",status)
              Promise.all(providerRecordPromises).then(()=>{
                callback()
              }).catch((reason)=>{
                logger.error(reason)
              })
            }
          }, function(err,res){
            resolve1()
          })
        })
      }))
    })
    Promise.all(promises).then(() => {
        return callback(providerDir)
    }).catch((reason)=>{
      logger.error(reason)
    })

  }

  const translateServiceToCSD = (bundleResource,ctx,callback)=>{
    const promises = []
    const serviceDir = xmlbuilder.begin().ele("csd:serviceDirectory")
    bundleResource.resource.entry.forEach((entry)=>{
      const resource = entry.resource
      let service = serviceDir.ele("csd:service")
      var entityID = null
      resource.identifier.forEach((identifier)=>{
        promises.push(new Promise((resolve, reject) => {
          if(identifier.system == "urn:ihe:iti:csd:2013:entityID")
            entityID = identifier.value
          resolve()
        }))
      })
      if(entityID == null)
        entityID = "urn:uuid" + resource.id

      service.att("entityID",entityID)

      //otherID
      if(resource.hasOwnProperty("identifier")) {
        resource.identifier.forEach((identifier)=>{
          promises.push(new Promise((resolve, reject) => {
            if(identifier.system != "urn:ihe:iti:csd:2013:entityID") {
              if(!identifier.hasOwnProperty("value")) {
                identifier.value = ''
              }
              if(!identifier.hasOwnProperty("system")) {
                identifier.system = ''
              }
              var otherID = service.ele("csd:otherID",identifier.value)
              otherID.att("assigningAuthorityName",identifier.system)
            }
            resolve()
          }))
        })
      }

      //codedType
      if(resource.hasOwnProperty("type")) {
        resource.type.forEach((type)=>{
          if(type.hasOwnProperty("coding")) {
            promises.push(new Promise((resolve, reject) => {
              type.coding.forEach((coding)=>{
                var codedType = service.ele("csd:codedType",coding.display)
                codedType.att("code",coding.code)
                codedType.att("codingScheme",coding.system)
              })
              resolve()
            }))
          }
        })
      }

      var status = ''
      if(resource.active === true || resource.active == "true")
        status = "Active"
      else if(resource.active === false || resource.active == "false")
        status = "Inactive"
      service.ele("csd:record").att("updated",resource.meta.lastUpdated).att("status",status)
    })
    Promise.all(promises).then(() => {
      return callback(serviceDir)
    }).catch((reason)=>{
      logger.error(reason)
    })
  }

  const translateLocationToCSD = (bundleResource,ctx,callback)=>{
    const promises = []
    const organizationDir = xmlbuilder.begin().ele("csd:organizationDirectory")
    const facilityDir = xmlbuilder.begin().ele("csd:facilityDirectory")
    bundleResource.resource.entry.forEach( (entry)=>{
      var resource = entry.resource
      if(resource.hasOwnProperty("physicalType") && resource.physicalType.hasOwnProperty("coding"))
      resource.physicalType.coding.forEach((coding)=>{
        promises.push(new Promise((resolve, reject) => {
          if(coding.code == "jdn") {
            getCSDOrganization(resource,organizationDir,ctx,(csdOrgDir)=>{
              organizationDir.importDocument(csdOrgDir)
              resolve()
            })
          }
          else if(coding.code == "bu"){
            getCSDFacility(resource,ctx,(csdFacDir)=>{
              facilityDir.importDocument(csdFacDir)
              resolve()
            })
          }
          else
            resolve()
        }))
      })
    })

    Promise.all(promises).then((values) => {
      return callback(facilityDir,organizationDir)
    }).catch((reason)=>{
      logger.error(reason)
    })
  }

  const getCSDFacility = (resource,ctx,callback)=>{
    const promises = []
    const facility = xmlbuilder.begin().ele("csd:facility")
    let entityID = null
    resource.identifier.forEach((identifier)=>{
      promises.push(new Promise((resolve, reject) => {
        if(identifier.system == "urn:ihe:iti:csd:2013:entityID")
          entityID = identifier.value
        resolve()
      }))
    })
    if(entityID == null)
        entityID = "urn:uuid" + resource.id

    facility.att("entityID",entityID)
    facility.ele("csd:primaryName",resource.name)

    //otherID
    if(resource.hasOwnProperty("identifier")) {
      resource.identifier.forEach((identifier)=>{
        promises.push(new Promise((resolve, reject) => {
          if(identifier.system != "urn:ihe:iti:csd:2013:entityID") {
            var otherID = facility.ele("csd:otherID",identifier.value)
            otherID.att("assigningAuthorityName",identifier.system)
          }
          resolve()
        }))
      })
    }

    //codedType
    if(resource.hasOwnProperty("type") && resource.hasOwnProperty("coding")) {
      resource.type.coding.forEach((coding)=>{
        promises.push(new Promise((resolve, reject) => {
          var codedType = facility.ele("csd:codedType",coding.display)
          codedType.att("code",coding.code)
          codedType.att("codingScheme",coding.system)
          resolve()
        }))
      })
    }

    //otherName
    if(resource.hasOwnProperty("alias")) {
      resource.alias.forEach((alias)=>{
        promises.push(new Promise((resolve, reject) => {
          var otherName = facility.ele("csd:otherName",alias)
          resolve()
        }))
      })
    }

    //address
    if(resource.hasOwnProperty("address")) {
      var address = facility.ele("csd:address")
      if(resource.address.hasOwnProperty("type"))
        address.att("type",resource.address.type)
      if(resource.address.hasOwnProperty("line"))
        address.ele("csd:addressLine",resource.address.line).att("component","streetAddress")
      if(resource.address.hasOwnProperty("city"))
        address.ele("csd:addressLine",resource.address.city).att("component","city")
      if(resource.address.hasOwnProperty("state"))
        address.ele("csd:addressLine",resource.address.state).att("component","stateProvince")
      if(resource.address.hasOwnProperty("country"))
        address.ele("csd:addressLine",resource.address.country).att("component","country")
      if(resource.address.hasOwnProperty("postalCode"))
        address.ele("csd:addressLine",resource.address.postalCode).att("component","postalCode")
    }

    //geocode
    if(resource.hasOwnProperty("position")) {
      var geocode = facility.ele("csd:geocode")
      if(resource.position.hasOwnProperty("longitude"))
        geocode.ele("csd:longitude",resource.position.longitude)
      if(resource.position.hasOwnProperty("latitude"))
        geocode.ele("csd:latitude",resource.position.latitude)
      if(resource.position.hasOwnProperty("altitude"))
        geocode.ele("csd:altitude",resource.position.altitude)
    }

    //contactPoint
    if(resource.hasOwnProperty("telecom"))
    resource.telecom.forEach((telecom)=>{
      promises.push(new Promise((resolve, reject) => {
        var code = ''
        if(telecom.system == 'phone')
          code = "BP"
        if(telecom.system == 'email')
          code = "EMAIL"
        if(telecom.system == 'fax')
          code = "FAX"
        else if(telecom.system == "other")
          code = "OTHER"
        var contPnt = facility.ele("csd:contactPoint")
        contPnt.ele("csd:codedType",telecom.value).att("code",code)
        resolve()
      }))
    })

    if(resource.hasOwnProperty("partOf")) {
      var referenceArr = resource.partOf.reference.split("Location/")
      var reference = referenceArr[referenceArr.length-1]
      var orgs = facility.ele("csd:organizations")
      orgs.ele("csd:organization").att("entityID",reference)
    }

    var lastUpdated = resource.meta.lastUpdated
    var status = resource.status
    facility.ele("csd:record").att("updated",lastUpdated).att("status",status)

    Promise.all(promises).then((values) => {
      return callback(facility)
    }).catch((reason)=>{
      logger.error(reason)
    })
  }

  const getCSDOrganization = (resource,organizationDir,ctx,callback)=>{
    const promises = []
    const organization = xmlbuilder.begin().ele("csd:organization")
    let entityID = null
    resource.identifier.forEach((identifier)=>{
      promises.push(new Promise((resolve, reject) => {
        if(identifier.system == "urn:ihe:iti:csd:2013:entityID")
          entityID = identifier.value
        resolve()
      }))
    })
    if(entityID == null)
        entityID = "urn:uuid" + resource.id

    organization.att("entityID",entityID)
    organization.ele("csd:primaryName",resource.name)

    //otherID
    resource.identifier.forEach((identifier)=>{
      promises.push(new Promise((resolve, reject) => {
        if(identifier.system != "urn:ihe:iti:csd:2013:entityID") {
          var otherID = organization.ele("csd:otherID",identifier.value)
          otherID.att("assigningAuthorityName",identifier.system)
        }
        resolve()
      }))
    })

    //codedType
    resource.type.coding.forEach((coding)=>{
      promises.push(new Promise((resolve, reject) => {
        var codedType = organization.ele("csd:codedType",coding.display)
        codedType.att("code",coding.code)
        codedType.att("codingScheme",coding.system)
        resolve()
      }))
    })

    //otherName
    if(resource.hasOwnProperty("alias"))
    resource.alias.forEach((alias)=>{
      promises.push(new Promise((resolve, reject) => {
        var otherName = organization.ele("csd:otherName",alias)
        resolve()
      }))
    })

    //address
    if(resource.hasOwnProperty("address")) {
      var address = organization.ele("csd:address")
      if(resource.address.hasOwnProperty("type"))
        address.att("type",resource.address.type)
      if(resource.address.hasOwnProperty("line"))
        address.ele("csd:addressLine",resource.address.line).att("component","streetAddress")
      if(resource.address.hasOwnProperty("city"))
        address.ele("csd:addressLine",resource.address.city).att("component","city")
      if(resource.address.hasOwnProperty("state"))
        address.ele("csd:addressLine",resource.address.state).att("component","stateProvince")
      if(resource.address.hasOwnProperty("country"))
        address.ele("csd:addressLine",resource.address.country).att("component","country")
      if(resource.address.hasOwnProperty("postalCode"))
        address.ele("csd:addressLine",resource.address.postalCode).att("component","postalCode")
    }

    //contactPoint
    if(resource.hasOwnProperty("telecom"))
    resource.telecom.forEach((telecom)=>{
      promises.push(new Promise((resolve, reject) => {
        var code = ''
        if(telecom.system == 'phone')
          code = "BP"
        if(telecom.system == 'email')
          code = "EMAIL"
        if(telecom.system == 'fax')
          code = "FAX"
        else if(telecom.system == "other")
          code = "OTHER"
        var contPnt = organization.ele("csd:contactPoint")
        contPnt.ele("csd:codedType",telecom.value).att("code",code)
        resolve()
      }))
    })

    //parent
    if(resource.hasOwnProperty("partOf")) {
      var referenceArr = resource.partOf.reference.split("Location/")
      var reference = referenceArr[referenceArr.length-1]
      organization.ele("csd:parent").att("entityID",reference)
    }

    var lastUpdated = resource.meta.lastUpdated
    var status = resource.status
    organization.ele("csd:record").att("updated",lastUpdated).att("status",status)

    Promise.all(promises).then((values) => {
      return callback(organization)
    }).catch((reason)=>{
      logger.error(reason)
    })
  }

  return {
    translatePractitionerToCSD: translatePractitionerToCSD,
    translateLocationToCSD: translateLocationToCSD,
    translateServiceToCSD: translateServiceToCSD
  }
}