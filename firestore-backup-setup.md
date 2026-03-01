# Firestore Backup Setup - Remaining Steps

The `dailyFirestoreBackup` Cloud Function is deployed. Run these `gcloud` commands to finish setup.

## 1. Create the backup bucket

```bash
gcloud storage buckets create gs://thoughtloom-918bd-firestore-backups \
  --project=thoughtloom-918bd \
  --location=us-central1 \
  --uniform-bucket-level-access
```

## 2. Set 30-day lifecycle policy

```bash
gcloud storage buckets update gs://thoughtloom-918bd-firestore-backups \
  --lifecycle-file=/dev/stdin <<'EOF'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}
EOF
```

## 3. Grant IAM permissions

```bash
# Get project number
gcloud projects describe thoughtloom-918bd --format="value(projectNumber)"
```

Replace `PROJECT_NUMBER` below with the value from above:

```bash
gcloud projects add-iam-policy-binding thoughtloom-918bd \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

gcloud storage buckets add-iam-policy-binding gs://thoughtloom-918bd-firestore-backups \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.admin"
```

## 4. Verify with manual trigger

```bash
gcloud scheduler jobs run firebase-schedule-dailyFirestoreBackup-us-central1 \
  --project=thoughtloom-918bd --location=us-central1
```

Check logs:

```bash
gcloud functions logs read dailyFirestoreBackup \
  --project=thoughtloom-918bd --region=us-central1 --gen2 --limit=10
```

Confirm export landed:

```bash
gcloud storage ls gs://thoughtloom-918bd-firestore-backups/
```

Expected log output:

```
[Backup] Starting Firestore export to gs://thoughtloom-918bd-firestore-backups
[Backup] Export started: projects/thoughtloom-918bd/databases/(default)/operations/...
```

## Restore procedure

```bash
# List backups
gcloud storage ls gs://thoughtloom-918bd-firestore-backups/

# Restore (merges into existing data -- does NOT wipe first)
gcloud firestore import gs://thoughtloom-918bd-firestore-backups/YYYY-MM-DDTHH:MM:SS_NNNNN/ \
  --project=thoughtloom-918bd
```
