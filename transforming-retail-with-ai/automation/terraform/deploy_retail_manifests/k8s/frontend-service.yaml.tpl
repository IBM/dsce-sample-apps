apiVersion: v1
kind: Service
metadata:
  name: retail-frontend
  namespace: ${namespace}
spec:
  selector:
    app: retail-frontend
  ports:
    - name: http
      port: 8080
      targetPort: 8080
