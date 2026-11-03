#!/bin/sh

echo "CONNECT_CREATE_ODE=$CONNECT_CREATE_ODE"
echo "CONNECT_CREATE_GEOJSONCONVERTER=$CONNECT_CREATE_GEOJSONCONVERTER"
echo "CONNECT_CREATE_CONFLICTMONITOR=$CONNECT_CREATE_CONFLICTMONITOR"
echo "CONNECT_CREATE_DEDUPLICATOR=$CONNECT_CREATE_DEDUPLICATOR"
echo "CONNECT_CREATE_S3_ARCHIVE=$CONNECT_CREATE_S3_ARCHIVE"
echo "CONNECT_S3_ARCHIVE_ODE=$CONNECT_S3_ARCHIVE_ODE"
echo "CONNECT_S3_ARCHIVE_GEOJSONCONVERTER=$CONNECT_S3_ARCHIVE_GEOJSONCONVERTER"
echo "CONNECT_S3_ARCHIVE_DEDUPLICATOR=$CONNECT_S3_ARCHIVE_DEDUPLICATOR"
echo "CONNECT_S3_ARCHIVE_MECDEPOSIT=$CONNECT_S3_ARCHIVE_MECDEPOSIT"
echo "CONNECT_S3_ARCHIVE_CONFLICTMONITOR=$CONNECT_S3_ARCHIVE_CONFLICTMONITOR"
echo "CONNECT_S3_ARCHIVE_INTERSECTION_API=$CONNECT_S3_ARCHIVE_INTERSECTION_API"
echo "CONNECT_S3_ARCHIVE_RSUSTATUSMONITOR=$CONNECT_S3_ARCHIVE_RSUSTATUSMONITOR"
echo "CONNECT_S3_ARCHIVE_OTHER=$CONNECT_S3_ARCHIVE_OTHER"
echo "CONNECT_CREATE_S3_RAW_ARCHIVE=$CONNECT_CREATE_S3_RAW_ARCHIVE"

# Set the maximum number of retries
MAX_RETRIES=5
RETRY_COUNT=0

# Retry the health check until it is ready or the retry limit is reached
until ./jikkou health get kafkaconnect | yq -e '.status.name == "UP"' > /dev/null; do
     echo "Waiting 10 sec for Kafka Connect to be ready (Attempt: $((RETRY_COUNT+1))/$MAX_RETRIES)"
     RETRY_COUNT=$((RETRY_COUNT+1))
     sleep 10
     if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
       echo "Quitting because retry count is >= max retries"
       exit 1
     fi
done

# The S3 archive connector reads the app topic lists of the topics values file as values.topicApps.
# Jikkou replaces top level keys of later values files, so the topic apps are moved under their own key.
yq '{"topicApps": .apps}' kafka-topics-values.yaml > /tmp/kafka-topics-apps.yaml || exit 1

./jikkou validate \
     --files kafka-connectors-template.jinja \
     --values-files kafka-connectors-values.yaml \
     --values-files /tmp/kafka-topics-apps.yaml

./jikkou apply \
     --files kafka-connectors-template.jinja \
     --values-files kafka-connectors-values.yaml \
     --values-files /tmp/kafka-topics-apps.yaml
