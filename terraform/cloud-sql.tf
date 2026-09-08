resource "google_sql_database_instance" "main" {
  name             = "${var.service_name}-pg"
  region           = var.region
  # Matches the Supabase instance (17.6). Keeping the major version identical
  # keeps pg_dump/pg_restore straightforward and avoids a version upgrade
  # riding along with a platform migration.
  database_version = "POSTGRES_17"

  # Guards against `terraform destroy` taking the production database with it.
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true

    ip_configuration {
      # No public IP. The only route in is the VPC connector from Cloud Run,
      # which is what keeps rule "never expose Cloud SQL publicly" true by
      # construction rather than by policy.
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "18:30" # 00:00 IST
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings { retained_backups = 14 }
    }

    database_flags {
      # The app opens 5 connections per Cloud Run instance; this leaves room for
      # migrations, psql and a burst of cold starts.
      name  = "max_connections"
      value = "200"
    }
    database_flags {
      name  = "cloudsql.enable_pg_cron"
      value = "off"
    }

    insights_config { query_insights_enabled = true }
  }

  depends_on = [google_service_networking_connection.private_vpc]
}

resource "google_sql_database" "casecode" {
  name     = "casecode"
  instance = google_sql_database_instance.main.name
}

# Two users mirroring the Supabase authenticated/service_role split.
# BYPASSRLS on casecode_admin is granted in gcp/sql/01_app_identity.sql, not
# here — Cloud SQL user creation cannot express role attributes.
resource "google_sql_user" "app" {
  name     = "casecode_app"
  instance = google_sql_database_instance.main.name
  password = data.google_secret_manager_secret_version.db_app_password.secret_data
}

resource "google_sql_user" "admin" {
  name     = "casecode_admin"
  instance = google_sql_database_instance.main.name
  password = data.google_secret_manager_secret_version.db_admin_password.secret_data
}
