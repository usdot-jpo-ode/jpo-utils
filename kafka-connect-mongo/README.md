# MongoDB Deposit Service
The mongo-connector service connects to specified Kafka topics (as defined in the mongo-connector/connect_start.sh script) and deposits these messages to separate collections in the MongoDB Database. The codebase that provides this functionality comes from Confluent using their community licensed [cp-kafka-connect image](https://hub.docker.com/r/confluentinc/cp-kafka-connect). Documentation for this image can be found [here](https://docs.confluent.io/platform/current/connect/index.html#what-is-kafka-connect).

## Configuration
Provided in the mongo-connector directory is a sample configuration shell script ([connect_start.sh](./scripts/kafka-connect/connect_start.sh)) that can be used to create kafka connectors to MongoDB. The connectors in kafka connect are defined in the format that follows:
``` shell
declare -A config_name=([name]="topic_name" [collection]="mongo_collection_name"
    [convert_timestamp]=true [timefield]="timestamp" [use_key]=true [key]="key" [add_timestamp]=true)
```
The format above describes the basic configuration for configuring a sink connector, this should be placed at the beginning of the connect_start.sh file. In general we recommend to keep the MongoDB collection name the same as the topic name to avoid confusion. Additionally, if there is a top level timefield set `convert_timestamp` to true and then specify the time field name that appears in the message. This will allow MongoDB to transform that message into a date object to allow for TTL creation and reduce message size. To override MongoDB's default message `_id` field, set `use_key` to true and then set the `key` property to "key". The "add_timestamp" field defines whether the connector will add a auto generated timestamp to each document. This allows for creation of Time To Live (TTL) indexes on the collections to help limit collection size growth.

After the sink connector is configured above, then make sure to call the createSink function with the config_name of the configuration like so:
``` shell
createSink config_name
```
This needs to be put after the createSink function definition.

## Quick Run
1. Create a copy of `sample.env` and rename it to `.env`.
2. Update the variable `DOCKER_HOST_IP` to the local IP address of the system running docker and 
3. Set an `admin` user password with the `MONGO_ADMIN_DB_PASS` variable.
4. Set the `ode` user password with the `MONGO_ODE_DB_PASS` variable.
5. Navigate back to the root directory and run the following command: `docker compose -f docker-compose-mongo.yml up -d`
6. Using either a local kafka install or [kcat](https://github.com/edenhill/kcat) to produce a sample message to one of the sink topics. Optionally, you can separately run the [ODE](https://github.com/usdot-jpo-ode/jpo-ode) and process messages directly from it's output.
7. Using [MongoDB Compass](https://www.mongodb.com/products/compass) or another DB visualizer connect to the MongoDB database using this connection string: `mongodb://[admin_user]:[admin_password]@localhost:27017/?directConnection=true`
8. Now we are done! If everything is working properly you should see an ODE database with a collection for each kafka sink topic that contains messages.
