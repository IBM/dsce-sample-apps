apiVersion: apps/v1
kind: Deployment
metadata:
  name: retail-backend
  namespace: ${namespace}
  labels:
    app: retail-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: retail-backend
  template:
    metadata:
      labels:
        app: retail-backend
    spec:
      serviceAccountName: retail
      imagePullSecrets:
        - name: dockerhub-secret
      containers:
        - name: backend
          image: docker.io/${docker_username}/retail-backend:1.0.0
          imagePullPolicy: Always
          env:
            - name: DB_HOST
              value: retail-postgres
            - name: DB_PORT
              value: "5432"
            - name: DB_NAME
              value: retaildb
            - name: DB_USER
              value: retail_user
            - name: DB_PASSWORD
              value: retail_password
            - name: JWT_SECRET
              value: "super-secret-change-in-prod"
            - name: NODE_ENV
              value: "production"
          ports:
            - containerPort: 4000
          resources:
            requests:
              cpu: "100m"           # Low guaranteed CPU → easier to saturate
              memory: "128Mi"      # Small guaranteed memory → visible spikes
            limits:
              cpu: "500m"          # Not too high → JMeter will cause throttling
              memory: "512Mi"      # Moderate upper bound → measurable increases
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 4000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: 4000
            initialDelaySeconds: 20
            periodSeconds: 20

