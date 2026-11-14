$token = Read-Host "Admin token"
$email = Read-Host "Customer email"
$headers = @{ "Content-Type" = "application/json"; "x-admin-token" = $token }
try {
  $result = Invoke-RestMethod -Method Post -Uri "https://txnvqcckskktukilsbsx.supabase.co/functions/v1/find-license" -Headers $headers -Body (@{ email = $email } | ConvertTo-Json)
  if ($result.licenses.Count -eq 0) { Write-Host "No purchase found for that email." }
  else { $result.licenses | Format-List }
} catch {
  Write-Host "Failed:" $_.ErrorDetails.Message
}