#!/bin/sh

echo "CONNECT_CREATE_ODE=$CONNECT_CREATE_ODE"
echo "CONNECT_CREATE_GEOJSONCONVERTER=$CONNECT_CREATE_GEOJSONCONVERTER"
echo "CONNECT_CREATE_CONFLICTMONITOR=$CONNECT_CREATE_CONFLICTMONITOR"
echo "CONNECT_CREATE_DEDUPLICATOR=$CONNECT_CREATE_DEDUPLICATOR"

# Set the maximum number of retries
MAX_RETRIES=5
RETRY_COUNT=0

# Retry the health check until it is ready or the retry limit is reached
until ./jikkou health get kafkaconnect | yq -e '.status.name == "UP"' > /dev/null; do
     echo "Waiting 10 sec for Kafka Connect to be ready (Attempt: $((RETRY_COUNT+1))/$MAX_RETRIES)"
     RETRY_COUNT=$((RETRY_COUNT+1))
     sleep 10
done

./jikkou validate \
     --files kafka-connectors-template.jinja \
     --values-files kafka-connectors-values.yaml 

./jikkou apply \
     --files kafka-connectors-template.jinja \
     --values-files kafka-connectors-values.yaml 