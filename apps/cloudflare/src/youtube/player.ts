import type { YoutubeCaptureInput } from "./parse"

export function playerHtml({ videoId, seconds }: YoutubeCaptureInput): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="origin">
  <style>
    html, body, #player { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    const target = ${seconds};
    window.capture = { ready: false, error: null, time: null };
    window.onYouTubeIframeAPIReady = () => {
      let timer = null;
      let pausing = false;
      const player = new YT.Player("player", {
        width: 1280,
        height: 720,
        videoId: ${JSON.stringify(videoId)},
        playerVars: {
          start: target,
          autoplay: 1,
          mute: 1,
          playsinline: 1,
          origin: location.origin
        },
        events: {
          onReady: (event) => event.target.playVideo(),
          onAutoplayBlocked: () => {
            window.capture.error = "Autoplay blocked";
          },
          onError: (event) => {
            window.capture.error = "YouTube player error " + event.data;
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED && !window.capture.ready) {
              window.capture.error = "Video ended before the requested time";
            }
            if (event.data === YT.PlayerState.PAUSED && pausing) {
              setTimeout(() => {
                window.capture.time = player.getCurrentTime();
                window.capture.ready = true;
              }, 150);
            }
            if (event.data !== YT.PlayerState.PLAYING || timer || pausing) return;
            timer = setInterval(() => {
              if (player.getCurrentTime() < target) return;
              clearInterval(timer);
              timer = null;
              pausing = true;
              player.pauseVideo();
            }, 50);
          }
        }
      });
    };
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`
}
