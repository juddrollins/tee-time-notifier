CLUSTER_NAME  := tee-time
NAMESPACE     := argo
IMAGE         := tee-time-notifier:latest
CRON_NAME     := tee-time-cron

# ── Build ─────────────────────────────────────────────────────────────────────

test:
	npm test

build:
	npm run build
	docker build -t $(IMAGE) .
	kind load docker-image $(IMAGE) --name $(CLUSTER_NAME)

# ── Cluster setup (run once) ──────────────────────────────────────────────────

cluster:
	kind create cluster --name $(CLUSTER_NAME)
	kubectl create namespace $(NAMESPACE)
	kubectl apply -n $(NAMESPACE) -f https://github.com/argoproj/argo-workflows/releases/download/v3.6.5/quick-start-minimal.yaml
	kubectl wait --for=condition=available deployment/workflow-controller -n $(NAMESPACE) --timeout=90s
	kubectl apply -f k8s/pvc.yaml

cluster-down:
	kind delete cluster --name $(CLUSTER_NAME)

# ── CronWorkflow ──────────────────────────────────────────────────────────────

apply:
	kubectl apply -f workflows/hello.yaml

trigger:
	argo submit --from=cronworkflow/$(CRON_NAME) -n $(NAMESPACE) --watch

suspend:
	argo cron suspend $(CRON_NAME) -n $(NAMESPACE)

resume:
	argo cron resume $(CRON_NAME) -n $(NAMESPACE)

# ── Inspect ───────────────────────────────────────────────────────────────────

list:
	argo list -n $(NAMESPACE)

logs:
	argo logs -n $(NAMESPACE) @latest

watch:
	argo get -n $(NAMESPACE) @latest --watch

ui:
	kubectl port-forward svc/argo-server 2746:2746 -n $(NAMESPACE)

# Spin up a debug pod to browse the PVC contents
browse:
	kubectl run debug --image=alpine --restart=Never -n $(NAMESPACE) \
	  --overrides='{"spec":{"containers":[{"name":"debug","image":"alpine","command":["sh"],"stdin":true,"tty":true,"volumeMounts":[{"name":"data","mountPath":"/workdir"}]}],"volumes":[{"name":"data","persistentVolumeClaim":{"claimName":"tee-time-data"}}]}}' \
	  -it --rm

# ── Shortcuts ─────────────────────────────────────────────────────────────────

# Build, apply, and trigger in one shot
run: build apply trigger

.PHONY: test build cluster cluster-down apply trigger suspend resume list logs watch ui browse run
