(function () {
    /* global RED, $ */
    // Favicon and menu items; runtimeSettings.js omits this script for non-FlowFuse (OEM) themes. Uses helpers from forge-platform.js.
    function changeFavicon (src) {
        const link = document.createElement('link')
        const oldLink = $('link[href="favicon.ico"]')[0] || $('#dynamic-favicon')[0]
        link.id = 'dynamic-favicon'
        link.rel = 'shortcut icon'
        link.href = src
        if (oldLink) {
            document.head.removeChild(oldLink)
        }
        document.head.appendChild(link)
    }

    window.addEventListener('load', (_event) => {
        const favicon32 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADzUlEQVR4AcXB206UVxzG4d+71jcbBmYGpjJIg2iHiNYEJaSKrQe4QeMNcOaR11BP2wuwV2JvQSMkxFAiGk1Q8UCjAoJsAkgRZuZb/wJtk6YtuEN4Ht3o7f0B+AXoBhy7w4Bh4FoEXAe+Z3cJ6AauO+Ake+c7B0TsHe/YY44495thjjj0WsdvMMNaZsSHiC7MQwAwkXBSZT6eJ0ml8MmlyziK+ADODEPDJpNU0N1t9qUT94cPkWlvJNDaSzGbxqZTkHBE7yOIYeU/d/v2h2NVFc3c3De3tShcKOO/Ffynic5lhIRDV1FjhyBFr6emh+dQpMk1NTs7xPhGfyEJgQyqft6auLjt48SL7OjqUyGTER4j4CBYCmOGiyOpaWqz59GlrPXdO9W1tcomEeB8z4nLZqqurhEoFC4HI4pgtSWyQc/h02moKBWtob2f/yZNW7OxUTWOjl8R24nLZlicnbe7RI+bHxmx5fFxri4vE5bIsBKJvr1wxzLAQYlsnkLx38t58MkmUTiuZy1Hb1ERtc7PSDQ3Ie8d2zHg3N2dTd++GicFBzY+NaW1hQRbHbJLYJBF1XL3q+FPEZ7I4tsUXL+xVf79NDA7q7fi4s2pVcg4k5D3/FrEDQqVibx48CC9v3tTUyIhW5+cd6+Qc8p7tOHZAqFRs8flz5p8+ZW1hQZghiQ8RsQOiTMYd6evj4IUL9np4OLy8dYu5x49VXVkRziGJrUTjAwO2KYQYEOvknJP35hMJ+XSaVD5PuqFByWwWeS+2kC4U9M3lyzrQ02Ozo6M2PjAQpu/d08rMjKxaFRKS2CSxQb9euhTMTJgZGyQEQjIknPf4VIp0Q4PlDh2i8cQJKx4/rrqWFrkoEtuwEOz36WmbffjQ3ty/r4Vnz1hbWFB1dZVQrWIhoBu9vQEQ2zHDzMAMOUe6ULB9HR124OxZip2dSmaz4j0sBKssL7O2tGSVt2+prKwQl8tEfAgJSfzt3fy8Xt2+rck7d6y+rc1az5+3r8+cobZYdEj8HzmnZC5HMpcT/+D7SqWfAPERJCHnsBC0MjOj6ZERvR4asnczMyFRV0cqn0feiw/g+0qlnwHxiSSxYW1xUbOjo25icJD5J08slMuWqKsjUVODnBNbiNghco4N5aUlTQwOanJoyGqLRQpHj9pXx46FfKmkTLFIMpuVT6Vw3oNzROw0CXkPZlqemmJ5clIv+/uJUilLZrOk8nlL5nJEmQw+kSACYsDxBUgC79kQl8tamZ1lZWZGmPGX2AHD7BJJyDnkPfIeeX/XAdeAO0Bg9wTgN+DHPwAIHJAeMJ00fgAAAABJRU5ErkJggg=='
        changeFavicon(favicon32)

        const ff = window.FlowFuse || {}

        const addMenuItems = function () {
            if (!RED || document.querySelector('#usermenu-item-ffsite')) { return }
            const settings = (RED.settings && RED.settings['flowfuse-common']) || {}

            RED.menu.addItem('red-ui-header-button-sidemenu', null) // menu seperator
            RED.menu.addItem('red-ui-header-button-sidemenu', {
                id: 'usermenu-item-ffsite',
                label: 'About FlowFuse',
                onselect: function () {
                    ff.navigateTo('https://flowfuse.com/')
                }
            })
            const projectURL = ff.getProjectURL ? ff.getProjectURL() : ''
            if (projectURL) {
                RED.menu.addItem('red-ui-header-button-sidemenu', {
                    id: 'usermenu-item-ffmain',
                    label: 'FlowFuse Application',
                    onselect: function () {
                        ff.navigateTo(projectURL)
                    }
                })
            }
            if (settings.launcherVersion) {
                RED.menu.addItem('red-ui-header-button-sidemenu', {
                    id: 'usermenu-item-fflv',
                    label: 'FlowFuse Launcher v' + settings.launcherVersion,
                    onselect: function () {
                        // do nothing
                    }
                })
            }
        }

        // Add now if the menu button already exists; otherwise add it once Node-RED inserts it.
        if (document.querySelector('#red-ui-header-button-sidemenu')) {
            addMenuItems()
        } else {
            const observer = new MutationObserver(function () {
                if (document.querySelector('#red-ui-header-button-sidemenu')) {
                    observer.disconnect()
                    addMenuItems()
                }
            })
            observer.observe(document.querySelector('#red-ui-header') || document.body, { childList: true, subtree: true })
            setTimeout(function () { observer.disconnect() }, 30000)
        }
    })
})()
