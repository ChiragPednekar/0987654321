terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
  # Set after the bucket exists (see docs/google-cloud-migration.md):
  #   terraform init -backend-config="bucket=<project>-tfstate"
  backend "gcs" { prefix = "casecode" }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
