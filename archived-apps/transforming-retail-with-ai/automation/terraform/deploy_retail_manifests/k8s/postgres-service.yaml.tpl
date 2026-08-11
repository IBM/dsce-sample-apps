apiVersion: v1
kind: Service
metadata:
  name: retail-postgres
  namespace: ${namespace}
  labels:
    app: retail-postgres
spec:
  clusterIP: None
  selector:
    app: retail-postgres
  ports:
    - name: postgres
      port: 5432
      targetPort: 5432
