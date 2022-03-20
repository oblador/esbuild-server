(() => {
  if ('EventSource' in window) {
    const source = new EventSource('/esbuild-livereload');
    let building = false;
    source.addEventListener(
      'message',
      (e) => {
        const event = JSON.parse(e.data);
        switch (event.type) {
          case 'build-start':
            console.log('Build started');
            building = true;
            break;
          case 'build-end':
            if (event.success) {
              console.log(
                `Build completed in ${event.duration}ms${
                  building ? ', reloading...' : ''
                }`
              );
              if (building) {
                window.location.reload();
              }
            } else {
              console.log('Build failed');
            }
            building = false;
            break;
        }
      },
      false
    );
  }
})();
