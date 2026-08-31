# Changelog

All notable changes to FleetOps Backend will be documented in this file.

## [v1.0.6] - 2026-05-11

### Fixed
- **CRITICAL**: Temperature accumulation bug causing values to exceed realistic bounds (e.g., 68964.4°C)
  - Added absolute temperature bounds enforcement (-30°C to +30°C)
  - Prevents temperature from accumulating indefinitely during coolant failures
  - Temperature now properly capped at ambient temperature (30°C) during failures
- **Auto-Resolution**: Incidents now auto-resolve after 10 minutes
  - Truck automatically resets to normal operation
  - Cargo temperature restored to safe levels
  - Cargo condition reset to "GOOD" (prevents permanent SPOILED state)
  - Associated alerts automatically acknowledged
  - Incident tracking cleaned up to allow new incidents
- **Alert Counter Sync**: Fixed frontend alert counter to show only active (unacknowledged) alerts
  - Updated both [`app.js`](../FleetOps/public/app.js:925) and [`operations-new.js`](../FleetOps/public/operations-new.js:300) to use `active_only=true` parameter
  - Counter now decrements when alerts are auto-resolved or acknowledged
- **Data Persistence**: Changed from multiple timestamped files to single files
  - All data types (trucks, stations, weather, incidents, alerts) now use single `_latest.json` files
  - Alerts additionally saved to `alerts_history.json` for historical tracking
  - Eliminates disk space issues from accumulating timestamped files
  - Maintains `_latest.json` files for current state
- **Alert Cleanup API**: Added `DELETE /alerts/history/cleanup` endpoint
  - Accepts optional `before_date` parameter to delete alerts before specific date
  - Returns count of deleted and remaining alerts
  - Helps manage disk space by removing old alert records
- **Alert Variety**: Ensured mix of cargo and weather incidents
  - 4 trucks selected for incidents: 2 get cargo alerts, 2 get weather alerts
  - Pre-assigned incident types prevent all trucks getting same alert type
  - Provides better demonstration of different alert scenarios

### Added
- **Active Alerts Filter**: Added `active_only` query parameter to `GET /alerts` endpoint
  - When `active_only=true`, returns only unacknowledged alerts
  - Allows frontend to query active alerts separately from historical data

### Technical Details
- Added `incident_creation_times` tracking dictionary
- Implemented `_check_auto_resolution()` method in simulation engine
- Enhanced `_simulate_cargo_drift()` with bounds checking at start of method
- Auto-resolution runs every simulation step (5 seconds) for trucks with active incidents
- Modified [`json_adapter.py`](app/persistence/json_adapter.py:) to use single `alerts_history.json` file
- Enhanced [`alerts.py`](app/api/alerts.py:) API with filtering and cleanup endpoints

---

## [v1.0.5] - 2026-05-11

### Added
- **WatsonX Orchestrate Integration**: Full integration with WatsonX Orchestrate using Kubernetes Secrets
  - Secure credential management via environment variables
  - Support for 4 agents: Weather, Station, Route, Decision
  - EU-GB region endpoint configuration
- **Kubernetes Secret Management**: Environment variable injection for sensitive data
- **Comprehensive Deployment Documentation**: Consolidated deployment guide with WatsonX setup

### Changed
- Updated deployment configuration to use environment variables for WatsonX credentials
- Modified ConfigMap to support environment variable overrides
- Enhanced Docker image with proper environment variable handling

### Fixed
- Resolved Multi-Attach volume errors during deployment
- Fixed ReplicaSet cleanup process

### Deployment
- Image: `docker.io/niteesh18/nndrepo:v1.0.5`
- Size: 214 MB
- Platform: linux/amd64

---

## [v1.0.4] - 2026-05-07

### Added
- **Trip Restart Feature**: Automatic trip restart when trucks reach destination
  - Route reversal for round-trip simulation
  - Cargo temperature reset to safe levels
  - Incidents cleared for fresh start
  - Continuous simulation without manual intervention

### Fixed
- **Temperature Bounds Fix**: 
  - Maximum temperature cap at 30°C during coolant failure
  - Cargo-specific safe temperature ranges during normal operation
  - Prevents unrealistic temperature accumulation (was reaching 48,000°C)
- **Route Completion Fix**:
  - Trucks stop properly at destination
  - Distance remaining cannot go negative
  - Prevents infinite simulation loops

### Technical Details
- Modified `simulation_engine.py` with temperature bounds checking
- Added route completion bounds validation
- Implemented automatic trip restart logic

