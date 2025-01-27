// Create indexes on all collections

/*
This is the second script responsible for configuring mongoDB automatically on startup.
This script is responsible for creating users, creating collections, adding indexes, and configuring TTLs
For more information see the header in a_init_replicas.js
*/

console.log("");
console.log("Running create_indexes.js");

Object.keys(process.env).forEach(key => {
    console.log(`${key}: ${process.env[key]}`);
});


// Setup Username and Password Definitions
const MONGO_ROOT_USERNAME = process.env['MONGO_ADMIN_DB_USER'];
const MONGO_ROOT_PASSWORD = process.env['MONGO_ADMIN_DB_PASS'];

const MONGO_READ_WRITE_USER=process.env['MONGO_READ_WRITE_USER'];
const MONGO_READ_WRITE_PASS=process.env['MONGO_READ_WRITE_PASS'];

const MONGO_READ_USER = process.env['MONGO_READ_USER'];
const MONGO_READ_PASS = process.env['MONGO_READ_PASS'];

// Prometheus Exporter User
const MONGO_EXPORTER_USERNAME = process.env['MONGO_EXPORTER_USERNAME'];
const MONGO_EXPORTER_PASSWORD = process.env['MONGO_EXPORTER_PASSWORD'];

const MONGO_DB_NAME = process.env['MONGO_DB_NAME'] || "CV";

const expireSeconds = Number(process.env['MONGO_DATA_RETENTION_SECONDS']) || 5184000; // 2 months
const ttlExpireSeconds = Number(process.env['MONGO_ASN_RETENTION_SECONDS']) || 86400; // 24 hours
const retryMilliseconds = 10000;

const CONNECT_CREATE_ODE = process.env['CONNECT_CREATE_ODE'] || true;
const CONNECT_CREATE_GEOJSONCONVERTER = process.env['CONNECT_CREATE_GEOJSONCONVERTER'] || true;
const CONNECT_CREATE_CONFLICTMONITOR = process.env['CONNECT_CREATE_CONFLICTMONITOR'] || true;
const CONNECT_CREATE_DEDUPLICATOR = process.env['CONNECT_CREATE_DEDUPLICATOR'] || true;


const users = [
    // {username: CM_MONGO_ROOT_USERNAME, password: CM_MONGO_ROOT_PASSWORD, roles: "root", database: "admin" },
    {username: MONGO_READ_WRITE_USER, password: MONGO_READ_WRITE_PASS, permissions: [{role: "readWrite", database: MONGO_DB_NAME}]},
    {username: MONGO_READ_USER, password: MONGO_READ_PASS, permissions: [{role: "read", database: MONGO_DB_NAME}]},
    {username: MONGO_EXPORTER_USERNAME, password: MONGO_EXPORTER_PASSWORD, permissions: [{role: "clusterMonitor", database: "admin"}, {role: "read", database: MONGO_DB_NAME}]}
];

console.log("\n\n\n\nMONGO_READ_WRITE_USER: " + MONGO_READ_WRITE_USER);
console.log("MONGO_READ_WRITE_PASS: " + MONGO_READ_WRITE_PASS + "\n\n\n\n");


