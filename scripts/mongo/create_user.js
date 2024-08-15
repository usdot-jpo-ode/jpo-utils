// Create indexes on all collections

/*
This script is responsible for initializing the replica set, creating collections, adding indexes and TTLs
*/
console.log("Running create_indexes.js");

const ode_db = process.env.MONGO_DB_NAME;
const ode_user = process.env.MONGO_ODE_DB_USER;
const ode_pass = process.env.MONGO_ODE_DB_PASS;

const retry_milliseconds = 5000;

console.log("ODE DB Name: " + ode_db);

try {
    console.log("Initializing replica set...");

    var config = {
        "_id": "rs0",
        "version": 1,
        "members": [
        {
            "_id": 0,
            "host": "mongo:27017",
            "priority": 2
        },
        ]
    };
    rs.initiate(config, { force: true });
    rs.status();
} catch(e) {
    rs.status().ok
}

// Function to check if the replica set is ready
function isReplicaSetReady() {
    let status;
    try {
        status = rs.status();
    } catch (error) {
        console.error("Error getting replica set status: " + error);
        return false;
    }

    // Check if the replica set has a primary
    if (!status.hasOwnProperty('myState') || status.myState !== 1) {
        console.log("Replica set is not ready yet");
        return false;
    }

    console.log("Replica set is ready");
    return true;
}

try{

    // Wait for the replica set to be ready
    while (!isReplicaSetReady()) {
        sleep(retry_milliseconds);
    }
    sleep(retry_milliseconds);
    // creates another user
    console.log("Creating ODE user...");
    admin = db.getSiblingDB("admin");
    // Check if user already exists
    var user = admin.getUser(ode_user);
    if (user == null) {
        admin.createUser(
            {
                user: ode_user,
                pwd: ode_pass,
                roles: [
                    { role: "readWrite", db: ode_db },
                ]
            }
        );
    } else {
        console.log("User \"" + ode_user + "\" already exists.");
    }

} catch (error) {
    print("Error connecting to the MongoDB instance: " + error);
}