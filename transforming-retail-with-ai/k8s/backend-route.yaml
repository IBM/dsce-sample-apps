apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: retail-backend
  namespace: tbb
spec:
  to:
    kind: Service
    name: retail-backend
  port:
    targetPort: http
  tls:
    termination: edge
