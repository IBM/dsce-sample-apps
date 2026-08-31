# FleetOps v2 Branch - Latest Updates

**Branch:** fleetops-v2  
**Last Updated:** May 19, 2026  
**Summary:** Additional features and fixes on top of main branch changes

---

## 🎯 Overview

This document outlines the additional changes in the `fleetops-v2` branch that are not present in the main branch. These updates build upon the truck diversion workflow and include persistent storage, decision tool improvements, and deployment enhancements.

---

## 📋 New Commits in fleetops-v2

### 1. **Execution History - Persistent Storage** (Commit: d8f0fba)
   - **Author:** Muralidhar Chavan
   - **Date:** May 19, 2026, 11:01 AM
   - **Impact:** 36 insertions, 2 deletions across 3 files

### 2. **Merge Pull Request #1** (Commit: 114819a)
   - **Description:** Merged fleetops-driverview branch
   - **Impact:** Consolidated driver view features

### 3. **Decision Tool Fix** (Commit: 2cbeac0)
   - **Author:** Utkarsh Dixit
   - **Date:** May 18, 2026, 2:05 PM
   - **Impact:** 92 insertions, 57 deletions in decision tool

---

## 🚀 New Features

### 1. **Persistent Storage for Execution History**

#### **New File Created:** `FleetOps/openshift-pvc-execution-history.yaml`

**Purpose:** Dedicated Persistent Volume Claim for storing agent execution history

**Specifications:**
```yaml
- Storage: 1Gi
- Access Mode: ReadWriteOnce
- Storage Class: ocs-storagecluster-ceph-rbd
- Namespace: fleetops-backend
- Purpose: execution-history persistence
```

**Benefits:**
- ✅ Execution history survives pod restarts
- ✅ Data persistence across deployments
- ✅ Audit trail for agent decisions
- ✅ Historical analysis capabilities

#### **OpenShift Deployment Updates** (`FleetOps/openshift-deployment.yaml`)

**Changes Made:**
- Added volume mount for execution history at `/app/data`
- Configured PVC binding for persistent storage
- Enhanced data retention capabilities

**Volume Configuration:**
```yaml
volumeMounts:
  - name: data-volume
    mountPath: /app/data
```

#### **Frontend Updates** (`FleetOps/public/index.html`)

**Changes:**
- Added 7 new lines for execution history display
- Enhanced UI to show historical agent executions
- Better data visualization for past decisions

---

### 2. **Decision Tool Improvements**

#### **File Updated:** `tools/decision_tool/decision_analysis_tool.py`

**Major Refactoring:**
- **Lines Changed:** 92 insertions, 57 deletions
- **Total Impact:** 149 lines modified

**Key Improvements:**

**a) Enhanced Data Models:**
```python
class DecisionType(str, Enum):
    EMERGENCY_REROUTE = "EMERGENCY_REROUTE"
    CONTROLLED_REROUTE = "CONTROLLED_REROUTE"
    CONTINUE = "CONTINUE"
    ABORT = "ABORT"

class UrgencyLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class SeverityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
```

**b) Improved Type Safety:**
- Added Pydantic models for all data structures
- Better validation for input parameters
- Type hints for all functions
- Field descriptions for clarity

**c) Enhanced Data Structures:**
- `LocationCoordinates` - Geographic coordinates
- `TelemetryData` - Current truck telemetry
- `CargoData` - Cargo information with thresholds
- `OriginalPlan` - Trip planning data
- `WeatherSegment` - Weather condition details
- `WeatherAnalysis` - Comprehensive weather analysis

**d) Better Error Handling:**
- Optional fields with default values
- Graceful degradation for missing data
- Improved validation logic

**e) Integration with watsonx Orchestrate:**
```python
from ibm_watsonx_orchestrate.agent_builder.tools import tool
```
- Proper tool decorator for agent integration
- Better compatibility with watsonx platform

---

## 📊 Statistics

### **Overall Changes in fleetops-v2:**
- **Total Files Modified:** 12
- **Total Insertions:** 1,331 lines
- **Total Deletions:** 501 lines
- **Net Change:** +830 lines

### **New Features Breakdown:**
```
Persistent Storage:
  - New PVC file: +19 lines
  - Deployment updates: +12 lines
  - Frontend updates: +7 lines
  
Decision Tool:
  - Refactoring: +92 lines
  - Code cleanup: -57 lines
  - Net improvement: +35 lines
```

---

## 🔄 Complete Feature Set (Main + v2)

### **From Main Branch:**
1. ✅ Truck diversion workflow
2. ✅ Driver view module (612 lines)
3. ✅ Service pause mechanism (1 minute)
4. ✅ Automatic route restoration
5. ✅ Enhanced agent service
6. ✅ Simulation engine improvements
7. ✅ Frontend UI enhancements

### **Additional in fleetops-v2:**
8. ✅ Persistent execution history storage
9. ✅ OpenShift PVC configuration
10. ✅ Enhanced decision tool with better type safety
11. ✅ Improved data models and validation
12. ✅ Historical data visualization

