# Secret *containers* only. Values are added out of band with
#   gcloud secrets versions add <name> --data-file=-
# so no secret ever lands in Terraform state, a .tfvars file, or git.
locals {
  app_secrets = [
    "db-app-password",
    "db-admin-password",
    "database-url",        # casecode_app DSN
    "database-admin-url",  # casecode_admin DSN
    "cron-secret",
    "gemini-api-key",
    "anthropic-api-key",
    "openai-api-key",
    "razorpay-key-secret",
    "razorpay-webhook-secret",
    "firebase-service-account", # only if Identity Platform admin SDK needs it
  ]
}

resource "google_secret_manager_secret" "app" {
  for_each  = toset(local.app_secrets)
  secret_id = each.value
  replication { auto {} }
  depends_on = [google_project_service.enabled]
}

# The runtime may read only these, not every secret in the project.
resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each  = google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# Referenced by cloud-sql.tf. Terraform reads these; it does not author them.
data "google_secret_manager_secret_version" "db_app_password" {
  secret = google_secret_manager_secret.app["db-app-password"].secret_id
}
data "google_secret_manager_secret_version" "db_admin_password" {
  secret = google_secret_manager_secret.app["db-admin-password"].secret_id
}

