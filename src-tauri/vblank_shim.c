/*
 * Brise Vblank-Shim für WebKitGTK auf NVIDIA/Wayland.
 *
 * WebKitGTK holt den Monitor-Takt über drmWaitVBlank(). Der nvidia-drm-Knoten
 * beantwortet DRM_IOCTL_WAIT_VBLANK mit EOPNOTSUPP; WebKit fällt dann auf einen
 * festen 60-Hz-Timer zurück und scrollt trotz 180-Hz-Monitor nur mit 60 fps.
 * Dieser Shim wird nur in den Brise-Prozess geladen. Er lässt drmWaitVBlank()
 * normal laufen und greift nur ein, wenn der Treiber die Anfrage ablehnt.
 * Dann liefert er einen synchronen Vblank im Takt von BRISE_REFRESH_HZ.
 *
 * Lizenz: MIT wie der Rest des Projekts. Keine Netzwerkfunktion, kein
 * Tracking, kein persistenter Zustand.
 */

#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <xf86drm.h>

typedef int (*drm_wait_vblank_fn)(int, drmVBlankPtr);

static drm_wait_vblank_fn real_drm_wait_vblank(void) {
  static drm_wait_vblank_fn fn = NULL;
  if (!fn) fn = (drm_wait_vblank_fn)dlsym(RTLD_NEXT, "drmWaitVBlank");
  return fn;
}

static uint64_t monotonic_ns(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (uint64_t)ts.tv_sec * 1000000000ULL + (uint64_t)ts.tv_nsec;
}

static unsigned int refresh_hz(void) {
  static unsigned int hz = 0;
  if (hz == 0) {
    const char *value = getenv("BRISE_REFRESH_HZ");
    long parsed = value ? strtol(value, NULL, 10) : 0;
    if (parsed < 30 || parsed > 360) parsed = 180;
    hz = (unsigned int)parsed;
  }
  return hz;
}

int drmWaitVBlank(int fd, drmVBlankPtr vbl) {
  static uint64_t sequence = 0;
  static int debug = -1;
  drm_wait_vblank_fn real = real_drm_wait_vblank();
  int rc = -1;

  if (real) {
    rc = real(fd, vbl);
    if (rc == 0) return 0;
    if (errno != EOPNOTSUPP && errno != ENOTSUP) return rc;
  }

  if (debug < 0) debug = getenv("BRISE_VBLANK_DEBUG") != NULL;

  const uint64_t period = 1000000000ULL / refresh_hz();
  const uint64_t now = monotonic_ns();
  const uint64_t next = ((now / period) + 1) * period;
  struct timespec target = {
    .tv_sec = (time_t)(next / 1000000000ULL),
    .tv_nsec = (long)(next % 1000000000ULL),
  };
  while (clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &target, NULL) == EINTR) {
    /* weiter warten */
  }

  if (vbl) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    vbl->reply.type = vbl->request.type;
    vbl->reply.sequence = (unsigned int)++sequence;
    vbl->reply.tval_sec = (long)ts.tv_sec;
    vbl->reply.tval_usec = (long)(ts.tv_nsec / 1000);
  }

  if (debug) {
    fprintf(stderr, "BRISE-VBLANK fd=%d type=0x%x seq=%u hz=%u driver=%d\n",
            fd, vbl ? (unsigned int)vbl->request.type : 0u,
            vbl ? vbl->reply.sequence : 0u, refresh_hz(), rc);
  }
  return 0;
}
