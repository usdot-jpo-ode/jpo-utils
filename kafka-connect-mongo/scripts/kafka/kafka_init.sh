sleep 2s
/opt/bitnami/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
echo 'Creating kafka topics'

# Create topics
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdeSpatJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdeBsmJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdeTimJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdeMapJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdeSsmJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdeSrmJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1
/opt/bitnami/kafka/bin/kafka-topics.sh --create --if-not-exists  --topic "topic.OdePsmJson" --bootstrap-server kafka:9092 --replication-factor 1 --partitions 1

echo 'Kafka created with the following topics:'
/opt/bitnami/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
exit