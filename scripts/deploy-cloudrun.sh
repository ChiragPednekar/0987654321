#!/usr/bin/env bash
#
# Deploys CaseCode to Cloud Run.
#
#   ./scripts/deploy-cloudrun.sh                 # build locally with Docker
#   ./scripts/deploy-cloudrun.sh --cloud-build   # build on Cloud Build instead
#
# Prerequisites (both need a human, once):
#   1. A billing account linked to the GCP project.
#   2. gcloud authenticated:  gcloud auth login
#
# --cloud-build needs no local Docker daemon and no local disk for image
# layers, and builds amd64 natively rather than emulating it on Apple Silicon.
# Prefer it unless you are iterating on the Dockerfile itself.
#
# Secrets are passed to Cloud Run as runtime env vars and are never baked into
# the image. Only the two NEXT_PUBLIC_* values are build args, because Next.js
# inlines those into the client bundle — and both are public by design.

set -euo pipefail

CLOUD_BUILD=0
[[ "${1:-}" == "--cloud-build" ]] && CLOUD_BUILD=1

PROJECT="${GCP_PROJECT:-mba-leetcode}"
# Mumbai: the Supabase project lives in ap-south-1, so this keeps the database
# round trip in-region. A US region would add ~200ms to every query.
REGION="${GCP_REGION:-asia-south1}"
SERVICE="${SERVICE_NAME:-casecode}"
REPO="containers"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}"

# .env.local is the source of truth for what production actually runs.
# This used to default to .env.cloud.backup, which had gone stale: it carried
# no GEMINI_API_KEY while the script hardcoded AI_PROVIDER=anthropic, so a
# deploy from it produced a site whose every submission failed to grade.
ENV_FILE="${ENV_FILE:-.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No $ENV_FILE. Set ENV_FILE=<path> or create it from .env.example." >&2
  exit 1
fi

# Reads a key, tolerating `export KEY=`, quotes and trailing whitespace.
need() {
  grep -m1 -E "^(export[[:space:]]+)?$1=" "$ENV_FILE" \
    | sed -E "s/^(export[[:space:]]+)?$1=//; s/^[\"']//; s/[\"'][[:space:]]*$//" \
    | tr -d '\r'
}

SUPABASE_URL="$(need NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_ANON="$(need NEXT_PUBLIC_SUPABASE_ANON_KEY)"
SERVICE_ROLE="$(need SUPABASE_SERVICE_ROLE_KEY)"
CRON_SECRET="$(need CRON_SECRET)"
SITE_URL="$(need NEXT_PUBLIC_SITE_URL)"

# Whichever provider this deployment actually uses, rather than a hardcoded one.
AI_PROVIDER="$(need AI_PROVIDER)"; AI_PROVIDER="${AI_PROVIDER:-gemini}"
GEMINI_API_KEY="$(need GEMINI_API_KEY)"
GEMINI_MODEL="$(need GEMINI_MODEL)"
ANTHROPIC_API_KEY="$(need ANTHROPIC_API_KEY)"
ANTHROPIC_MODEL="$(need ANTHROPIC_MODEL)"
OPENAI_API_KEY="$(need OPENAI_API_KEY)"
OPENAI_MODEL="$(need OPENAI_MODEL)"
RAZORPAY_KEY_ID="$(need RAZORPAY_KEY_ID)"
RAZORPAY_KEY_SECRET="$(need RAZORPAY_KEY_SECRET)"
RAZORPAY_WEBHOOK_SECRET="$(need RAZORPAY_WEBHOOK_SECRET)"

# ---- refuse to ship a deployment that cannot do its main job ---------------
# Grading is the product. Shipping with the wrong provider key produces a site
# that looks fine until the first submission, which is the worst place to find
# out — so this is checked here rather than discovered in production.
fail() { echo "ERROR: $1" >&2; exit 1; }

[[ -n "$SUPABASE_URL"  ]] || fail "NEXT_PUBLIC_SUPABASE_URL is missing from $ENV_FILE"
[[ -n "$SUPABASE_ANON" ]] || fail "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from $ENV_FILE"
[[ -n "$SERVICE_ROLE"  ]] || fail "SUPABASE_SERVICE_ROLE_KEY is missing — grading and cron cannot write"
[[ -n "$CRON_SECRET"   ]] || fail "CRON_SECRET is missing — the cron routes would reject every call"

