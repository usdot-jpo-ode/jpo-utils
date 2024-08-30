#!/bin/sh

#
# Create or update topics
#
# Usage: 
#   ./kafka_init.sh [app1] [app2] ...
#
# Arguments:
#   List of application names that can include the following:
#     - jpo-ode
#     - jpo-geojsonconverter
#     - jpo-conflictmonitor
#     - jpo-deduplicator
#

echo "APPS=$@"

JPO_ODE=false
JPO_GEOJSONCONVERTER=false
JPO_CONFLICTMONITOR=false
JPO_DEDUPLICATOR=false
for app in "$@"; do
    if [ "$app" = "jpo-ode" ]; then
        JPO_ODE=true
    elif [ "$app" = "jpo-geojsonconverter" ]; then
        JPO_GEOJSONCONVERTER=true
    elif [ "$app" = "jpo-conflictmonitor" ]; then
        JPO_CONFLICTMONITOR=true
    elif [ "$app" = "jpo-deduplicator" ]; then
        JPO_DEDUPLICATOR=true
    else
        echo "Unknown application: $app"
        exit 1
    fi
done

echo "JPO_ODE=$JPO_ODE"
echo "JPO_GEOJSONCONVERTER=$JPO_GEOJSONCONVERTER"
echo "JPO_CONFLICTMONITOR=$JPO_CONFLICTMONITOR"
echo "JPO_DEDUPLICATOR=$JPO_DEDUPLICATOR"

# Validate and log the filled-in template
# Pass environment variables to jikkou. 
# Note using this approach instead of jikkou --selector option because the latter
# causes an error status to be returned for topics that already exit.
JPO_ODE=${JPO_ODE} JPO_GEOJSONCONVERTER=${JPO_GEOJSONCONVERTER} JPO_CONFLICTMONITOR=${JPO_CONFLICTMONITOR} JPO_DEDUPLICATOR=${JPO_DEDUPLICATOR} ./jikkou validate \
     --files kafka-topics-template.jinja \
     --values-files kafka-topics-values.yaml 

# Create or update topics
JPO_ODE=${JPO_ODE} JPO_GEOJSONCONVERTER=${JPO_GEOJSONCONVERTER} JPO_CONFLICTMONITOR=${JPO_CONFLICTMONITOR} JPO_DEDUPLICATOR=${JPO_DEDUPLICATOR} ./jikkou apply \
    --files kafka-topics-template.jinja \
    --values-files kafka-topics-values.yaml 


 
