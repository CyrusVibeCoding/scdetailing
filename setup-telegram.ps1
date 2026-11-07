# Secrets remain in memory. Run after bot has received a private message from you.
$ErrorActionPreference = 'Stop'
$secureToken = Read-Host 'BotFather token' -AsSecureString
$token = [System.Net.NetworkCredential]::new('', $secureToken).Password
$base = 'https://api.telegram.org/bot' + $token
try {
  $updates = Invoke-RestMethod -Method Post -Uri ($base + '/getUpdates') -ContentType 'application/json' -Body '{}'
  $updates.result | ForEach-Object { if ($_.message) { [pscustomobject]@{ ChatId=$_.message.chat.id; AdminUserId=$_.message.from.id; ChatType=$_.message.chat.type } } } | Format-Table
  $secretSecure = Read-Host 'TELEGRAM_WEBHOOK_SECRET already added in Supabase' -AsSecureString
  $secret = [System.Net.NetworkCredential]::new('', $secretSecure).Password
  $body = @{url='https://ywqpluaiepwetqrlskit.supabase.co/functions/v1/detailing-chat?telegram=1'; secret_token=$secret; allowed_updates=@('message')} | ConvertTo-Json
  $result = Invoke-RestMethod -Method Post -Uri ($base + '/setWebhook') -ContentType 'application/json' -Body $body
  Write-Output ('Webhook registered: ' + $result.ok)
} catch {
  Write-Error 'Telegram setup failed. Check token and Supabase function deployment. Secrets were not printed.'
} finally { $token=$null; $base=$null; $secret=$null; $body=$null }
