apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: retail-frontend
  namespace: tbb
spec:
  to:
    kind: Service
    name: retail-frontend
  port:
    targetPort: http
  tls:
    termination: edge
