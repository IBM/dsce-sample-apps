apiVersion: v1
kind: Secret
metadata:
  name: retail-postgres-secret
  namespace: ${namespace}
type: Opaque
data:
  POSTGRES_DB: ${postgres_db}
  POSTGRES_USER: ${postgres_user}
  POSTGRES_PASSWORD: ${postgres_password}
