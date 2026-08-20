#!/usr/bin/env bash
#
# Deploys CaseCode to Cloud Run.
#
#   ./scripts/deploy-cloudrun.sh
#
# Prerequisites (both need a human, once):
#   1. A billing account linked to the GCP project.
#   2. gcloud authenticated:  gcloud auth login
#
# Secrets are read from .env.cloud.backup and passed to Cloud Run as runtime
# env vars. They are never baked into the image — only the two NEXT_PUBLIC_*
# values are, because Next.js inlines those into the client bundle at build.

set -euo pipefail

PROJECT="${GCP_PROJECT:-mba-leetcode}"
# Mumbai: the Supabase project lives in ap-south-1, so this keeps the database
# round trip in-region. A US region would add ~200ms to every query.
REGION="${GCP_REGION:-asia-south1}"
SERVICE="${SERVICE_NAME:-casecode}"
REPO="containers"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}"
ENV_FILE="${ENV_FILE:-.env.cloud.backup}"

need() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2-; }

SUPABASE_URL="$(need NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_ANON="$(need NEXT_PUBLIC_SUPABASE_ANON_KEY)"
SERVICE_ROLE="$(need SUPABASE_SERVICE_ROLE_KEY)"
ANTHROPIC_KEY="$(need ANTHROPIC_API_KEY)"
CRON_SECRET="$(need CRON_SECRET)"

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON" ]]; then
  echo "Missing Supabase URL or anon key in $ENV_FILE" >&2
  exit 1
fi

echo "==> Project $PROJECT / region $REGION"
gcloud config set project "$PROJECT" --quiet

echo "==> Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com --quiet

echo "==> Ensuring Artifact Registry repo"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" \
    --repository-format=docker --location="$REGION" \
    --description="CaseCode container images" --quiet

echo "==> Configuring docker auth"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Building image (linux/amd64 — Cloud Run does not run arm64)"
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON" \
  -t "$IMAGE:latest" .

echo "==> Pushing"
docker push "$IMAGE:latest"

echo "==> Deploying to Cloud Run"
gcloud run deploy "$SERVICE" \
  --image="$IMAGE:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=120s \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL},NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON},SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE},ANTHROPIC_API_KEY=${ANTHROPIC_KEY},ANTHROPIC_MODEL=claude-sonnet-5,AI_PROVIDER=anthropic,CRON_SECRET=${CRON_SECRET}" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
echo
echo "Deployed: $URL"
echo
echo "Next: add $URL to Supabase → Authentication → URL Configuration"
echo "      (Site URL, and $URL/** in Redirect URLs)"
