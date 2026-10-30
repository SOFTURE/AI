# A worker image for the footage blocks of @softure-ai/marketing-kit: Node 22, Debian's ffmpeg (built with libzimg, so
# it decodes HEVC and has the zscale and tonemap filters HDR phone clips need), the libraries and fonts
# chrome-headless-shell needs, and the chrome-headless-shell hyperframes renders with. CI renders the fixture footage
# film inside it (`.github/workflows/ci.yml`, job `footage-image`); an app copies it and adds its own code on top.
#
#   docker build -t footage-worker -f footage-worker.Dockerfile .
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip ffmpeg \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libgbm1 libnss3 libpangocairo-1.0-0 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 \
    fontconfig fonts-dejavu-core fonts-liberation fonts-noto-color-emoji fonts-noto-core \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -f

# The chrome-headless-shell hyperframes 0.8.85 pins (`hyperframes browser path`), from Chrome for Testing, so a render
# uses its BeginFrame capture and nothing is downloaded at run time. linux64 only: Chrome for Testing has no arm64 build.
ARG CHROME_VERSION=152.0.7977.30
RUN curl -sSfL --retry 3 -o /tmp/chrome.zip \
    "https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-headless-shell-linux64.zip" \
  && unzip -q /tmp/chrome.zip -d /opt \
  && rm /tmp/chrome.zip \
  && /opt/chrome-headless-shell-linux64/chrome-headless-shell --version

ENV HYPERFRAMES_BROWSER_PATH=/opt/chrome-headless-shell-linux64/chrome-headless-shell \
  HYPERFRAMES_NO_TELEMETRY=1
