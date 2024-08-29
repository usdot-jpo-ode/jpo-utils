#!/bin/sh

# Validate and log the filled-in template
./jikkou validate --files kafka-topics-template.jinja --values-files kafka-topics-values.yaml

# Create or update topics
./jikkou apply --files kafka-topics-template.jinja --values-files kafka-topics-values.yaml
