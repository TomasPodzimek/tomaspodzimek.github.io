$port = if ($env:PORT) { $env:PORT } else { "9123" }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:${port}/")
$listener.Prefixes.Add("http://127.0.0.1:${port}/")
$listener.Start()
Write-Host "Server started on http://localhost:${port}"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }

    $file = Join-Path "W:\Kozel" ($path -replace "/", "\")
    $resp = $ctx.Response

    if (Test-Path $file -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($file)
        $resp.ContentType = switch($ext) {
            ".html" { "text/html; charset=utf-8" }
            ".css"  { "text/css" }
            ".js"   { "application/javascript" }
            ".json" { "application/json" }
            ".svg"  { "image/svg+xml" }
            ".png"  { "image/png" }
            default { "application/octet-stream" }
        }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $resp.StatusCode = 404
    }
    $resp.Close()
}
