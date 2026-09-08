output "service_url" {
  value       = google_cloud_run_v2_service.app.uri
  description = "Temporary run.app URL. Validate everything here before touching DNS."
}

output "db_connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "For cloud-sql-proxy during migration and validation."
}

output "db_private_ip" {
  value     = google_sql_database_instance.main.private_ip_address
  sensitive = true
}

output "artifact_repo" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Set as the GitHub Actions secret WIF_PROVIDER."
}

output "deployer_service_account" {
  value = google_service_account.deployer.email
}
