# ArgoCD Pi Setup

One-time steps required on the Pi before the GitOps flow is active.

## 1. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Wait for all pods to be ready:

```bash
kubectl get pods -n argocd --watch
```

## 2. Make the container image public

Go to **GitHub → Packages → tee-time-notifier → Package settings** and set visibility to **Public**.

This allows the Pi to pull `ghcr.io/juddrollins/tee-time-notifier:latest` without a pull secret. If you prefer to keep it private, create an image pull secret instead and add it to `values.yaml`.

## 3. Register the ArgoCD Application

```bash
kubectl apply -f argocd/app.yaml
```

This tells ArgoCD to watch the `k8s/` Helm chart on the `main` branch and sync it to the cluster automatically.

## 4. Verify

```bash
# Check ArgoCD has picked up the app
kubectl get application -n argocd

# Check the CronWorkflow is running
kubectl get cronworkflow -n argo
```

## After setup

Every push to `main` will:
1. Self-hosted runner builds TypeScript and Docker image on the Pi
2. Image pushed to `ghcr.io/juddrollins/tee-time-notifier:latest`
3. ArgoCD detects any chart changes and syncs to the cluster automatically
