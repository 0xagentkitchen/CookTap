#!/bin/zsh

set -euo pipefail

tmpdir=$(mktemp -d "${TMPDIR:-/tmp}/cooktap-promo.XXXXXX")
trap 'rm -rf "$tmpdir"' EXIT

common_encode=(
  -r 30
  -c:v libx264
  -crf 16
  -preset slow
  -pix_fmt yuv420p
)

ffmpeg -y \
  -loop 1 -t 2.8 -i Splash.png \
  -filter_complex "$(cat <<'EOF'
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,
eq=brightness=0.02:contrast=1.09:saturation=1.22,
vignette=PI/5,
noise=alls=2:allf=t,
zoompan=z='min(1.14,1.0+0.00165*on)':d=84:s=1920x1080:fps=30:x='iw/2-(iw/zoom/2)-20':y='ih/2-(ih/zoom/2)-12',
unsharp=5:5:0.7:5:5:0.0,
fade=t=in:st=0:d=0.30,
fade=t=out:st=2.35:d=0.45,
trim=duration=2.8,setpts=PTS-STARTPTS[v]
EOF
)" \
  -map "[v]" \
  "${common_encode[@]}" \
  "$tmpdir/01-splash.mp4"

ffmpeg -y \
  -loop 1 -t 3.6 -i Game.png \
  -filter_complex "$(cat <<'EOF'
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,
boxblur=32:3,eq=brightness=-0.03:contrast=1.06:saturation=1.25,
noise=alls=4:allf=t,vignette=PI/6[bg];
[0:v]scale=980:1100:force_original_aspect_ratio=decrease,
pad=1060:1120:(ow-iw)/2:(oh-ih)/2:color=0x0C1018,
drawbox=x=0:y=0:w=iw:h=ih:color=white@0.10:t=4,
format=rgba[card];
[card]format=rgba,colorchannelmixer=aa=0.32,boxblur=20:3[shadow];
[bg][shadow]overlay='(W-w)/2+30+8*sin(t*1.4)':'(H-h)/2+34+6*cos(t*1.1)'[tmp];
[tmp][card]overlay='(W-w)/2+4*sin(t*1.4)':'(H-h)/2-10+3*cos(t*1.1)',
fps=30,unsharp=5:5:0.6:5:5:0.0,
fade=t=in:st=0:d=0.20,
fade=t=out:st=3.15:d=0.45,
trim=duration=3.6,setpts=PTS-STARTPTS[v]
EOF
)" \
  -map "[v]" \
  "${common_encode[@]}" \
  "$tmpdir/02-game.mp4"

ffmpeg -y \
  -loop 1 -t 3.2 -i ShareCard.png \
  -filter_complex "$(cat <<'EOF'
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,
boxblur=18:2,eq=brightness=-0.01:contrast=1.06:saturation=1.18,
noise=alls=3:allf=t,vignette=PI/7[bg];
[0:v]scale=1700:956:force_original_aspect_ratio=decrease,
pad=1760:1016:(ow-iw)/2:(oh-ih)/2:color=0x0D1017,
drawbox=x=0:y=0:w=iw:h=ih:color=white@0.08:t=4,
format=rgba[card];
[card]format=rgba,colorchannelmixer=aa=0.25,boxblur=18:2[shadow];
[bg][shadow]overlay=(W-w)/2+22:(H-h)/2+26[tmp];
[tmp][card]overlay=(W-w)/2:(H-h)/2-6,
zoompan=z='min(1.06,1.0+0.00065*on)':d=96:s=1920x1080:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',
unsharp=5:5:0.6:5:5:0.0,
fade=t=in:st=0:d=0.25,
fade=t=out:st=2.85:d=0.35,
trim=duration=3.2,setpts=PTS-STARTPTS[v]
EOF
)" \
  -map "[v]" \
  "${common_encode[@]}" \
  "$tmpdir/03-share.mp4"

cat > "$tmpdir/concat.txt" <<EOF
file '$tmpdir/01-splash.mp4'
file '$tmpdir/02-game.mp4'
file '$tmpdir/03-share.mp4'
EOF

ffmpeg -y \
  -f concat -safe 0 -i "$tmpdir/concat.txt" \
  "${common_encode[@]}" \
  -movflags +faststart \
  promo-v2.mp4