case "$AI_PROVIDER" in
  gemini|google)
    [[ -n "$GEMINI_API_KEY" ]] || fail "AI_PROVIDER=$AI_PROVIDER but GEMINI_API_KEY is missing" ;;
  anthropic)
    [[ -n "$ANTHROPIC_API_KEY" ]] || fail "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing" ;;
  *)
    [[ -n "$OPENAI_API_KEY" ]] || fail "AI_PROVIDER=$AI_PROVIDER but OPENAI_API_KEY is missing" ;;
esac

echo "==> Project $PROJECT / region $REGION / provider $AI_PROVIDER"
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

if [[ $CLOUD_BUILD -eq 1 ]]; then
  echo "==> Building on Cloud Build (amd64, no local Docker needed)"
  gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions="_IMAGE=${IMAGE},_SUPABASE_URL=${SUPABASE_URL},_SUPABASE_ANON=${SUPABASE_ANON}" \
    --quiet
else
  docker info >/dev/null 2>&1 || fail "Docker is not running. Start it, or use --cloud-build."
  echo "==> Configuring docker auth"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

  echo "==> Building image (linux/amd64 — Cloud Run does not run arm64)"
  docker build --platform linux/amd64 \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON" \
    -t "$IMAGE:latest" .

  echo "==> Pushing"
  docker push "$IMAGE:latest"
fi

# Built as an array so a value containing a comma cannot silently truncate the
# rest of the list, which is what --set-env-vars does with a bare string.
ENVS="NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}"
ENVS+=",NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON}"
ENVS+=",SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE}"
ENVS+=",CRON_SECRET=${CRON_SECRET}"
ENVS+=",AI_PROVIDER=${AI_PROVIDER}"
[[ -n "$GEMINI_API_KEY"          ]] && ENVS+=",GEMINI_API_KEY=${GEMINI_API_KEY}"
[[ -n "$GEMINI_MODEL"            ]] && ENVS+=",GEMINI_MODEL=${GEMINI_MODEL}"
[[ -n "$ANTHROPIC_API_KEY"       ]] && ENVS+=",ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
[[ -n "$ANTHROPIC_MODEL"         ]] && ENVS+=",ANTHROPIC_MODEL=${ANTHROPIC_MODEL}"
[[ -n "$OPENAI_API_KEY"          ]] && ENVS+=",OPENAI_API_KEY=${OPENAI_API_KEY}"
[[ -n "$OPENAI_MODEL"            ]] && ENVS+=",OPENAI_MODEL=${OPENAI_MODEL}"
[[ -n "$RAZORPAY_KEY_ID"         ]] && ENVS+=",RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}"
[[ -n "$RAZORPAY_KEY_SECRET"     ]] && ENVS+=",RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}"
[[ -n "$RAZORPAY_WEBHOOK_SECRET" ]] && ENVS+=",RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET}"
[[ -n "$SITE_URL"                ]] && ENVS+=",NEXT_PUBLIC_SITE_URL=${SITE_URL}"

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
  --timeout=300s \
  --set-env-vars="$ENVS" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
echo
echo "Deployed: $URL"
echo
echo "Still to do, once:"
echo "  1. Supabase -> Authentication -> URL Configuration:"
echo "       Site URL:      $URL"
echo "       Redirect URLs: $URL/auth/callback"
echo "     Without this, email confirmation and OAuth bounce back to the old host."
if [[ "$SITE_URL" != "$URL" ]]; then
echo "  2. Set NEXT_PUBLIC_SITE_URL=$URL in $ENV_FILE and re-run this script."
echo "     It is baked into auth redirects, and right now it says '${SITE_URL:-unset}'."
fi
echo "  3. Scheduling: vercel.json does nothing here. Either point the existing"
echo "     GitHub Actions workflow at this host (add a SITE_URL repo secret set"
echo "     to $URL), or create two Cloud Scheduler jobs:"
echo
echo "       gcloud scheduler jobs create http casecode-leaderboards \\"
echo "         --location=$REGION --schedule='0 3 * * *' \\"
echo "         --uri='$URL/api/cron/refresh-leaderboards' \\"
echo "         --headers='Authorization=Bearer <CRON_SECRET>'"
echo
echo "       gcloud scheduler jobs create http casecode-weekly-contest \\"
echo "         --location=$REGION --schedule='0 6 * * 5' \\"
echo "         --uri='$URL/api/cron/weekly-contest' \\"
echo "         --headers='Authorization=Bearer <CRON_SECRET>'"
