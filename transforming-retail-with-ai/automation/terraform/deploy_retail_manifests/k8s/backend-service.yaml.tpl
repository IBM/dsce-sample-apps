apiVersion: v1
kind: Service
metadata:
  name: retail-backend
  namespace: ${namespace}
spec:
  selector:
    app: retail-backend
  ports:
    - name: http
      port: 4000
      targetPort: 4000
