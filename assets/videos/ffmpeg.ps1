Get-ChildItem *.webm | ForEach-Object {
    $name = $_.BaseName
    New-Item -ItemType Directory -Force -Path $name | Out-Null

    ffmpeg -i "$($_.FullName)" `
        -c:v libx264 -preset slow -crf 23 `
        -c:a aac -b:a 96k `
        -hls_time 4 -hls_playlist_type vod `
        -hls_segment_filename "$name\seg_%03d.ts" `
        "$name\index.m3u8"
}
