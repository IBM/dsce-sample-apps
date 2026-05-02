apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: retail-backend-hpa
  namespace: tbb
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: retail-backend
  minReplicas: 5
  maxReplicas: 8
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

