# classroomIoT Mobius Cam-core

Rasp Face detection maybe..

## Concept

Mobius thyme ncore

![Test](concept.png)

1. Check how much people in classroom (OpenCV)
2. Check temperature & motor control (GPIO - UART)

# Pre-setup

## Install OpenCV

### Windows 10 - WSL

```bash
npm i -S opencv-build
```

### Raspberry Pi 4 (arm64)

From [OpenCV manual compile](https://webnautes.tistory.com/1433)

1. Install dependency

```bash
sudo apt-get install build-essential cmake
sudo apt-get install pkg-config
sudo apt-get install libjpeg-dev libtiff5-dev libpng-dev
sudo apt-get install ffmpeg libavcodec-dev libavformat-dev libswscale-dev libxvidcore-dev libx264-dev libxine2-dev
sudo apt-get install libv4l-dev v4l-utils
sudo apt-get install mesa-utils libgl1-mesa-dri libgtkgl2.0-dev libgtkglext1-dev
sudo apt-get install libatlas-base-dev gfortran libeigen3-dev
sudo apt-get install python3-dev python3-numpy
```

2. Download and extract opencv 4.2.0 repo

```bash
mkdir opencv
cd opencv
wget -O opencv.zip https://github.com/opencv/opencv/archive/4.2.0.zip
wget -O opencv_contrib.zip https://github.com/opencv/opencv_contrib/archive/4.2.0.zip
unzip opencv.zip
unzip opencv_contrib.zip
```

3. CMake

```bash
cd opencv-4.2.0
mkdir build
cd build
cmake -D CMAKE_BUILD_TYPE=RELEASE -D CMAKE_INSTALL_PREFIX=/usr/local -D WITH_TBB=OFF -D WITH_IPP=OFF -D WITH_1394=OFF -D BUILD_WITH_DEBUG_INFO=OFF -D BUILD_DOCS=OFF -D INSTALL_C_EXAMPLES=ON -D INSTALL_PYTHON_EXAMPLES=ON -D BUILD_EXAMPLES=OFF -D BUILD_PACKAGE=OFF -D BUILD_TESTS=OFF -D BUILD_PERF_TESTS=OFF -D WITH_QT=OFF -D WITH_GTK=ON -D WITH_OPENGL=ON -D BUILD_opencv_python3=ON -D OPENCV_EXTRA_MODULES_PATH=../../opencv_contrib-4.2.0/modules -D WITH_V4L=ON  -D WITH_FFMPEG=ON -D WITH_XINE=ON -D OPENCV_ENABLE_NONFREE=ON -D BUILD_NEW_PYTHON_SUPPORT=ON -D OPENCV_SKIP_PYTHON_LOADER=ON -D OPENCV_GENERATE_PKGCONFIG=ON ../
```

4. Make (takes 2 hours)

```bash
time make -j$(nproc)
```

5. Install and ldconfig

```bash
sudo make install
sudo ldconfig
```

6. Install opencv4nodejs in `project directory`

```bash
export OPENCV4NODEJS_DISABLE_AUTOBUILD=1
npm i -S opencv4nodejs
```

### Raspberry Pi 3

1. Install [OpenCV 4.2.0 precompiled by dltpdn](https://github.com/dltpdn/opencv-for-rpi/releases/tag/4.2.0_buster_pi3b)

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y \
	libjpeg-dev libpng-dev libtiff-dev libgtk-3-dev \
	libavcodec-extra libavformat-dev libswscale-dev libv4l-dev \
	libxvidcore-dev libx264-dev libjasper1 libjasper-dev \
	libatlas-base-dev gfortran libeigen3-dev libtbb-dev

mkdir opencv42
cd opencv42
wget https://github.com/dltpdn/opencv-for-rpi/releases/download/4.2.0_buster_pi3b/opencv4.2.0.deb.tar
tar -xvf opencv4.2.0.deb.tar
sudo apt install -y ./OpenCV*.deb
```

2. Copy library to local

```bash
sudo mkdir /usr/local/lib/opencv4.2
cp -Lr /usr/lib/libopencv*.so /usr/local/lib/opencv4.2/
```

3. Set environment

```bash
export OPENCV4NODEJS_DISABLE_AUTOBUILD=1
export OPENCV_LIB_DIR=/usr/local/lib/opencv4.2/
export OPENCV_INCLUDE_DIR=/usr/include/opencv4
```

4. try to build and fail

```bash
npm i -S opencv4nodejs
```

5. manual build

```bash
npm i -g node-gyp
cd node_modules/opencv4nodejs/
node-gyp rebuild
```

## Enable Video4Linux2