---

## 🏗️ Architecture Enhancements

### **Storage Architecture:**
```
┌─────────────────────────────────────┐
│   FleetOps Frontend Pod             │
│                                     │
│   ┌─────────────────────────────┐  │
│   │  /app/data (mounted)        │  │
│   │  - execution_history.json   │  │
│   │  - agent_decisions.log      │  │
│   └─────────────────────────────┘  │
│              │                      │
└──────────────┼──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Persistent Volume Claim            │
│  Name: fleetops-execution-history   │
│  Size: 1Gi                          │
│  Class: ocs-storagecluster-ceph-rbd │
└─────────────────────────────────────┘
```

### **Decision Tool Flow:**
```
Input Data → Validation (Pydantic) → Analysis → Decision
    │              │                     │          │
    │              │                     │          │
    ▼              ▼                     ▼          ▼
Telemetry    Type Safety         Risk Score    Recommendation
Weather      Field Validation    Urgency       Action Plan
Cargo        Default Values      Severity      Routing
Station                                        Notification
```

---

## 🔧 Deployment Considerations

### **For OpenShift Deployment:**

1. **Apply PVC First:**
```bash
oc apply -f FleetOps/openshift-pvc-execution-history.yaml
```

2. **Verify PVC Status:**
```bash
oc get pvc fleetops-execution-history -n fleetops-backend
```

3. **Deploy Application:**
```bash
oc apply -f FleetOps/openshift-deployment.yaml
```

4. **Check Volume Mount:**
```bash
oc exec -it <pod-name> -- ls -la /app/data
```

### **Storage Requirements:**
- Minimum: 1Gi (as configured)
- Recommended: 2-5Gi for production
- Growth rate: ~10-50MB per day (depends on traffic)

---

## 🧪 Testing Recommendations

### **Test Persistent Storage:**
1. Trigger agent workflow
2. Check execution history in `/app/data`
3. Restart pod
4. Verify data persistence
5. Check historical data retrieval

### **Test Decision Tool:**
1. Send various telemetry scenarios
2. Verify proper type validation
3. Check decision accuracy
4. Test edge cases with missing data
5. Validate urgency level calculations

### **Integration Testing:**
1. Complete workflow: Alert → Agent → Decision → Storage
2. Verify data flow through all components
3. Check UI displays historical data
4. Test concurrent executions
5. Validate data consistency

---

## 📝 Notes for Bob Users

### **When Working with fleetops-v2:**

1. **Persistent Storage:**
   - Data is now stored in `/app/data` directory
   - Execution history persists across restarts
   - Check PVC status before debugging storage issues
   - Monitor disk usage for the PVC

2. **Decision Tool:**
   - All inputs are now validated with Pydantic
   - Use proper type hints when extending functionality
   - Optional fields have sensible defaults
   - Check `decision_analysis_tool.py` for data models

3. **Deployment:**
   - Always apply PVC before deployment
   - Verify volume mounts in pod specs
   - Check storage class availability in your cluster
   - Monitor PVC binding status

4. **Debugging:**
   - Check `/app/data` for execution logs
   - Review historical decisions for patterns
   - Validate input data against Pydantic models
   - Use type hints for better IDE support

### **Key Files to Review:**
- `FleetOps/openshift-pvc-execution-history.yaml` - Storage configuration
- `FleetOps/openshift-deployment.yaml` - Volume mounts
- `tools/decision_tool/decision_analysis_tool.py` - Enhanced decision logic
- `FleetOps/public/index.html` - Historical data display

---

## 🔗 Related Documentation

- **Main Branch Changes:** See `LATEST_CHANGES.md`
- **Architecture:** See `FleetOps/ARCHITECTURE_WITH_AGENTS.md`
- **Deployment:** See `FleetOps/DEPLOYMENT.md`
- **Testing:** See `fleetops-backend/TESTING_GUIDE_v1.0.6.md`

---

## 🚦 Status

✅ **Branch switched to fleetops-v2**  
✅ **Latest changes pulled from origin**  
✅ **All features documented**  
✅ **Ready for development**

---

## 📞 Contributors

- **Muralidhar Chavan** - Persistent storage implementation
- **Utkarsh Dixit** - Decision tool improvements
- **Niteesh Nair** - Main workflow features
- **Shan** - Driver view and UI fixes

---

## 🔄 Branch Comparison

### **Main Branch:**
- Last commit: 7cd7bc3 (Truck diversion workflow)
- Focus: Core functionality

### **fleetops-v2 Branch:**
- Last commit: d8f0fba (Execution history storage)
- Focus: Production readiness with persistence
- Additional commits: 3 (d8f0fba, 114819a, 2cbeac0)
- Extra features: Persistent storage + Enhanced decision tool

---

*Generated on: May 19, 2026*  
*Branch: fleetops-v2*  
*Last Commit: d8f0fba*