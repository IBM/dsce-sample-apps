apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: retail-postgres
  namespace: ${namespace}
  labels:
    app: retail-postgres
spec:
  serviceName: retail-postgres
  replicas: 1
  selector:
    matchLabels:
      app: retail-postgres
  template:
    metadata:
      labels:
        app: retail-postgres
    spec:
      serviceAccountName: retail
      imagePullSecrets:
        - name: dockerhub-secret
      containers:
        - name: postgres
          image: docker.io/${docker_username}/retail-postgresql:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: postgres
              containerPort: 5432
          envFrom:
            - secretRef:
                name: retail-postgres-secret
          env:
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "1Gi"
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          readinessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 5
          livenessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
            initialDelaySeconds: 30
            periodSeconds: 20
            timeoutSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 10Gi
          storageClassName: ibmc-vpc-block-10iops-tier
