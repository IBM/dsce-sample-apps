# Testing Guide for v1.0.6

## Overview
This guide helps you test all the fixes implemented in v1.0.6 before deploying to OpenShift.

## What's Fixed in v1.0.6

### 1. Temperature Bounds Bug ✅
- **Issue**: Temperature values accumulating to unrealistic levels (68964.4°C)
- **Fix**: Added absolute bounds check (-30°C to +30°C) at start of drift calculation
- **Files Changed**: `app/services/simulation_engine.py`

### 2. Auto-Resolution of Incidents ✅
- **Issue**: Trucks permanently stuck in SPOILED state
- **Fix**: Incidents auto-resolve after 10 minutes, restoring normal operation
- **Files Changed**: `app/services/simulation_engine.py`

### 3. Alert Counter Sync ✅
- **Issue**: Alert counter shows all alerts including resolved ones
- **Fix**: Counter now shows only active (unacknowledged) alerts
- **Files Changed**: 
  - `FleetOps/public/app.js` (line 925)
  - `FleetOps/public/operations-new.js` (line 300)
  - `app/api/alerts.py` (added `active_only` parameter)

### 4. Alert Persistence ✅
- **Issue**: Multiple timestamped JSON files filling disk space
- **Fix**: Single `alerts_history.json` file with append-only pattern
- **Files Changed**: `app/persistence/json_adapter.py`

### 5. Alert Cleanup API ✅
- **Issue**: No way to delete old alert records
- **Fix**: New `DELETE /alerts/history/cleanup` endpoint
- **Files Changed**: `app/api/alerts.py`

## Testing Steps

### Prerequisites
1. Ensure you have the latest code (after git pull and stash pop)
2. Backend should be running on port 8005
3. Frontend should be running on port 4000

### Test 1: Temperature Bounds
**Expected**: Temperature should never exceed -30°C to +30°C range

1. Start both backend and frontend
2. Monitor trucks with coolant failures
3. Check that temperature stays within bounds
4. Look for any temperature values > 30°C or < -30°C

**Pass Criteria**: ✅ No temperature values outside -30°C to +30°C range

### Test 2: Auto-Resolution (10 minutes)
**Expected**: Incidents should auto-resolve after 10 minutes

1. Identify a truck with an active incident (e.g., TRUCK-001)
2. Note the time when incident started
3. Wait 10 minutes
4. Check that:
   - Truck status returns to normal
   - Cargo temperature restored to safe level
   - Cargo condition shows "GOOD"
   - Alert is acknowledged automatically

**Pass Criteria**: ✅ Truck auto-resolves after 10 minutes

### Test 3: Alert Counter Sync
**Expected**: Counter shows only active alerts and decrements when resolved

1. Note the initial alert counter value
2. Wait for an incident to auto-resolve (10 minutes)
3. Check that alert counter decrements
4. Verify counter shows only unacknowledged alerts

**Pass Criteria**: ✅ Counter decrements when alerts are resolved

### Test 4: Single Alert File
**Expected**: Only one `alerts_history.json` file created

1. Check the data directory: `ls -la fleetops-backend/data/`
2. Verify only these files exist:
   - `alerts_history.json` (growing file with all alerts)
   - `alerts_latest.json` (current active alerts)
3. No timestamped files like `alerts_2026-05-11_*.json`

**Pass Criteria**: ✅ Single `alerts_history.json` file exists

### Test 5: Alert Cleanup API
**Expected**: API can delete old alert records

1. Test cleanup endpoint:
```bash
# Delete all history
curl -X DELETE http://localhost:8005/api/alerts/history/cleanup

# Delete alerts before specific date
curl -X DELETE "http://localhost:8005/api/alerts/history/cleanup?before_date=2026-05-11T00:00:00Z"
```

2. Check response shows deleted and remaining counts
3. Verify `alerts_history.json` file size reduced

**Pass Criteria**: ✅ API successfully deletes old alerts

## Quick Test Commands

### Start Backend (Terminal 1)
```bash
cd fleetops-backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8005
```

### Start Frontend (Terminal 2)
```bash
cd FleetOps
npm start
```

### Monitor Logs
```bash
# Backend logs show auto-resolution
tail -f fleetops-backend/logs/app.log | grep "auto-resolved"

# Check alert file
cat fleetops-backend/data/alerts_history.json | jq '.[-5:]'
```

### Test API Endpoints
```bash
# Get only active alerts
curl http://localhost:8005/api/alerts?active_only=true | jq '.'

# Get all alerts
curl http://localhost:8005/api/alerts | jq '.'

# Cleanup old alerts
curl -X DELETE http://localhost:8005/api/alerts/history/cleanup
```

## Expected Results Summary

| Test | Expected Behavior | Status |
|------|------------------|--------|
| Temperature Bounds | Values stay within -30°C to +30°C | ⏳ Test |
| Auto-Resolution | Incidents resolve after 10 min | ⏳ Test |
| Alert Counter | Shows only active alerts | ⏳ Test |
| Single Alert File | Only `alerts_history.json` created | ⏳ Test |
| Cleanup API | Successfully deletes old alerts | ⏳ Test |

## Deployment Checklist

Only proceed with deployment after ALL tests pass:

- [ ] Temperature stays within bounds
- [ ] Auto-resolution works after 10 minutes
- [ ] Alert counter shows only active alerts
- [ ] Single alert file is created
- [ ] Cleanup API works correctly
- [ ] No errors in backend logs
- [ ] No errors in frontend console
- [ ] Git changes committed

## Deployment Commands (After Testing)

```bash
# 1. Commit changes
cd /Users/niteeshnair/Desktop/fleetops-2/smart-cold-chain
git add .
git commit -m "v1.0.6: Fix temperature bounds, auto-resolution, alert sync, and persistence"
git push

# 2. Build and push Docker image
cd fleetops-backend
docker build -t niteesh18/nndrepo:v1.0.6 .
docker push niteesh18/nndrepo:v1.0.6

# 3. Update deployment
cd k8s
# Edit deployment.yaml to use v1.0.6
kubectl apply -f deployment.yaml

# 4. Verify deployment
kubectl get pods -n fleetops
kubectl logs -f <pod-name> -n fleetops
```

## Troubleshooting

### Issue: Temperature still exceeding bounds
- Check `simulation_engine.py` line 180-186 for bounds check
- Verify bounds check is at START of `_simulate_cargo_drift()`

### Issue: Auto-resolution not working
- Check backend logs for "auto-resolved" messages
- Verify `incident_creation_times` dictionary is tracking incidents
- Ensure 10 minutes (600 seconds) have passed

### Issue: Alert counter not updating
- Check browser console for errors
- Verify API call includes `active_only=true` parameter
- Check Network tab to see actual API response

### Issue: Multiple alert files created
- Check `json_adapter.py` `save_alerts()` method
- Verify it's using `alerts_history.json` not timestamped files

## Notes
- All fixes are backward compatible
- No database schema changes required
- Frontend changes are immediate (no build needed)
- Backend changes require restart

## Contact
If any test fails, DO NOT deploy. Report the issue with:
1. Which test failed
2. Error messages from logs
3. Screenshots if applicable