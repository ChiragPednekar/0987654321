resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  # Public site; authorization happens in the app, as it does today on Vercel.
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email

    # Private egress to Cloud SQL. Only VPC-bound traffic uses the connector;
    # calls to Gemini/Anthropic/Razorpay still go out directly.
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    scaling {
      # Zero would be cheaper, but a cold Next.js standalone start in front of a
      # student mid-case is the wrong trade. One warm instance is a few dollars.
      min_instance_count = 1
      max_instance_count = 10
    }

    containers {
      image = var.image

      resources {
        limits = { cpu = "1", memory = "1Gi" }
        # AI grading is I/O-bound waiting on the model; without this the
        # instance is billed for CPU it is not using.
        cpu_idle = true
      }

      ports { container_port = 8080 }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_ADMIN_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["database-admin-url"].secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = toset([
          "cron-secret", "gemini-api-key", "anthropic-api-key",
          "openai-api-key", "razorpay-key-secret", "razorpay-webhook-secret",
        ])
        content {
          name = upper(replace(env.value, "-", "_"))
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.app[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "AI_PROVIDER"
        value = var.ai_provider
      }

      startup_probe {
        http_get { path = "/api/health" }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
      liveness_probe {
        http_get { path = "/api/health" }
        period_seconds = 30
      }
    }

    # AI grading can take a while; the Vercel default was shorter and this
    # matches the real workload rather than the platform's convenience.
    timeout = "300s"
  }

  depends_on = [google_project_service.enabled]
}

# The site is public, same as today.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

variable "image" {
  type    = string
  default = "us-docker.pkg.dev/cloudrun/container/hello" # replaced by Cloud Build
}
variable "ai_provider" {
  type    = string
  default = "gemini"
}
