# Optional discovery helper. Active flow uses outbound notifications, with no webhook.
$ErrorActionPreference = 'Stop'
$secureToken = Read-Host 'BotFather token' -AsSecureString
$token = [System.Net.NetworkCredential]::new('', $secureToken).Password
$base = 'https://api.telegram.org/bot' + $token
try {
  $updates = Invoke-RestMethod -Method Post -Uri ($base + '/getUpdates') -ContentType 'application/json' -Body '{}'
$channels = @($updates.result | ForEach-Object {
  if ($_.channel_post) {
    [pscustomobject]@{ ChatId=$_.channel_post.chat.id; Title=$_.channel_post.chat.title; Type=$_.channel_post.chat.type }
  }
})
if ($channels.Count) { $channels | Sort-Object ChatId -Unique | Format-Table }
else { Write-Output 'No channel post found. Add the bot as a channel admin, post SC setup test in the channel, then run again.' }
Write-Output 'Store TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID only in Supabase Edge Function secrets for project gwlgkojgaenkixstfjlp. No webhook is needed.'
} catch {
Write-Output 'Telegram discovery failed. Check the token and channel permissions. Secrets were not printed.'
} finally { $token=$null; $base=$null; $secureToken=$null }
