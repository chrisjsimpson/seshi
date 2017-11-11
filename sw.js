this.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('v1').then(function(cache) {
      return cache.addAll([
        '/',
        '/?utm_source=homescreen',
        '/js/jquery.min.js',
        '/js/clipboard.min.js',
        '/Dexie.js',
        '/adapter.js',
        '/boxHandling.js',
        '/clientXHRSignalingChannel.js',
        '/databaseSchema.js',
        '/ui/progress.js',
        '/ui/ui/main.min.js',
        '/styles/main.css',
        '/js/Seshi.js',
        '/js/SeshiSkin.js',
        '/js/media-player.js',
        '/js/plyr/plyr.js',
        '/js/vendor/modernizr-2.8.3-respond-1.4.2.min.js',
        '/js/vendor/xss.js',
        '/js/workers/getLocalFilesList.js',
        '/js/workers/core.js',
        '/js/workers/md5.js',
        '/js/workers/sha1.js',
        '/js/workers/sha256.js',
        '/js/workers/workerConfig.js',
        '/js/workers/storeFileDexieWorker.js',
        '/img/image.css',
        '/img/addfile.png',
        '/img/addfile.png',
        '/img/landingtab.png',
        '/img/multidevice2.png',
        '/img/newlandingpage.jpg',
        '/img/polygon.jpg',
        '/img/seshilongbeta.png',
        '/img/seshilongbetablue.png',
        '/custom-icon/flaticon.css',
        '/96x96.png',
        '/512x512.png'
      ]);
    })
  );
});

this.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
