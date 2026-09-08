# Runtime identity for Cloud Run. Least privilege: it may reach Cloud SQL, read
# the secrets it needs, and write logs. Nothing else. Explicitly not editor.
resource "google_service_account" "runtime" {
  account_id   = "${var.service_name}-run"
  display_name = "CaseCode Cloud Run runtime"
}

resource "google_project_iam_member" "runtime" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Separate identity for builds, so a compromised build cannot serve traffic and
# the runtime cannot deploy itself.
resource "google_service_account" "deployer" {
  account_id   = "${var.service_name}-deploy"
  display_name = "CaseCode Cloud Build deployer"
}

resource "google_project_iam_member" "deployer" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/logging.logWriter",
    "roles/secretmanager.secretAccessor",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Cloud Build needs to hand the runtime identity to the service it deploys.
resource "google_service_account_iam_member" "deployer_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# --- GitHub -> GCP without service account keys ------------------------------
# Workload Identity Federation. No JSON key is ever created or downloaded, so
# there is no long-lived credential to leak from the repo or a laptop.
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "${var.service_name}-github"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  # Without this condition the provider would trust tokens from *any* GitHub
  # repository, letting anyone with a public Actions runner impersonate the
  # deployer.
  attribute_condition = "assertion.repository == '${var.github_owner}/${var.github_repo}'"
  oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
}

resource "google_service_account_iam_member" "github_deploy" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repo}"
}
