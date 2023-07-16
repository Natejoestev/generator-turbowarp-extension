
interface extensionConfig {
    extName: String,
    extId: String,
    newFolder: Boolean,
    gitInit: Boolean,
    lang: 'ts'|'js',
    srcPath: String|undefined,
    devEnv: {
        typ: 'vscode'|'runcli',
        init: {
            "browser": true|undefined,
            "httpserver": true|undefined,
            "tsc": true|undefined
        },
        browserType: String|undefined,
        serverType: String|undefined
    },
    expressServer: Boolean|undefined,
    devPort: String|undefined,
    pkgManager: 'npm'
}