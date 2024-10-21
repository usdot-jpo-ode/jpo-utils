FROM confluentinc/cp-kafka-connect:7.7.0

COPY connect_wait.sh /scripts/connect_wait.sh

# Docs: https://www.mongodb.com/docs/kafka-connector/current/
RUN confluent-hub install --no-prompt mongodb/kafka-connect-mongodb:1.13.0
# Docs: https://docs.confluent.io/platform/current/connect/transforms/overview.html
RUN confluent-hub install --no-prompt confluentinc/connect-transforms:1.4.7

# CMD ["bash", "-c", "/scripts/connect_wait.sh"]