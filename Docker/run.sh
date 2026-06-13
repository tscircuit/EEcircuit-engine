#!/bin/bash
echo "build: Entryponit script is Running..."

echo "build: Installing emscripten..."

NGSPICE_HOME="https://github.com/danchitnis/ngspice-sf-mirror"
#NGSPICE_HOME="https://git.code.sf.net/p/ngspice/ngspice"

echo "build: ngsice git repository is $NGSPICE_HOME"

cd /opt
if [ -d emsdk ]; then
  cd emsdk
  source ./emsdk_env.sh
fi
command -v emconfigure >/dev/null || { echo "build: emconfigure is unavailable, stopping execution"; exit 1; }

echo "build: emscripten is installed"

############################################

echo -e "\n"
echo "build: cloning ngspice repository..."

cd /opt
git clone $NGSPICE_HOME ngspice-ngspice
cd ngspice-ngspice

############################################

echo -e "\n"
echo "build: determining the latest release version and branch..."

# Step 1: Find the latest tag with the version format "ngspice-X.Y"
latest_tag=$(git tag | grep -E '^ngspice-[0-9]+\.[0-9]+$' | sort -V | tail -n 1)
if [ -z "$latest_tag" ]; then
  echo "build: No ngspice tags found."
  exit 1
fi
latest_version=${latest_tag#ngspice-}  # Extract version number (e.g., 44.2)
echo "build: Latest tag: $latest_tag (version $latest_version)"

# Step 2: Find the branch with a higher version than the latest tag.
# We assume branch names are in the form "pre-master-X" or "pre-master-X.Y"
# Extract the version number, sort them, and then pick the first branch with a version > latest_version.
branch_version=$(git branch -r | \
  grep -Eo 'pre-master-[0-9]+(\.[0-9]+)?' | \
  sed -E 's/.*pre-master-([0-9]+(\.[0-9]+)?)/\1/' | \
  sort -V | \
  awk -v latest="$latest_version" '{ if ($1+0 > latest+0) { print $1; exit } }')

if [ -n "$branch_version" ]; then
  echo "build: Branch with higher version: pre-master-$branch_version"
else
  echo "build: No branch found with a version higher than $latest_version"
  exit 1
fi

############################################

echo -e "\n"
echo "build: Running build requested is: $VERSION"

if [ "$VERSION" == "next" ]; then
  echo "build: Checking out the branch pre-master-$branch_version"
  git checkout "pre-master-$branch_version" || { echo "build: Checkout failed, stopping execution"; exit 1; }
else
  echo "build: Checking out the master branch for version $latest_version"
fi

############################################

echo -e "\n"
echo "build: Applying hicum2 removal patch"

cp /hicum2_patch.sh ./hicum2_patch.sh
./hicum2_patch.sh || { echo "build: hicum2 patch failed, stopping execution"; exit 1; }

############################################

echo -e "\n"
echo "build: Applying patches..."
echo "build: Branch name is $(git branch --show-current)"


#https://www.cyberciti.biz/faq/how-to-use-sed-to-find-and-replace-text-in-files-in-linux-unix-shell/
#https://sourceforge.net/p/ngspice/patches/99/
sed -i 's/-Wno-unused-but-set-variable/-Wno-unused-const-variable/g' ./configure.ac
sed -i 's/AC_CHECK_FUNCS(\[time getrusage\])/AC_CHECK_FUNCS(\[time\])/g' ./configure.ac
sed -i 's|#include "ngspice/ngspice.h"|#include <emscripten.h>\n\nEM_ASYNC_JS(void, eesim_sleep_hack, (), {\n    if (Module["handleThings"]) {\n        await new Promise((resolve) => {\n            Module["handleThings"]();\n        });\n    }\n});\n\n#include "ngspice/ngspice.h"|g' ./src/frontend/control.c
sed -i 's|freewl = wlist = getcommand(string);|eesim_sleep_hack();\n\n\t\tfreewl = wlist = getcommand(string);|g' ./src/frontend/control.c


############################################

echo -e "\n"
echo "build: Building ngspice..."

./autogen.sh
mkdir release
cd release

emconfigure ../configure --disable-debug --disable-openmp --disable-osdi --without-x -with-readline=no
wait

# cmpp is a build-time generator used by XSPICE. If it is built with
# Emscripten it cannot read the host source tree paths used below.
make -C src/xspice/cmpp CC=gcc CFLAGS="-O2" LDFLAGS="" LIBS="" ifs_yacc.c mod_yacc.c cmpp || { echo "build: Native cmpp build failed, stopping execution"; exit 1; }

echo "build: Building static XSPICE code models..."
emmake make -C src/xspice/icm > /tmp/xspice-icm-build.log 2>&1 || { echo "build: XSPICE code model build failed, stopping execution"; tail -200 /tmp/xspice-icm-build.log; exit 1; }

cat > src/xspice/icm/eecircuit_static_icm.c <<'EOF'
#include <stdarg.h>
#include <stdio.h>

#include "ngspice/devdefs.h"
#include "ngspice/cmtypes.h"
#include "ngspice/evtudn.h"
#include "ngspice/inertial.h"

int add_device(int n, SPICEdev **devs, int flag);
int add_udn(int n, Evt_Udn_Info_t **udns);

FILE *fopen_with_path(const char *path, const char *mode) {
  return fopen(path, mode);
}

int cm_message_printf(const char *fmt, ...) {
  int result;
  va_list args;

  va_start(args, fmt);
  result = vfprintf(stderr, fmt, args);
  va_end(args);
  fputc('\n', stderr);

  return result;
}

Mif_Boolean_t cm_is_inertial(enum param_vals param) {
  if (param == Not_set) {
    return 1;
  }
  return param == On ? 1 : 0;
}

#include "spice2poly/cmextrn.h"
#include "spice2poly/udnextrn.h"
SPICEdev *eecircuit_spice2poly_devices[] = {
#include "spice2poly/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_spice2poly_udns[] = {
#include "spice2poly/udninfo.h"
  NULL
};
int eecircuit_spice2poly_device_count = sizeof(eecircuit_spice2poly_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_spice2poly_udn_count = sizeof(eecircuit_spice2poly_udns) / sizeof(Evt_Udn_Info_t *) - 1;

#include "digital/cmextrn.h"
#include "digital/udnextrn.h"
SPICEdev *eecircuit_digital_devices[] = {
#include "digital/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_digital_udns[] = {
#include "digital/udninfo.h"
  NULL
};
int eecircuit_digital_device_count = sizeof(eecircuit_digital_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_digital_udn_count = sizeof(eecircuit_digital_udns) / sizeof(Evt_Udn_Info_t *) - 1;

#include "analog/cmextrn.h"
#include "analog/udnextrn.h"
SPICEdev *eecircuit_analog_devices[] = {
#include "analog/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_analog_udns[] = {
#include "analog/udninfo.h"
  NULL
};
int eecircuit_analog_device_count = sizeof(eecircuit_analog_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_analog_udn_count = sizeof(eecircuit_analog_udns) / sizeof(Evt_Udn_Info_t *) - 1;

#include "xtradev/cmextrn.h"
#include "xtradev/udnextrn.h"
SPICEdev *eecircuit_xtradev_devices[] = {
#include "xtradev/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_xtradev_udns[] = {
#include "xtradev/udninfo.h"
  NULL
};
int eecircuit_xtradev_device_count = sizeof(eecircuit_xtradev_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_xtradev_udn_count = sizeof(eecircuit_xtradev_udns) / sizeof(Evt_Udn_Info_t *) - 1;

#include "xtraevt/cmextrn.h"
#include "xtraevt/udnextrn.h"
SPICEdev *eecircuit_xtraevt_devices[] = {
#include "xtraevt/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_xtraevt_udns[] = {
#include "xtraevt/udninfo.h"
  NULL
};
int eecircuit_xtraevt_device_count = sizeof(eecircuit_xtraevt_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_xtraevt_udn_count = sizeof(eecircuit_xtraevt_udns) / sizeof(Evt_Udn_Info_t *) - 1;

#include "table/cmextrn.h"
#include "table/udnextrn.h"
SPICEdev *eecircuit_table_devices[] = {
#include "table/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_table_udns[] = {
#include "table/udninfo.h"
  NULL
};
int eecircuit_table_device_count = sizeof(eecircuit_table_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_table_udn_count = sizeof(eecircuit_table_udns) / sizeof(Evt_Udn_Info_t *) - 1;

#include "tlines/cmextrn.h"
#include "tlines/udnextrn.h"
SPICEdev *eecircuit_tlines_devices[] = {
#include "tlines/cminfo.h"
  NULL
};
Evt_Udn_Info_t *eecircuit_tlines_udns[] = {
#include "tlines/udninfo.h"
  NULL
};
int eecircuit_tlines_device_count = sizeof(eecircuit_tlines_devices) / sizeof(SPICEdev *) - 1;
int eecircuit_tlines_udn_count = sizeof(eecircuit_tlines_udns) / sizeof(Evt_Udn_Info_t *) - 1;

static void register_code_model_set(
  int device_count,
  SPICEdev **devices,
  int udn_count,
  Evt_Udn_Info_t **udns
) {
  if (device_count > 0) {
    add_device(device_count, devices, 1);
  }
  if (udn_count > 0) {
    add_udn(udn_count, udns);
  }
}

int eecircuit_register_static_xspice_icm(void) {
  register_code_model_set(eecircuit_spice2poly_device_count, eecircuit_spice2poly_devices, eecircuit_spice2poly_udn_count, eecircuit_spice2poly_udns);
  register_code_model_set(eecircuit_digital_device_count, eecircuit_digital_devices, eecircuit_digital_udn_count, eecircuit_digital_udns);
  register_code_model_set(eecircuit_analog_device_count, eecircuit_analog_devices, eecircuit_analog_udn_count, eecircuit_analog_udns);
  register_code_model_set(eecircuit_xtradev_device_count, eecircuit_xtradev_devices, eecircuit_xtradev_udn_count, eecircuit_xtradev_udns);
  register_code_model_set(eecircuit_xtraevt_device_count, eecircuit_xtraevt_devices, eecircuit_xtraevt_udn_count, eecircuit_xtraevt_udns);
  register_code_model_set(eecircuit_table_device_count, eecircuit_table_devices, eecircuit_table_udn_count, eecircuit_table_udns);
  register_code_model_set(eecircuit_tlines_device_count, eecircuit_tlines_devices, eecircuit_tlines_udn_count, eecircuit_tlines_udns);
  return 0;
}
EOF

emcc \
  -I./src/include \
  -I../src/include \
  -I./src/xspice/icm \
  -O2 \
  -c ./src/xspice/icm/eecircuit_static_icm.c \
  -o ./src/xspice/icm/eecircuit_static_icm.o || { echo "build: Static XSPICE registry build failed, stopping execution"; exit 1; }
echo "build: Static XSPICE registry symbols:"
NM_TOOL="$(command -v "${NM:-llvm-nm}" || command -v llvm-nm-19)"
"$NM_TOOL" ./src/xspice/icm/eecircuit_static_icm.o | grep -E 'eecircuit_register_static_xspice_icm|fopen_with_path|cm_message_printf|cm_is_inertial' || { echo "build: Static XSPICE registry symbols missing, stopping execution"; exit 1; }

sed -i '/extern struct coreInfo_t  coreInfo;/a int eecircuit_register_static_xspice_icm(void);' ../src/spicelib/devices/dev.c
sed -i '/DEVices\[i\] = static_devices\[i\]();/a\\#ifdef XSPICE\n    eecircuit_register_static_xspice_icm();\n#endif' ../src/spicelib/devices/dev.c

STATIC_ICM_OBJECTS="$(cd src && find xspice/icm -type f \( -name 'cfunc.o' -o -name 'ifspec.o' -o -name 'udnfunc.o' \) -print | sort | tr '\n' ' ')"
STATIC_ICM_OBJECTS="xspice/icm/eecircuit_static_icm.o xspice/icm/dstring.o xspice/icm/tline_common.o xspice/icm/msline_common.o $STATIC_ICM_OBJECTS"
WASM_LINK_FLAGS='-O2 -s ASYNCIFY=1 -s ASYNCIFY_ADVISE=0 -s ASYNCIFY_IGNORE_INDIRECT=0 -s ENVIRONMENT="web,worker" -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORTED_RUNTIME_METHODS=["FS","Asyncify","callMain"] --pre-js /mnt/pre.js -o spice.mjs'

# ngspice$(EXEEXT)
sed -i '/$(ngspice_LINK) $(ngspice_OBJECTS)/s|$(LIBS)|'"$STATIC_ICM_OBJECTS"' $(LIBS) '"$WASM_LINK_FLAGS"'|' ./src/Makefile
grep -q 'spice.mjs' ./src/Makefile || { echo "build: ngspice wasm link patch failed, stopping execution"; exit 1; }

emmake make -j || { echo "build: Make failed, stopping execution"; exit 1; }
#emmake make 2>&1 | tee make.log

wait

############################################

echo -e "\n"
echo "build: Copying the build artifacts..."

cd src
mv spice.mjs spice.js
mkdir -p /mnt/build
\cp spice.js spice.wasm /mnt/build

echo "build: Build artifacts are copied to /mnt/build"

############################################

echo -e "\n"
echo -e "build: Docker script is ended\n"
