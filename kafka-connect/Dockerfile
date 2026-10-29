FROM confluentinc/cp-kafka-connect:7.7.0

# MongoDB Kafka Connector
# Docs: https://www.mongodb.com/docs/kafka-connector/current/
RUN confluent-hub install --no-prompt mongodb/kafka-connect-mongodb:1.13.0

# Transforms
# Docs: https://docs.confluent.io/platform/current/connect/transforms/overview.html
RUN confluent-hub install --no-prompt confluentinc/connect-transforms:1.4.7

# Amazon S3 Sink Connector (Confluent Community License)
# Docs: https://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html
# NOTE: Versions 12.1.14+, 12.0.12+ and 11.0.22+ include a preCommit offset fallback (CC-43920) that can commit
# offsets for records that failed to upload after a retriable S3 error. Re-run the S3 outage test in
# docs/S3_Archive.md before upgrading.
RUN confluent-hub install --no-prompt confluentinc/kafka-connect-s3:12.1.13

# Prometheus JMX exporter java agent (Apache 2.0), enabled through KAFKA_OPTS in docker-compose-connect.yml
# Docs: https://prometheus.github.io/jmx_exporter/
USER root
RUN mkdir -p /usr/share/jmx-exporter \
    && curl -fsSL -o /usr/share/jmx-exporter/jmx_prometheus_javaagent.jar \
       https://github.com/prometheus/jmx_exporter/releases/download/1.7.0/jmx_prometheus_javaagent-1.7.0.jar \
    && echo "0ad843261c567d1924a017d542e14c40f2afff523d940c25ee000742fde4b3a9  /usr/share/jmx-exporter/jmx_prometheus_javaagent.jar" | sha256sum -c -
COPY jmx-exporter.yml /usr/share/jmx-exporter/jmx-exporter.yml
RUN chmod 755 /usr/share/jmx-exporter && chmod 644 /usr/share/jmx-exporter/*
USER appuser
