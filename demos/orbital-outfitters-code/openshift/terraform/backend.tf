terraform {
  backend "s3" {
    bucket = "orbital-suppliers-tfstate-aps"
    key    = "terraform.tfstate"
    region = "us-south"

    endpoints = {
      s3 = "https://s3.us-south.cloud-object-storage.appdomain.cloud"
    }

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    use_path_style              = true
  }
}
