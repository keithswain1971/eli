(function () {
    // 1. Config
    const currentScript = document.currentScript;
    const baseUrl = currentScript.getAttribute('data-eli-url') || 'http://localhost:3000'; // Fallback for local dev
    const context = currentScript.getAttribute('data-context') || '';

    // 2. Create Iframe container
    const iframeId = 'eli-widget-iframe';
    const iframeUrl = `${baseUrl}/embed?context=${encodeURIComponent(context)}`;

    // Prevent duplicates
    if (document.getElementById(iframeId)) return;

    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.src = iframeUrl;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style.right = '20px';
    iframe.style.width = '80px';
    iframe.style.height = '80px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '2147483647'; // Max z-index
    iframe.style.transition = 'width 0.3s ease, height 0.3s ease, bottom 0.3s ease, right 0.3s ease';
    iframe.style.boxShadow = 'none';
    iframe.style.borderRadius = '12px'; // Optional: matches the widget radius if needed

    // Mobile handling
    const isMobile = () => window.innerWidth < 640;

    document.body.appendChild(iframe);

    // 3. Listen for Resize Messages
    window.addEventListener('message', (event) => {
        // Security check: ensure message is from our eli url
        // (Loose check for now to support localhost/production switching)
        if (!event.origin.includes(baseUrl.replace(/^https?:\/\//, '').split(':')[0])) {
            // Optional: strict origin check
        }

        const { type, payload } = event.data;

        if (type === 'ELI_RESIZE') {
            if (payload.isOpen) {
                if (isMobile()) {
                    // Full screen on mobile
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.bottom = '0';
                    iframe.style.right = '0';
                    iframe.style.borderRadius = '0';
                } else {
                    // Desktop size
                    iframe.style.width = '400px';
                    iframe.style.height = '620px';
                    iframe.style.bottom = '20px';
                    iframe.style.right = '20px';
                    iframe.style.borderRadius = '16px'; // Nice rounded corners
                    iframe.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
                }
            } else {
                // Closed state (Launcher only)
                iframe.style.width = '80px';
                iframe.style.height = '80px';
                iframe.style.bottom = '20px';
                iframe.style.right = '20px';
                iframe.style.borderRadius = '50%'; // Rounded for the bubble
                iframe.style.boxShadow = 'none';
            }
        }
    });

    // 4. Handle Window Resize (switch between mobile/desktop modes if open)
    let currentIsOpen = false;
    window.addEventListener('message', (e) => {
        if (e.data.type === 'ELI_RESIZE') {
            currentIsOpen = e.data.payload.isOpen;
        }
    });

    window.addEventListener('resize', () => {
        if (currentIsOpen) {
            if (isMobile()) {
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.bottom = '0';
                iframe.style.right = '0';
                iframe.style.borderRadius = '0';
            } else {
                iframe.style.width = '400px';
                iframe.style.height = '620px';
                iframe.style.bottom = '20px';
                iframe.style.right = '20px';
                iframe.style.borderRadius = '16px';
            }
        }
    });

})();