// name -> collection name
// ttlField -> field to perform ttl on 
// timeField -> field to index for time queries
// intersectionField -> field containing intersection id for id queries
// rsuIP -> field containing an rsuIP if available
// expireTime -> the number of seconds after the ttl field at which the record should be deleted
const odeCollections = [
    // ODE Json data
    {name: "OdeDriverAlertJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeBsmJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeBsmJson", "timeField": "recordGeneratedAt", rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeMapJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeMapJson", "timeField": "recordGeneratedAt", rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeSpatJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeSpatRxJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeSrmJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeSrmJson", "timeField": "recordGeneratedAt", rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeSsmJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeSsmJson", "timeField": "recordGeneratedAt", rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeTimJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeTimJson", "timeField": "recordGeneratedAt", rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeTimBroadcastJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},
    {name: "OdeTIMCertExpirationTimeJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: expireSeconds},

    // Ode Raw ASN
    {name: "OdeRawEncodedBSMJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: ttlExpireSeconds},
    {name: "OdeRawEncodedMAPJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: ttlExpireSeconds},
    {name: "OdeRawEncodedSPATJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: ttlExpireSeconds},
    {name: "OdeRawEncodedSRMJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: ttlExpireSeconds},
    {name: "OdeRawEncodedSSMJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: ttlExpireSeconds},
    {name: "OdeRawEncodedTIMJson", ttlField: "recordGeneratedAt", "timeField": "metadata.odeReceivedAt", intersectionField: null, rsuIP:"metadata.originIp", expireTime: ttlExpireSeconds},
];

// GeoJson Converter Data
const geoJsonConverterCollections = [
    {name: "ProcessedMap", ttlField: "recordGeneratedAt", timeField: "properties.timeStamp", intersectionField: "properties.intersectionId", expireTime: expireSeconds},
    {name: "ProcessedSpat", ttlField: "recordGeneratedAt", timeField: "utcTimeStamp", intersectionField: "intersectionId", expireTime: expireSeconds},
    {name: "ProcessedBsm", ttlField: "recordGeneratedAt", timeField: "timeStamp", geoSpatialField: "features.geometry.coordinates", expireTime: expireSeconds},
];


const conflictMonitorCollections = [
    // Conflict Monitor Events
    { name: "CmStopLineStopEvent", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmStopLinePassageEvent", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmIntersectionReferenceAlignmentEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalGroupAlignmentEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmConnectionOfTravelEvent", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalStateConflictEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmLaneDirectionOfTravelEvent", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSpatTimeChangeDetailsEvent", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSpatMinimumDataEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmMapBroadcastRateEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmMapMinimumDataEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSpatBroadcastRateEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmBsmEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },


    { name: "CmSpatMessageCountProgressionEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmMapMessageCountProgressionEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmBsmMessageCountProgressionEvents", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },

    { name: "CmSpatMinimumDataAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmMapMinimumDataAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmIntersectionReferenceAlignmentAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalGroupAlignmentAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalStateConflictAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmTimeChangeDetailsAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmEventStateProgressionAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmBsmMessageCountProgressionAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmMapMessageCountProgressionAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSpatMessageCountProgressionAggregation", ttlField: "eventGeneratedAt", timeField: "eventGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },


    // Conflict Monitor Assessments
    { name: "CmLaneDirectionOfTravelAssessment", ttlField: "assessmentGeneratedAt", timeField: "assessmentGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmConnectionOfTravelAssessment", ttlField: "assessmentGeneratedAt", timeField: "assessmentGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalStateEventAssessment", ttlField: "assessmentGeneratedAt", timeField: "assessmentGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmStopLineStopAssessment", ttlField: "assessmentGeneratedAt", timeField: "assessmentGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    
    // Conflict Monitor Notifications
    { name: "CmSpatTimeChangeDetailsNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmLaneDirectionOfTravelNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmConnectionOfTravelNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmAppHealthNotifications", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalStateConflictNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalGroupAlignmentNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmStopLinePassageNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmStopLineStopNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmNotification", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },

    { name: "CmEventStateProgressionNotificationAggregation", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmIntersectionReferenceAlignmentNotificationAggregation", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalGroupAlignmentNotificationAggregation", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmSignalStateConflictNotificationAggregation", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },
    { name: "CmTimeChangeDetailsNotificationAggregation", ttlField: "notificationGeneratedAt", timeField: "notificationGeneratedAt", intersectionField: "intersectionID", expireTime: expireSeconds },

    // Reports
    { name: "CmReport", timeField: "reportGeneratedAt", intersectionField: "intersectionID"},

];

let collections = [];

if(CONNECT_CREATE_ODE){
    collections = collections.concat(odeCollections);
}

if(CONNECT_CREATE_GEOJSONCONVERTER){
    collections = collections.concat(geoJsonConverterCollections);
}

if(CONNECT_CREATE_CONFLICTMONITOR){
    collections = collections.concat(conflictMonitorCollections);
}


try{
    
    db.getMongo().setReadPref("primaryPreferred");
    db = db.getSiblingDB("admin");
    db.runCommand({autoCompact: true});
    
    // Create Users in Database
    for(user of users){
        createUser(user);
    }

    db = db.getSiblingDB(MONGO_DB_NAME);
    db.getMongo().setReadPref("primaryPreferred");
    var isMaster = db.isMaster();
    if (isMaster.primary) {
        console.log("Connected to the primary replica set member.");
    } else {
        console.log("Not connected to the primary replica set member. Current node: " + isMaster.host);
    }
} 
catch(err){
    console.log("Could not switch DB to Sibling DB");
    console.log(err);
}



// Wait for the collections to exist in mongo before trying to create indexes on them
let missing_collection_count;
do {
    try {
        missing_collection_count = 0;
        const collectionNames = db.getCollectionNames();
        for (collection of collections) {
            // Create Collection if it doesn't exist
            let created = false;
            if(!collectionNames.includes(collection['name'])){
                created = createCollection(collection);
            }else{
                created = true;
            }

            if(created){
                createTTLIndex(collection);
                createTimeIntersectionIndex(collection);
                createTimeRsuIpIndex(collection);
                createGeoSpatialIndex(collection);
            }else{
                missing_collection_count++;
                console.log("Collection " + collection['name'] + " does not exist yet");
            }
        }
        if (missing_collection_count > 0) {
            console.log("Waiting on " + missing_collection_count + " collections to be created...will try again in " + retryMilliseconds + " ms");
            sleep(retryMilliseconds);
        }
    } catch (err) {
        console.log("Error while setting up TTL indexes in collections");
        console.log(rs.status());
        console.error(err);
        sleep(retryMilliseconds);
    }
} while (missing_collection_count > 0);

console.log("Finished Creating All TTL indexes");

function createUser(user){
    try{
        console.log("Creating User: " + user['username'] + " with Permissions: " + JSON.stringify(user['permissions']));
        db.createUser(
        {
            user: user['username'],
            pwd: user['password'],
            roles: user['permissions'].map(permission => ({
                role: permission['role'],
                db: permission['database']
            }))
        });
    } catch (error) {
        console.error("Error creating user: ", error);
    }
}

function createCollection(collection){
    try {
        db.createCollection(collection['name']);
        return true;
    } catch (err) {
        console.log("Unable to Create Collection: " + collection.name);
        console.log(err);
        return false;
    }
}

// Create TTL Indexes
function createTTLIndex(collection) {
    if(collection.hasOwnProperty("ttlField") && collection['ttlField'] != null){
        const ttlField = collection['ttlField'];
        const collectionName = collection['name'];
        const duration = collection['expireTime'];
        
        let indexJson = {};
        indexJson[ttlField] = 1;


        console.log(collectionName, duration, ttlField);
        try{
            if (ttlIndexExists(collection)) {
                db.runCommand({
                    "collMod": collectionName,
                    "index": {
                        keyPattern: indexJson,
                        expireAfterSeconds: duration
                    }
                });
                console.log("Updated TTL index for " + collectionName + " using the field: " + ttlField + " as the timestamp");
            }else{
                db.getCollection(collectionName).createIndex(indexJson,
                    {expireAfterSeconds: duration}
                );
                console.log("Created TTL index for " + collectionName + " using the field: " + ttlField + " as the timestamp");
            }
        } catch(err){
            console.log("Failed to Create or Update index for " + collectionName + " using the field: " + ttlField + " as the timestamp");
            console.log(err);
        }
    }
}

function createTimeIndex(collection){
    if(timeIndexExists(collection)){
        // Skip if Index already Exists
        return;
    }

    if(collection.hasOwnProperty("timeField") && collection['timeField'] != null){
        const collectionName = collection['name'];
        const timeField = collection['timeField'];
        console.log("Creating Time Index for " + collectionName);

        var indexJson = {};
        indexJson[timeField] = -1;

        try {
            db[collectionName].createIndex(indexJson);
            console.log("Created Time Intersection index for " + collectionName + " using the field: " + timeField + " as the timestamp");
        } catch (err) {
            db.runCommand({
                "collMod": collectionName,
                "index": {
                    keyPattern: indexJson
                }
            });
            console.log("Updated Time index for " + collectionName + " using the field: " + timeField + " as the timestamp");
        }
    }
}

function createTimeRsuIpIndex(){
    if(timeRsuIpIndexExists(collection)){
        // Skip if Index already Exists
        return;
    }

    if(collection.hasOwnProperty("timeField") && collection.timeField != null && collection.hasOwnProperty("rsuIP") && collection.rsuIP != null){
        const collectionName = collection['name'];
        const timeField = collection['timeField'];
        const rsuIP = collection['rsuIP'];
        console.log("Creating Time rsuIP Index for " + collectionName);

        var indexJson = {};
        indexJson[rsuIP] = -1;
        indexJson[timeField] = -1;
        

        try {
            db[collectionName].createIndex(indexJson);
            console.log("Created Time rsuIP Intersection index for " + collectionName + " using the field: " + timeField + " as the timestamp and : " + rsuIP+" as the rsuIP");
        } catch (err) {
            db.runCommand({
                "collMod": collectionName,
                "index": {
                    keyPattern: indexJson
                }
            });
            console.log("Updated Time rsuIP index for " + collectionName + " using the field: " + timeField + " as the timestamp and : " + rsuIP+" as the rsuIP");
        }
    }
}


function createTimeIntersectionIndex(collection){
    if(timeIntersectionIndexExists(collection)){
        // Skip if Index already Exists
        return;
    }

    if(collection.hasOwnProperty("timeField") && collection.timeField != null && collection.hasOwnProperty("intersectionField") && collection.intersectionField != null){
        const collectionName = collection['name'];
        const timeField = collection['timeField'];
        const intersectionField = collection['intersectionField'];
        console.log("Creating time intersection index for " + collectionName);

        var indexJson = {};
        indexJson[intersectionField] = -1;
        indexJson[timeField] = -1;
        

        try {
            db[collectionName].createIndex(indexJson);
            console.log("Created time intersection index for " + collectionName + " using the field: " + timeField + " as the timestamp and : " + intersectionField + " as the rsuIP");
        } catch (err) {
            db.runCommand({
                "collMod": collectionName,
                "index": {
                    keyPattern: indexJson
                }
            });
            console.log("Updated time intersection index for " + collectionName + " using the field: " + timeField + " as the timestamp and : " + intersectionField + " as the rsuIP");
        }
    }
}

function createGeoSpatialIndex(collection){
    if(geoSpatialIndexExists(collection)){
        return;
    }

    if(collection.hasOwnProperty("timeField") && collection['timeField'] != null && collection.hasOwnProperty("geoSpatialField") && collection['geoSpatialField'] != null){
        const collectionName = collection['name'];
        const timeField = collection['timeField'];
        const geoSpatialField = collection['geoSpatialField'];
        console.log("Creating GeoSpatial index for " + collectionName);

        var indexJson = {};
        indexJson[geoSpatialField] = "2dsphere";
        indexJson[timeField] = -1;
        

        try {
            db[collectionName].createIndex(indexJson);
            console.log("Created time geospatial index for " + collectionName + " using the field: " + timeField + " as the timestamp and : " + geoSpatialField + " as the GeoSpatial Field");
        } catch (err) {
            db.runCommand({
                "collMod": collectionName,
                "index": {
                    keyPattern: indexJson
                }
            });
            console.log("Updated time geospatial index for " + collectionName + " using the field: " + timeField + " as the timestamp and : " + geoSpatialField + " as the GeoSpatial Field");
        }
    }

}

function ttlIndexExists(collection) {
    return db[collection['name']].getIndexes().find((idx) => idx.hasOwnProperty("expireAfterSeconds")) !== undefined;
}

function timeIntersectionIndexExists(collection){
    return db[collection['name']].getIndexes().find((idx) => idx.name == collection['intersectionField'] + "_-1_" + collection['timeField'] + "_-1") !== undefined;
}

function timeRsuIpIndexExists(collection){
    return db[collection['name']].getIndexes().find((idx) => idx.name == collection['rsuIP'] + "_-1_" + collection['timeField'] + "_-1") !== undefined;
}

function timeIndexExists(collection){
    return db[collection['name']].getIndexes().find((idx) => idx.name == collection['timeField'] + "_-1") !== undefined;
}

function geoSpatialIndexExists(collection){
    return db[collection['name']].getIndexes().find((idx) => idx.name == collection['geoSpatialField'] + "_2dsphere_timeStamp_-1") !== undefined;
}
