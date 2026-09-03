#!/bin/bash
echo "Running restore_mongo.sh"

# Initialize the replica set
echo "Initializing replica set..."
mongosh --host mongo:27017 -u "${MONGO_ADMIN_DB_USER}" -p "${MONGO_ADMIN_DB_PASS}" --authenticationDatabase admin --eval '
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo:27017" }
  ]
});
'

# Wait for the node to become primary
echo "Waiting for the node to become primary..."
until mongosh --host mongo:27017 -u "${MONGO_ADMIN_DB_USER}" -p "${MONGO_ADMIN_DB_PASS}" --authenticationDatabase admin --eval '
quit(db.isMaster().ismaster ? 0 : 2);
' &>/dev/null; do
  sleep 1
done

echo "Replica set initialized and primary node is ready!"

# Restore data if sample data path is provided
echo "Restoring mongo data"

# Ensure username and password are set
if [ -z "${MONGO_ADMIN_DB_USER}" ] || [ -z "${MONGO_ADMIN_DB_PASS}" ]; then
    echo "Error: MONGO_ADMIN_DB_USER or MONGO_ADMIN_DB_PASS is not set."
    exit 1
fi
echo "Restore Calling Dump"

mongorestore --host mongo --username "${MONGO_ADMIN_DB_USER}" --password "${MONGO_ADMIN_DB_PASS}" --authenticationDatabase admin /dump
echo "Restore Done Dumping"