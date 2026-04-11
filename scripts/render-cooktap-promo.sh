#!/bin/zsh

# Renders the CookTap promo video by stitching Splash → demo → ShareCard
# with a synth score. Inputs (Splash.png, CookTap-Demo-H.mp4, ShareCard.png)
# and output live in ../assets relative to this script, so this works
# regardless of the caller's cwd.

set -euo pipefail

script_dir="${0:A:h}"
assets_dir="$script_dir/../assets"
cd "$assets_dir"

tmpdir=$(mktemp -d "${TMPDIR:-/tmp}/cooktap-share.XXXXXX")
trap 'rm -rf "$tmpdir"' EXIT

out_video="cooktap-promo.mp4"
music_wav="$tmpdir/music.wav"
seg1="$tmpdir/01-splash.mp4"
seg2="$tmpdir/02-demo.mp4"
seg3="$tmpdir/03-share.mp4"
playlist="$tmpdir/concat.txt"

common_encode=(
  -r 30
  -c:v libx264
  -crf 16
  -preset slow
  -pix_fmt yuv420p
)

# More energetic synth bed: four-on-the-floor pulse, bassline, arp lead, and hats.
ffmpeg -y \
  -f lavfi -i "aevalsrc=0.28*sin(2*PI*58*t)*if(lt(mod(t\,0.5)\,0.12)\,exp(-26*mod(t\,0.5))\,0):s=48000:d=14.6" \
  -f lavfi -i "aevalsrc=(0.07*sin(2*PI*110*t)+0.035*sin(2*PI*220*t)+0.018*sin(2*PI*330*t))*(0.65+0.35*sin(2*PI*t/4)^2):s=48000:d=14.6" \
  -f lavfi -i "aevalsrc=(0.03*sin(2*PI*440*t)+0.025*sin(2*PI*554.37*t)+0.02*sin(2*PI*659.25*t))*if(lt(mod(t\,0.25)\,0.09)\,exp(-18*mod(t\,0.25))\,0):s=48000:d=14.6" \
  -f lavfi -i "anoisesrc=color=white:amplitude=0.012:d=14.6:r=48000" \
  -filter_complex "[3:a]highpass=f=5000,lowpass=f=12000,volume=0.20[hats];[0:a][1:a][2:a][hats]amix=inputs=4:normalize=0,lowpass=f=9000,highpass=f=45,acompressor=threshold=0.12:ratio=3:attack=5:release=120,afade=t=in:st=0:d=0.35,afade=t=out:st=13.5:d=1.1,volume=0.95[a]" \
  -map "[a]" \
  -c:a pcm_s16le \
  "$music_wav"

ffmpeg -y \
  -loop 1 -t 2.3 -i Splash.png \
  -filter_complex "$(cat <<'EOF'
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,
eq=brightness=0.02:contrast=1.08:saturation=1.18,
vignette=PI/5,
noise=alls=2:allf=t,
zoompan=z='min(1.15,1.0+0.0020*on)':d=69:s=1920x1080:fps=30:x='iw/2-(iw/zoom/2)-22':y='ih/2-(ih/zoom/2)-10',
unsharp=5:5:0.7:5:5:0.0,
fade=t=in:st=0:d=0.25,
fade=t=out:st=1.85:d=0.45,
trim=duration=2.3,setpts=PTS-STARTPTS[v]
EOF
)" \
  -map "[v]" \
  "${common_encode[@]}" \
  "$seg1"

ffmpeg -y \
  -ss 6.0 -t 9.5 -i CookTap-Demo-H.mp4 \
  -filter_complex "$(cat <<'EOF'
[0:v]fps=60,scale=1920:1080:force_original_aspect_ratio=decrease,
pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x05070C,
setsar=1[base];
[base]boxblur=36:4,eq=brightness=-0.05:contrast=1.06:saturation=1.15,
noise=alls=2:allf=t,vignette=PI/6[bg];
[0:v]fps=60,scale=-2:1080:force_original_aspect_ratio=decrease,
setsar=1[demo];
[bg][demo]overlay=(W-w)/2:(H-h)/2,
fps=30,
unsharp=5:5:0.4:5:5:0.0,
fade=t=in:st=0:d=0.25,
fade=t=out:st=8.95:d=0.55,
trim=duration=9.5,setpts=PTS-STARTPTS[v]
EOF
)" \
  -map "[v]" \
  "${common_encode[@]}" \
  "$seg2"

ffmpeg -y \
  -loop 1 -t 2.8 -i ShareCard.png \
  -filter_complex "$(cat <<'EOF'
[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,
eq=brightness=0.01:contrast=1.06:saturation=1.16,
vignette=PI/7,
noise=alls=2:allf=t,
zoompan=z='if(lte(on,36),1.08-0.0016*on,1.022+0.0011*(on-36))':d=84:s=1920x1080:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',
unsharp=5:5:0.6:5:5:0.0,
fade=t=in:st=0:d=0.30,
fade=t=out:st=2.30:d=0.50,
trim=duration=2.8,setpts=PTS-STARTPTS[v]
EOF
)" \
  -map "[v]" \
  "${common_encode[@]}" \
  "$seg3"

cat > "$playlist" <<EOF
file '$seg1'
file '$seg2'
file '$seg3'
EOF

ffmpeg -y \
  -f concat -safe 0 -i "$playlist" \
  -i "$music_wav" \
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -r 30 \
  -shortest \
  -movflags +faststart \
  "$out_video"
