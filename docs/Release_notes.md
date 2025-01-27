## JPO-UTILS Release Notes

## Version 2.0.0

### **Summary**
The first release of the jpo-utils package. This package is focused on hosting utility applications that other parts of the Conflict Monitor depend on. Many of these components are provided by 3rd party groups such as Kafka and MongoDB. This first official release formalizes the migration of multiple components from other repositories to the jpo-utils repository. The migrated components are as follows
- MongoDB - Transferred from the jpo-conflictmonitor
- Kafka - Transferred from the jpo-ode
- Deduplicator - Transferred from the jpo-conflictmonitor
- Kafka Connect - Transferred from the jpo-conflictmonitor repository

This release also makes additional changes to the submodule components as follows
- Refactored docker-compose files to use compose profiles for modular component approach
- Adds in Jikkou for managing Kafka topic creation and Kafka connect behaviors
- Updates mongoDB indexes and collection list to support new collections
- Updated jpo-deduplicator for compatibility with jpo-ode version 4.0.0

Enhancements in this release:
USDOT PR 2: Kafka Connect Module Addition
USDOT PR 3: Kafka topics management
USDOT PR 5: Add TMC filtered TIM topic
USDOT PR 6: Merge Release/2024 q3 to master branch
USDOT PR 7: Sync Develop with Master branch for Q3 release 2024
USDOT PR 8: Kafka Connect Jikkou Refactor
USDOT PR 9: Environmental Variable Fixes
USDOT PR 10: Kafka topic addition
USDOT PR 11: updates to mongo and kafka connect
USDOT PR 12: update keyfile generation to use env vars
USDOT PR 13: Added Spat and ASN Tim Deduplication
USDOT PR 14: Adding DB entries for Progression Events
USDOT PR 15: Cimms event aggregation topics
USDOT PR 16: Updating Conflict Monitor Mongo Connectors
USDOT PR 17: chore: make kafka_init.sh executable
USDOT PR 18: Adding JPO-Deduplicator to jpo-utils
CDOT PR 3: Updated Deduplicator for Compatibility with ode 4.0
CDOT PR 4: Enable BSM deduplication by default
USDOT PR 21: Adding missing cm topic
USDOT PR 22: Adding Default Credentials
USDOT PR 23: Adding missing ode topics
USDOT PR 24: Index updates
CDOT PR 6: Adding MEC Deposit Resources
USDOT PR 25: Updating version for kafka ui to latest release
CDOT PR 7: Tim compatibility and CI updates
CDOT PR 8: Jpo deduplicator removal