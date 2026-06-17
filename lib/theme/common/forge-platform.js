(function () {
    /* global RED, $ */
    // Navigation interception and iframe messaging; loaded via editorTheme.page.scripts so it runs regardless of active theme.
    const context = {
        isEmbedded: window.parent !== window.self,
        shouldEmitInsteadOfRedirect: false
    }
    const navigateTo = (url) => {
        if (context.shouldEmitInsteadOfRedirect) {
            window.parent.postMessage({
                type: 'navigate',
                payload: url
            }, '*')
        } else {
            window.location = url
        }
    }
    // falls back to the project link in the header when flowfuse-common settings are absent
    const getProjectURL = () => {
        const settings = (typeof RED !== 'undefined' && RED.settings && RED.settings['flowfuse-common']) || {}
        if (settings.projectURL) {
            return settings.projectURL
        }
        const img = $('#red-ui-header > span > a > img')
        const ownerHref = img.parent().prop('href')
        if (ownerHref && /http[s]*:\/\/.*\/project\/\w+-\w+-\w+-\w+-\w+.*/.test(ownerHref)) {
            return ownerHref
        }
        return ''
    }
    document.addEventListener('click', (e) => {
        if (e.target.closest('#usermenu-item-logout')) {
            e.preventDefault()
            e.stopPropagation()
            if (context.shouldEmitInsteadOfRedirect) {
                window.parent.postMessage({ type: 'logout' }, '*')
            }
            return
        }
        if (e.target.closest('.red-ui-header-logo a')) {
            e.preventDefault()
            navigateTo(getProjectURL())
        }
    }, true)

    function handleMessage (event) {
        if (event.data && event.data.type === 'prevent-redirect') {
            context.shouldEmitInsteadOfRedirect = event.data.payload
        }
    }

    if (context.isEmbedded) {
        window.parent.postMessage({ type: 'load', payload: true }, '*')
        window.addEventListener('message', handleMessage)
    }

    // shared with forge-branding.js
    window.FlowFuse = Object.assign(window.FlowFuse || {}, { navigateTo, getProjectURL })
})()
