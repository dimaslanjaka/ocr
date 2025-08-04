# Use an official Python image
FROM python:3.11-slim

# Build
# docker build -t node-ocr-app-builder .
#
# Run the container and copy out the dist folder
# docker run --rm -v %cd%/dist:/app/dist node-ocr-app-builder
#
# Or if you want to copy after the build
# docker create --name temp_container node-ocr-app-builder
# docker cp temp_container:/app/dist ./dist
# docker rm temp_container

# Install required build tools and Tesseract dependencies
RUN apt-get update && \
    apt-get install -y gcc g++ wget make git \
    autoconf automake libtool pkg-config \
    tesseract-ocr libtesseract-dev libleptonica-dev \
    libpng-dev libjpeg62-turbo-dev libtiff5-dev zlib1g-dev \
    libwebpdemux2 libwebp-dev libopenjp2-7-dev libgif-dev \
    libarchive-dev libcurl4-openssl-dev \
    && pip install --upgrade pip

# (Optional) Install training tools for Tesseract
# RUN apt-get install -y libicu-dev libpango1.0-dev libcairo2-dev

# Set TESSDATA_PREFIX if you want to use custom tessdata
ENV TESSDATA_PREFIX=/app/tessdata

# Set environment variables
ENV NUITKA_CACHE_DIR=/app/tmp/nuitka-cache
ENV ESLINT_USE_FLAT_CONFIG=true
ENV DEBUG_PKG=1
ENV PATH="/app/venv/bin:/app/node_modules/.bin:$PATH"

# Set work directory
WORKDIR /app

# Copy all project files
COPY . .

# Make all files in bin executable
RUN chmod +x bin/*

# Install Python dependencies
# RUN bash -e ./bin/py -m pip install -r requirements.txt
RUN pip install -r requirements.txt

# The dist folder will be available at /app/dist
# To export it, use a Docker volume or copy it out after build
