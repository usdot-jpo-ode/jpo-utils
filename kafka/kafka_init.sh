#!/bin/sh

echo "KAFKA_TOPIC_CREATE_ODE=$KAFKA_TOPIC_CREATE_ODE"
echo "KAFKA_TOPIC_CREATE_GEOJSONCONVERTER=$KAFKA_TOPIC_CREATE_GEOJSONCONVERTER"
echo "KAFKA_TOPIC_CREATE_CONFLICTMONITOR=$KAFKA_TOPIC_CREATE_CONFLICTMONITOR"
echo "KAFKA_TOPIC_CREATE_DEDUPLICATOR=$KAFKA_TOPIC_CREATE_DEDUPLICATOR"

# Validate and log the filled-in template
./jikkou validate \
     --files kafka-topics-template.jinja \
     --values-files kafka-topics-values.yaml 

# Create or update topics
./jikkou apply \
    --files kafka-topics-template.jinja \
    --values-files kafka-topics-values.yaml 


 
