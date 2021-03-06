Bitcoin Trezor Plugin
=====================

1. Project initialization
-------------------------

    git clone https://github.com/trezor/trezor-plugin.git

    git clone git://github.com/trezor/firebreath.git

    cd firebreath
    git submodule update --recursive --init

    mkdir -p projects
    ln -s ../../trezor-plugin projects/BitcoinTrezorPlugin

    cd projects/BitcoinTrezorPlugin
    git submodule update --recursive --init


2a. Building on Linux
---------------------

* install Vagrant (for example from http://www.vagrantup.com/)

* install and init Debian Vagrant boxes from PuppetLabs:

    vagrant box add debian32 http://puppet-vagrant-boxes.puppetlabs.com/debian-73-i386-virtualbox-nocm.box
    vagrant init debian32
    - or -
    vagrant box add debian64 http://puppet-vagrant-boxes.puppetlabs.com/debian-73-x64-virtualbox-nocm.box
    vagrant init debian64

* log into it:

    vagrant up
    vagrant ssh

* install required tools and libraries

    sudo apt-get install cmake git zlib1g-dev

* remove librt.a so it won't get picked during the build

    sudo rm /usr/lib/i386-linux-gnu/librt.a
    - or -
    sudo rm /usr/lib/x86_64-linux-gnu/librt.a

* download and install openssl from source

    wget http://www.openssl.org/source/openssl-1.0.1f.tar.gz
    tar xfz openssl-1.0.1f.tar.gz
    cd openssl-1.0.1f
    ./config -fPIC no-shared --openssldir=/usr/local
    make
    sudo make install

* download and install protobuf from source

    wget https://protobuf.googlecode.com/files/protobuf-2.5.0.tar.bz2
    tar xfj protobuf-2.5.0.tar.bz2
    cd protobuf-2.5.0
    ./configure --with-pic --disable-shared --enable-static
    make
    sudo make install

* download and install libusb from source

    wget https://downloads.sourceforge.net/project/libusb/libusb-1.0/libusb-1.0.18/libusb-1.0.18.tar.bz2
    tar xfj libusb-1.0.18.tar.bz2
    cd libusb-1.0.18
    ./configure --with-pic --disable-shared --enable-static --disable-udev
    make
    sudo make install

* setup firebreath and trezor-plugin projects as described in chapter 1

* generate make files and build the project

      cd firebreath
      ./prepmake.sh

      cd build
      make

* binary is located in build/bin/BitcoinTrezorPlugin/npBitcoinTrezorPlugin.so

2b. Building on Mac OS X
------------------------

You will need to have Xcode installed.

    # install dependencies
    brew install cmake protobuf boost

    # generate the makefiles
    ./prepmac.sh projects build \
        -DCMAKE_OSX_ARCHITECTURES=i386 \
        -DWITH_SYSTEM_BOOST=1 \
        -DBoost_USE_STATIC_LIBS=on \
        -DBoost_USE_STATIC_RUNTIME=on

    # build the project
    cd build
    xcodebuild -configuration Debug # or Release

    # symlink to the plugin directory
    ln -s `pwd`/projects/BitcoinTrezorPlugin/Debug/Bitcoin\ Trezor\ Plugin.plugin \
        ~/Library/Internet\ Plug-Ins/

2c. Building on Windows
-----------------------

Requirements:

- [Visual Studio 2010 Express](http://www.visualstudio.com/en-us/downloads#d-2010-express)
- [Windows Driver Kit 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=11800)
  with the "Build Environments" option enabled, installed to the
  default location
- [CMake 2.8.7 or later](http://www.cmake.org/cmake/resources/software.html)
  binary distribution, allow installer to append CMake binaries to
  PATH
- [Git](http://msysgit.github.io/)
- [Protobuf 2.5.0](https://protobuf.googlecode.com/files/protobuf-2.5.0.zip)
- [Python 2.7](http://python.org/download/)
- [WiX 3.6](http://wix.codeplex.com/releases/view/93929)

Instructions:

a) Build Protobuf

    1. In the `vsprojects` directory, run `extract_includes.bat`
    2. Open the VS solution from the `vsprojects` directory
    3. Switch to preferred configuration (Release/Debug)
    3. Switch the `libprotobuf` project to static runtime `/MT` or `/MTd` (open
       Properties through the right-click menu, then C++, Code Generation, item
       Runtime Library)
    4. Build `libprotobuf` project

b) Build plugin

    1. Generate the VS solution (change the Protobuf path to your installation):

            set PROTOBUF_PATH=C:/Code/protobuf-2.5.0/
            prep.cmd

    2. Open the solution from the generated `build` directory
    3. Switch to preferred configuration
    4. Build the solution
    5. Results of the build are at `build/bin/BitcoinTrezorPlugin/{Debug,Release,...}`
    6. You can either run the installer or register the compiled DLL manually with:

            regsvr32.exe npBitcoinTrezorPlugin.dll

3. Testing
----------

After you build the plugin according to instructions above, you can
open the test page in your web browser:

    pythom -m SimpleHTTPServer
    google-chrome http://localhost:8000/test.html

If you rebuild the plugin you should restart the browser to be sure
you're running the newest version.
