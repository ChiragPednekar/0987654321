variable "project_id" { type = string }

variable "region" {
  type = string
  # Mumbai. The Supabase database already lives in ap-south-1 and the users are
  # Indian MBA students; the current Vercel deployment runs functions in
  # us-east1 and pays ~200ms per query crossing to Mumbai and back, which
  # measured as a 4.3s dashboard TTFB. Co-locating is most of the fix.
  default = "asia-south1"
}

variable "db_tier" {
  type = string
  # 2 shared vCPU / 1.7GB. The database is 9.5MB and ~2,800 rows; this is sized
  # for connection headroom and the AI grading workload, not data volume.
  default = "db-g1-small"
}

variable "service_name" {
  type    = string
  default = "casecode"
}
variable "github_owner" {
  type    = string
  default = "ChiragPednekar"
}
variable "github_repo" {
  type    = string
  default = "0987654321"
}

variable "deletion_protection" {
  type        = bool
  description = "Keep true in production. Guards against terraform destroy removing the database."
  default     = true
}
