const MongoClient = require('mongodb').MongoClient


MongoClient.connect("mongodb://localhost/hearth-dev", (err, database) => {
    if ( err ) throw err

    console.log("connected to "+database.databaseName)

    let test1 = database.db('test1')
    console.log("connected to "+test1.databaseName)

    database.close()
    console.log("connected to "+test1.databaseName)
    console.log("connected to "+database.databaseName)
})
