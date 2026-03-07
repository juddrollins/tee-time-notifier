 ---
  1. Output Parameters (what we just used)

  {{tasks.generate.outputs.parameters.message}}

  How it works: Argo's executor sidecar reads a file from the container's filesystem after it exits, stores the value in the
  Workflow object in Kubernetes (etcd), and injects it into the next container's args as a plain string.

  Pod A container → writes /tmp/out.txt → Argo executor reads it → stores in k8s Workflow object
                                                                            ↓
                                                Pod B container ← Argo injects as env var / arg

  Limitations:
  - Max ~512KB (it's stored in etcd, which has a 1MB object limit)
  - Only strings — no binary data
  - Only flows forward through declared dependencies

  Best for: small scalar values — a count, a date, a status flag, a run ID

  ---
  2. Artifacts (files via object storage)

  Argo can automatically upload a file from one container to S3/MinIO and download it in the next.

  - name: produce
    outputs:
      artifacts:
        - name: data
          path: /tmp/data.json   # Argo uploads this to MinIO after container exits
    container: ...

  - name: consume
    inputs:
      artifacts:
        - name: data
          from: "{{tasks.produce.outputs.artifacts.data}}"  # Argo downloads before container starts
    container: ...

  How it works:
  Pod A → writes /tmp/data.json → Argo uploads to MinIO/S3
                                          ↓
                          Argo downloads to /tmp/data.json → Pod B starts

  Best for: medium-sized files — JSON responses, CSVs, reports. The quick-start manifest we installed includes a MinIO instance
  for exactly this.

  Limitations: requires object storage (MinIO locally, S3 in prod). Not ideal for large datasets.

  ---
  3. Shared Volume (PVC) — the "shared directory"

  This is what you were asking about. You mount the same PersistentVolumeClaim into every pod.

  spec:
    volumeClaimTemplates:         # Argo creates a PVC for this workflow run
      - metadata:
          name: workdir
        spec:
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 1Gi

    templates:
      - name: main
        dag:
          tasks:
            - name: generate
              template: generate-message
            - name: consume
              template: print-message
              dependencies: [generate]

      - name: generate-message
        container:
          image: alpine:3.19
          command: [sh, -c]
          args: ["echo 'hello' > /workdir/message.txt"]
          volumeMounts:
            - name: workdir
              mountPath: /workdir

      - name: print-message
        container:
          image: alpine:3.19
          command: [sh, -c]
          args: ["cat /workdir/message.txt"]
          volumeMounts:
            - name: workdir
              mountPath: /workdir   # same directory, same files

  How it works:
  Pod A mounts /workdir (PVC) → writes files
  Pod B mounts /workdir (same PVC) → reads files

  Best for: large files, binary data, cases where you'd naturally use a filesystem (e.g. downloading a video, processing it in
  chunks).

  Important caveat: ReadWriteOnce means only one node can mount the volume at a time. If tasks run in parallel on different
  nodes this breaks. For parallel tasks you need ReadWriteMany (requires NFS or a cloud file system). On a single-node kind
  cluster this isn't an issue.

  ---
  4. External Database (what we're building)

  Tasks share nothing through Argo — they communicate via Postgres. Argo only passes a run_id between steps.

  fetch → writes raw data to DB, outputs run_id
  save  → reads run_id, reads raw data from DB, writes normalized rows
  compare → reads run_id, queries DB for diff, outputs new_count
  notify  → reads new_count, sends email if > 0

  Pod A ──writes──▶ Postgres ◀──reads── Pod B
          run_id passed via output parameter (tiny string, fine for etcd)

  Best for: structured data that needs to persist beyond the workflow, data you want to query later, audit trails.

  ---
  Summary: when to use what

  ┌──────────────────────┬────────────┬────────────────────────────┬─────────────────────────────────────────────┐
  │        Method        │ Size limit │  Persists after workflow   │                  Best for                   │
  ├──────────────────────┼────────────┼────────────────────────────┼─────────────────────────────────────────────┤
  │ Output parameters    │ ~512KB     │ No                         │ Small scalars: IDs, counts, flags           │
  ├──────────────────────┼────────────┼────────────────────────────┼─────────────────────────────────────────────┤
  │ Artifacts (MinIO/S3) │ GBs        │ Configurable               │ Files, JSON blobs, reports                  │
  ├──────────────────────┼────────────┼────────────────────────────┼─────────────────────────────────────────────┤
  │ Shared volume (PVC)  │ Disk size  │ No (deleted with workflow) │ Large files, binary data                    │
  ├──────────────────────┼────────────┼────────────────────────────┼─────────────────────────────────────────────┤
  │ External DB          │ Unlimited  │ Yes                        │ Structured data, audit trails, our use case │
  └──────────────────────┴────────────┴────────────────────────────┴─────────────────────────────────────────────┘

  ---
  For our tee-time notifier

  The right answer is output parameters for control flow + Postgres for data:

  fetch  →──run_id (output param)──▶  save  →──run_id──▶  compare  →──new_count──▶  notify
            (data in Postgres)                (data in Postgres)      (conditional)

  - run_id is a tiny UUID — perfect for output parameters
  - new_count is an integer — perfect for output parameters
  - The actual tee time records live in Postgres — queryable, persistent, auditable

  This is also closer to real-world microservice patterns: services share a database, not a filesystem.