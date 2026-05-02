apiVersion: apps/v1
kind: Deployment
metadata:
  name: retail-frontend
  namespace: ${namespace}
  labels:
    app: retail-frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: retail-frontend
  template:
    metadata:
      labels:
        app: retail-frontend
    spec:
      serviceAccountName: retail
      imagePullSecrets:
        - name: dockerhub-secret
      containers:
        - name: frontend
          image: docker.io/${docker_username}/retail-frontend:1.0.0
          imagePullPolicy: Always
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "50m"
              memory: "128Mi"
            limits:
              cpu: "300m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 20
