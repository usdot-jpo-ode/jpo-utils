# S3 Archive Kafka Connector

The S3 archive connector continuously copies processed ODE, GeoJSON Converter, Deduplicator and jpo-mec-deposit Kafka topics to Amazon S3. It replaces nightly MongoDB backups as the long term retention mechanism for data that is published to Kafka. The connector runs on the existing jpo-utils Kafka Connect deployment, next to the MongoDB sink connectors, and is created and updated by the `kafka-connect-setup` (Jikkou) service.

**Table of Contents**

- [1. Connector Selection](#1-connector-selection)
- [2. How It Works](#2-how-it-works)
- [3. Topic Inventory](#3-topic-inventory)
- [4. Configuration](#4-configuration)
- [5. Deployment in AWS](#5-deployment-in-aws)
- [6. S3 Security, Encryption and Lifecycle](#6-s3-security-encryption-and-lifecycle)
- [7. Delivery Guarantees and Failure Handling](#7-delivery-guarantees-and-failure-handling)
- [8. Monitoring](#8-monitoring)
- [9. Operations](#9-operations)
- [10. Recovery and Replay](#10-recovery-and-replay)
- [11. Data Retrieval](#11-data-retrieval)
- [12. Troubleshooting](#12-troubleshooting)
- [13. Test Results](#13-test-results)
- [14. Upgrading the Connector](#14-upgrading-the-connector)
- [15. Compact Raw Archive](#15-compact-raw-archive)

## 1. Connector Selection

| Component | Version | License | Notes |
|---|---|---|---|
| [Confluent Amazon S3 Sink Connector](https://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html) (`confluentinc/kafka-connect-s3`) | `12.1.13` | [Confluent Community License](https://www.confluent.io/confluent-community-license) | Installed with `confluent-hub` in [kafka-connect/Dockerfile](../kafka-connect/Dockerfile). Bundles AWS SDK for Java v2 `2.28.23`. |
| [Prometheus JMX exporter](https://github.com/prometheus/jmx_exporter) java agent | `1.7.0` | Apache 2.0 | Exposes Kafka Connect metrics on port `9404`. Pinned by SHA-256 checksum. |
| [Adobe S3Mock](https://github.com/adobe/S3Mock) | `5.2.3` | Apache 2.0 | Local S3 emulator for development and testing only (`s3_local` profile). |

The Confluent connector was selected because:

- The Kafka Connect image already uses Confluent Community License components (the `confluentinc/cp-kafka-connect` base image and `confluentinc/connect-transforms`).
- It installs the same way as the existing plugins.
- It provides the required time based partitioning, gzip compression, multi record objects, the AWS default credential provider chain and server side encryption out of the box.

The Confluent Community License permits free use, including in production. It only prohibits offering the software as a competing SaaS product. The Apache 2.0 [Aiven S3 sink connector](https://github.com/Aiven-Open/cloud-storage-connectors-for-apache-kafka) is the fallback if that license is not approved. It would need a different plugin installation and different connector settings in the Jikkou template.

**Note:** `12.1.13` is intentionally pinned. Testing found that versions `12.1.14`, `12.0.12`, `11.0.22` and later can commit Kafka offsets for records that were never written to S3, after a retriable S3 error followed by a task failure. See [Upgrading the Connector](#14-upgrading-the-connector).

[Back to top](#s3-archive-kafka-connector)

## 2. How It Works

```text
ODE / GeoJSON Converter / Deduplicator / jpo-mec-deposit
        |
        v
  Kafka topics --> Kafka Connect worker --> sink.S3Archive --> s3://<bucket>/<environment>/<topic>/year=YYYY/month=MM/day=dd/hour=HH/<topic>+<partition>+<startOffset>.json.gz
                                       \--> sink.<Collection> (existing MongoDB sinks, unchanged)
```

- **One connector for all topics.** The connector `sink.S3Archive` subscribes to every topic in the archive list. Its consumer group is `connect-sink.S3Archive`, separate from the MongoDB sink consumer groups, so it does not change the MongoDB sinks.
- **Raw values only.** The record value is written unchanged with the `ByteArrayConverter` and `ByteArrayFormat`, followed by a newline. No message type specific code or schema is involved, so any current or future message type can be archived. Record keys and headers are not stored. Null value records, such as tombstones, are skipped.
- **Batched, compressed objects.** Records are buffered per topic partition and hour. An object is committed to S3 when either:
  - `flush.size` records (default 10000) are buffered, or
  - the wall clock `rotate.schedule.interval.ms` (default 2 minutes) passes.

  Objects are gzip compressed newline delimited files.
- **Time partitioning.** The prefix comes from the Kafka record timestamp in UTC, which is the time the record was produced to Kafka (ingestion time), not the event time inside the message.
- **Traceability to Kafka.** Each object key contains the source topic, the Kafka partition and the offset of the first record in the object. Line `n` (starting at 0) of an object holds the record at offset `startOffset + n`. This holds for the archived topics, which are non-compacted and non-transactional, with null value records skipped. See [Data Retrieval](#11-data-retrieval).
- **Offsets.** Kafka offsets are only committed after the objects that hold those records are written to S3. They are stored in the standard Kafka consumer group of the connector.
- **Compact raw archive.** An optional second connector, `sink.S3RawArchive`, keeps only the `odeReceivedAt`, `originIp` and `asn1` fields of the decoded topics, for replaying the received messages at lower storage cost. See [Compact Raw Archive](#15-compact-raw-archive).

[Back to top](#s3-archive-kafka-connector)

## 3. Topic Inventory

> **Status: proposed, pending approval for production.** The inventory below was built from the jpo-ode `application.yaml` topic configuration, the Jikkou topic and connector values files, and the jpo-mec-deposit topic configuration. The topics actually produced in each production deployment must be confirmed before go-live. The list is stored in `s3Archive.topics` in [kafka-connectors-values.yaml](../jikkou/kafka-connectors-values.yaml).

### Archived by default

| Topic | Producer | Message type | Also stored in MongoDB |
|---|---|---|---|
| `topic.OdeBsmJson` | ODE | BSM | Yes, when the deduplicator is disabled |
| `topic.OdeTimJson` | ODE | TIM | Yes, when the deduplicator is disabled |
| `topic.OdeMapJson` | ODE | MAP | Yes, when the deduplicator is disabled |
| `topic.OdeSpatJson` | ODE | SPaT | Yes |
| `topic.OdeSrmJson` | ODE | SRM | Yes |
| `topic.OdeSsmJson` | ODE | SSM | Yes |
| `topic.OdePsmJson` | ODE | PSM | Yes |
| `topic.OdeSdsmJson` | ODE | SDSM | Yes |
| `topic.OdeRtcmJson` | ODE | RTCM | Yes |
| `topic.OdeRsmJson` | ODE | RSM | Yes |
| `topic.OdeDriverAlertJson` | ODE | Driver alert | Yes |
| `topic.OdeTimJsonTMCFiltered` | ODE | TIM (TMC generated) | Yes |
| `topic.OdeTIMCertExpirationTimeJson` | ODE | TIM certificate expiration | Yes |
| `topic.OdeRawEncodedBSMJson`, `...TIMJson`, `...MAPJson`, `...SPATJson`, `...SRMJson`, `...SSMJson`, `...PSMJson`, `...SDSMJson`, `...RTCMJson`, `...RSMJson` | ODE | Raw encoded messages of all 10 types, allows re-decoding | No |
| `topic.ProcessedBsm`, `topic.ProcessedMap`, `topic.ProcessedMapWKT`, `topic.ProcessedSpat`, `topic.ProcessedSrm`, `topic.ProcessedSsm`, `topic.ProcessedRtcm` | GeoJSON Converter | Processed messages | Yes, except `ProcessedMapWKT` |
| `topic.DeduplicatedOdeBsmJson`, `topic.DeduplicatedOdeTimJson`, `topic.DeduplicatedOdeMapJson`, `topic.DeduplicatedProcessedBsm`, `topic.DeduplicatedProcessedMap`, `topic.DeduplicatedProcessedMapWKT`, `topic.DeduplicatedProcessedSpat` | Deduplicator | Deduplicated messages | Yes, when the deduplicator is enabled |
| `topic.MecDepositMetrics` | jpo-mec-deposit | Deposit metrics | Yes, when `CONNECT_CREATE_MECDEPOSIT=true` |

Notes on the inventory:

- **jpo-mec-deposit:** its only Kafka topic is `topic.MecDepositMetrics`. The messages it receives over MQTT and REST are deposited into the ODE, so they are archived through the ODE topics above.
- **Message types without a processed topic:** PSM, SDSM, RSM and TIM have no `topic.Processed*` topic. Their decoded `topic.Ode*Json` topics are archived.
- **Topics that do not exist:** topics from applications that are not deployed, such as the Deduplicator topics, are not consumed until they exist. Remove them from the list to avoid repeated `UNKNOWN_TOPIC_OR_PARTITION` consumer warnings, which only appear when `CONNECT_LOG_LEVEL` is `WARN` or lower.

### Not archived

| Topic | Reason |
|---|---|
| `topic.Asn1DecoderInput`, `topic.Asn1DecoderOutput`, `topic.Asn1EncoderInput`, `topic.Asn1EncoderOutput`, `topic.SDWDepositorInput` | Internal processing topics; their content is archived in the raw and decoded topics. |
| `topic.OdeTimKTableJson` | Compacted state topic backing a KTable, contains tombstones. |
| `topic.FilteredOdeBsmJson`, `topic.FilteredOdeSpatJson`, `topic.FilteredOdeTimJson` | Privacy filtered copies. These are only produced when the PPM (jpo-cvdp) is deployed; add them if the filtered data must be retained. |
| `dlq.*` | ODE dead letter topics; add them if failed raw messages must be retained. |
| Conflict Monitor, Intersection API, RSU status monitor topics | Outside the scope of the ODE and jpo-mec-deposit archive; add them with `CONNECT_S3_TOPICS` if required. |

[Back to top](#s3-archive-kafka-connector)

## 4. Configuration

The connector is created only when `CONNECT_CREATE_S3_ARCHIVE=true`. All settings can be changed without rebuilding any image by updating the `.env` file or the mounted values file, then re-running the `kafka-connect-setup` service. See [Operations](#9-operations).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CONNECT_CREATE_S3_ARCHIVE` | `false` | Create or update the `sink.S3Archive` connector. |
| `CONNECT_S3_BUCKET_NAME` | | **Required.** Destination bucket. The bucket must already exist. |
| `CONNECT_S3_REGION` | `us-east-1` | Bucket region. Also set as `AWS_REGION` on the `kafka-connect` container. |
| `CONNECT_S3_ENVIRONMENT` | `local` | **Required in production.** First prefix level, e.g. `itsa-prod`. |
| `CONNECT_S3_TOPICS` | values file list | Comma separated list of topics. Replaces the values file list. |
| `CONNECT_S3_TASKS_MAX` | `1` | Number of connector tasks. Topic partitions are spread across tasks. |
| `CONNECT_S3_FLUSH_SIZE` | `10000` | Maximum records per object. |
| `CONNECT_S3_ROTATE_INTERVAL_MS` | `120000` | Maximum time before an open object is committed. Keep well below 5 minutes to meet the archive latency target. |
| `CONNECT_S3_SSE_ALGORITHM` | bucket default | `AES256` (SSE-S3) or `aws:kms` (SSE-KMS). |
| `CONNECT_S3_SSE_KMS_KEY_ID` | | KMS key ARN or ID when `aws:kms` is used. |
| `CONNECT_S3_ACL_CANNED` | | Optional canned ACL, e.g. `bucket-owner-full-control` for cross account buckets. |
| `CONNECT_S3_STORE_URL` | | Local emulator only. Must be blank for Amazon S3. |
| `CONNECT_S3_LOCAL_ACCESS_KEY_ID`, `CONNECT_S3_LOCAL_SECRET_ACCESS_KEY` | | Local emulator only. Must be blank for Amazon S3. |

### Values file settings

The `s3Archive` section of [kafka-connectors-values.yaml](../jikkou/kafka-connectors-values.yaml) holds the defaults and the topic list. To customize it, copy the file, edit it, and point `CONNECT_KAFKA_CONNECTORS_VALUES_FILE` at the copy.

| Setting | Default | Description |
|---|---|---|
| `connectorName` | `S3Archive` | Connector name suffix, creates `sink.S3Archive`. |
| `pathFormat` | `'year'=YYYY/'month'=MM/'day'=dd/'hour'=HH` | Time based prefix below the topic. |
| `partitionDurationMs` | `3600000` | One time partition per hour. |
| `compressionType` | `gzip` | Object compression. |
| `partSize` | `5242880` | S3 multipart upload part size, 5 MB (the S3 minimum). |
| `elasticBufferInitCapacity` | `131072` | Initial buffer per open object; buffers grow up to `partSize`, keeping memory low for many low volume topics. |
| `partRetries`, `retryBackoffMs` | `5`, `1000` | Retries of a single S3 request with exponential backoff. |
| `taskRetryBackoffMs` | `5000` | Wait before the task retries a failed S3 write. |
| `maxPollIntervalMs` | `900000` | Consumer `max.poll.interval.ms`, so slow S3 retries do not cause consumer group rebalances. |
| `dlqTopicName` | `dlq.S3Archive` | Dead letter queue topic. It is created by `kafka-setup` with a fixed 7 day retention. |
| `topics` | see [Topic Inventory](#3-topic-inventory) | Archived topics. |

[Back to top](#s3-archive-kafka-connector)

## 5. Deployment in AWS

1. **Create the bucket** with Block Public Access enabled, default encryption, versioning (recommended), and the lifecycle rules from [section 6](#6-s3-security-encryption-and-lifecycle).
2. **Grant the Kafka Connect host an IAM role.** Do not create access keys. The connector uses the AWS SDK default credential provider chain, which checks:
   - environment variables (empty values are skipped)
   - EKS IRSA web identity
   - the shared profile
   - the ECS task role
   - the EC2 instance profile

   For Docker on EC2, the instance metadata hop limit must be at least 2 so that containers can reach IMDSv2:

   ```bash
   aws ec2 modify-instance-metadata-options --instance-id <id> --http-tokens required --http-put-response-hop-limit 2
   ```

3. **Attach the IAM policy** from [section 6](#6-s3-security-encryption-and-lifecycle) to the role.
4. **Increase Kafka retention for archived topics.** Retention must cover the longest S3 or Kafka Connect outage you need to survive without data loss. The default `KAFKA_TOPIC_RETENTION_MS=300000` is **5 minutes**, which only allows a 5 minute outage. A retention of at least 24 hours (`86400000`) is recommended for production, sized against the available broker disk. See [Delivery Guarantees](#7-delivery-guarantees-and-failure-handling).
5. **Configure the `.env` file** of the deployment, for example:

   ```bash
   CONNECT_CREATE_S3_ARCHIVE=true
   CONNECT_S3_BUCKET_NAME=<bucket>
   CONNECT_S3_REGION=us-east-1
   CONNECT_S3_ENVIRONMENT=itsa-prod
   CONNECT_S3_SSE_ALGORITHM=aws:kms
   CONNECT_S3_SSE_KMS_KEY_ID=arn:aws:kms:us-east-1:<account>:key/<key-id>
   ```

6. **Rebuild or pull the Kafka Connect image** that includes the S3 plugin (`usdotjpoode/jpo-kafka-connect` or a local build). Restart the worker and the setup service:

   ```bash
   docker compose up -d --build kafka-connect
   docker compose up kafka-connect-setup
   ```

7. **Verify:**
   - `curl http://<connect-host>:8083/connectors/sink.S3Archive/status` shows the connector and its tasks as `RUNNING`.
   - Objects appear under `s3://<bucket>/<environment>/` within the rotation interval.
   - The **Kafka Connect S3 Archive** Grafana dashboard shows data.

[Back to top](#s3-archive-kafka-connector)

## 6. S3 Security, Encryption and Lifecycle

### IAM policy for the Kafka Connect role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ArchiveBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
      "Resource": "arn:aws:s3:::<bucket>"
    },
    {
      "Sid": "ArchiveObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": "arn:aws:s3:::<bucket>/<environment>/*"
    },
    {
      "Sid": "ArchiveKmsKey",
      "Effect": "Allow",
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "arn:aws:kms:<region>:<account>:key/<key-id>"
    }
  ]
}
```

- **Why `s3:GetObject`:** the connector reads existing object names after a retry, to avoid overwriting committed objects.
- **The KMS statement:** remove it when SSE-S3 (`AES256`) or the bucket default encryption is used.
- **What the role cannot do:** it has no delete permissions, so the connector cannot remove archived data.

### Encryption

- **At rest:**
  - Enable [default bucket encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-bucket-encryption.html) with SSE-S3 or SSE-KMS.
  - Optionally, set `CONNECT_S3_SSE_ALGORITHM` and `CONNECT_S3_SSE_KMS_KEY_ID` so that the connector requests encryption explicitly on every upload.
  - With SSE-KMS, enable an [S3 Bucket Key](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-key.html) to reduce KMS request costs.
- **In transit:** the connector always uses HTTPS for Amazon S3. Enforce it with a bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::<bucket>", "arn:aws:s3:::<bucket>/*"],
      "Condition": {"Bool": {"aws:SecureTransport": "false"}}
    }
  ]
}
```

### Access control

- Enable S3 Block Public Access on the bucket and account.
- Set Object Ownership to "Bucket owner enforced", which disables ACLs. Leave `CONNECT_S3_ACL_CANNED` blank unless writing to a bucket owned by another account.
- Grant read access to archived data with separate, read-only roles.

### Retention and lifecycle

The archive retention policy must be agreed with the data owners. The example lifecycle configuration below:

- keeps objects in S3 Standard for 30 days
- moves them to Glacier Instant Retrieval
- expires them after 3 years
- cleans up incomplete multipart uploads after 7 days

Adjust the periods to the approved retention policy.

```json
{
  "Rules": [
    {
      "ID": "jpo-archive-retention",
      "Status": "Enabled",
      "Filter": {"Prefix": "<environment>/"},
      "Transitions": [{"Days": 30, "StorageClass": "GLACIER_IR"}],
      "Expiration": {"Days": 1095},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
    }
  ]
}
```

```bash
aws s3api put-bucket-lifecycle-configuration --bucket <bucket> --lifecycle-configuration file://lifecycle.json
```

S3 Object Lock in compliance mode can be added if archived data must be immutable.

[Back to top](#s3-archive-kafka-connector)

## 7. Delivery Guarantees and Failure Handling

The connector provides **at-least-once** delivery as long as Kafka still holds the data.

| Failure | Behavior | Data loss | Operator action |
|---|---|---|---|
| Kafka Connect worker or connector restart | Uncommitted records are re-read from the last committed offset. Rewritten objects use the same names; the connector detects existing objects and does not overwrite them. | No | None |
| S3 timeouts, throttling, 5xx errors, network loss | The S3 request is retried `partRetries` times, then the task rewinds to the start of the uncommitted object and retries every `taskRetryBackoffMs`, for as long as the error persists. The task stays `RUNNING`. Consumption pauses while writes fail, so worker memory stays bounded. | No, while the outage is shorter than Kafka retention | None. Alert on archive latency. |
| Non-retriable errors: DNS resolution failure, missing bucket, access denied, missing credentials | The task moves to `FAILED`. Offsets of unwritten records are not committed. | No, while the task is restarted within Kafka retention | Fix the cause, then [restart the task](#restart-a-failed-task). |
| Record reported as errant by the connector or the Connect framework | Reported to the dead letter queue topic `dlq.S3Archive` with error context headers, and logged. | No, the record is kept in `dlq.S3Archive` for 7 days | Investigate the DLQ record. |
| Kafka unavailable | The consumer retries until Kafka is back. | No | None |
| Outage longer than Kafka topic retention | Records deleted by Kafka retention before they are archived are lost. | **Yes** | Size retention for the longest tolerated outage. |

Notes:

- **Duplicates.** Duplicate records in S3 are possible after restarts or rebalances, but rare. They can always be removed by `(topic, partition, offset)`, which is recoverable from the object key and the line number.
- **What reaches the DLQ.** Raw values are not converted, so converter errors cannot occur and the DLQ is expected to stay empty. S3 write failures are retried rather than sent to the DLQ.

[Back to top](#s3-archive-kafka-connector)

## 8. Monitoring

### Metrics

| Signal | Source | Metric |
|---|---|---|
| Connector and task state | JMX exporter (`kafka-connect:9404`) | `kafka_connect_connector_status{connector="sink.S3Archive",status=...}`, `kafka_connect_connector_task_status{...,status=...}`, `kafka_connect_worker_connector_connector_failed_task_count` |
| Consumer lag (records) | kafka-lag-exporter (`kafka-exporter:8000`) | `kafka_consumergroup_group_lag{group="connect-sink.S3Archive"}`, `kafka_consumergroup_group_sum_lag` |
| Archive latency | kafka-lag-exporter | `kafka_consumergroup_group_lag_seconds{group="connect-sink.S3Archive"}`, `kafka_consumergroup_group_max_lag_seconds`. Offsets are only committed after objects are in S3, so the time lag of the committed offset is the archive latency. |
| Throughput | JMX exporter | `kafka_connect_sink_task_metrics_sink_record_read`, `kafka_connect_sink_task_metrics_sink_record_send`, `kafka_connect_sink_task_metrics_sink_record_active_count` |
| Failures | JMX exporter | `kafka_connect_task_error_metrics_total_record_errors`, `kafka_connect_task_error_metrics_total_record_failures`, `kafka_connect_task_error_metrics_deadletterqueue_produce_requests`, `kafka_connect_connector_task_metrics_offset_commit_failure_percentage` |

The Grafana dashboard **Kafka Connect S3 Archive** ([kafka-connect-s3-archive.json](../monitoring/grafana/dashboards/kafka-connect-s3-archive.json)) shows these metrics. It is provisioned automatically with the `monitoring_full` profile. The Prometheus job `kafka-connect` is configured in [prometheus.yml](../monitoring/prometheus/prometheus.yml). For a Kafka Connect worker on another host, change the target to `<host>:9404`.

The JMX exporter rules ([jmx-exporter.yml](../kafka-connect/jmx-exporter.yml)) export connector status and the per connector task counts for every connector. Task level metrics (task status, throughput, errors) are only exported for `sink.S3Archive` and `sink.S3RawArchive`. With the default `CONNECT_TASKS_MAX=10`, the Mongo sinks run more than 800 tasks. Reading every task MBean made a scrape take 15 to 20 seconds on a one CPU worker, which is longer than the 10 second Prometheus scrape timeout. With the task metrics limited to the archive connectors, a scrape takes about one second. If a connector is renamed (`s3Archive.connectorName` or `s3RawArchive.connectorName`), update the task level `includeObjectNames` entries in that file and rebuild the image. If Prometheus shows the `kafka-connect` target as down with `context deadline exceeded`, and the worker logs `The Prometheus metrics HTTPServer caught an Exception while trying to send the metrics response`, the scrape is taking longer than the timeout.

### Recommended alerts

The alerts cover both archive connectors. If only `sink.S3Archive` is deployed, replace `sink.S3(Raw)?Archive` with `sink.S3Archive`, otherwise the missing connector alert fires for `sink.S3RawArchive`.

| Alert | PromQL | For |
|---|---|---|
| S3 archive task failed | `sum by (connector) (kafka_connect_worker_connector_connector_failed_task_count{connector=~"sink.S3(Raw)?Archive"}) > 0` | 1m |
| S3 archive connector missing or not running | `absent(kafka_connect_connector_status{connector="sink.S3Archive",status="running"})`, and the same for `sink.S3RawArchive` | 5m |
| Archive latency above target | `max by (group) (kafka_consumergroup_group_max_lag_seconds{group=~"connect-sink.S3(Raw)?Archive"}) > 300` | 5m |
| Records sent to the S3 archive DLQ | `sum by (connector) (increase(kafka_connect_task_error_metrics_deadletterqueue_produce_requests{connector=~"sink.S3(Raw)?Archive"}[15m])) > 0` | 0m |

### Logs

- Connector errors are logged at `ERROR` by the `kafka-connect` container, e.g. `Exception on topic partition` for retried S3 errors and `Task threw an uncaught and unrecoverable exception` for failed tasks.
- To see object commits (`FILES COMMITTED`) without restarting the worker, raise the S3 logger temporarily:

  ```bash
  curl -X PUT -H "Content-Type: application/json" -d '{"level":"INFO"}' http://<connect-host>:8083/admin/loggers/io.confluent.connect.s3
  ```

  The level resets when the worker restarts.

[Back to top](#s3-archive-kafka-connector)

## 9. Operations

All commands use the Kafka Connect REST API on port `8083`. Changes made directly through the REST API are overwritten the next time `kafka-connect-setup` runs, so make permanent changes in the `.env` or values file.

| Task | Command |
|---|---|
| Create or update from configuration | `docker compose up kafka-connect-setup` |
| Inspect status | `curl http://<connect-host>:8083/connectors/sink.S3Archive/status` |
| Inspect configuration | `curl http://<connect-host>:8083/connectors/sink.S3Archive/config` |
| Update configuration directly | `curl -X PUT -H "Content-Type: application/json" --data @config.json http://<connect-host>:8083/connectors/sink.S3Archive/config` |
| Restart connector and all tasks | `curl -X POST "http://<connect-host>:8083/connectors/sink.S3Archive/restart?includeTasks=true"` |
| Pause / resume | `curl -X PUT http://<connect-host>:8083/connectors/sink.S3Archive/pause` / `.../resume` |
| Delete | `curl -X DELETE http://<connect-host>:8083/connectors/sink.S3Archive`. The committed offsets are kept, so re-creating it resumes where it left off. |

### Add or remove archived topics

Either option takes effect without rebuilding any image:

- Set `CONNECT_S3_TOPICS` in the `.env` file to the full comma separated topic list.
- Or edit `s3Archive.topics` in a mounted copy of the values file.

Then run `docker compose up kafka-connect-setup`. Only `sink.S3Archive` is updated; the MongoDB connectors are left unchanged. A newly added topic is archived from its earliest retained offset.

[Back to top](#s3-archive-kafka-connector)

## 10. Recovery and Replay

### Restart a failed task

1. Fix the cause shown in the task `trace` of `GET /connectors/sink.S3Archive/status`.
2. Restart only the failed tasks:

   ```bash
   curl -X POST "http://<connect-host>:8083/connectors/sink.S3Archive/restart?includeTasks=true&onlyFailed=true"
   ```

3. Check the task is `RUNNING`, and that archive latency drops on the dashboard.

The task resumes from the last committed offset; no offset repair is needed. If the restart fails again immediately with a connection error, S3 is not reachable yet. Wait and retry.

### Re-archive from an earlier offset

Use this to rewrite data that is still in Kafka, for example after objects were deleted from S3. Kafka Connect 3.6+ supports offset management through the REST API:

```bash
# 1. Stop the connector (tasks are shut down, configuration is kept)
curl -X PUT http://<connect-host>:8083/connectors/sink.S3Archive/stop

# 2. Inspect the committed offsets
curl http://<connect-host>:8083/connectors/sink.S3Archive/offsets

# 3. Move one topic partition back
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"offsets":[{"partition":{"kafka_topic":"topic.OdeBsmJson","kafka_partition":0},"offset":{"kafka_offset":123000}}]}' \
  http://<connect-host>:8083/connectors/sink.S3Archive/offsets

# 4. Resume
curl -X PUT http://<connect-host>:8083/connectors/sink.S3Archive/resume
```

The rewritten records are stored in new objects named with the new start offset. They overlap existing objects, so remove duplicates by `(topic, partition, offset)` when reading.

### Replay archived data into Kafka

Archived records can be produced back to a Kafka topic, for example to rebuild a MongoDB collection through the existing MongoDB sink connectors. Produce to a separate replay topic first if downstream consumers must not see the data twice.

```bash
aws s3 cp s3://<bucket>/<environment>/topic.OdeBsmJson/year=2026/month=10/day=28/ ./replay --recursive
find ./replay -name '*.json.gz' | sort | xargs zcat | \
  kafka-console-producer.sh --bootstrap-server <kafka>:9092 --topic topic.OdeBsmJson
```

[Back to top](#s3-archive-kafka-connector)

## 11. Data Retrieval

```bash
# List the archived topics and hours
aws s3 ls s3://<bucket>/<environment>/
aws s3 ls s3://<bucket>/<environment>/topic.OdeMapJson/year=2026/month=10/day=28/hour=18/

# Download one hour of a topic
aws s3 cp s3://<bucket>/<environment>/topic.OdeMapJson/year=2026/month=10/day=28/hour=18/ ./data --recursive

# Read records
zcat ./data/*.json.gz | jq -c '.metadata.odeReceivedAt'

# Recover the Kafka offset of each record from the object name and the line number
f=./data/topic.OdeMapJson+0+0000002500.json.gz
start=$(basename "$f" .json.gz | awk -F+ '{print $3 + 0}')
zcat "$f" | awk -v start="$start" '{print start + NR - 1 "\t" $0}' | head
```

- **Partitions:** the hour prefix is based on the time the record was written to Kafka, in UTC. Records for an event may be in the prefix for the following hour if they were produced to Kafka late.
- **Athena:** the `<topic>/year=/month=/day=/hour=` layout can be queried with Amazon Athena partition projection, using a single string column per line and `json_extract`.

[Back to top](#s3-archive-kafka-connector)

## 12. Troubleshooting

| Symptom | Cause and resolution |
|---|---|
| Task `FAILED` with `Unable to load credentials from any of the providers in the chain` | No IAM role is reachable. Check the instance profile / task role and the IMDS hop limit (section 5). The error lists each provider that was tried. |
| Task `FAILED` with `Access Denied` or `403` | The IAM policy or KMS key policy is missing a permission (section 6). |
| Task `FAILED` with `bucket ... does not exist` or `UnknownHostException` | Wrong bucket name or region, or S3 / DNS not reachable when the task started. Restart the task after it is reachable. |
| Connector missing after setup | `CONNECT_CREATE_S3_ARCHIVE` is not `true`, or `kafka-connect-setup` could not reach `CONNECT_URL`. Check the setup container logs. |
| Archive latency keeps increasing while the task is `RUNNING` | S3 writes are failing and being retried; check the `kafka-connect` logs for `Exception on topic partition`. Throughput too low; increase `CONNECT_S3_TASKS_MAX` (requires topics with multiple partitions). |
| Many small objects | Low volume topics are committed every rotation interval. Increase `CONNECT_S3_ROTATE_INTERVAL_MS`, staying below the latency target. |
| `UNKNOWN_TOPIC_OR_PARTITION` warnings | Listed topics do not exist; remove them from the topic list. |
| Worker memory pressure | Each open object buffers up to `partSize` (5 MB). Reduce the number of topics per worker, or increase the worker memory limit in `docker-compose-connect.yml`. |
| `FileExistsException: File already exists` in logs after a restart | Expected. The connector found an object it already wrote and continues with the next offset. |

[Back to top](#s3-archive-kafka-connector)

## 13. Test Results

The following tests were run on 2026-10-28 against the jpo-utils compose stack. The stack ran under Docker Desktop on Windows 11, with profiles `kafka,kafka_setup,kafka_connect_standalone,s3_local,prometheus,grafana,kafka_exporter`. The connector archived to the S3Mock emulator with a 60 second rotation interval. The test payloads were ODE output fixtures for all 10 message types from the jpo-ode test resources, plus representative Processed and MecDepositMetrics messages, written to the 31 existing archived topics. The Deduplicator topics were not created.

| Test | Result |
|---|---|
| Plugin installation | `S3SinkConnector 12.1.13` and `MongoSinkConnector 1.13.0` loaded. All 83 MongoDB sink connectors and `sink.S3Archive` `RUNNING`. Jikkou output for the MongoDB connectors is identical with `CONNECT_CREATE_S3_ARCHIVE=false`. |
| All message types | 500 records on each of 31 topics were archived within 2 minutes of production starting. Every line byte-for-byte equal to the produced value, offsets contiguous from 0, multi record gzip objects, keys matching `<env>/<topic>/year=/month=/day=/hour=/<topic>+<partition>+<startOffset>.json.gz`. The MongoDB collections received the same records. DLQ empty. |
| Configuration without rebuild | `CONNECT_S3_TOPICS` override applied by re-running `kafka-connect-setup` (1 connector altered, 83 unchanged). REST `PUT config`, `restart`, `pause`, `resume`, `stop` and `PATCH offsets` verified. |
| Worker restart during production | 2000 records per topic produced while the worker restarted. Archive complete, no gaps, no duplicates, no manual offset repair. |
| S3 network outage, 3.5 minutes (container paused) | Task stayed `RUNNING`, writes retried, lag-seconds reported the delay. Archive complete 24 seconds after S3 returned. No loss, DLQ empty. |
| S3 unresolvable (container stopped) | Task moved to `FAILED` and `failed_task_count` became 1. Committed offsets stayed at the last archived record. After S3 returned and the task was restarted, the archive was complete with no loss. |
| Credential chain | With empty access key variables, the SDK skipped the environment provider and continued to web identity, ECS container and EC2 instance profile providers. |
| Load (250 msg/s on each of 8 topics, 2000 msg/s total including 16 KB MAP messages, 4 minutes per phase) | Compared to the same load with the S3 connector paused, MongoDB sink lag was unchanged (max 9.5 s, 2.4k records). Kafka Connect CPU averaged 56% instead of 41% of one core, and memory was 2.26 GiB instead of 1.9 GiB, within its 4 GiB limit. Kafka broker CPU averaged 56% instead of 38%. S3 archive lag stayed at or under 59 s. The connector also archived a 480k record backlog in 85 s. |

A load test at production message rates, on production sized infrastructure with Amazon S3, is still required before go-live. Repeat the load test above with the deployment's rates and compare the Kafka, Kafka Connect, MongoDB and ODE dashboards with the connector paused and running.

[Back to top](#s3-archive-kafka-connector)

## 14. Upgrading the Connector

Connector versions `12.1.14` and later (and the backports `12.0.12` and `11.0.22`) add a `preCommit` fallback from upstream change CC-43920. The fallback commits the framework's consumed offset when a partition writer has no pending data. After a retriable S3 error, the connector replaces the partition writer, so the fallback can commit offsets for records that were never written to S3.

In testing with `12.1.14`, 200 records on each of 3 topics were lost after an S3 outage. The sequence was:

1. a retriable S3 error,
2. the offset commit,
3. a non-retriable error that failed the task.

The records were not in S3 or the DLQ, and their offsets were committed.

Before upgrading the connector:

1. Check whether the upstream issue is fixed, comparing `S3SinkTask.preCommit` and the `RetriableException` handling in `S3SinkTask.put` with `12.1.13`.
2. Re-run the outage tests in [Test Results](#13-test-results) with the new version: stop the `s3-local` container while producing, wait for the task to fail, start it, restart the task, and verify that every produced record is in S3.

[Back to top](#s3-archive-kafka-connector)

## 15. Compact Raw Archive

The optional `sink.S3RawArchive` connector archives only the three values needed to replay a received message through the ODE:

- `odeReceivedAt`: the time the ODE received the message.
- `originIp`: the IP address the UDP packet came from.
- `asn1`: the hex of the message as received:
  - For UDP, this is the full packet, including any WSMP and IEEE 1609.2 headers.
  - For OBU log file uploads, it is the record payload with the WSMP header removed.

It runs alongside `sink.S3Archive`, which keeps the full record values, and does not change it.

### Source topics

The connector reads the decoded ODE topics, not the raw encoded topics. The ODE copies the metadata of the received message, including `asn1`, into the decoded record. This holds for the external ASN.1 decoder route and for the FFM decode routes, including the direct UDP route that can skip the raw encoded topics. The archive keeps working if the `topic.OdeRawEncoded*Json` topics are removed.

| Archived | Topics |
|---|---|
| Yes | `topic.OdeBsmJson`, `topic.OdeTimJson`, `topic.OdeMapJson`, `topic.OdeSpatJson`, `topic.OdeSrmJson`, `topic.OdeSsmJson`, `topic.OdePsmJson`, `topic.OdeSdsmJson`, `topic.OdeRtcmJson`, `topic.OdeRsmJson` |
| No | `topic.OdeTimJsonTMCFiltered` and `topic.OdeTIMCertExpirationTimeJson` are derived from `topic.OdeTimJson`. `topic.OdeDriverAlertJson` has no `asn1`. |

**What is not archived:**
- **Messages that fail to decode:** only decoded messages reach these topics. While the raw encoded topics exist, `sink.S3Archive` still keeps every received message.
- **TIMs deposited through the ODE REST API (`POST /tim`):** the ODE publishes them to `topic.OdeTimJson` before encoding, so they have no `asn1`. A filter drops every record without a non empty `asn1`.

### Layout and format

```text
s3://<bucket>/<environment>/compact/<topic>/year=YYYY/month=MM/day=dd/hour=HH/<topic>+<partition>+<startOffset>.json.gz
```

Each object is a gzip (level 9) file with one JSON object per line:

```json
{"odeReceivedAt":"2026-10-29T22:07:29.253Z","originIp":"10.10.0.3","asn1":"0300208095038100400380380014354..."}
```

- **Key order:** the order of the keys in a line is not fixed.
- **Empty `originIp`:** records imported from OBU log files have `"originIp":""`.
- **Offsets:** `startOffset` is the offset of the first record in the object. Line `n` holds offset `startOffset + n` only if no record in that range was filtered out. On `topic.OdeTimJson`, deposited TIMs are filtered out, so use `odeReceivedAt` and `asn1` to find a record on Kafka.
- **Separate prefix:** the `compact` prefix keeps these objects apart from the full archive objects of the same topics, which have the same object names.

### How it works

The connector reads the records with the `JsonConverter` and applies three transforms. No custom code is involved:

1. `ExtractField$Value` (`field=metadata`) replaces the value with its `metadata` object.
2. `io.confluent.connect.transforms.Filter$Value` (`filter.condition=$[?(@.asn1 =~ /.+/)]`, `filter.type=include`, `missing.or.null.behavior=exclude`) drops records whose `asn1` is missing, null or empty. It comes from the `confluentinc/connect-transforms` plugin, which is already installed in the Kafka Connect image.
3. `ReplaceField$Value` (`include=odeReceivedAt,originIp,asn1`) keeps only those fields.

`JsonFormat` then writes each result as one line. The bucket, region, environment, partitioning, flush, retry, error handling and encryption settings are shared with `sink.S3Archive` through the `s3_sink_common` macro in [kafka-connectors-template.jinja](../jikkou/kafka-connectors-template.jinja). The connector has its own consumer group `connect-sink.S3RawArchive` and its own dead letter queue `dlq.S3RawArchive`, with 7 day retention.

**CPU:** the connector parses each decoded record, which is about 1.9 KB for a BSM and 12.5 KB for a MAP, and keeps about 0.4 KB and 2 KB of it. This uses more CPU than the full archive's byte-for-byte copy. Include both connectors when sizing the Kafka Connect worker.

### Configuration

| Setting | Default | Description |
|---|---|---|
| `CONNECT_CREATE_S3_RAW_ARCHIVE` | `false` | Create or update `sink.S3RawArchive`. Uses `CONNECT_S3_BUCKET_NAME`, `CONNECT_S3_REGION`, `CONNECT_S3_ENVIRONMENT`, the SSE, ACL and store settings of [Configuration](#4-configuration). |
| `CONNECT_S3_RAW_TOPICS` | blank | Comma separated topic list that replaces `s3RawArchive.topics`. |
| `s3RawArchive.topics` | the 10 decoded topics in [Source topics](#source-topics) | Topics to archive. |
| `s3RawArchive.fields` | `odeReceivedAt`, `originIp`, `asn1` | Metadata fields kept in each line. |
| `s3RawArchive.pathPrefix` | `compact` | Prefix under the environment. |
| `s3RawArchive.compressionLevel` | `9` | gzip level. |
| `s3RawArchive.flushSize`, `rotateScheduleIntervalMs` | `10000`, `120000` | Object size and age limits. |

The IAM policy, encryption, lifecycle rules, monitoring and operations of the previous sections apply in the same way. Use the connector name `sink.S3RawArchive` with the REST API. The Grafana dashboard's connector selector lists both connectors.

**Adding topics:** the connector reads a newly added topic from its earliest retained record. To start at the current end instead, follow these steps:
1. Stop the connector.
2. Set the consumer group's offsets for the new topics to the end with `kafka-consumer-groups.sh --reset-offsets --to-latest`.
3. Run `kafka-connect-setup`.
4. Resume the connector.

`kafka-connect-setup` updates the configuration of a stopped connector but does not resume it.

### Storage size

The table compares the gzip compressed size per record with the full archive. The records are real ODE records, created by sending the unique signed BSM, MAP and TIM messages of the Commsignia sample logs in the jpo-ode `data` folder over UDP to the ODE.

| Message | Full decoded record (`sink.S3Archive`, gzip 6) | Full raw encoded record (`sink.S3Archive`, gzip 6) | Compact (`sink.S3RawArchive`, gzip 9) | Compact / full decoded |
|---|---|---|---|---|
| Signed BSM (511 records) | 144.8 B | 137.6 B | 97.2 B | 67% |
| Signed MAP (103 records) | 261.0 B | 168.8 B | 115.0 B | 44% |
| Signed TIM (279 records) | 140.2 B | 138.5 B | 98.9 B | 71% |

- **Signed messages:** most of what remains after compression is the 1609.2 signature and certificate data, which does not compress.
- **Repeated test data:** test data that repeats the same message compresses far better. On a local stack fed by a UDP sender that repeats one BSM, the compact archive took 3.9 B per record against 47.6 B for the full decoded record, about one twelfth. Do not use such data to estimate storage.
- **Binary encoding:** a custom binary encoding (8 byte time, 4 byte IP, 2 byte length, then raw bytes) would be about another 15 to 19% smaller. It would need custom connector code and a reader, so JSON lines were chosen.
- **gzip level:** level 9 is about 1% smaller than the default level 6.

### Retrieval and replay

```bash
# Download one hour of BSMs
aws s3 cp s3://<bucket>/<environment>/compact/topic.OdeBsmJson/year=2026/month=10/day=29/hour=22/ ./raw --recursive

# Read the records
zcat ./raw/*.json.gz | jq -c '{odeReceivedAt, originIp}'

# Replay each message as a UDP packet to the ODE receiver for its type (bash, with xxd)
zcat ./raw/*.json.gz | jq -r '.asn1' | while read -r hex; do
  echo "$hex" | xxd -r -p > /dev/udp/<ode-host>/46800
done
```

**ODE UDP ports** (defaults):

| Type | Port |
|---|---|
| BSM | `46800` |
| TIM | `47900` |
| MAP | `44920` |
| SPaT | `44910` |
| SRM | `44930` |
| SSM | `44900` |
| PSM | `44940` |
| SDSM | `44950` |
| RTCM | `44960` |
| RSM | `44970` |
| Generic receiver | `44990` |

**What changes on replay:** the replayed records get a new `odeReceivedAt` and the replaying host as `originIp`. Use the archived values to correlate them with the original records.

**OBU log file records:** these were not replayed in testing. Their `asn1` keeps the 1609.2 header but not the WSMP header, and their log metadata (location and generation time) is not in the compact archive.

### Test results

These tests were run on 2026-10-29 against the jpo-ode compose stack (external ASN.1 decoder route) with jpo-utils. Both S3 connectors were enabled, and a synthetic UDP sender kept up a BSM load.

| Test | Result |
|---|---|
| Template | The rendered `sink.S3Archive` configuration and all MongoDB connectors are identical to the previous template. `sink.S3RawArchive` is only rendered with `CONNECT_CREATE_S3_RAW_ARCHIVE=true`. |
| Filter | A test connector with the same transforms kept the records with an `asn1` value and dropped those with `asn1` missing, null or `""`. |
| Topic switch | The existing connector was moved from the raw encoded topics to the decoded topics with the steps in [Configuration](#configuration). All 85 connectors and 832 tasks stayed `RUNNING`. |
| BSM | 163,867 records archived in 18 objects with no gaps or overlaps between objects. 79,081 consecutive records were compared line by line with `metadata` on Kafka, with no mismatches. All 511 real Commsignia BSMs were archived. |
| MAP | All 103 real Commsignia MAPs were archived and match Kafka. |
| TIM | `topic.OdeTimJson` held 279 UDP TIMs, 279 TIMs from an OBU log upload (`POST /upload/obulog`) and 1 TIM deposited with `POST /tim`. All 558 records with `asn1` were archived and match Kafka. The deposited TIM was dropped. The log records have `"originIp":""`. |
| Replay | An archived signed Commsignia MAP `asn1` was sent as a UDP packet to port 44920, and the ODE decoded it to `topic.OdeMapJson` again. |
| Health | `dlq.S3RawArchive` empty, no connector errors, task metrics exported for both connectors, Prometheus scrape under 3 seconds. |
| Capacity | In an earlier run with both connectors, the 83 MongoDB sinks and a synthetic load on about 40 archived topics, the one CPU Kafka Connect worker was at its CPU limit and both archive connectors fell behind while working through backlogs. Size the worker CPU for both connectors at production rates. |

[Back to top](#s3-archive-kafka-connector)
