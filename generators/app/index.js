const Generator = require('yeoman-generator');
const path = require('path');

module.exports = class extends Generator {
    constructor(args, opts) {
        super(args, opts);
        this.description = 'Generator for Turbowarp extensions.';
    }
    initializing() {
    }

    async prompting() {
        const {extName} = await this.prompt([
            { name: 'extName', message: 'Extension name:', default:this.appname,
            filter(txt) {
                return txt.replaceAll(' ','');
            } }
        ]);
        this.extName = extName;
        const {extId} = await this.prompt([
            { name: 'extId', message: 'Extension Id:', default:extName.toLowerCase().match(/[a-z0-9]/g).join(''),
            validate(txt) {
                const res = txt.match(/[a-z0-9]/g);
                if (res && res.join('') == txt) return true;
                return `Only a-z and 0-9 (no uppercase letters or special characters)`;
            } }
        ] );
        this.extId = extId;
        const {newFolder} = await this.prompt([
            // { name: 'newFolder', message: `Create in new Folder? (${extName})`, type:'confirm', default:true }
            { name: 'newFolder', message: `Create in new folder?`, type:'expand', choices: [
                { key: 'y', name: `Create a new folder (${extName}).`, value: true, short: 'Yes' },
                { key: 'n', name: 'Populate current folder', value: false, short: 'No' }
            ]}
            //TODO set default value
        ]);
        this.newFolder = newFolder;

        const {language} = await this.prompt([
            { name: 'language', type: 'list', choices: [
                { name: 'javascript', value: 'js' },
                { name: 'typescript (node project compiled to js)', value: 'ts' }   
            ] }
        ]);
        this.language = language;
        if (language == 'ts') {
            const {srcPath} = await this.prompt([
                { name: 'srcPath', message: 'What path to src files?', default:'src' }
            ]);
            this.srcPath = srcPath;
        }

        const vscodeChoices = [
            { name: 'Launch dev browser', value: 'browser' },
            { name: 'Run dev HTTP server on startup', value: 'httpserver' }
            //NOTE maybe add 'hide unnecessary files' option (settings.json:explorer.exclude)
        ];
        if (language == 'ts') vscodeChoices.push({ name: 'Run typescript compiler on startup', value: 'tsc' });
        const {vscodeInit} = await this.prompt([
            { name: 'vscodeInit' , message: 'Initialize vscode dev env?', type:'checkbox', choices: vscodeChoices,
            filter(ans) {
                return Object.fromEntries(ans.map(k => [k,true]))
            } }
        ]);
        this.vscodeInit = vscodeInit;
        if (vscodeInit['browser']) {
            const {browserType} = await this.prompt([
                { name: 'browserType', message: 'What browser to use?', type:'list', choices: [
                    { name: 'Chrome', value: 'chrome' },
                    { name: 'Edge', value: 'msedge' }
                ] }
            ]);
            this.browserType = browserType;
        }
        if (vscodeInit['httpserver']) {
            const {serverType} = await this.prompt([
                { name: 'serverType', message: 'What http server to use?', type:'list', choices: [
                    { name: 'Python http.server', value: 'py' },
                    { name: 'Node express server', value: 'express' }
                ]}
            ]);
            this.httpServerType = serverType;
        }
        if (vscodeInit['httpserver'] || vscodeInit['browser']) {
            const {devPort} = await this.prompt([
                { name: 'devPort' , message: 'Dev Http port:', default: '5010' }
            ]);
            this.devPort = devPort;
        }

        this.usesPkgManager = language == 'ts' || (vscodeInit['httpserver'] && this.httpServerType=='express');

        if (this.usesPkgManager) {
            const {pkgManager} = await this.prompt([
                { name: 'pkgManager', message: 'What package manager to use?', type: 'list', choices: [
                    'npm'
                ]}
            ]);
            this.pkgManager = pkgManager;
        }
    }

    configuring () {
        if (this.newFolder) {
            this.destinationRoot(path.resolve(this.destinationPath(), this.extName));
        }
    }

    writing() {
        if (this.vscodeInit['httpserver'] || this.vscodeInit['tsc']) {
            const content = this.fs.readJSON(this.templatePath('vscode', 'tasks.json'));
            if (this.vscodeInit['httpserver']) {
                if (this.httpServerType == 'py') {
                    content.tasks.push(
                        JSON.parse(this.fs.read(
                            this.templatePath('vscode', 'http-python-task.json')
                        ).replaceAll('<%= devPort %>', this.devPort))
                    );
                } else if (this.httpServerType == 'express') {
                    content.tasks.push(this.fs.readJSON(
                        this.templatePath('vscode', 'http-express-task.json')
                    ));
                    this.fs.copyTpl(
                        this.templatePath('server.js'),
                        this.destinationPath('server.js'),
                        { devPort: this.devPort }
                    );
                }
            }
            if (this.vscodeInit['tsc']) {
                content.tasks.push(
                    this.fs.readJSON(this.templatePath('vscode', 'tsc-task.json'))
                );
            }
            this.fs.writeJSON(
                this.destinationPath('.vscode', 'tasks.json'),
                content
            );
        }
        if (this.vscodeInit['browser']) {
            this.fs.copyTpl(
                this.templatePath('vscode', 'browser-launch.json'),
                this.destinationPath('.vscode', 'launch.json'),
                { devPort: this.devPort, browserType:this.browserType }
            );
        }
        if (this.usesPkgManager) {
            if (this.pkgManager == 'npm') {
                this.fs.copyTpl(
                    this.templatePath('package.json'),
                    this.destinationPath('package.json'),
                    { extName: this.extName }
                );
            }
        }
        if (this.language == 'js') {
            this.fs.copyTpl(
                this.templatePath('js', 'extension.js'),
                this.destinationPath('extension.js'),
                { extName: this.extName, extId: this.extId }
            );
        } else if (this.language == 'ts') {
            if (this.pkgManager == 'npm') {
                this.fs.copyTpl(
                    this.templatePath('ts', 'tsconfig.json'),
                    this.destinationPath('tsconfig.json'),
                    { srcPath: this.srcPath }
                );
                this.fs.copyTpl(
                    this.templatePath('ts', 'main.ts'),
                    this.destinationPath(this.srcPath, 'main.ts'),
                    { extName: this.extName, extId: this.extId }
                );
            }
        }
    }

    install() {
        if (this.language == 'ts') {
            if (this.pkgManager == 'npm') {
                this.spawnCommand('npm', ['install', 'typescript', '@turbowarp/types', '-y', '--quiet']);
            }
        }
        if (this.vscodeInit['httpserver'] && this.httpServerType == 'express') {
            if (this.pkgManager=='npm') {
                this.spawnCommand('npm', ['install', 'express', '-y', '--quiet']);
            }
        }
    }
};