### Deployment
- Image: `docker.io/niteesh18/nndrepo:v1.0.4`
- Size: 211 MB

---

## [v1.0.3] - 2026-05-04

### Fixed
- **Path Resolution Fix**: Corrected file path handling for OpenShift deployment
  - Fixed data directory paths to use absolute paths
  - Resolved persistence file location issues
  - Improved cross-platform compatibility

### Changed
- Updated data directory configuration in `config.yaml`
- Modified persistence service to handle container paths correctly

---

## [v1.0.2] - 2026-05-03

### Added
- **OpenShift Deployment Support**: Full OpenShift compatibility
  - Multi-stage Dockerfile optimized for OpenShift
  - Arbitrary UID support for security contexts
  - Persistent volume claim configuration
  - Route and service definitions

### Changed
- Dockerfile optimized for production deployment
- Added health checks and readiness probes
- Configured resource limits and requests

### Deployment Files
- `k8s/namespace.yaml`
- `k8s/deployment.yaml`
- `k8s/service.yaml`
- `k8s/route.yaml`
- `k8s/pvc.yaml`
- `k8s/configmap.yaml`

---

## [v1.0.1] - 2026-05-02

### Added
- **Data Persistence System**: Complete persistence architecture
  - JSON file-based persistence (default)
  - Astra DB adapter (plugin)
  - IBM Db2 adapter (plugin)
  - Configurable persistence levels (initial, events, intervals)
  - Automatic state restoration on restart

### Features
- Persistence API endpoints for data retrieval
- Admin endpoints for persistence management
- Manual reset capability via API
- Timestamped data files for history tracking

### Configuration
- Added `config.yaml` for centralized configuration
- Persistence settings with multiple backend support
- Simulation parameters configuration

---

## [v1.0.0] - 2026-05-01

### Initial Release

### Core Features
- **Real-time Fleet Simulation**: 10 trucks with continuous updates
- **10x Accelerated Speed**: Updates every 5 seconds
- **Dynamic Weather System**: Real-time conditions affecting routes
- **Cargo Monitoring**: Temperature tracking with spoilage detection
- **Incident Management**: Automated generation and handling
- **Station Network**: 120km spacing with emergency services
- **Route Planning**: Dynamic generation with alternatives
- **REST API**: 20+ endpoints with interactive documentation

### Simulation Behavior
- Real I-95 corridor routes (30 verified land-based cities)
- Stations every 120 km along routes
- 4 out of 10 trucks affected by incidents
- Dynamic weather conditions with severity levels

### API Endpoints
- Truck operations (GET, POST, UPDATE)
- Route and waypoint management
- Station search with radius
- Weather data retrieval
- Alert and incident tracking

### Technical Stack
- Python 3.12+
- FastAPI 0.109.0
- Uvicorn with standard extras
- Pydantic for data validation
- APScheduler for background tasks
- Geopy for geographic calculations

---

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

---

## Upgrade Notes

### Upgrading to v1.0.5
1. Create WatsonX Orchestrate Kubernetes Secret
2. Update deployment.yaml to reference the secret
3. Deploy new image version
4. Verify environment variables are injected correctly

### Upgrading to v1.0.4
1. No configuration changes required
2. Deploy new image version
3. Verify temperature bounds are working correctly
4. Monitor trip restart functionality

### Upgrading to v1.0.3
1. Update `config.yaml` with correct data directory paths
2. Verify persistence is working after upgrade

### Upgrading to v1.0.2
1. Apply new Kubernetes manifests
2. Create PVC before deploying
3. Update image reference in deployment

### Upgrading to v1.0.1
1. Add `config.yaml` to your deployment
2. Configure persistence settings
3. Create data directory with proper permissions

---

## Deprecations

None currently.

---

## Known Issues

### v1.0.5
- Disk space warning on persistent volume (periodic persistence saves may fail)
  - **Workaround**: Clean up old data files or increase PVC size

### v1.0.4
- None

### v1.0.3
- None

---

## Future Roadmap

### Planned Features
- [ ] Real-time agent communication with WatsonX Orchestrate
- [ ] Advanced analytics dashboard
- [ ] Multi-region support
- [ ] Enhanced incident prediction
- [ ] Integration with external weather APIs
- [ ] Mobile app support
- [ ] Advanced reporting capabilities

### Under Consideration
- GraphQL API support
- WebSocket for real-time updates
- Machine learning for route optimization
- Blockchain for supply chain tracking

---

**Maintained by:** FleetOps Team  
**Last Updated:** May 11, 2026