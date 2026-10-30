# jpo-utils

**US Department of Transportation (USDOT) Intelligent Transportation Systems (ITS) Joint Program Office (JPO) Utilities**

The JPO ITS utilities repository serves as a central location for deploying open-source utilities used by other JPO-ITS repositories.

<a name="toc"></a>

**Table of Contents**

- [jpo-utils](#jpo-utils)
  - [1. Configuration](#1-configuration)
    - [System Requirements](#system-requirements)
    - [Tips and Advice](#tips-and-advice)
  - [2. MongoDB](#2-mongodb)
    - [Quick Run](#quick-run)
  - [3. Kafka](#3-kafka)
    - [Configure Topic Creation](#configure-topic-creation)
      - [Confluent Cloud Support](#confluent-cloud-support)
    - [Quick Run](#quick-run-1)
  - [4. MongoDB Kafka Connect](#4-mongodb-kafka-connect)
    - [Configuration](#configuration)
    - [Configure Kafka Connector Creation](#configure-kafka-connector-creation)
    - [Quick Run](#quick-run-2)
    - [S3 Archive Kafka Connector](#s3-archive-kafka-connector)
  - [5. Monitoring Stack](#5-monitoring-stack)
    - [Configuration](#configuration-1)
    - [Quick Run](#quick-run-3)
    - [Scrape Configurations](#scrape-configurations)
  - [Security Notice](#security-notice)


<a name="base-configuration"></a>

## 1. Configuration

### System Requirements

-  Minimum RAM: 16 GB
-  Supported operating systems:
   -  Ubuntu 22.04 Linux (Recommended)
   -  Windows 10/11 Professional (Professional version required for Docker virtualization)
   -  OSX 10 Mojave
      -  NOTE: Not all images have ARM64 builds (they can still be ran through a compatibility layer)
-  Docker-compose V2 - version 3.4 or newer

The jpo-utils repository is intended to be ran with docker-compose v2 as it uses functionality added in the v2 release.

### Tips and Advice

Read the following guides to familiarize yourself with the jpo-utils Docker configuration.

- [Docker README](docker.md)
- [Docker Compose Profiles](https://docs.docker.com/compose/profiles/)

**Important!**
You must rename `sample.env` to `.env` for Docker to automatically read the file. Do not push this file to source control.

<a name="mongodb"></a>

## 2. MongoDB

A MongoDB instance that is initialized as a standalone replica-set and has configured users is configured in the [docker-compose-mongo](docker-compose-mongo.yml) file. To use a different `setup_mongo.sh` or `create_indexes.js` script, pass in the relative path of the new script by overriding the `KAFKA_INIT_SCRIPT_RELATIVE_PATH` or `MONGO_CREATE_INDEXES_SCRIPT_RELATIVE_PATH` environmental variables. These scripts facilitate the initialization of the MongoDB Database along with the created indexes.

Where the `COMPOSE_PROFILES` variable in you're `.env` file are as follows:

- `mongo_full` - deploys all resources in the [docker-compose-mongo.yml](docker-compose-mongo.yml) file
  - `mongo` - only deploys the `mongo` and `mongo-setup` services
  - `mongo_express` - only deploys the `mongo-express` service

### Quick Run

1. Create a copy of `sample.env` and rename it to `.env`.
2. Update the variable `DOCKER_HOST_IP` to the local IP address of the system running docker which can be found by running the `ifconfig` command
   1. Hint: look for "inet addr:" within "eth0" or "en0" for OSX
3. Set the password for `MONGO_ADMIN_DB_PASS` and `MONGO_READ_WRITE_PASS` environmental variables to a secure password.
4. Set the `COMPOSE_PROFILES` variable to: `mongo_full`
5. Run the following command: `docker-compose up -d`
6. Go to `localhost:8082` in your browser and verify that `mongo-express` can see the created database

[Back to top](#toc)

<a name="kafka"></a>

## 3. Kafka

The [Bitnami Legacy Kafka](https://hub.docker.com/r/bitnamilegacy/kafka) is being used as a hybrid controller and broker in the  [docker-compose-kafka](docker-compose-kafka.yml) file. To use a different `kafka_init.sh` script, pass in the relative path of the new script by overriding the `KAFKA_INIT_SCRIPT_RELATIVE_PATH` environmental variable. This can help in initializing new topics at startup. Note: the intention for the future is to switch this to use the official Apache Kafka image since Bitnami is no longer a reliable image provider.

An optional `kafka-init`, `schema-registry`, and `kafka-ui` instance can be deployed by configuring the `COMPOSE_PROFILES` as follows:

- `kafka_full` - deploys all resources in the [docker-compose-kafka.yml](docker-compose-kafka.yml) file
  - `kafka` - only deploys the `kafka` services
  - `kafka_setup` - deploys a `kafka-setup` service that creates topics in the `kafka` service.  
  - `kafka_schema_registry` - deploys a `kafka-schema-registry` service that can be used to manage schemas for kafka topics
  - `kafka_ui` - deploys a [web interface](https://github.com/kafbat/kafka-ui) to interact with the kafka cluster

### Kafka Topic Log Retention and Rotation

During operation, Kafka stores all the messages published to topics in files called logs. These logs are stored on the host system and can quickly become quite large for deployments with real CV volumes of data. A kafka log may be split across multiple files called segments. Each segment is limited in size based upon the KAFKA_LOG_SEGMENT_BYTES environment variable. The number of segments stored is variable but collectively, the total volume of all segments for 1 partition will not exceed the value specified in KAFKA_LOG_RETENTION_BYTES. When Kafka needs to delete data, either because the total KAFKA_LOG_RETENTION_BYTES is exceeded or because data in the oldest segment exceeds the KAFKA_LOG_RETENTION_HOURS an entire segment file will be deleted. Please note, Kafka will never delete the active log segment. So even if the data is far older than the value specified in KAFKA_LOG_RETENTION_HOURS the data may not be deleted if there is not enough data to fill up the segment and cause the creation of a new log segment. Additionally, please note that the values specified in KAFKA_LOG_RETENTION_BYTES and KAFKA_LOG_SEGMENT_BYTES are on a per topic per partition basis. So for a deployment with multiple partitions and topics, the total used storage will likely become quite large even for what may seem like small individual log and segment sizes. When configuring the KAFKA_LOG_SEGMENT_BYTES and KAFKA_LOG_RETENTION_BYTES variables. Make sure that the KAFKA_LOG_RETENTION_BYTES is larger than the KAFKA_LOG_SEGMENT_BYTES. If the value is not larger, Kafka will not be able to generate a new log segment before needing to rotate the logs which will lead to unpredictable behavior.

### Configure Topic Creation

The Kafka topics created by the `kafka-setup` service are configured in the [kafka-topics-values.yaml](jikkou/kafka-topics-values.yaml) file.  The topics in that file are organized by the application, and sorted into "Stream Topics" (those with `cleanup.policy` = `delete`) and "Table Topics" (with `cleanup.policy` = `compact`).  

The following enviroment variables can be used to configure Kafka Topic creation.  

| Environment Variable | Description |
|---|---|
| `KAFKA_TOPIC_CREATE_ODE` | Whether to create topics for the ODE |
| `KAFKA_TOPIC_CREATE_GEOJSONCONVERTER` | Whether to create topics for the GeoJSON Converter |
| `KAFKA_TOPIC_CREATE_CONFLICTMONITOR` | Whether to create topics for the Conflict Monitor |
| `KAFKA_TOPIC_CREATE_DEDUPLICATOR` | Whether to create topics for the Deduplicator |
| `KAFKA_TOPIC_CREATE_OTHER` | Whether to create topics for other applications, this is only useful when you attach a custom `kafka-topics-values.yaml` file with other topics |
| `KAFKA_TOPICS_VALUES_FILE` | Path to a custom `kafka-topics-values.yaml` file|
| `KAFKA_TOPIC_PARTITIONS` | Number of partitions |
| `KAFKA_TOPIC_REPLICAS` | Number of replicas |
| `KAFKA_TOPIC_MIN_INSYNC_REPLICAS` | Minumum number of in-sync replicas (for use with ack=all) |
| `KAFKA_TOPIC_RETENTION_MS` | Retention time for stream topics, milliseconds |
| `KAFKA_TOPIC_DELETE_RETENTION_MS` | Tombstone retention time for compacted topics, milliseconds |
| `KAFKA_CUSTOM_TOPIC_RETENTION_MS` | Retention time for custom stream topics to allow for a secondary retention time. If more granular retention time is required, this can be further customized by configuring the `retentionMs` per defined topic in the `customTopics` objects within [kafka-topics-values.yaml](./jikkou/kafka-topics-values.yaml) |

#### Confluent Cloud Support

The following environment variables are used to configure the Kafka client for Confluent Cloud.

| Environment Variable | Description |
|---|---|
| `KAFKA_SECURITY_PROTOCOL` | Security protocol for Kafka |
| `KAFKA_SASL_MECHANISM` | SASL mechanism for Kafka |
| `KAFKA_SASL_JAAS_CONFIG` | SASL JAAS configuration for Kafka |
| `KAFKA_SSL_ENDPOINT_ALGORITHM` | SSL endpoint algorithm for Kafka |

### Quick Run

1. Create a copy of `sample.env` and rename it to `.env`.
2. Update the variable `DOCKER_HOST_IP` to the local IP address of the system running docker which can be found by running the `ifconfig` command
   1. Hint: look for "inet addr:" within "eth0" or "en0" for OSX
3. Set the `COMPOSE_PROFILES` variable to: `kafka_full`
4. Run the following command: `docker-compose up -d`
5. Go to `localhost:8001` in your browser and verify that `kafka-ui` can see the created kafka cluster and initialized topics

[Back to top](#toc)


<a name="mongodb-kafka-connect"></a>

## 4. MongoDB Kafka Connect
The mongo-connector service connects to specified Kafka topics and deposits these messages to separate collections in the MongoDB Database. The codebase that provides this functionality comes from Confluent using their community licensed [cp-kafka-connect image](https://hub.docker.com/r/confluentinc/cp-kafka-connect). Documentation for this image can be found [here](https://docs.confluent.io/platform/current/connect/index.html#what-is-kafka-connect).

### Configuration

Kafka connectors are managed by the 

Set the `COMPOSE_PROFILES` environmental variable as follows:

- `kafka_connect` will only spin up the `kafka-connect` and `kafka-init` services in [docker-compose-connect](docker-compose-connect.yml)
  - NOTE: This implies that you will be using a separate Kafka and MongoDB cluster
- `kafka_connect_standalone` will run the following:
  1. `kafka-connect` service from [docker-compose-connect](docker-compose-connect.yml)
  2. `kafka-init` service from [docker-compose-connect](docker-compose-connect.yml)
  3. `kafka` service from [docker-compose-kafka](docker-compose-kafka.yml)
  4. `mongo` and `mongo-setup` services from [docker-compose-mongo](docker-compose-mongo.yml)

### Configure Kafka Connector Creation

The Kafka connectors created by the `kafka-connect-setup` service are configured in the [kafka-connectors-values.yaml](jikkou/kafka-connectors-values.yaml) file.  The connectors in that file are organized by the application, and given parameters to define the Kafka -> MongoDB sync connector:

| Connector Variable  | Required | Condition | Description|
|---|---|---|---|
| `topicName` | Yes | Always | The name of the Kafka topic to sync from |
| `collectionName` | Yes | Always | The name of the MongoDB collection to write to |
| `generateTimestamp` | No | Optional | Enable or disable adding a timestamp to each message (true/false) |
| `connectorName` | No | Optional | Override the name of the connector from the `collectionName` to this field instead |
| `useTimestamp` | No | Optional | Converts the `timestampField` field at the top level of the value to a BSON date |
| `timestampField` | No | Required if `useTimestamp` is `true` | The name of the timestamp field at the top level of the message |
| `useKey` | No | Optional | Override the document `_id` field in MongoDB to use a specified `keyField` from the message |
| `keyField` | No | Required if `useKey` is `true` | The name of the key field |

The following environment variables can be used to configure Kafka Connectors:

| Environment Variable | Description |
|---|---|
| `CONNECT_URL` | Kafka connect API URL |
| `CONNECT_LOG_LEVEL` | Kafka connect log level (`OFF`, `ERROR`, `WARN`, `INFO`) |
| `CONNECT_TASKS_MAX` | Number of concurrent tasks to configure on kafka connectors |
| `CONNECT_CREATE_ODE` | Whether to create kafka connectors for the ODE |
| `CONNECT_CREATE_GEOJSONCONVERTER` | Whether to create topics for the GeojsonConverter |
| `CONNECT_CREATE_CONFLICTMONITOR` | Whether to create kafka connectors for the Conflict Monitor |
| `CONNECT_CREATE_DEDUPLICATOR` | Whether to create kafka connectors for the Deduplicator |
| `CONNECT_KAFKA_CONNECTORS_VALUES_FILE` | Path to a custom `kafka-connectors-values.yaml` file |
| `CONNECT_CREATE_OTHER` | Whether to create kafka connectors for other applications, this is only useful when you attach a custom `kafka-connectors-values.yaml` file with other connectors |

### Quick Run

1. Create a copy of `sample.env` and rename it to `.env`.
2. Update the variable `DOCKER_HOST_IP` to the local IP address of the system running docker
3. Set the password for `MONGO_ADMIN_DB_PASS` and `MONGO_READ_WRITE_PASS` environmental variables to a secure password.
4. Set the `COMPOSE_PROFILES` variable to: `kafka_connect_standalone,mongo_express,kafka_ui,kafka_setup`
5. Navigate back to the root directory and run the following command: `docker compose up -d`
6. Produce a sample message to one of the sink topics by using `kafka_ui` by:
   1. Go to `localhost:8001`
   2. Click local -> Topics
   3. Select `topic.OdeBsmJson`
   4. Select `Produce Message`
   5. Leave the defaults except set the `Value` field to `{"foo":"bar"}`
   6. Click `Produce  Message`
7. View the synced message in `mongo-express` by:
   1. Go to `localhost:8082`
   2. Click `ode` -- Or click whatever value you set the `MONGO_DB_NAME` to
   3. Click `OdeBsmJson`, and now you should see your message!
8. Feel free to test this with other topics or by producing to these topics using the [ODE](https://github.com/usdot-jpo-ode/jpo-ode)

### S3 Archive Kafka Connector

The Kafka Connect image also includes the [Confluent Amazon S3 Sink Connector](https://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html) (version `12.1.13`, [Confluent Community License](https://www.confluent.io/confluent-community-license)). When enabled, the `kafka-connect-setup` service creates a `sink.S3Archive` connector that continuously archives the raw values of the configured ODE, PPM, SDW depositor input, GeoJSON Converter, Deduplicator and jpo-mec-deposit topics, and optionally the Conflict Monitor topics, to Amazon S3 as gzip compressed, newline delimited objects:

```text
<bucket>/<CONNECT_S3_ENVIRONMENT>/<topic>/year=YYYY/month=MM/day=dd/hour=HH/<topic>+<partition>+<startOffset>.json.gz
```

The archived topics are listed under `s3Archive.topics` in [kafka-connectors-values.yaml](jikkou/kafka-connectors-values.yaml) and can be overridden with `CONNECT_S3_TOPICS` without rebuilding any image. AWS credentials are never stored in the connector configuration, the connector uses the AWS default credential provider chain (IAM role) of the `kafka-connect` container.

| Environment Variable | Description |
|---|---|
| `CONNECT_CREATE_S3_ARCHIVE` | Whether to create the S3 archive connector (default: `false`) |
| `CONNECT_S3_BUCKET_NAME` | Destination S3 bucket, required when the S3 archive connector is enabled |
| `CONNECT_S3_REGION` | AWS region of the bucket (default: `us-east-1`) |
| `CONNECT_S3_ENVIRONMENT` | Top level S3 prefix, e.g. the deployment environment name |
| `CONNECT_S3_TOPICS` | Optional comma separated list of topics that replaces the default topic list |
| `CONNECT_S3_ARCHIVE_CONFLICTMONITOR` | Whether to also archive the Conflict Monitor event, assessment, notification and metrics topics (default: `false`). Ignored when `CONNECT_S3_TOPICS` is set. |
| `CONNECT_S3_TASKS_MAX` | Optional number of connector tasks (default: `1`) |
| `CONNECT_S3_FLUSH_SIZE` | Optional maximum records per S3 object (default: `10000`) |
| `CONNECT_S3_ROTATE_INTERVAL_MS` | Optional maximum time before an open S3 object is committed (default: `120000`) |
| `CONNECT_S3_ACL_CANNED` | Optional canned ACL for created objects, e.g. `bucket-owner-full-control` |
| `CONNECT_S3_STORE_URL` | Local S3 emulator endpoint only, leave blank for Amazon S3 |
| `CONNECT_S3_LOCAL_ACCESS_KEY_ID`, `CONNECT_S3_LOCAL_SECRET_ACCESS_KEY` | Local S3 emulator credentials only, leave blank for Amazon S3 |
| `CONNECT_CREATE_S3_RAW_ARCHIVE` | Whether to create the compact raw S3 archive connector `sink.S3RawArchive` (default: `false`). It uses the bucket and environment settings above. |
| `CONNECT_S3_RAW_TOPICS` | Optional comma separated list of topics that replaces the compact raw archive's default list of decoded ODE topics |

The optional compact raw archive connector `sink.S3RawArchive` writes only the `odeReceivedAt`, `originIp` and `asn1` metadata fields of each decoded ODE record (`topic.OdeBsmJson`, `topic.OdeMapJson`, `topic.OdeTimJson` and the other decoded message topics), as gzip compressed JSON lines under `<bucket>/<CONNECT_S3_ENVIRONMENT>/compact/<topic>/...`. These fields are enough to replay the received messages through the ODE, at 30 to 55% less storage than the full decoded records. Records without `asn1`, such as TIMs deposited through the ODE REST API, are skipped. See [S3_Archive.md](docs/S3_Archive.md#15-compact-raw-archive).

To try the connector locally with the [S3Mock](https://github.com/adobe/S3Mock) emulator:

1. Complete the Kafka Connect quick run above.
2. In the `.env` file, set `COMPOSE_PROFILES` to `kafka_connect_standalone,kafka_setup,s3_local` and set:

   ```bash
   CONNECT_CREATE_S3_ARCHIVE=true
   CONNECT_S3_BUCKET_NAME=jpo-archive-local
   CONNECT_S3_ENVIRONMENT=local
   CONNECT_S3_STORE_URL=http://s3-local:9090
   CONNECT_S3_LOCAL_ACCESS_KEY_ID=local
   CONNECT_S3_LOCAL_SECRET_ACCESS_KEY=local
   ```

3. Run `docker compose up -d --build`, then produce a message to `topic.OdeBsmJson`.
4. After the rotation interval, list the archived objects: `curl "http://localhost:9000/jpo-archive-local?list-type=2&prefix=local/"`

See [docs/S3_Archive.md](docs/S3_Archive.md) for the topic inventory, AWS deployment, IAM, encryption, lifecycle, monitoring, recovery, replay and data retrieval instructions.

[Back to top](#toc)

## 5. Monitoring Stack

The monitoring stack consists of Prometheus for metrics collection and Grafana for visualization, along with several exporters that collect metrics from different services. The configuration is defined in [docker-compose-monitoring.yml](docker-compose-monitoring.yml).

Set the `COMPOSE_PROFILES` environmental variable as follows:

- `monitoring_full` - deploys all resources in the [docker-compose-monitoring.yml](docker-compose-monitoring.yml) file
  - `prometheus` - deploys only the Prometheus service
  - `grafana` - deploys only the Grafana service
  - `node_exporter` - deploys only the Node Exporter service for system metrics
  - `kafka_exporter` - deploys only the Kafka Lag Exporter service
  - `mongodb_exporter` - deploys only the MongoDB Exporter service

### Configuration

The following environment variables can be used to configure the monitoring stack:

| Environment Variable | Description |
|---|---|
| `PROMETHEUS_RETENTION` | Data retention period for Prometheus (default: 15d) |
| `GRAFANA_ADMIN_USER` | Grafana admin username (default: admin) |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password (default: grafana) |
| `KAFKA_LAG_EXPORTER_ROOT_LOG_LEVEL` | Root log level for kafka lag exporter (default: WARN) |
| `KAFKA_LAG_EXPORTER_LOG_LEVEL` | Kafka lag exporter log level (default: INFO) |
| `KAFKA_LAG_EXPORTER_KAFKA_LOG_LEVEL` | Kafka log level for kafka lag exporter (default: ERROR) |

### Quick Run

1. Create a copy of `sample.env` and rename it to `.env`.
2. Set the `COMPOSE_PROFILES` variable to: `monitoring_full`
3. Update any passwords in the `.env` file for security
4. Run the following command: `docker compose up -d`
5. Access the monitoring interfaces:
   - Grafana: `http://localhost:3000` (default credentials: admin/grafana)
   - Prometheus: `http://localhost:9090`
6. The following metrics endpoints will be available:
   - Node Exporter: `http://localhost:9100/metrics`
   - Kafka Lag Exporter: `http://localhost:8000/metrics`
   - MongoDB Exporter: `http://localhost:9216/metrics`
   - Kafka Connect JMX Exporter: `http://localhost:9404/metrics`

### Scrape Configurations

The scrape configurations for the monitoring stack are defined in the [prometheus.yml](monitoring/prometheus/prometheus.yml) file. If you would like to add a new scrape configuration, you can do so by adding a new job to the `scrape_configs` section. Please note that this file doesn't support environment variables, so you will need to manually edit the file.

The following scrape configurations are available:

- `prometheus` - scrapes the Prometheus metrics
- `node_exporter` - scrapes the Node Exporter metrics
- `kafka_exporter` - scrapes the Kafka Lag Exporter metrics
- `mongodb_exporter` - scrapes the MongoDB Exporter metrics
- `kafka-connect` - scrapes the Kafka Connect worker, connector and task metrics from the JMX exporter in the `kafka-connect` service

[Back to top](#toc)

## Security Notice

While default passwords are provided for development convenience, it is **strongly recommended** to:

1. Change all passwords before deploying to any environment
2. Never use default passwords in production
3. Use secure password generation and management practices
4. Consider using Docker secrets or environment management tools for production deployments
