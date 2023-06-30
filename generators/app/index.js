const Generator = require('yeoman-generator');
const path = require('path');
const chalk = require('chalk');

function camelCase(str) {
    // https://stackoverflow.com/a/2970667
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
        if (+match === 0) return "";
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

module.exports = class extends Generator {
    initializing() {
        const turbowarp = chalk.hex('#ff4c4c');
        this.log('Welcome, to the '+turbowarp.bold('TurboWarp Extension')+' Generator.');
    }

    async prompting() {
        const {extName} = await this.prompt([
            { name: 'extName', message: 'Extension name:', default:this.appname }
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
            { name: 'newFolder', message: `Create in new folder?`, type:'expand', choices: [
                { key: 'y', name: `Create a new folder (${extName}).`, value: true, short: 'Yes' },
                { key: 'n', name: 'Populate current folder', value: false, short: 'No' }
            ], default: 0 }
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

        //NOTE maybe have support for other editors
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
                    { extName: this.extName } //ERROR extname can contain spaces, maybe just replace with -'s
                );
            }
        }
        const className = camelCase(this.extName);
        if (this.language == 'js') {
            this.fs.copyTpl(
                this.templatePath('js', 'extension.js'),
                this.destinationPath('extension.js'),
                { className, extName:this.extName, extId: this.extId }
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
                    { className, extName:this.extName, extId: this.extId }
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

    async end() {
        const {openCode} = await this.prompt([
            { name:'openCode', message: 'Open in VSCode', type:'confirm', default:true }
        ]);
        if (openCode) {
            this.spawnCommand('code', [this.destinationPath()]);
        }
    }
};